import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '@/lib/constants';
import { timeToMinutes } from '@/lib/schedule';
import { validateAnalysis } from '@/lib/validate';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();

    if (!input || !input.tasks || !input.today) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured', code: 'no_api_key' },
        { status: 500 }
      );
    }

    const userMessage = `Here is today's data. Analyze it and return the JSON response.

USER: ${JSON.stringify(input.user)}
TODAY: ${JSON.stringify(input.today)}
TASKS: ${JSON.stringify(input.tasks)}
DEAD ZONE SETTINGS: ${JSON.stringify(input.deadZoneSettings)}
CURRENT TIME: ${input.currentTime} IST
CONSTRAINTS: ${JSON.stringify(input.constraints)}`;

    let result = await callClaude(apiKey, userMessage);
    if (!result) {
      result = await callClaude(apiKey, userMessage);
      if (!result) {
        return NextResponse.json(
          { error: 'AI is unavailable right now', code: 'ai_unavailable' },
          { status: 502 }
        );
      }
    }

    const nowMin = timeToMin(input.currentTime);
    const validation = validateAnalysis(result, input, nowMin);
    let finalResult = validation.repaired;

    if (!validation.valid) {
      console.warn('Validation violations:', validation.violations);
      const retryMsg = `${userMessage}\n\nYour previous response had these violations — fix them:\n${validation.violations.join('\n')}`;
      const retryResult = await callClaude(apiKey, retryMsg);
      if (retryResult) {
        const retryValidation = validateAnalysis(retryResult, input, nowMin);
        if (retryValidation.valid) {
          finalResult = retryValidation.repaired;
        } else {
          console.warn('Retry still has violations:', retryValidation.violations);
          return NextResponse.json(
            { error: 'Plan has unresolvable violations', code: 'invalid_plan', violations: retryValidation.violations },
            { status: 422 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'AI is unavailable right now', code: 'ai_unavailable' },
          { status: 502 }
        );
      }
    }

    computeScore(finalResult, input, nowMin);
    computeStats(finalResult, input, nowMin);

    if (finalResult.schedule && finalResult.overflow) {
      const scheduledIds = new Set(finalResult.schedule.map((b: any) => b.id));
      finalResult.overflow = finalResult.overflow.filter((o: any) => !scheduledIds.has(o.id));
      finalResult.stats.tasksOverflow = finalResult.overflow.length;
    }

    if (finalResult.schedule) {
      finalResult.schedule = fillTimelineGaps(
        finalResult.schedule,
        input.user.wakeTime,
        input.user.sleepTime
      );
    }

    return NextResponse.json(finalResult);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed unexpectedly' },
      { status: 500 }
    );
  }
}

async function callClaude(apiKey: string, userMessage: string): Promise<any | null> {
  try {
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
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return null;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (!content) return null;

    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const cleaned = jsonMatch
      ? jsonMatch[1].trim()
      : content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    return JSON.parse(cleaned);
  } catch (e) {
    console.error('callClaude failed:', e instanceof SyntaxError ? 'Invalid JSON from Claude' : e);
    return null;
  }
}

function computeScore(result: any, input: any, nowMinutes?: number): void {
  const wakeMin = timeToMin(input.user.wakeTime);
  const sleepMin = timeToMin(input.user.sleepTime);
  const effectiveStart = (nowMinutes !== undefined && nowMinutes > wakeMin) ? nowMinutes : wakeMin;

  const remainingMin = Math.max(0, sleepMin - effectiveStart);

  const futureFixedMin = (input.today.fixedBlocks || [])
    .filter((b: any) => timeToMin(b.end) > effectiveStart)
    .reduce((sum: number, b: any) => {
      const start = Math.max(timeToMin(b.start), effectiveStart);
      return sum + (timeToMin(b.end) - start);
    }, 0);

  const dz = input.deadZoneSettings || {};
  let deadZoneMin = 0;
  if (effectiveStart < 14 * 60) deadZoneMin += (dz.lunchDuration || 0);
  if (effectiveStart < 21 * 60) deadZoneMin += (dz.dinnerDuration || 0);
  const hasGym = (input.today.fixedBlocks || []).some(
    (b: any) => b.type === 'gym' && timeToMin(b.end) > effectiveStart
  );
  if (hasGym) deadZoneMin += (dz.gymRecovery || 0);

  const usableMin = Math.max(1, remainingMin - futureFixedMin - deadZoneMin);

  const totalDemandMinutes = (input.tasks || []).reduce(
    (sum: number, t: any) => sum + (t.estimatedMinutes || 0), 0
  );

  const pct = Math.min(Math.round((totalDemandMinutes / usableMin) * 100), 150);
  result.dayLoadPercent = pct;
  result.dayLoadLabel =
    pct <= 60 ? 'CLEAR' : pct <= 85 ? 'TIGHT' : pct <= 100 ? 'LOADED' : 'OVERLOADED';
}

function computeStats(result: any, input: any, nowMinutes?: number): void {
  const wakeMin = timeToMin(input.user.wakeTime);
  const sleepMin = timeToMin(input.user.sleepTime);
  const effectiveStart = (nowMinutes !== undefined && nowMinutes > wakeMin) ? nowMinutes : wakeMin;

  const remainingMin = Math.max(0, sleepMin - effectiveStart);
  const futureFixedMin = (input.today.fixedBlocks || [])
    .filter((b: any) => timeToMin(b.end) > effectiveStart)
    .reduce((sum: number, b: any) => {
      const start = Math.max(timeToMin(b.start), effectiveStart);
      return sum + (timeToMin(b.end) - start);
    }, 0);

  const freeMin = Math.max(0, remainingMin - futureFixedMin);

  const dz = input.deadZoneSettings || {};
  let deadZoneMin = 0;
  if (effectiveStart < 14 * 60) deadZoneMin += (dz.lunchDuration || 0);
  if (effectiveStart < 21 * 60) deadZoneMin += (dz.dinnerDuration || 0);
  const hasGym = (input.today.fixedBlocks || []).some(
    (b: any) => b.type === 'gym' && timeToMin(b.end) > effectiveStart
  );
  if (hasGym) deadZoneMin += (dz.gymRecovery || 0);

  const usableMin = Math.max(0, freeMin - deadZoneMin);

  const totalTaskMin = (input.tasks || []).reduce(
    (sum: number, t: any) => sum + (t.estimatedMinutes || 0), 0
  );

  const scheduledCount = (result.schedule || []).filter((b: any) => b.type === 'task').length;

  result.stats = {
    freeTimeAvailable: fmtMin(freeMin),
    usableTimeAfterDeadZones: fmtMin(usableMin),
    totalTasksRequested: (input.tasks || []).length,
    estimatedTaskTime: fmtMin(totalTaskMin),
    tasksScheduled: scheduledCount,
    tasksOverflow: (result.overflow || []).length,
  };
}

function fillTimelineGaps(
  schedule: any[],
  wakeTime: string,
  sleepTime: string
): any[] {
  const sorted = [...schedule]
    .filter((b) => b.type !== 'wake' && b.type !== 'sleep')
    .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));

  const filled: any[] = [];
  const wakeMin = timeToMin(wakeTime);
  const sleepMin = timeToMin(sleepTime);

  filled.push({
    id: 'wake',
    name: 'Wake up',
    start: wakeTime,
    end: wakeTime,
    type: 'wake',
    category: null,
    estimatedMinutes: 0,
    energyType: null,
    notes: null,
  });

  let cursor = wakeMin;

  for (const block of sorted) {
    const blockStart = timeToMin(block.start);
    if (blockStart > cursor + 29) {
      const gapMin = blockStart - cursor;
      const label = getGapLabel(cursor, blockStart);
      filled.push({
        id: `gap-${cursor}`,
        name: label,
        start: minutesToTimeStr(cursor),
        end: minutesToTimeStr(blockStart),
        type: 'buffer',
        category: null,
        estimatedMinutes: gapMin,
        energyType: null,
        notes: null,
      });
    }
    filled.push(block);
    cursor = Math.max(cursor, timeToMin(block.end));
  }

  if (sleepMin > cursor + 29) {
    const label = getGapLabel(cursor, sleepMin);
    filled.push({
      id: `gap-${cursor}`,
      name: label,
      start: minutesToTimeStr(cursor),
      end: minutesToTimeStr(sleepMin),
      type: 'buffer',
      category: null,
      estimatedMinutes: sleepMin - cursor,
      energyType: null,
      notes: null,
    });
  }

  filled.push({
    id: 'sleep',
    name: 'Wind down & sleep',
    start: sleepTime,
    end: sleepTime,
    type: 'sleep',
    category: null,
    estimatedMinutes: 0,
    energyType: null,
    notes: null,
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

function fmtMin(min: number): string {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h} hrs`;
}
