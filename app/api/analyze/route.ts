import { NextRequest, NextResponse } from 'next/server';
import { GROK_SYSTEM_PROMPT } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const { input, context } = await req.json();

    if (!input || !input.tasks || !input.today) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        generateFallbackAnalysis(input),
        { status: 200 }
      );
    }

    const userMessage = `Here is today's data. Analyze it and return the JSON response.

USER: ${JSON.stringify(input.user)}
TODAY: ${JSON.stringify(input.today)}
TASKS: ${JSON.stringify(input.tasks)}
DEAD ZONE SETTINGS: ${JSON.stringify(input.deadZoneSettings)}
CURRENT TIME: ${input.currentTime} IST
CONSTRAINTS: ${JSON.stringify(input.constraints)}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: GROK_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return NextResponse.json(
        generateFallbackAnalysis(input),
        { status: 200 }
      );
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      return NextResponse.json(
        generateFallbackAnalysis(input),
        { status: 200 }
      );
    }

    // Extract JSON block — model may include reasoning text before the JSON
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const cleaned = jsonMatch ? jsonMatch[1].trim() : content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    // Enforce label thresholds — don't trust the model's label
    const pct = result.dayLoadPercent ?? 0;
    result.dayLoadLabel =
      pct <= 60 ? 'CLEAR' : pct <= 85 ? 'TIGHT' : pct <= 100 ? 'LOADED' : 'OVERLOADED';

    // Fix #5: Remove overflow tasks that are already in the schedule
    if (result.schedule && result.overflow) {
      const scheduledIds = new Set(result.schedule.map((b: any) => b.id));
      result.overflow = result.overflow.filter((o: any) => !scheduledIds.has(o.id));
      result.stats.tasksOverflow = result.overflow.length;
    }

    // Fix #7: Fill timeline gaps with labeled buffer blocks
    if (result.schedule) {
      result.schedule = fillTimelineGaps(result.schedule, input.user.wakeTime, input.user.sleepTime);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
}

function generateFallbackAnalysis(input: any) {
  const { today, tasks, user } = input;
  const gymBlock = today.fixedBlocks?.find((b: any) => b.type === 'gym');
  const gymRequired = !!gymBlock;
  const gymDuration = gymBlock ? (new Date(`1970-01-01T${gymBlock.end}:00`).getTime() - new Date(`1970-01-01T${gymBlock.start}:00`).getTime()) / 60000 : 75;
  const freeMinutes = today.totalFreeMinutes;
  const freeHours = (freeMinutes / 60).toFixed(1);

  const categoryDurations: Record<string, number> = {
    personal_brand: 60,
    agency_client: 120,
    college: 90,
    health: 75,
    personal: 30,
  };

  let totalTaskMinutes = 0;
  const estimatedTasks = tasks.map((t: any) => ({
    ...t,
    estimatedMinutes: t.estimatedMinutes || categoryDurations[t.category] || 60,
  }));

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const deadlineOrder: Record<string, number> = {
    today: 0, tomorrow: 1, this_week: 2, next_week: 3, two_plus_weeks: 4, none: 5,
  };

  estimatedTasks.sort((a: any, b: any) => {
    const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
    const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
    if (pa !== pb) return pa - pb;
    const da = deadlineOrder[a.deadline] ?? 5;
    const db = deadlineOrder[b.deadline] ?? 5;
    return da - db;
  });

  const schedule: any[] = [];
  const overflow: any[] = [];

  for (const block of today.fixedBlocks) {
    schedule.push({
      id: block.id,
      name: block.name,
      start: block.start,
      end: block.end,
      type: 'fixed',
      category: null,
      estimatedMinutes: timeToMin(block.end) - timeToMin(block.start),
      energyType: null,
      notes: null,
    });
  }

  const windows = [...(today.freeWindows || [])];
  let windowIdx = 0;
  let windowUsed = 0;
  let scheduledCount = 0;

  for (const task of estimatedTasks) {
    const mins = task.estimatedMinutes;
    let placed = false;

    for (let i = 0; i < windows.length; i++) {
      if (windows[i].durationMinutes >= mins + 15) {
        const start = windows[i].start;
        const end = minutesToTimeStr(timeToMin(start) + mins);
        schedule.push({
          id: task.id,
          name: task.name,
          start,
          end,
          type: 'task',
          category: task.category,
          estimatedMinutes: mins,
          energyType: null,
          notes: task.notes,
        });

        schedule.push({
          id: `buffer-${task.id}`,
          name: 'Buffer',
          start: end,
          end: minutesToTimeStr(timeToMin(end) + 15),
          type: 'buffer',
          category: null,
          estimatedMinutes: 15,
          energyType: null,
          notes: null,
        });

        totalTaskMinutes += mins;
        scheduledCount++;
        windows[i] = {
          ...windows[i],
          start: minutesToTimeStr(timeToMin(end) + 15),
          durationMinutes: windows[i].durationMinutes - mins - 15,
        };
        placed = true;
        break;
      }
    }

    if (!placed) {
      overflow.push({
        id: task.id,
        name: task.name,
        reason: `Not enough free time in any available window for ${mins} minutes.`,
        suggestedDay: 'Tomorrow',
      });
    }
  }

  const filledSchedule = fillTimelineGaps(schedule, user.wakeTime, user.sleepTime);

  const loadPercent = Math.min(
    Math.round((totalTaskMinutes / freeMinutes) * 100),
    150
  );
  const label =
    loadPercent <= 60 ? 'CLEAR' :
    loadPercent <= 85 ? 'TIGHT' :
    loadPercent <= 100 ? 'LOADED' : 'OVERLOADED';

  const taskHours = (totalTaskMinutes / 60).toFixed(1);
  let assessment = '';

  if (overflow.length > 0) {
    assessment = `You've packed ${tasks.length} tasks into a day with ${freeHours} hours of actual free time. ${overflow.length} task${overflow.length > 1 ? 's' : ''} won't fit — move ${overflow.map((o: any) => o.name).join(', ')} to tomorrow. Focus on what's scheduled and don't try to squeeze in extras.`;
  } else if (loadPercent > 85) {
    assessment = `Your day is tight — ${taskHours} hours of tasks against ${freeHours} hours free. No room for unexpected work or overruns. If anything takes longer than estimated, something else drops. Stick to the schedule strictly.`;
  } else if (loadPercent > 60) {
    assessment = `Reasonable workload at ${loadPercent}% capacity. You have some breathing room but don't waste it — your high-priority tasks are placed in your best energy windows. Execute in order, don't reshuffle mid-day.`;
  } else {
    assessment = `Light day at ${loadPercent}% capacity. Good opportunity for deep work or getting ahead on upcoming deadlines. Don't fill the space with busywork — use the margin to do fewer things better.`;
  }

  if (today.dayProfile === 'heavy') {
    assessment += ' This is a heavy class day — protect your energy for the blocks you have scheduled.';
  }

  return {
    dayLoadPercent: loadPercent,
    dayLoadLabel: label,
    stats: {
      freeTimeAvailable: `${freeHours} hrs`,
      totalTasksRequested: tasks.length,
      estimatedTaskTime: `${taskHours} hrs`,
      tasksScheduled: scheduledCount,
      tasksOverflow: overflow.length,
    },
    mentorAssessment: assessment,
    schedule: filledSchedule,
    overflow,
    gymScheduled: filledSchedule.some((b: any) => b.type === 'gym'),
    gymSlot: filledSchedule.find((b: any) => b.type === 'gym')
      ? { start: filledSchedule.find((b: any) => b.type === 'gym')!.start, end: filledSchedule.find((b: any) => b.type === 'gym')!.end }
      : null,
    warnings: [],
  };
}

function fillTimelineGaps(schedule: any[], wakeTime: string, sleepTime: string): any[] {
  const sorted = [...schedule]
    .filter((b) => b.type !== 'wake' && b.type !== 'sleep')
    .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));

  const filled: any[] = [];
  const wakeMin = timeToMin(wakeTime);
  const sleepMin = timeToMin(sleepTime);

  filled.push({
    id: 'wake', name: 'Wake up', start: wakeTime, end: wakeTime,
    type: 'wake', category: null, estimatedMinutes: 0, energyType: null, notes: null,
  });

  let cursor = wakeMin;

  for (const block of sorted) {
    const blockStart = timeToMin(block.start);
    if (blockStart > cursor + 29) {
      const gapMin = blockStart - cursor;
      const label = getGapLabel(cursor, blockStart);
      filled.push({
        id: `gap-${cursor}`, name: label, start: minutesToTimeStr(cursor), end: minutesToTimeStr(blockStart),
        type: 'buffer', category: null, estimatedMinutes: gapMin, energyType: null, notes: null,
      });
    }
    filled.push(block);
    cursor = Math.max(cursor, timeToMin(block.end));
  }

  if (sleepMin > cursor + 29) {
    const label = getGapLabel(cursor, sleepMin);
    filled.push({
      id: `gap-${cursor}`, name: label, start: minutesToTimeStr(cursor), end: minutesToTimeStr(sleepMin),
      type: 'buffer', category: null, estimatedMinutes: sleepMin - cursor, energyType: null, notes: null,
    });
  }

  filled.push({
    id: 'sleep', name: 'Wind down & sleep', start: sleepTime, end: sleepTime,
    type: 'sleep', category: null, estimatedMinutes: 0, energyType: null, notes: null,
  });

  return filled;
}

function getGapLabel(startMin: number, endMin: number): string {
  const mid = (startMin + endMin) / 2;
  if (startMin >= 7 * 60 && endMin <= 8 * 60) return 'Morning routine';
  if (mid >= 12 * 60 && mid <= 13.5 * 60) return 'Lunch break';
  if (mid >= 18 * 60 && mid <= 20 * 60) return 'Dinner & rest';
  if (startMin >= 21 * 60) return 'Wind down';
  if (endMin - startMin <= 30) return 'Transit';
  return 'Free block';
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}
