import { UserSettings, DayPlan, Task } from '@/lib/types';
import { normalizeSettings } from '@/lib/normalizeSettings';
import { EMPTY_SETTINGS } from '@/lib/constants';
import { getDateString } from '@/lib/schedule';

type Listener = () => void;

let _userId: string | null = null;
let _settings: UserSettings | null = null;
const _dayPlans = new Map<string, DayPlan>();
const _deferredTasks = new Map<string, Task[]>();
const _plannedTasks = new Map<string, Task[]>();
let _hydrated = false;
let _version = 0;
const _listeners = new Set<Listener>();
let _settingsTimer: ReturnType<typeof setTimeout> | null = null;
const _failedWrites: Array<() => Promise<void>> = [];
let _writesInFlight = 0;
let _hydrateCount = 0;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
let _retryAttempt = 0;

function notify() {
  _version++;
  _listeners.forEach(fn => { try { fn(); } catch {} });
}

export function subscribe(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
export function getVersion(): number { return _version; }
export function isHydrated(): boolean { return _hydrated; }
export function getUserId(): string | null { return _userId; }
export function getHydrateCount(): number { return _hydrateCount; }
export function hasPendingWrites(): boolean {
  return _writesInFlight > 0 || _settingsTimer !== null || _failedWrites.length > 0;
}

export function getRetryDelay(attempt: number): number {
  if (attempt <= 0) return 5000;
  if (attempt === 1) return 15000;
  return 60000;
}

export function shouldRehydrate(p: { hydrated: boolean; cachedUserId: string | null; sessionUserId: string }): boolean {
  if (!p.hydrated) return true;
  return p.cachedUserId !== p.sessionUserId;
}

// ---- reads ----

export function getCachedSettings(): UserSettings | null { return _settings; }

export function getCachedDayPlan(dateStr: string): DayPlan | null {
  return _dayPlans.get(dateStr) ?? null;
}

export function getCachedDeferredTasks(dateStr: string): Task[] {
  return _deferredTasks.get(dateStr) ?? [];
}

export function getCachedPlannedTasks(dateStr: string): Task[] {
  return _plannedTasks.get(dateStr) ?? [];
}

// ---- helpers ----

async function client() {
  const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
  return getSupabaseBrowserClient();
}

function scheduleRetry(): void {
  if (_retryTimer !== null) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (_failedWrites.length === 0) return;

  const delay = getRetryDelay(_retryAttempt);
  _retryTimer = setTimeout(async () => {
    _retryTimer = null;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    _retryAttempt++;
    const batch = [..._failedWrites]; _failedWrites.length = 0;
    for (const fn of batch) { try { await fn(); } catch { _failedWrites.push(fn); } }
    if (_failedWrites.length === 0) {
      _retryAttempt = 0;
    } else {
      scheduleRetry();
    }
  }, delay);
}

// ---- writes ----

export function cacheSettings(s: UserSettings): void {
  if (!_hydrated) { console.warn('cacheSettings: skipped — not hydrated yet'); return; }
  _settings = s;
  notify();
  if (_settingsTimer) clearTimeout(_settingsTimer);
  _settingsTimer = setTimeout(() => { _settingsTimer = null; flushSettings(); }, 600);
}

export function updateCachedSettings(updater: (current: UserSettings) => UserSettings): UserSettings {
  const current = _settings ?? normalizeSettings(EMPTY_SETTINGS);
  const updated = updater(current);
  cacheSettings(updated);
  return updated;
}

async function flushSettings(): Promise<void> {
  if (!_userId || !_settings) return;
  const snap = { ..._settings };
  _writesInFlight++;
  try {
    const sb = await client();
    const { error } = await sb.from('profiles').upsert({
      user_id: _userId, settings: snap as unknown as Record<string, unknown>, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    saveOfflineCache();
  } catch (e) {
    console.warn('Settings write failed:', e);
    const uid = _userId;
    _failedWrites.push(async () => {
      const sb = await client();
      await sb.from('profiles').upsert({
        user_id: uid, settings: snap as unknown as Record<string, unknown>, updated_at: new Date().toISOString(),
      });
    });
    scheduleRetry();
  } finally {
    _writesInFlight--;
  }
}

export function cacheDayPlan(plan: DayPlan): void {
  if (!_hydrated) { console.warn('cacheDayPlan: skipped — not hydrated yet'); return; }
  _dayPlans.set(plan.date, plan);
  notify();
  writeDayPlan(plan);
}

async function writeDayPlan(plan: DayPlan): Promise<void> {
  if (!_userId) return;
  const uid = _userId;
  _writesInFlight++;
  try {
    const sb = await client();
    const { error } = await sb.from('day_plans').upsert({
      user_id: uid, plan_date: plan.date, plan: plan as unknown as Record<string, unknown>, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    saveOfflineCache();
  } catch (e) {
    console.warn('Day plan write failed:', e);
    _failedWrites.push(async () => {
      const sb = await client();
      await sb.from('day_plans').upsert({
        user_id: uid, plan_date: plan.date, plan: plan as unknown as Record<string, unknown>, updated_at: new Date().toISOString(),
      });
    });
    scheduleRetry();
  } finally {
    _writesInFlight--;
  }
}

export function cacheDeferredTasks(dateStr: string, tasks: Task[]): void {
  if (!_hydrated) { console.warn('cacheDeferredTasks: skipped — not hydrated yet'); return; }
  tasks.length ? _deferredTasks.set(dateStr, tasks) : _deferredTasks.delete(dateStr);
  notify();
  writeQueue('deferred', dateStr, tasks);
}

export function cachePlannedTasks(dateStr: string, tasks: Task[]): void {
  if (!_hydrated) { console.warn('cachePlannedTasks: skipped — not hydrated yet'); return; }
  tasks.length ? _plannedTasks.set(dateStr, tasks) : _plannedTasks.delete(dateStr);
  notify();
  writeQueue('planned', dateStr, tasks);
}

async function writeQueue(kind: 'deferred' | 'planned', dateStr: string, tasks: Task[]): Promise<void> {
  if (!_userId) return;
  const uid = _userId;
  _writesInFlight++;
  try {
    const sb = await client();
    if (!tasks.length) {
      await sb.from('task_queues').delete().match({ user_id: uid, kind, queue_date: dateStr });
    } else {
      const { error } = await sb.from('task_queues').upsert({
        user_id: uid, kind, queue_date: dateStr,
        tasks: tasks as unknown as Record<string, unknown>[], updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }
    saveOfflineCache();
  } catch (e) {
    console.warn(`${kind} queue write failed:`, e);
    _failedWrites.push(async () => {
      const sb = await client();
      if (!tasks.length) {
        await sb.from('task_queues').delete().match({ user_id: uid, kind, queue_date: dateStr });
      } else {
        await sb.from('task_queues').upsert({
          user_id: uid, kind, queue_date: dateStr,
          tasks: tasks as unknown as Record<string, unknown>[], updated_at: new Date().toISOString(),
        });
      }
    });
    scheduleRetry();
  } finally {
    _writesInFlight--;
  }
}

// ---- hydration ----

export async function hydrate(uid: string, clientOverride?: any): Promise<{ ok: boolean; dbMissing?: boolean }> {
  if (_hydrated && _userId === uid && (_writesInFlight > 0 || _settingsTimer !== null || _failedWrites.length > 0)) {
    return { ok: true };
  }
  _userId = uid;
  try {
    const sb = clientOverride ?? await client();

    const { data: profile, error: profErr } = await sb
      .from('profiles').select('settings, display_name').eq('user_id', uid).maybeSingle();

    if (profErr) {
      const code = profErr.code ?? '';
      const msg = profErr.message ?? '';
      if (
        code === '42P01' || code === 'PGRST205' || code === 'PGRST202' ||
        msg.includes('does not exist') || msg.includes('Could not find the table') || msg.includes('schema cache')
      ) {
        return { ok: false, dbMissing: true };
      }
      throw profErr;
    }

    if (!profile) {
      await sb.from('profiles').upsert({ user_id: uid, settings: EMPTY_SETTINGS as unknown as Record<string, unknown>, display_name: '' });
      _settings = { ...EMPTY_SETTINGS };
    } else {
      _settings = normalizeSettings(profile.settings ?? EMPTY_SETTINGS);
    }

    const fourteenAgo = new Date();
    fourteenAgo.setDate(fourteenAgo.getDate() - 14);
    const fromDate = getDateString(fourteenAgo);

    const { data: plans } = await sb.from('day_plans').select('plan_date, plan').eq('user_id', uid).gte('plan_date', fromDate);
    _dayPlans.clear();
    if (plans) for (const r of plans) _dayPlans.set(r.plan_date, r.plan as DayPlan);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const qFrom = getDateString(yesterday);

    const { data: queues } = await sb.from('task_queues').select('kind, queue_date, tasks').eq('user_id', uid).gte('queue_date', qFrom);
    _deferredTasks.clear();
    _plannedTasks.clear();
    if (queues) {
      for (const r of queues) {
        const t = (r.tasks as Task[]) || [];
        if (r.kind === 'deferred') _deferredTasks.set(r.queue_date, t);
        else _plannedTasks.set(r.queue_date, t);
      }
    }

    _hydrated = true;
    _hydrateCount++;
    notify();
    saveOfflineCache();
    return { ok: true };
  } catch (e) {
    if (loadOfflineCache(uid)) {
      _hydrated = true;
      _hydrateCount++;
      notify();
      return { ok: true };
    }
    throw e;
  }
}

export async function sync(): Promise<void> {
  if (!_userId || !_hydrated) return;
  await flushAll();
  if (_writesInFlight > 0 || _failedWrites.length > 0) return;
  try { await hydrate(_userId); } catch (e) { console.warn('Sync failed:', e); }
}

export async function flushAll(): Promise<void> {
  if (_settingsTimer) { clearTimeout(_settingsTimer); _settingsTimer = null; await flushSettings(); }
  const batch = [..._failedWrites]; _failedWrites.length = 0;
  for (const fn of batch) { try { await fn(); } catch { _failedWrites.push(fn); } }
}

export function clear(): void {
  _userId = null; _settings = null;
  _dayPlans.clear(); _deferredTasks.clear(); _plannedTasks.clear();
  _hydrated = false; _failedWrites.length = 0;
  if (_settingsTimer) { clearTimeout(_settingsTimer); _settingsTimer = null; }
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
  _retryAttempt = 0;
  notify();
}

// ---- offline cache ----

const OFFLINE_PREFIX = 'dayos_cache_';

function saveOfflineCache(): void {
  if (!_userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_PREFIX + _userId, JSON.stringify({
      settings: _settings,
      dayPlans: Object.fromEntries(_dayPlans),
      deferredTasks: Object.fromEntries(_deferredTasks),
      plannedTasks: Object.fromEntries(_plannedTasks),
    }));
  } catch {}
}

function loadOfflineCache(uid: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(OFFLINE_PREFIX + uid);
    if (!raw) return false;
    const d = JSON.parse(raw);
    _settings = d.settings ? normalizeSettings(d.settings) : null;
    _dayPlans.clear();
    if (d.dayPlans) for (const [k, v] of Object.entries(d.dayPlans)) _dayPlans.set(k, v as DayPlan);
    _deferredTasks.clear();
    if (d.deferredTasks) for (const [k, v] of Object.entries(d.deferredTasks)) _deferredTasks.set(k, v as Task[]);
    _plannedTasks.clear();
    if (d.plannedTasks) for (const [k, v] of Object.entries(d.plannedTasks)) _plannedTasks.set(k, v as Task[]);
    return true;
  } catch { return false; }
}

export function clearOfflineCache(uid: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(OFFLINE_PREFIX + uid); } catch {}
}
