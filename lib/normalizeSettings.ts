import { UserSettings, DayProfile } from './types';

const ALL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const FALLBACK_DEAD_ZONES = { morningRoutine: 35, lunchDuration: 30, dinnerDuration: 30, gymRecovery: 45 };

export function normalizeSettings(raw: unknown): UserSettings {
  if (!raw || typeof raw !== 'object') {
    return emptyShell();
  }

  const s = { ...(raw as Record<string, unknown>) } as any;

  if (!s.wakeTime || typeof s.wakeTime !== 'string') s.wakeTime = '07:00';
  if (!s.sleepTime || typeof s.sleepTime !== 'string') s.sleepTime = '23:00';

  // --- gym ---
  if (!s.gym || typeof s.gym !== 'object') {
    s.gym = { enabled: false, durationMinutes: 75, sessions: nullSessions() };
  } else {
    if (!s.gym.days && !s.gym.sessions) {
      const old = s.gym;
      const freq = old.frequency ?? 4;
      const defaultDays = ['monday', 'wednesday', 'friday', 'saturday', 'sunday'];
      let preferredTime = '17:00';
      if (old.preference === 'morning') preferredTime = '06:30';
      else if (old.preference === 'afternoon') preferredTime = '14:00';
      else if (old.preference === 'evening') preferredTime = '18:00';
      s.gym = { enabled: old.enabled ?? true, durationMinutes: old.duration ?? 75, preferredTime, days: defaultDays.slice(0, freq) };
    }
    if (s.gym.days && !s.gym.sessions) {
      const { preferredTime, days, enabled, durationMinutes } = s.gym;
      const sessions: Record<string, string | null> = {};
      for (const d of ALL_DAYS) sessions[d] = (days || []).includes(d) ? (preferredTime || '17:00') : null;
      s.gym = { enabled: enabled ?? true, durationMinutes: durationMinutes ?? 75, sessions };
    }
    if (!s.gym.sessions) s.gym.sessions = nullSessions();
    for (const d of ALL_DAYS) { if (!(d in s.gym.sessions)) s.gym.sessions[d] = null; }
    if (typeof s.gym.enabled !== 'boolean') s.gym.enabled = false;
    if (typeof s.gym.durationMinutes !== 'number') s.gym.durationMinutes = 75;
  }

  // --- schedule ---
  if (!s.schedule || typeof s.schedule !== 'object') s.schedule = {};
  for (const d of ALL_DAYS) { if (!Array.isArray(s.schedule[d])) s.schedule[d] = []; }

  // --- dead zones ---
  if (!s.deadZones || typeof s.deadZones !== 'object') {
    s.deadZones = { ...FALLBACK_DEAD_ZONES };
  } else {
    for (const f of ['morningRoutine', 'lunchDuration', 'dinnerDuration', 'gymRecovery'] as const) {
      if (typeof s.deadZones[f] !== 'number') s.deadZones[f] = FALLBACK_DEAD_ZONES[f];
    }
  }

  // --- day types ---
  if (!s.dayTypes || typeof s.dayTypes !== 'object') {
    s.dayTypes = {} as Record<string, DayProfile>;
  }
  const valid: DayProfile[] = ['moderate', 'heavy', 'low-capacity', 'free'];
  for (const d of ALL_DAYS) {
    if (!valid.includes(s.dayTypes[d])) s.dayTypes[d] = 'moderate';
  }

  return s as UserSettings;
}

function nullSessions(): Record<string, null> {
  return Object.fromEntries(ALL_DAYS.map(d => [d, null]));
}

function emptyShell(): UserSettings {
  return {
    wakeTime: '07:00',
    sleepTime: '23:00',
    gym: { enabled: false, durationMinutes: 75, sessions: nullSessions() as any },
    schedule: Object.fromEntries(ALL_DAYS.map(d => [d, []])),
    deadZones: { ...FALLBACK_DEAD_ZONES },
    dayTypes: Object.fromEntries(ALL_DAYS.map(d => [d, 'moderate' as DayProfile])),
  };
}
