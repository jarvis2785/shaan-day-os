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
import { USER_CONTEXT } from './constants';
import { getGymDoneThisWeek } from './storage';

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
  const gymDone = getGymDoneThisWeek();
  const gymRequired = settings.gym.enabled && gymDone < settings.gym.frequency;

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
    gymRequired,
    gymDone,
    gymPreference: settings.gym.preference,
    gymDuration: settings.gym.duration,
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
