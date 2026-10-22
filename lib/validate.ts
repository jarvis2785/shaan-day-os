import { AnalysisResult, AnalysisInput, ScheduleBlock } from './types';
import { timeToMinutes, minutesToTime } from './schedule';

export interface ValidationResult {
  valid: boolean;
  violations: string[];
  repaired: AnalysisResult;
}

export function validateAnalysis(
  result: AnalysisResult,
  input: AnalysisInput,
  nowMinutes?: number
): ValidationResult {
  const violations: string[] = [];
  const repaired = JSON.parse(JSON.stringify(result)) as AnalysisResult;

  if (!repaired.schedule) repaired.schedule = [];
  if (!repaired.overflow) repaired.overflow = [];

  const noTaskBeforeMin = timeToMinutes(input.constraints.noTaskBefore);
  const wakeMin = timeToMinutes(input.user.wakeTime);
  const sleepMin = timeToMinutes(input.user.sleepTime);
  const fixedBlocks = input.today.fixedBlocks || [];
  const fixedIds = new Set(fixedBlocks.map(b => b.id));
  const inputTaskIds = new Set(input.tasks.map(t => t.id));
  const inputTaskMap = new Map(input.tasks.map(t => [t.id, t]));

  // === AUTO-REPAIRS (silent, always applied) ===

  // R1: Restore fixed blocks — overwrite moved ones, add missing, dedupe
  for (const fb of fixedBlocks) {
    const existing = repaired.schedule.filter(b => b.id === fb.id);
    repaired.schedule = repaired.schedule.filter(b => b.id !== fb.id);
    const base = existing[0];
    repaired.schedule.push({
      id: fb.id,
      name: fb.name,
      start: fb.start,
      end: fb.end,
      type: fb.type === 'gym' ? 'gym' : 'fixed',
      category: base?.category ?? null,
      estimatedMinutes: timeToMinutes(fb.end) - timeToMinutes(fb.start),
      energyType: base?.energyType ?? null,
      notes: base?.notes ?? null,
    });
  }

  // R2: No invented fixed/gym blocks — retype to task if matches user task, else delete
  const r2Schedule: ScheduleBlock[] = [];
  for (const b of repaired.schedule) {
    if ((b.type === 'fixed' || b.type === 'gym') && !fixedIds.has(b.id)) {
      if (inputTaskIds.has(b.id)) {
        r2Schedule.push({ ...b, type: 'task' });
      }
    } else {
      r2Schedule.push(b);
    }
  }
  repaired.schedule = r2Schedule;

  // R3: Remove buffer blocks that overlap another block
  repaired.schedule = repaired.schedule.filter(b => {
    if (b.type !== 'buffer') return true;
    const bStart = timeToMinutes(b.start);
    const bEnd = timeToMinutes(b.end);
    for (const s of repaired.schedule) {
      if (s === b) continue;
      const sStart = timeToMinutes(s.start);
      const sEnd = timeToMinutes(s.end);
      if (bStart < sEnd && bEnd > sStart) return false;
    }
    return true;
  });

  // R4: Dedupe schedule/overflow — task in both → remove from overflow
  const scheduledTaskIds = new Set(
    repaired.schedule.filter(b => b.type === 'task').map(b => b.id)
  );
  repaired.overflow = repaired.overflow.filter(o => !scheduledTaskIds.has(o.id));

  // R5: Fix estimatedMinutes — recalculate from start/end
  for (const block of repaired.schedule) {
    if (block.start && block.end) {
      block.estimatedMinutes = timeToMinutes(block.end) - timeToMinutes(block.start);
    }
  }

  // Sort by start time
  repaired.schedule.sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  // === VIOLATION CHECKS ===

  const taskBlocks = repaired.schedule.filter(b => b.type === 'task');

  // OVERLAP — task-to-task
  for (let i = 0; i < taskBlocks.length; i++) {
    for (let j = i + 1; j < taskBlocks.length; j++) {
      const a = taskBlocks[i];
      const b = taskBlocks[j];
      if (timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end)) {
        violations.push(
          `OVERLAP: "${a.name}" (${a.start}-${a.end}) overlaps "${b.name}" (${b.start}-${b.end})`
        );
      }
    }
  }

  // OVERLAP — task-to-fixed
  for (const task of taskBlocks) {
    const tStart = timeToMinutes(task.start);
    const tEnd = timeToMinutes(task.end);
    for (const fb of fixedBlocks) {
      const fbStart = timeToMinutes(fb.start);
      const fbEnd = timeToMinutes(fb.end);
      if (tStart < fbEnd && tEnd > fbStart) {
        violations.push(
          `OVERLAP: "${task.name}" (${task.start}-${task.end}) overlaps fixed "${fb.name}" (${fb.start}-${fb.end})`
        );
      }
    }
  }

  // OVERLAP — meal/dead_zone vs task/fixed/gym
  const mealDzBlocks = repaired.schedule.filter(b => b.type === 'meal' || b.type === 'dead_zone');
  const solidBlocks = repaired.schedule.filter(b => b.type === 'task' || b.type === 'fixed' || b.type === 'gym');
  for (const mdz of mealDzBlocks) {
    const mStart = timeToMinutes(mdz.start);
    const mEnd = timeToMinutes(mdz.end);
    for (const s of solidBlocks) {
      const sStart = timeToMinutes(s.start);
      const sEnd = timeToMinutes(s.end);
      if (mStart < sEnd && sStart < mEnd) {
        violations.push(
          `OVERLAP: "${s.name}" (${s.start}-${s.end}) overlaps ${mdz.type} "${mdz.name}" (${mdz.start}-${mdz.end})`
        );
      }
    }
  }

  // OVERLAP — meal/dead_zone vs meal/dead_zone
  for (let i = 0; i < mealDzBlocks.length; i++) {
    for (let j = i + 1; j < mealDzBlocks.length; j++) {
      const a = mealDzBlocks[i];
      const b = mealDzBlocks[j];
      if (timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end)) {
        violations.push(
          `OVERLAP: "${a.name}" (${a.start}-${a.end}) overlaps "${b.name}" (${b.start}-${b.end})`
        );
      }
    }
  }

  // BEFORE_MORNING
  for (const task of taskBlocks) {
    if (timeToMinutes(task.start) < noTaskBeforeMin) {
      violations.push(
        `BEFORE_MORNING: "${task.name}" starts at ${task.start}, before noTaskBefore ${input.constraints.noTaskBefore}`
      );
    }
  }

  // IN_PAST
  if (nowMinutes !== undefined) {
    for (const task of taskBlocks) {
      if (timeToMinutes(task.start) < nowMinutes) {
        violations.push(
          `IN_PAST: "${task.name}" starts at ${task.start}, which is in the past (now: ${minutesToTime(nowMinutes)})`
        );
      }
    }
  }

  // OUTSIDE_WAKING
  for (const task of taskBlocks) {
    const tStart = timeToMinutes(task.start);
    const tEnd = timeToMinutes(task.end);
    if (tStart < wakeMin || tEnd > sleepMin || tEnd <= tStart) {
      violations.push(
        `OUTSIDE_WAKING: "${task.name}" (${task.start}-${task.end}) outside waking hours (${input.user.wakeTime}-${input.user.sleepTime})`
      );
    }
  }

  // TOO_SHORT — aggregate split blocks, >5 min below estimate
  const scheduledMinutesByTask = new Map<string, number>();
  for (const block of taskBlocks) {
    const dur = timeToMinutes(block.end) - timeToMinutes(block.start);
    scheduledMinutesByTask.set(block.id, (scheduledMinutesByTask.get(block.id) || 0) + dur);
  }
  for (const task of input.tasks) {
    if (task.estimatedMinutes == null) continue;
    const scheduled = scheduledMinutesByTask.get(task.id);
    if (scheduled === undefined) continue;
    if (task.estimatedMinutes - scheduled > 5) {
      violations.push(
        `TOO_SHORT: "${task.name}" scheduled ${scheduled} min but needs ${task.estimatedMinutes} min`
      );
    }
  }

  // DEEP_FOCUS_WINDOW — single block in 90+ min stretch
  const deepFocusBlocksByTask = new Map<string, ScheduleBlock[]>();
  for (const task of taskBlocks) {
    const cat = task.category || inputTaskMap.get(task.id)?.category;
    const isDeep = task.energyType === 'deep_focus' ||
      (!task.energyType && (cat === 'agency_client' || cat === 'college'));
    if (!isDeep) continue;
    const existing = deepFocusBlocksByTask.get(task.id) || [];
    existing.push(task);
    deepFocusBlocksByTask.set(task.id, existing);
  }

  const boundaryBlocks = repaired.schedule
    .filter(b => b.type === 'fixed' || b.type === 'gym' || b.type === 'meal' || b.type === 'dead_zone')
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  for (const [, blocks] of Array.from(deepFocusBlocksByTask)) {
    if (blocks.length > 1) {
      violations.push(
        `DEEP_FOCUS_WINDOW: "${blocks[0].name}" is split across ${blocks.length} blocks — deep-focus tasks must be a single block`
      );
      continue;
    }

    const task = blocks[0];
    const tStart = timeToMinutes(task.start);
    const tEnd = timeToMinutes(task.end);

    if (nowMinutes !== undefined && tStart < nowMinutes) continue;

    let stretchStart = wakeMin;
    if (nowMinutes !== undefined) stretchStart = Math.max(stretchStart, nowMinutes);
    for (const bb of boundaryBlocks) {
      const bbEnd = timeToMinutes(bb.end);
      if (bbEnd <= tStart && bbEnd > stretchStart) stretchStart = bbEnd;
    }

    let stretchEnd = sleepMin;
    for (const bb of boundaryBlocks) {
      const bbStart = timeToMinutes(bb.start);
      if (bbStart >= tEnd && bbStart < stretchEnd) {
        stretchEnd = bbStart;
        break;
      }
    }

    if (stretchEnd - stretchStart < 90) {
      violations.push(
        `DEEP_FOCUS_WINDOW: "${task.name}" (${task.start}-${task.end}) in a ${stretchEnd - stretchStart}-min stretch — deep-focus tasks need 90+ minutes`
      );
    }
  }

  // MISSING_TASK — input task not in schedule or overflow
  const overflowIds = new Set(repaired.overflow.map(o => o.id));
  for (const task of input.tasks) {
    if (!scheduledTaskIds.has(task.id) && !overflowIds.has(task.id)) {
      violations.push(
        `MISSING_TASK: "${task.name}" (${task.id}) not in schedule or overflow`
      );
    }
  }

  // UNKNOWN_TASK — schedule task not in input
  for (const task of taskBlocks) {
    if (!inputTaskIds.has(task.id)) {
      violations.push(
        `UNKNOWN_TASK: "${task.name}" (${task.id}) not in input tasks`
      );
    }
  }

  return { valid: violations.length === 0, violations, repaired };
}
