import { AnalysisResult, AnalysisInput } from './types';
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
  const fixedIds = new Set(fixedBlocks.map((b) => b.id));
  const inputTaskIds = new Set(input.tasks.map((t) => t.id));
  const inputTaskMap = new Map(input.tasks.map((t) => [t.id, t]));

  // === AUTO-REPAIRS (silent, always applied) ===

  // R1: Restore fixed blocks — ensure all fixedBlocks appear in schedule
  for (const fb of fixedBlocks) {
    if (!repaired.schedule.some((b) => b.id === fb.id)) {
      repaired.schedule.push({
        id: fb.id,
        name: fb.name,
        start: fb.start,
        end: fb.end,
        type: fb.type === 'gym' ? 'gym' : 'fixed',
        category: null,
        estimatedMinutes: timeToMinutes(fb.end) - timeToMinutes(fb.start),
        energyType: null,
        notes: null,
      });
    }
  }

  // R2: Remove fake gym — gym blocks not in fixedBlocks
  repaired.schedule = repaired.schedule.filter(
    (b) => !(b.type === 'gym' && !fixedIds.has(b.id))
  );

  // R3: Remove overlapping non-task blocks (buffers/dead_zones/meals that overlap fixed or task)
  const solidBlocks = repaired.schedule.filter(
    (b) => b.type === 'task' || b.type === 'fixed' || b.type === 'gym'
  );
  repaired.schedule = repaired.schedule.filter((b) => {
    if (b.type !== 'buffer' && b.type !== 'dead_zone' && b.type !== 'meal') return true;
    const bStart = timeToMinutes(b.start);
    const bEnd = timeToMinutes(b.end);
    for (const s of solidBlocks) {
      const sStart = timeToMinutes(s.start);
      const sEnd = timeToMinutes(s.end);
      if (bStart < sEnd && bEnd > sStart) return false;
    }
    return true;
  });

  // R4: Dedupe schedule/overflow — task in both → remove from overflow
  const scheduledTaskIds = new Set(
    repaired.schedule.filter((b) => b.type === 'task').map((b) => b.id)
  );
  repaired.overflow = repaired.overflow.filter((o) => !scheduledTaskIds.has(o.id));

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

  const taskBlocks = repaired.schedule.filter((b) => b.type === 'task');

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

  // TOO_SHORT — task scheduled for < 50% of input estimate
  for (const task of taskBlocks) {
    const inputTask = inputTaskMap.get(task.id);
    if (inputTask?.estimatedMinutes) {
      const scheduled = timeToMinutes(task.end) - timeToMinutes(task.start);
      if (scheduled < inputTask.estimatedMinutes * 0.5) {
        violations.push(
          `TOO_SHORT: "${task.name}" scheduled ${scheduled} min but needs ${inputTask.estimatedMinutes} min`
        );
      }
    }
  }

  // MISSING_TASK — input task not in schedule or overflow
  const overflowIds = new Set(repaired.overflow.map((o) => o.id));
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
