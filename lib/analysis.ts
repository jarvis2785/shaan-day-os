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
    deadZoneSettings: settings.deadZones ?? DEFAULT_DEAD_ZONES,
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
