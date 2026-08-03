import { UserSettings, DayPlan, Task } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { getDateString, getISTStartOfWeekString } from './schedule';

const SETTINGS_KEY = 'dayos_settings';
const PLAN_PREFIX = 'dayos_plan_';
const GYM_WEEK_KEY = 'dayos_gym_week';
const INIT_KEY = 'dayos_initialized';

export function isInitialized(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(INIT_KEY) === 'true';
}

export function initialize(): void {
  if (typeof window === 'undefined') return;
  if (!isInitialized()) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(INIT_KEY, 'true');
  }
}

export function getSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    initialize();
    return DEFAULT_SETTINGS;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getDayPlan(date: Date = new Date()): DayPlan | null {
  if (typeof window === 'undefined') return null;
  const key = PLAN_PREFIX + getDateString(date);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveDayPlan(plan: DayPlan): void {
  if (typeof window === 'undefined') return;
  const key = PLAN_PREFIX + plan.date;
  localStorage.setItem(key, JSON.stringify(plan));
}

export function getGymDoneThisWeek(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(GYM_WEEK_KEY);
  if (!raw) return 0;
  try {
    const data = JSON.parse(raw);
    const startOfWeekStr = getISTStartOfWeekString();
    if (data.weekStart < startOfWeekStr) {
      return 0;
    }
    return data.count || 0;
  } catch {
    return 0;
  }
}

export function incrementGymDone(): void {
  if (typeof window === 'undefined') return;
  const startOfWeekStr = getISTStartOfWeekString();
  const current = getGymDoneThisWeek();
  localStorage.setItem(
    GYM_WEEK_KEY,
    JSON.stringify({ weekStart: startOfWeekStr, count: current + 1 })
  );
}

export function getDeferredTasks(date: Date = new Date()): Task[] {
  if (typeof window === 'undefined') return [];
  const key = `dayos_deferred_${getDateString(date)}`;
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function deferTask(task: Task, toDate: Date): void {
  if (typeof window === 'undefined') return;
  const key = `dayos_deferred_${getDateString(toDate)}`;
  const existing = getDeferredTasks(toDate);
  existing.push(task);
  localStorage.setItem(key, JSON.stringify(existing));
}

export function clearDeferredTasks(date: Date = new Date()): void {
  if (typeof window === 'undefined') return;
  const key = `dayos_deferred_${getDateString(date)}`;
  localStorage.removeItem(key);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
