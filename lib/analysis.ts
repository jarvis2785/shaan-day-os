import { AnalysisInput, Task, UserSettings, DayProfile } from './types';
import {
  getDayName,
  getDayProfile,
  getTodayBlocks,
  getTotalFixedMinutes,
  getTotalFreeMinutes,
  getTotalWakingMinutes,
  getFreeWindows,
  getDateString,
  getCurrentTimeStr,
  timeToMinutes,
  minutesToTime,
} from './schedule';
import { USER_CONTEXT, DEFAULT_DEAD_ZONES } from './constants';

export function buildAnalysisInput(
  settings: UserSettings,
  tasks: Task[],
  date: Date = new Date()
): AnalysisInput {
  const dayName = getDayName(date);
  const blocks = getTodayBlocks(settings, date);
  const totalFixedMinutes = getTotalFixedMinutes(blocks);
  const totalWakingMinutes = getTotalWakingMinutes(settings.wakeTime, settings.sleepTime);
  const totalFreeMinutes = getTotalFreeMinutes(settings.wakeTime, settings.sleepTime, blocks);
  const freeWindows = getFreeWindows(settings.wakeTime, settings.sleepTime, blocks);
  const dayProfile = getDayProfile(dayName);

  const deadZones = settings.deadZones ?? DEFAULT_DEAD_ZONES;
  const morningRoutineEnd = timeToMinutes(settings.wakeTime) + deadZones.morningRoutine;
  const noTaskBefore = minutesToTime(morningRoutineEnd);

  return {
    user: {
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
    body: JSON.stringify({
      input,
      context: USER_CONTEXT,
    }),
  });
}
