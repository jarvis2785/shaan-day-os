import { AnalysisInput, AnalysisResult, TaskCategory, TimeWindow } from './types';
import { timeToMinutes, getFreeWindows } from './schedule';

// TODO Step 3: per-user meal times
const MEAL_WINDOWS = {
  lunch: { start: 12 * 60, end: 15 * 60 },
  dinner: { start: 19 * 60, end: 22 * 60 },
};

const CATEGORY_DEFAULT_MINUTES: Record<TaskCategory, number> = {
  personal_brand: 60,
  agency_client: 120,
  college: 90,
  health: 75,
  personal: 30,
};

interface CoreMetrics {
  requestedMinutes: number;
  freeMinutes: number;
  deadZoneMinutes: number;
  usableMinutes: number;
}

function subtractFromAvailable(
  available: Array<[number, number]>,
  dzStart: number,
  dzEnd: number,
  budget: number,
): { deducted: number; remaining: Array<[number, number]> } {
  if (budget <= 0 || dzStart >= dzEnd) return { deducted: 0, remaining: available };
  let left = budget;
  const result: Array<[number, number]> = [];
  for (const [s, e] of available) {
    if (left <= 0) { result.push([s, e]); continue; }
    const os = Math.max(s, dzStart);
    const oe = Math.min(e, dzEnd);
    if (os >= oe) { result.push([s, e]); continue; }
    const overlapLen = oe - os;
    const take = Math.min(overlapLen, left);
    left -= take;
    if (s < os) result.push([s, os]);
    if (take < overlapLen) result.push([os + take, oe]);
    if (oe < e) result.push([oe, e]);
  }
  return { deducted: budget - left, remaining: result };
}

function computeCoreMetrics(result: AnalysisResult, input: AnalysisInput, nowMinutes: number): CoreMetrics {
  const scheduleBlocks = (result.schedule || []).filter(b => b.type === 'task');
  const blockMinutesByTaskId = new Map<string, number>();
  for (const b of scheduleBlocks) {
    const dur = timeToMinutes(b.end) - timeToMinutes(b.start);
    blockMinutesByTaskId.set(b.id, (blockMinutesByTaskId.get(b.id) || 0) + dur);
  }

  let requestedMinutes = 0;
  for (const task of (input.tasks || [])) {
    const scheduled = blockMinutesByTaskId.get(task.id);
    if (scheduled !== undefined) {
      requestedMinutes += scheduled;
    } else if (task.estimatedMinutes != null) {
      requestedMinutes += task.estimatedMinutes;
    } else {
      requestedMinutes += CATEGORY_DEFAULT_MINUTES[task.category] || 60;
    }
  }

  const freeMinutes = input.today.totalFreeMinutes;

  const windows: TimeWindow[] = (input.today.freeWindows && input.today.freeWindows.length > 0)
    ? input.today.freeWindows
    : getFreeWindows(input.user.wakeTime, input.user.sleepTime, input.today.fixedBlocks, nowMinutes);

  let available: Array<[number, number]> = windows.map(w => [timeToMinutes(w.start), timeToMinutes(w.end)]);

  const dz = input.deadZoneSettings;
  const wakeMin = timeToMinutes(input.user.wakeTime);
  let totalDeducted = 0;

  // Morning routine: [wake, wake+morningRoutine] cut to now onward
  if (dz.morningRoutine > 0) {
    const mrStart = Math.max(wakeMin, nowMinutes);
    const mrEnd = wakeMin + dz.morningRoutine;
    if (mrStart < mrEnd) {
      const r = subtractFromAvailable(available, mrStart, mrEnd, mrEnd - mrStart);
      totalDeducted += r.deducted;
      available = r.remaining;
    }
  }

  // Gym recovery: [gymEnd, gymEnd+gymRecovery] for each gym block ending after now
  if (dz.gymRecovery > 0) {
    for (const b of (input.today.fixedBlocks || [])) {
      if (b.type === 'gym' && timeToMinutes(b.end) > nowMinutes) {
        const gymEnd = timeToMinutes(b.end);
        const r = subtractFromAvailable(available, gymEnd, gymEnd + dz.gymRecovery, dz.gymRecovery);
        totalDeducted += r.deducted;
        available = r.remaining;
      }
    }
  }

  // Lunch: skip if any fixed block name matches /lunch/i
  const hasLunchBlock = (input.today.fixedBlocks || []).some(b => /lunch/i.test(b.name));
  if (!hasLunchBlock && (dz.lunchDuration || 0) > 0) {
    const lStart = Math.max(MEAL_WINDOWS.lunch.start, nowMinutes);
    const lEnd = MEAL_WINDOWS.lunch.end;
    if (lStart < lEnd) {
      const r = subtractFromAvailable(available, lStart, lEnd, dz.lunchDuration);
      totalDeducted += r.deducted;
      available = r.remaining;
    }
  }

  // Dinner: skip if any fixed block name matches /dinner/i
  const hasDinnerBlock = (input.today.fixedBlocks || []).some(b => /dinner/i.test(b.name));
  if (!hasDinnerBlock && (dz.dinnerDuration || 0) > 0) {
    const dStart = Math.max(MEAL_WINDOWS.dinner.start, nowMinutes);
    const dEnd = MEAL_WINDOWS.dinner.end;
    if (dStart < dEnd) {
      const r = subtractFromAvailable(available, dStart, dEnd, dz.dinnerDuration);
      totalDeducted += r.deducted;
      available = r.remaining;
    }
  }

  const usableMinutes = Math.max(0, freeMinutes - totalDeducted);
  return { requestedMinutes, freeMinutes, deadZoneMinutes: totalDeducted, usableMinutes };
}

export function computeScore(result: AnalysisResult, input: AnalysisInput, nowMinutes: number): void {
  const { requestedMinutes, usableMinutes } = computeCoreMetrics(result, input, nowMinutes);

  let pct: number;
  if (requestedMinutes === 0) {
    pct = 0;
  } else if (usableMinutes === 0) {
    pct = 150;
  } else {
    pct = Math.min(Math.round((requestedMinutes / usableMinutes) * 100), 150);
  }

  result.dayLoadPercent = pct;
  result.dayLoadLabel = pct <= 60 ? 'CLEAR' : pct <= 85 ? 'TIGHT' : pct <= 100 ? 'LOADED' : 'OVERLOADED';
}

export function computeStats(result: AnalysisResult, input: AnalysisInput, nowMinutes: number): void {
  const { requestedMinutes, freeMinutes, usableMinutes } = computeCoreMetrics(result, input, nowMinutes);

  const scheduledIds = new Set(
    (result.schedule || []).filter(b => b.type === 'task').map(b => b.id)
  );

  result.stats = {
    freeTimeAvailable: fmtMin(freeMinutes),
    usableTimeAfterDeadZones: fmtMin(usableMinutes),
    totalTasksRequested: (input.tasks || []).length,
    estimatedTaskTime: fmtMin(requestedMinutes),
    tasksScheduled: scheduledIds.size,
    tasksOverflow: (result.overflow || []).length,
  };
}

function fmtMin(min: number): string {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h} hrs`;
}
