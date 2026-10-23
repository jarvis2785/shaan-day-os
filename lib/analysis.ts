import { AnalysisInput, Task, UserSettings } from './types';
import {
  getDayName,
  getDayProfile,
  getTodayBlocks,
  getTotalFixedMinutes,
  getFreeMinutes,
  getTotalWakingMinutes,
  getFreeWindows,
  getDateString,
  getCurrentTimeStr,
  getISTMinutes,
  timeToMinutes,
  minutesToTime,
} from './schedule';
import { DEFAULT_DEAD_ZONES } from './constants';

export function buildAnalysisInput(
  settings: UserSettings,
  tasks: Task[],
  date: Date = new Date()
): AnalysisInput {
  const dayName = getDayName(date);
  const blocks = getTodayBlocks(settings, date);
  const totalFixedMinutes = getTotalFixedMinutes(blocks);
  const totalWakingMinutes = getTotalWakingMinutes(settings.wakeTime, settings.sleepTime);
  const nowMin = getISTMinutes();
  const totalFreeMinutes = getFreeMinutes(settings.wakeTime, settings.sleepTime, blocks, true, nowMin);
  const freeWindows = getFreeWindows(settings.wakeTime, settings.sleepTime, blocks, nowMin);
  const dayProfile = getDayProfile(dayName, settings);

  const deadZones = settings.deadZones ?? DEFAULT_DEAD_ZONES;
  const morningRoutineEnd = timeToMinutes(settings.wakeTime) + deadZones.morningRoutine;
  const noTaskBefore = minutesToTime(Math.max(morningRoutineEnd, nowMin));

  return {
    user: {
      // TODO Step 3: use the account's display name and profile
      name: 'Shaan',
      wakeTime: settings.wakeTime,
      sleepTime: settings.sleepTime,
      totalWakingHours: totalWakingMinutes / 60,
    },
    today: {
      date: getDateString(date),
      dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
      dayProfile,
      fixedBlocks: blocks,
      totalFixedMinutes,
      totalFreeMinutes,
      freeWindows,
    },
    tasks,
    deadZoneSettings: deadZones,
    currentTime: getCurrentTimeStr(),
    constraints: {
      noTaskBefore,
      reason: `Morning routine dead zone — first ${deadZones.morningRoutine} minutes after wake are always reserved`,
    },
  };
}

export async function analyzeDay(input: AnalysisInput): Promise<Response> {
  return fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
}
