import { UserSettings, DayPlan, Task } from './types';
import { EMPTY_SETTINGS } from './constants';
import { getDateString, getISTStartOfWeekString } from './schedule';
import * as cache from './supabase/dataCache';
import { normalizeSettings } from './normalizeSettings';

const GYM_WEEK_PREFIX = 'dayos_gym_week_';

const LEGACY_EXACT = ['dayos_settings', 'dayos_initialized', 'dayos_gym_week', 'dayos_gym_week_anon'];
const LEGACY_PREFIXES = ['dayos_plan_', 'dayos_deferred_', 'dayos_planned_'];

export function legacyKeysToRemove(allKeys: string[]): string[] {
  return allKeys.filter(key => {
    if (LEGACY_EXACT.includes(key)) return true;
    if (LEGACY_PREFIXES.some(p => key.startsWith(p))) return true;
    return false;
  });
}

export function isInitialized(): boolean {
  return cache.isHydrated();
}

export function initialize(): void {
  // No-op — handled by AppProvider
}

export function getSettings(): UserSettings {
  if (typeof window === 'undefined') return normalizeSettings(EMPTY_SETTINGS);
  const cached = cache.getCachedSettings();
  if (cached) return cached;
  return normalizeSettings(EMPTY_SETTINGS);
}

export function saveSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return;
  cache.cacheSettings(settings);
}

export function updateSettings(updater: (current: UserSettings) => UserSettings): UserSettings {
  if (typeof window === 'undefined') return normalizeSettings(EMPTY_SETTINGS);
  return cache.updateCachedSettings(updater);
}

export function getDayPlan(date: Date = new Date()): DayPlan | null {
  if (typeof window === 'undefined') return null;
  return cache.getCachedDayPlan(getDateString(date));
}

export function saveDayPlan(plan: DayPlan): void {
  if (typeof window === 'undefined') return;
  cache.cacheDayPlan(plan);
}

function gymKey(): string | null {
  const uid = cache.getUserId();
  return uid ? GYM_WEEK_PREFIX + uid : null;
}

export function getGymDoneThisWeek(): number {
  if (typeof window === 'undefined') return 0;
  const key = gymKey();
  if (!key) return 0;
  const raw = localStorage.getItem(key);
  if (!raw) return 0;
  try {
    const data = JSON.parse(raw);
    const startOfWeekStr = getISTStartOfWeekString();
    if (data.weekStart < startOfWeekStr) return 0;
    return data.count || 0;
  } catch { return 0; }
}

export function incrementGymDone(): void {
  if (typeof window === 'undefined') return;
  const key = gymKey();
  if (!key) return;
  const startOfWeekStr = getISTStartOfWeekString();
  const current = getGymDoneThisWeek();
  localStorage.setItem(key, JSON.stringify({ weekStart: startOfWeekStr, count: current + 1 }));
}

export function getDeferredTasks(date: Date = new Date()): Task[] {
  if (typeof window === 'undefined') return [];
  return cache.getCachedDeferredTasks(getDateString(date));
}

export function deferTask(task: Task, toDate: Date): void {
  if (typeof window === 'undefined') return;
  const dateStr = getDateString(toDate);
  const existing = cache.getCachedDeferredTasks(dateStr);
  cache.cacheDeferredTasks(dateStr, [...existing, task]);
}

export function clearDeferredTasks(date: Date = new Date()): void {
  if (typeof window === 'undefined') return;
  cache.cacheDeferredTasks(getDateString(date), []);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getPlannedTasks(date: Date): Task[] {
  if (typeof window === 'undefined') return [];
  return cache.getCachedPlannedTasks(getDateString(date));
}

export function savePlannedTasks(tasks: Task[], date: Date): void {
  if (typeof window === 'undefined') return;
  cache.cachePlannedTasks(getDateString(date), tasks);
}

export function clearPlannedTasks(date: Date): void {
  if (typeof window === 'undefined') return;
  cache.cachePlannedTasks(getDateString(date), []);
}

export function removeLegacyLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) allKeys.push(k);
    }
    for (const key of legacyKeysToRemove(allKeys)) {
      try { localStorage.removeItem(key); } catch {}
    }
  } catch {}
}
