import { FixedBlock, TimeWindow, DayProfile, UserSettings } from './types';
import { HEAVY_DAYS, LOW_CAP_DAYS, FREE_DAYS, DAY_NAMES } from './constants';

const IST_TZ = 'Asia/Kolkata';

function getISTMinutes(): number {
  const timeStr = new Date().toLocaleTimeString('en-GB', {
    timeZone: IST_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

export function getBlockDuration(block: FixedBlock): number {
  return timeToMinutes(block.end) - timeToMinutes(block.start);
}

export function getTotalFixedMinutes(blocks: FixedBlock[]): number {
  return blocks.reduce((sum, b) => sum + getBlockDuration(b), 0);
}

export function getTotalWakingMinutes(wakeTime: string, sleepTime: string): number {
  return timeToMinutes(sleepTime) - timeToMinutes(wakeTime);
}

export function getTransitionBufferMinutes(blocks: FixedBlock[]): number {
  return blocks.length * 30;
}

export function getTotalFreeMinutes(
  wakeTime: string,
  sleepTime: string,
  blocks: FixedBlock[]
): number {
  const waking = getTotalWakingMinutes(wakeTime, sleepTime);
  const fixed = getTotalFixedMinutes(blocks);
  const buffer = getTransitionBufferMinutes(blocks);
  const meals = 45;
  return Math.max(0, waking - fixed - buffer - meals);
}

export function getFreeMinutesFromNow(
  wakeTime: string,
  sleepTime: string,
  blocks: FixedBlock[]
): number {
  const nowMin = getISTMinutes();
  const wakeMin = timeToMinutes(wakeTime);
  const sleepMin = timeToMinutes(sleepTime);

  if (nowMin < wakeMin) {
    return getTotalFreeMinutes(wakeTime, sleepTime, blocks);
  }

  if (nowMin >= sleepMin) return 0;

  const remaining = sleepMin - nowMin;
  const futureBlocks = blocks.filter((b) => timeToMinutes(b.end) > nowMin);
  const futureFixed = futureBlocks.reduce((sum, b) => {
    const start = Math.max(timeToMinutes(b.start), nowMin);
    const end = timeToMinutes(b.end);
    return sum + (end - start);
  }, 0);
  const futureTransitions = futureBlocks.length * 30;
  const meals = 45;
  return Math.max(0, remaining - futureFixed - futureTransitions - meals);
}

export function isBeforeWakeTime(wakeTime: string): boolean {
  return getISTMinutes() < timeToMinutes(wakeTime);
}

export function getCurrentTimeStr(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: IST_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function getHeavyDayContext(
  dayName: string,
  wakeTime: string,
  sleepTime: string,
  blocks: FixedBlock[]
): string | null {
  const lower = dayName.toLowerCase();
  if (!HEAVY_DAYS.includes(lower)) return null;

  const windows = getFreeWindows(wakeTime, sleepTime, blocks);
  const bigWindows = windows.filter((w) => w.durationMinutes >= 60);
  if (bigWindows.length === 0) return 'Heavy day — no usable windows for tasks';

  const totalUsable = bigWindows.reduce((s, w) => s + w.durationMinutes, 0);
  const best = bigWindows.sort((a, b) => b.durationMinutes - a.durationMinutes)[0];
  return `Heavy day — ${minutesToHoursDisplay(totalUsable)} usable (${formatTimeDisplay(best.start)}–${formatTimeDisplay(best.end)})`;
}

export function getFreeWindows(
  wakeTime: string,
  sleepTime: string,
  blocks: FixedBlock[]
): TimeWindow[] {
  const sorted = [...blocks].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  const windows: TimeWindow[] = [];
  const wakeMin = timeToMinutes(wakeTime);
  const sleepMin = timeToMinutes(sleepTime);

  let cursor = wakeMin;

  for (const block of sorted) {
    const blockStart = timeToMinutes(block.start);
    if (cursor < blockStart) {
      const duration = blockStart - cursor;
      if (duration >= 30) {
        windows.push({
          start: minutesToTime(cursor),
          end: minutesToTime(blockStart),
          durationMinutes: duration,
          quality: getTimeQuality(cursor),
        });
      }
    }
    const blockEnd = timeToMinutes(block.end) + 30;
    cursor = Math.max(cursor, blockEnd);
  }

  if (cursor < sleepMin - 30) {
    const duration = sleepMin - 30 - cursor;
    if (duration >= 30) {
      windows.push({
        start: minutesToTime(cursor),
        end: minutesToTime(sleepMin - 30),
        durationMinutes: duration,
        quality: getTimeQuality(cursor),
      });
    }
  }

  return windows;
}

function getTimeQuality(minutesFromMidnight: number): 'prime' | 'good' | 'low' {
  if (minutesFromMidnight < 12 * 60) return 'prime';
  if (minutesFromMidnight < 17 * 60) return 'good';
  return 'low';
}

export function getDayProfile(dayName: string): DayProfile {
  const lower = dayName.toLowerCase();
  if (HEAVY_DAYS.includes(lower)) return 'heavy';
  if (LOW_CAP_DAYS.includes(lower)) return 'low-capacity';
  if (FREE_DAYS.includes(lower)) return 'free';
  return 'moderate';
}

export function getDayName(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    timeZone: IST_TZ, weekday: 'long',
  }).toLowerCase();
}

export function getTodayBlocks(settings: UserSettings, date: Date = new Date()): FixedBlock[] {
  const dayName = getDayName(date);
  return settings.schedule[dayName] || [];
}

export function formatDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    timeZone: IST_TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export function getDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

export function getISTTomorrow(): Date {
  const todayStr = getDateString();
  const [y, m, d] = todayStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 12, 0));
}

export function getISTStartOfWeekString(): string {
  const todayStr = getDateString();
  const dow = DAY_NAMES.indexOf(getDayName() as typeof DAY_NAMES[number]);
  const [y, m, d] = todayStr.split('-').map(Number);
  const sundayDate = new Date(Date.UTC(y, m - 1, d - dow, 12, 0));
  return getDateString(sundayDate);
}

export function getDayLabel(dayName: string): string {
  const lower = dayName.toLowerCase();
  if (HEAVY_DAYS.includes(lower)) return 'HEAVY';
  if (LOW_CAP_DAYS.includes(lower)) return 'LOW CAP';
  if (FREE_DAYS.includes(lower)) return 'FREE';
  return '';
}

export function minutesToHoursDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}.${Math.round((m / 60) * 10)}h`;
}
