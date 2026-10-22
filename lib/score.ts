import { AnalysisInput, AnalysisResult, TaskCategory } from './types';
import { timeToMinutes } from './schedule';

// TODO Step 2: these become per-user profile fields
const DEAD_ZONE_CUTOFFS = {
  LUNCH_BEFORE: 14 * 60,
  DINNER_BEFORE: 21 * 60,
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

  const dz = input.deadZoneSettings;
  const wakeMin = timeToMinutes(input.user.wakeTime);
  const noTaskBeforeMin = timeToMinutes(input.constraints.noTaskBefore);

  let deadZoneMinutes = 0;
  if (nowMinutes < noTaskBeforeMin) {
    deadZoneMinutes += noTaskBeforeMin - Math.max(nowMinutes, wakeMin);
  }
  if (nowMinutes < DEAD_ZONE_CUTOFFS.LUNCH_BEFORE) {
    deadZoneMinutes += dz.lunchDuration || 0;
  }
  if (nowMinutes < DEAD_ZONE_CUTOFFS.DINNER_BEFORE) {
    deadZoneMinutes += dz.dinnerDuration || 0;
  }
  const hasGymAhead = (input.today.fixedBlocks || []).some(
    b => b.type === 'gym' && timeToMinutes(b.end) > nowMinutes
  );
  if (hasGymAhead) {
    deadZoneMinutes += dz.gymRecovery || 0;
  }

  const usableMinutes = Math.max(0, freeMinutes - deadZoneMinutes);
  return { requestedMinutes, freeMinutes, deadZoneMinutes, usableMinutes };
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
