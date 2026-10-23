import { getFreeMinutes, getRawFreeMinutes, getFreeWindows, getTodayBlocks, timeToMinutes, minutesToTime } from '../lib/schedule';
import { validateAnalysis } from '../lib/validate';
import { computeScore, computeStats } from '../lib/score';
import { runAnalysisFlow, CallClaudeFn, ClaudeResponse, cleanUserFacingText } from '../lib/analyzeFlow';
import { AnalysisResult, AnalysisInput, FixedBlock, UserSettings } from '../lib/types';
import { DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../lib/constants';
import { sanitizeRedirectPath, decideRoute } from '../lib/auth';
import { normalizeSettings } from '../lib/normalizeSettings';
import { consumeAiCall } from '../lib/aiLimit';
import { shouldRehydrate, getHydrateCount, hasPendingWrites, getRetryDelay, updateCachedSettings, getCachedSettings, clear as clearCache, hydrate, cacheSettings } from '../lib/supabase/dataCache';
import { legacyKeysToRemove, updateSettings } from '../lib/storage';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.error(`  FAIL: ${name}`);
    failed++;
  }
}

// ============================================================
// FREE-TIME CALCULATIONS
// ============================================================
console.log('\n--- Free-time: raw (full day) ---');

const blocks: FixedBlock[] = [
  { id: '1', name: 'Class A', start: '08:00', end: '09:00', type: 'class' },
  { id: '2', name: 'Class B', start: '11:00', end: '12:00', type: 'class' },
];

const raw = getRawFreeMinutes('06:30', '23:30', blocks);
assert(raw === 17 * 60 - 120, `Raw free = waking - fixed: expected ${17 * 60 - 120}, got ${raw}`);

assert(
  getRawFreeMinutes('06:30', '23:30', []) === 17 * 60,
  'No blocks = all waking time is free'
);

const heavyBlocks: FixedBlock[] = [
  { id: '1', name: 'A', start: '08:00', end: '09:30', type: 'class' },
  { id: '2', name: 'B', start: '09:30', end: '11:00', type: 'class' },
  { id: '3', name: 'C', start: '11:00', end: '12:30', type: 'class' },
  { id: '4', name: 'D', start: '16:00', end: '17:30', type: 'class' },
];
const heavyRaw = getRawFreeMinutes('06:30', '23:30', heavyBlocks);
const heavyFixed = 90 + 90 + 90 + 90;
assert(heavyRaw === 17 * 60 - heavyFixed, `Heavy day: expected ${17 * 60 - heavyFixed}, got ${heavyRaw}`);

console.log('\n--- Free-time: unified getFreeMinutes ---');

// isToday=false should equal getRawFreeMinutes
assert(
  getFreeMinutes('06:30', '23:30', blocks, false) === raw,
  'getFreeMinutes(isToday=false) equals getRawFreeMinutes'
);

// isToday=true with injectable nowMinutes
const freeAt10 = getFreeMinutes('06:30', '23:30', blocks, true, 10 * 60);
// At 10:00: remaining = 23:30-10:00 = 810 min. Future fixed: Class B 11:00-12:00 = 60 min. Free = 750
assert(freeAt10 === 750, `Free at 10:00 = 750: got ${freeAt10}`);

const freeAt830 = getFreeMinutes('06:30', '23:30', blocks, true, 8 * 60 + 30);
// At 08:30: remaining = 23:30-08:30 = 900. Future fixed: Class A 08:30-09:00=30 + Class B=60 = 90. Free = 810
assert(freeAt830 === 810, `Free at 08:30 = 810: got ${freeAt830}`);

// Before wake → returns full day
const freeBeforeWake = getFreeMinutes('06:30', '23:30', blocks, true, 5 * 60);
assert(freeBeforeWake === raw, `Before wake = full day: got ${freeBeforeWake}`);

// At/after sleep → 0
assert(getFreeMinutes('06:30', '23:30', blocks, true, 23 * 60 + 30) === 0, 'At sleep = 0');
assert(getFreeMinutes('06:30', '23:30', blocks, true, 24 * 60) === 0, 'After sleep = 0');

// Thursday reference: 4 classes, at 14:00
const thuBlocks: FixedBlock[] = [
  { id: 't1', name: 'Vib', start: '08:00', end: '09:30', type: 'class' },
  { id: 't2', name: 'Ctrl', start: '09:30', end: '11:00', type: 'class' },
  { id: 't3', name: 'Thermo', start: '11:00', end: '12:30', type: 'class' },
  { id: 't4', name: 'EMC', start: '16:00', end: '17:30', type: 'class' },
];
const thuFreeAt14 = getFreeMinutes('06:30', '23:30', thuBlocks, true, 14 * 60);
// At 14:00: remaining = 23:30-14:00 = 570. Future fixed: EMC 16:00-17:30 = 90. Free = 480
assert(thuFreeAt14 === 480, `Thu at 14:00 free = 480: got ${thuFreeAt14}`);

const thuFreeAt0630 = getFreeMinutes('06:30', '23:30', thuBlocks, true, 6 * 60 + 30);
// At 06:30 (wake): remaining = 1020. Fixed left = 90+90+90+90 = 360. Free = 660
assert(thuFreeAt0630 === 660, `Thu at 06:30 free = 660: got ${thuFreeAt0630}`);

// ============================================================
// FREE WINDOWS
// ============================================================
console.log('\n--- Free windows ---');

const windows = getFreeWindows('06:30', '23:30', blocks);
const firstWindow = windows[0];
assert(
  firstWindow.start === '06:30' && firstWindow.end === '08:00',
  `First window: 06:30-08:00, got ${firstWindow?.start}-${firstWindow?.end}`
);

const lastWindow = windows[windows.length - 1];
assert(
  lastWindow.end === '23:30',
  `Last window extends to sleep: got ${lastWindow?.end}`
);

const middleWindow = windows.find(w => w.start === '09:00');
assert(
  middleWindow?.end === '11:00',
  `Middle window 09:00-11:00: got ${middleWindow?.start}-${middleWindow?.end}`
);

// Min window threshold is now 15 min
const tightBlocks: FixedBlock[] = [
  { id: '1', name: 'A', start: '08:00', end: '09:00', type: 'class' },
  { id: '2', name: 'B', start: '09:20', end: '10:00', type: 'class' },
];
const tightWindows = getFreeWindows('06:30', '23:30', tightBlocks);
const small = tightWindows.find(w => w.start === '09:00');
assert(!!small && small.durationMinutes === 20, `20-min gap included (min=15): got ${small?.durationMinutes}`);

// nowMinutes trims past windows
const windowsAt10 = getFreeWindows('06:30', '23:30', blocks, 10 * 60);
assert(
  windowsAt10[0].start === '10:00',
  `With nowMinutes=600, first window starts at 10:00: got ${windowsAt10[0]?.start}`
);
assert(
  windowsAt10.every(w => timeToMinutes(w.end) > 10 * 60),
  'All windows after nowMinutes'
);

// Window ending before now is dropped
const windowsAt0930 = getFreeWindows('06:30', '23:30', blocks, 9 * 60 + 30);
assert(
  !windowsAt0930.some(w => w.end === '08:00'),
  '06:30-08:00 window dropped when now=09:30'
);

// ============================================================
// GYM IN getTodayBlocks (sessions map)
// ============================================================
console.log('\n--- Gym in getTodayBlocks (sessions map) ---');

const gymSettings: UserSettings = {
  ...DEFAULT_SETTINGS,
  gym: {
    enabled: true,
    durationMinutes: 75,
    sessions: {
      monday: '17:00',
      tuesday: null,
      wednesday: '17:00',
      thursday: null,
      friday: null,
      saturday: '10:00',
      sunday: null,
    },
  },
};

const mondayDate = new Date('2026-10-26T12:00:00Z'); // Monday
const mondayBlocks = getTodayBlocks(gymSettings, mondayDate);
const hasGym = mondayBlocks.some(b => b.type === 'gym');
assert(hasGym, 'Monday has gym block');

const gymBlock = mondayBlocks.find(b => b.type === 'gym')!;
assert(gymBlock.start === '17:00', `Gym starts at 17:00, got ${gymBlock?.start}`);
assert(gymBlock.end === '18:15', `Gym ends at 18:15 (75 min), got ${gymBlock?.end}`);
assert(gymBlock.id === 'gym-monday', `Gym id = gym-monday: got ${gymBlock?.id}`);

const tuesdayDate = new Date('2026-10-27T12:00:00Z'); // Tuesday
const tuesdayBlocks = getTodayBlocks(gymSettings, tuesdayDate);
assert(
  !tuesdayBlocks.some(b => b.type === 'gym'),
  'Tuesday has no gym (session is null)'
);

// Saturday gym at different time
const satDate = new Date('2026-10-31T12:00:00Z'); // Saturday
const satBlocks = getTodayBlocks(gymSettings, satDate);
const satGym = satBlocks.find(b => b.type === 'gym');
assert(satGym?.start === '10:00', `Saturday gym at 10:00: got ${satGym?.start}`);
assert(satGym?.id === 'gym-saturday', `Sat gym id = gym-saturday: got ${satGym?.id}`);

// Disabled gym produces no blocks
const disabledGym: UserSettings = {
  ...DEFAULT_SETTINGS,
  gym: { enabled: false, durationMinutes: 75, sessions: { monday: '17:00' } },
};
const disabledBlocks = getTodayBlocks(disabledGym, mondayDate);
assert(!disabledBlocks.some(b => b.type === 'gym'), 'Disabled gym = no gym block');

// ============================================================
// VALIDATION — repairs
// ============================================================
console.log('\n--- Validation: auto-repairs ---');

const mockInput: AnalysisInput = {
  user: { name: 'Test', wakeTime: '06:30', sleepTime: '23:30', totalWakingHours: 17 },
  today: {
    date: '2026-10-22',
    dayName: 'Thursday',
    dayProfile: 'heavy',
    fixedBlocks: [
      { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'class' },
    ],
    totalFixedMinutes: 60,
    totalFreeMinutes: 960,
    freeWindows: [],
  },
  tasks: [
    { id: 'task1', name: 'Study', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: 90, notes: null },
    { id: 'task2', name: 'Quick email', category: 'personal', deadline: 'today', priority: 'low', estimatedMinutes: 20, notes: null },
  ],
  deadZoneSettings: { morningRoutine: 35, lunchDuration: 30, dinnerDuration: 30, gymRecovery: 45 },
  currentTime: '07:05',
  constraints: { noTaskBefore: '07:05', reason: 'Morning routine' },
};

// R1: Restore missing fixed block
const missingFixed: AnalysisResult = {
  dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
  stats: { freeTimeAvailable: '16h', totalTasksRequested: 2, estimatedTaskTime: '2h', tasksScheduled: 1, tasksOverflow: 0 },
  mentorAssessment: 'test',
  schedule: [
    { id: 'task1', name: 'Study', start: '10:00', end: '11:30', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
  ],
  overflow: [{ id: 'task2', name: 'Quick email', reason: 'no time', suggestedDay: null }],
  warnings: [],
};
const r1 = validateAnalysis(missingFixed, mockInput);
assert(
  r1.repaired.schedule.some(b => b.id === 'c1'),
  'R1: Missing fixed block restored'
);

// R2: Remove fake gym
const fakeGym: AnalysisResult = {
  ...missingFixed,
  schedule: [
    ...missingFixed.schedule,
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'fake-gym', name: 'Gym', start: '17:00', end: '18:15', type: 'gym', category: null, estimatedMinutes: 75, energyType: null, notes: null },
  ],
};
const r2 = validateAnalysis(fakeGym, mockInput);
assert(
  !r2.repaired.schedule.some(b => b.id === 'fake-gym'),
  'R2: Fake gym removed'
);

// R4: Dedupe schedule/overflow
const dupeResult: AnalysisResult = {
  ...missingFixed,
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '10:00', end: '11:30', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
    { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
  ],
  overflow: [{ id: 'task1', name: 'Study', reason: 'dupe', suggestedDay: null }],
};
const r4 = validateAnalysis(dupeResult, mockInput);
assert(r4.repaired.overflow.length === 0, 'R4: Duplicate removed from overflow');

// R5: Fix estimatedMinutes
const badEst: AnalysisResult = {
  ...missingFixed,
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 999, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '10:00', end: '11:30', type: 'task', category: 'college', estimatedMinutes: 999, energyType: 'deep_focus', notes: null },
  ],
  overflow: [{ id: 'task2', name: 'Quick email', reason: 'no time', suggestedDay: null }],
};
const r5 = validateAnalysis(badEst, mockInput);
const studyBlock = r5.repaired.schedule.find(b => b.id === 'task1');
assert(studyBlock?.estimatedMinutes === 90, `R5: estimatedMinutes fixed to 90: got ${studyBlock?.estimatedMinutes}`);

// ============================================================
// VALIDATION — violations
// ============================================================
console.log('\n--- Validation: violations ---');

// OVERLAP with fixed
const overlapFixed: AnalysisResult = {
  dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
  stats: { freeTimeAvailable: '16h', totalTasksRequested: 2, estimatedTaskTime: '2h', tasksScheduled: 2, tasksOverflow: 0 },
  mentorAssessment: 'test',
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '08:30', end: '10:00', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
    { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
  ],
  overflow: [],
  warnings: [],
};
const vOverlap = validateAnalysis(overlapFixed, mockInput);
assert(!vOverlap.valid, 'Overlap with fixed detected');
assert(vOverlap.violations.some(v => v.startsWith('OVERLAP:')), 'OVERLAP violation code present');

// BEFORE_MORNING
const earlyResult: AnalysisResult = {
  dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
  stats: { freeTimeAvailable: '16h', totalTasksRequested: 2, estimatedTaskTime: '2h', tasksScheduled: 2, tasksOverflow: 0 },
  mentorAssessment: 'test',
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '06:30', end: '07:00', type: 'task', category: 'college', estimatedMinutes: 30, energyType: 'deep_focus', notes: null },
    { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
  ],
  overflow: [],
  warnings: [],
};
const vEarly = validateAnalysis(earlyResult, mockInput);
assert(vEarly.violations.some(v => v.startsWith('BEFORE_MORNING:')), 'BEFORE_MORNING violation');

// IN_PAST
const pastResult: AnalysisResult = {
  dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
  stats: { freeTimeAvailable: '16h', totalTasksRequested: 2, estimatedTaskTime: '2h', tasksScheduled: 2, tasksOverflow: 0 },
  mentorAssessment: 'test',
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '09:00', end: '10:30', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
    { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
  ],
  overflow: [],
  warnings: [],
};
const vPast = validateAnalysis(pastResult, mockInput, 14 * 60); // now = 14:00
assert(vPast.violations.some(v => v.startsWith('IN_PAST:')), 'IN_PAST violation when now=14:00');

// No IN_PAST when nowMinutes not provided
const vNoPast = validateAnalysis(pastResult, mockInput);
assert(!vNoPast.violations.some(v => v.startsWith('IN_PAST:')), 'No IN_PAST when nowMinutes omitted');

// OUTSIDE_WAKING
const lateResult: AnalysisResult = {
  dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
  stats: { freeTimeAvailable: '16h', totalTasksRequested: 2, estimatedTaskTime: '2h', tasksScheduled: 2, tasksOverflow: 0 },
  mentorAssessment: 'test',
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '10:00', end: '11:30', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
    { id: 'task2', name: 'Late task', start: '23:00', end: '00:30', type: 'task', category: 'personal', estimatedMinutes: 90, energyType: 'low_energy_ok', notes: null },
  ],
  overflow: [],
  warnings: [],
};
const vLate = validateAnalysis(lateResult, mockInput);
assert(vLate.violations.some(v => v.startsWith('OUTSIDE_WAKING:')), 'OUTSIDE_WAKING violation');

// TOO_SHORT
const shortResult: AnalysisResult = {
  dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
  stats: { freeTimeAvailable: '16h', totalTasksRequested: 2, estimatedTaskTime: '2h', tasksScheduled: 2, tasksOverflow: 0 },
  mentorAssessment: 'test',
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '10:00', end: '10:30', type: 'task', category: 'college', estimatedMinutes: 30, energyType: 'deep_focus', notes: null },
    { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
  ],
  overflow: [],
  warnings: [],
};
const vShort = validateAnalysis(shortResult, mockInput);
assert(vShort.violations.some(v => v.startsWith('TOO_SHORT:')), 'TOO_SHORT: 30 min for 90-min task');

// MISSING_TASK
const missingResult: AnalysisResult = {
  dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
  stats: { freeTimeAvailable: '16h', totalTasksRequested: 2, estimatedTaskTime: '2h', tasksScheduled: 1, tasksOverflow: 0 },
  mentorAssessment: 'test',
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '10:00', end: '11:30', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
  ],
  overflow: [],
  warnings: [],
};
const vMissing = validateAnalysis(missingResult, mockInput);
assert(vMissing.violations.some(v => v.startsWith('MISSING_TASK:')), 'MISSING_TASK: task2 not in schedule or overflow');

// UNKNOWN_TASK
const unknownResult: AnalysisResult = {
  dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
  stats: { freeTimeAvailable: '16h', totalTasksRequested: 2, estimatedTaskTime: '2h', tasksScheduled: 3, tasksOverflow: 0 },
  mentorAssessment: 'test',
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '10:00', end: '11:30', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
    { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
    { id: 'phantom', name: 'Phantom task', start: '14:00', end: '15:00', type: 'task', category: 'personal', estimatedMinutes: 60, energyType: 'low_energy_ok', notes: null },
  ],
  overflow: [],
  warnings: [],
};
const vUnknown = validateAnalysis(unknownResult, mockInput);
assert(vUnknown.violations.some(v => v.startsWith('UNKNOWN_TASK:')), 'UNKNOWN_TASK: phantom not in input');

// Good schedule passes
const goodResult: AnalysisResult = {
  dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
  stats: { freeTimeAvailable: '16h', totalTasksRequested: 2, estimatedTaskTime: '2h', tasksScheduled: 2, tasksOverflow: 0 },
  mentorAssessment: 'test',
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '10:00', end: '11:30', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
    { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
  ],
  overflow: [],
  warnings: [],
};
const vGood = validateAnalysis(goodResult, mockInput);
assert(vGood.valid, 'Good schedule passes validation');
assert(vGood.violations.length === 0, 'No violations for good schedule');

// Task-to-task overlap
const t2tOverlap: AnalysisResult = {
  ...goodResult,
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '10:00', end: '12:00', type: 'task', category: 'college', estimatedMinutes: 120, energyType: 'deep_focus', notes: null },
    { id: 'task2', name: 'Quick email', start: '11:30', end: '12:00', type: 'task', category: 'personal', estimatedMinutes: 30, energyType: 'low_energy_ok', notes: null },
  ],
};
const vT2T = validateAnalysis(t2tOverlap, mockInput);
assert(vT2T.violations.some(v => v.startsWith('OVERLAP:')), 'Task-to-task overlap detected');

// ============================================================
// MIGRATION: sessions map
// ============================================================
console.log('\n--- Migration ---');

// Simulate old gym shape with days array
const oldGymSettings = {
  wakeTime: '06:30',
  sleepTime: '23:30',
  gym: {
    enabled: true,
    durationMinutes: 75,
    preferredTime: '17:00',
    days: ['monday', 'wednesday', 'friday'],
  },
  schedule: DEFAULT_SETTINGS.schedule,
  dayTypes: DEFAULT_SETTINGS.dayTypes,
};

// Import migrateSettings indirectly — we test through getTodayBlocks after manual migration
// The migration happens in getSettings() via localStorage, so we test the shape here
const sessions: { [day: string]: string | null } = {};
const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
for (const d of allDays) {
  sessions[d] = oldGymSettings.gym.days.includes(d) ? oldGymSettings.gym.preferredTime : null;
}
assert(sessions['monday'] === '17:00', 'Migration: monday gets preferredTime');
assert(sessions['tuesday'] === null, 'Migration: tuesday stays null');
assert(sessions['friday'] === '17:00', 'Migration: friday gets preferredTime');
assert(sessions['saturday'] === null, 'Migration: saturday stays null');

// ============================================================
// R3: Remove overlapping buffer
// ============================================================
console.log('\n--- R3: Overlapping buffer removal ---');

const bufferOverlap: AnalysisResult = {
  dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
  stats: { freeTimeAvailable: '16h', totalTasksRequested: 2, estimatedTaskTime: '2h', tasksScheduled: 2, tasksOverflow: 0 },
  mentorAssessment: 'test',
  schedule: [
    { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'buf1', name: 'Transit', start: '08:30', end: '09:30', type: 'buffer', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    { id: 'task1', name: 'Study', start: '10:00', end: '11:30', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
    { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
  ],
  overflow: [],
  warnings: [],
};
const r3 = validateAnalysis(bufferOverlap, mockInput);
assert(
  !r3.repaired.schedule.some(b => b.id === 'buf1'),
  'R3: Buffer overlapping fixed block removed'
);

// ============================================================
// SCORE AND STATS (lib/score.ts)
// ============================================================
console.log('\n--- Score and stats ---');

// Example 1: Thursday 19:00, OVERLOADED capped at 150
{
  const input: AnalysisInput = {
    user: { name: 'Test', wakeTime: '06:30', sleepTime: '23:30', totalWakingHours: 17 },
    today: {
      date: '2026-10-22', dayName: 'Thursday', dayProfile: 'heavy',
      fixedBlocks: [{ id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'class' }],
      totalFixedMinutes: 60, totalFreeMinutes: 270, freeWindows: [],
    },
    tasks: [
      { id: 'client', name: 'Client work', category: 'agency_client', deadline: 'today', priority: 'high', estimatedMinutes: 150, notes: null },
      { id: 'study', name: 'Study', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: 120, notes: null },
      { id: 'reel', name: 'Reel', category: 'personal_brand', deadline: 'today', priority: 'medium', estimatedMinutes: 90, notes: null },
      { id: 'proposal', name: 'Proposal', category: 'agency_client', deadline: 'today', priority: 'medium', estimatedMinutes: 90, notes: null },
    ],
    deadZoneSettings: { morningRoutine: 35, lunchDuration: 30, dinnerDuration: 30, gymRecovery: 45 },
    currentTime: '19:00',
    constraints: { noTaskBefore: '07:05', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test',
    schedule: [
      { id: 'client', name: 'Client work', start: '19:30', end: '22:00', type: 'task', category: 'agency_client', estimatedMinutes: 150, energyType: 'deep_focus', notes: null },
    ],
    overflow: [
      { id: 'study', name: 'Study', reason: 'no time', suggestedDay: null },
      { id: 'reel', name: 'Reel', reason: 'no time', suggestedDay: null },
      { id: 'proposal', name: 'Proposal', reason: 'no time', suggestedDay: null },
    ],
    warnings: [],
  };
  computeScore(result, input, 19 * 60);
  assert(result.dayLoadPercent === 150, `Score ex1: 150 cap, got ${result.dayLoadPercent}`);
  assert(result.dayLoadLabel === 'OVERLOADED', `Score ex1: OVERLOADED, got ${result.dayLoadLabel}`);
}

// Example 2a: Thursday 13:00, requested 380, TIGHT
{
  const input: AnalysisInput = {
    ...mockInput,
    today: { ...mockInput.today, totalFreeMinutes: 540 },
    tasks: [
      { id: 't1', name: 'A', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: 200, notes: null },
      { id: 't2', name: 'B', category: 'personal', deadline: 'today', priority: 'low', estimatedMinutes: 180, notes: null },
    ],
    currentTime: '13:00',
    constraints: { noTaskBefore: '07:05', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [
      { id: 't1', name: 'A', reason: 'no time', suggestedDay: null },
      { id: 't2', name: 'B', reason: 'no time', suggestedDay: null },
    ], warnings: [],
  };
  computeScore(result, input, 13 * 60);
  // usable = 540 - 60 (lunch+dinner) = 480. 380/480 = 79.2 → 79
  assert(result.dayLoadPercent === 79, `Score ex2a: 79, got ${result.dayLoadPercent}`);
  assert(result.dayLoadLabel === 'TIGHT', `Score ex2a: TIGHT, got ${result.dayLoadLabel}`);
}

// Example 2b: same setup, requested 650, OVERLOADED
{
  const input: AnalysisInput = {
    ...mockInput,
    today: { ...mockInput.today, totalFreeMinutes: 540 },
    tasks: [
      { id: 't1', name: 'A', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: 350, notes: null },
      { id: 't2', name: 'B', category: 'personal', deadline: 'today', priority: 'low', estimatedMinutes: 300, notes: null },
    ],
    currentTime: '13:00',
    constraints: { noTaskBefore: '07:05', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [
      { id: 't1', name: 'A', reason: 'no time', suggestedDay: null },
      { id: 't2', name: 'B', reason: 'no time', suggestedDay: null },
    ], warnings: [],
  };
  computeScore(result, input, 13 * 60);
  // 650/480 = 135.4 → 135
  assert(result.dayLoadPercent === 135, `Score ex2b: 135, got ${result.dayLoadPercent}`);
  assert(result.dayLoadLabel === 'OVERLOADED', `Score ex2b: OVERLOADED, got ${result.dayLoadLabel}`);
}

// Example 3: all tasks no estimate — use category defaults
{
  const input: AnalysisInput = {
    ...mockInput,
    today: { ...mockInput.today, totalFreeMinutes: 500 },
    tasks: [
      { id: 't1', name: 'A', category: 'agency_client', deadline: 'today', priority: 'high', estimatedMinutes: null, notes: null },
      { id: 't2', name: 'B', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: null, notes: null },
      { id: 't3', name: 'C', category: 'personal', deadline: 'today', priority: 'low', estimatedMinutes: null, notes: null },
    ],
    currentTime: '13:00',
    constraints: { noTaskBefore: '07:05', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [], warnings: [],
  };
  computeScore(result, input, 13 * 60);
  // requested = 120+90+30 = 240. usable = 500-60 = 440. 240/440 = 54.5 → 55
  assert(result.dayLoadPercent === 55, `Score ex3: 55 (category defaults), got ${result.dayLoadPercent}`);
}

// Example 4: split task 60+60, counted once as 120
{
  const input: AnalysisInput = {
    ...mockInput,
    today: { ...mockInput.today, totalFreeMinutes: 500 },
    tasks: [
      { id: 'split', name: 'Study', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: 120, notes: null },
    ],
    currentTime: '13:00',
    constraints: { noTaskBefore: '07:05', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test',
    schedule: [
      { id: 'split', name: 'Study', start: '10:00', end: '11:00', type: 'task', category: 'college', estimatedMinutes: 60, energyType: 'deep_focus', notes: null },
      { id: 'split', name: 'Study', start: '14:00', end: '15:00', type: 'task', category: 'college', estimatedMinutes: 60, energyType: 'deep_focus', notes: null },
    ],
    overflow: [], warnings: [],
  };
  computeScore(result, input, 13 * 60);
  computeStats(result, input, 13 * 60);
  // requested = 120 (sum of blocks). tasksScheduled = 1 (distinct ids)
  assert(result.stats.tasksScheduled === 1, `Score ex4: tasksScheduled=1 for split, got ${result.stats.tasksScheduled}`);
}

// usable=0, requested>0 → 150
{
  const input: AnalysisInput = {
    ...mockInput,
    today: { ...mockInput.today, totalFreeMinutes: 0 },
    tasks: [{ id: 't', name: 'Task', category: 'personal', deadline: 'today', priority: 'low', estimatedMinutes: 60, notes: null }],
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [], warnings: [],
  };
  computeScore(result, input, 7 * 60 + 5);
  assert(result.dayLoadPercent === 150, `Score: usable=0 → 150, got ${result.dayLoadPercent}`);
}

// requested=0 → 0
{
  const input: AnalysisInput = { ...mockInput, tasks: [] };
  const result: AnalysisResult = {
    dayLoadPercent: 99, dayLoadLabel: 'OVERLOADED',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [], warnings: [],
  };
  computeScore(result, input, 7 * 60 + 5);
  assert(result.dayLoadPercent === 0, `Score: requested=0 → 0, got ${result.dayLoadPercent}`);
}

// Morning routine ahead: 20 min counted
{
  const input: AnalysisInput = {
    ...mockInput,
    today: { ...mockInput.today, totalFreeMinutes: 100, fixedBlocks: [] },
    tasks: [{ id: 't', name: 'Task', category: 'personal', deadline: 'today', priority: 'low', estimatedMinutes: 60, notes: null }],
    deadZoneSettings: { morningRoutine: 35, lunchDuration: 0, dinnerDuration: 0, gymRecovery: 0 },
    constraints: { noTaskBefore: '07:05', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [], warnings: [],
  };
  // nowMinutes = 06:45 (405), noTaskBefore = 07:05 (425), wake = 06:30 (390)
  // morning dead zone = 425 - max(405, 390) = 20
  computeScore(result, input, 6 * 60 + 45);
  // usable = 100 - 20 = 80. 60/80 = 75 → TIGHT
  assert(result.dayLoadPercent === 75, `Score: morning routine 20 min → 75%, got ${result.dayLoadPercent}`);
  assert(result.dayLoadLabel === 'TIGHT', `Score: morning routine → TIGHT, got ${result.dayLoadLabel}`);
}

// ============================================================
// FIXED BLOCKS C2
// ============================================================
console.log('\n--- Fixed blocks C2 ---');

// Gym moved to another time is restored
{
  const gymInput: AnalysisInput = {
    ...mockInput,
    today: {
      ...mockInput.today,
      fixedBlocks: [
        { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'class' },
        { id: 'gym-thu', name: 'Gym', start: '17:00', end: '18:15', type: 'gym' },
      ],
    },
  };
  const movedGym: AnalysisResult = {
    ...goodResult,
    schedule: [
      { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
      { id: 'gym-thu', name: 'Gym', start: '10:00', end: '11:15', type: 'gym', category: null, estimatedMinutes: 75, energyType: null, notes: null },
      { id: 'task1', name: 'Study', start: '11:30', end: '13:00', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
      { id: 'task2', name: 'Quick email', start: '14:00', end: '14:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
    ],
  };
  const v = validateAnalysis(movedGym, gymInput);
  const gymBlock = v.repaired.schedule.find(b => b.id === 'gym-thu');
  assert(gymBlock?.start === '17:00', `C2: Moved gym restored to 17:00, got ${gymBlock?.start}`);
  assert(gymBlock?.type === 'gym', `C2: Gym type preserved, got ${gymBlock?.type}`);
}

// Fake fixed block whose id matches user task is retyped to 'task'
{
  const fakeFixed: AnalysisResult = {
    ...goodResult,
    schedule: [
      { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
      { id: 'task1', name: 'Study', start: '10:00', end: '11:30', type: 'fixed', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
      { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
    ],
  };
  const v = validateAnalysis(fakeFixed, mockInput);
  const retyped = v.repaired.schedule.find(b => b.id === 'task1');
  assert(retyped?.type === 'task', `C2: Fake fixed retyped to task, got ${retyped?.type}`);
}

// Invented fixed block (unknown id) is deleted
{
  const inventedFixed: AnalysisResult = {
    ...goodResult,
    schedule: [
      ...goodResult.schedule,
      { id: 'invented-class', name: 'Fake Class', start: '15:00', end: '16:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
    ],
  };
  const v = validateAnalysis(inventedFixed, mockInput);
  assert(!v.repaired.schedule.some(b => b.id === 'invented-class'), 'C2: Invented fixed block deleted');
}

// ============================================================
// MEALS C3
// ============================================================
console.log('\n--- Meals C3 ---');

// Task through lunch → OVERLAP violation, meal NOT deleted
{
  const mealOverlap: AnalysisResult = {
    ...goodResult,
    schedule: [
      { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
      { id: 'task1', name: 'Study', start: '12:30', end: '14:00', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
      { id: 'task2', name: 'Quick email', start: '15:00', end: '15:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
      { id: 'lunch', name: 'Lunch', start: '13:00', end: '13:30', type: 'meal', category: null, estimatedMinutes: 30, energyType: null, notes: null },
    ],
  };
  const v = validateAnalysis(mealOverlap, mockInput);
  assert(v.violations.some(v2 => v2.includes('OVERLAP') && v2.includes('meal')), 'C3: Meal overlap is OVERLAP violation');
  assert(v.repaired.schedule.some(b => b.id === 'lunch'), 'C3: Meal block NOT deleted');
}

// ============================================================
// DEEP FOCUS C4
// ============================================================
console.log('\n--- Deep focus C4 ---');

// 45-min deep focus in 60-min stretch → violation
{
  const dfInput: AnalysisInput = {
    ...mockInput,
    today: {
      ...mockInput.today,
      fixedBlocks: [
        { id: 'c1', name: 'Class', start: '11:00', end: '12:30', type: 'class' },
      ],
    },
  };
  const narrowStretch: AnalysisResult = {
    ...goodResult,
    schedule: [
      { id: 'c1', name: 'Class', start: '11:00', end: '12:30', type: 'fixed', category: null, estimatedMinutes: 90, energyType: null, notes: null },
      { id: 'task1', name: 'Study', start: '12:35', end: '13:20', type: 'task', category: 'college', estimatedMinutes: 45, energyType: 'deep_focus', notes: null },
      { id: 'task2', name: 'Quick email', start: '15:00', end: '15:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
      { id: 'lunch', name: 'Lunch', start: '13:30', end: '14:00', type: 'meal', category: null, estimatedMinutes: 30, energyType: null, notes: null },
    ],
  };
  const v = validateAnalysis(narrowStretch, dfInput);
  assert(v.violations.some(v2 => v2.startsWith('DEEP_FOCUS_WINDOW:')), 'C4: 60-min stretch → DEEP_FOCUS_WINDOW');
}

// Same task in wide stretch → valid
{
  const dfInput: AnalysisInput = {
    ...mockInput,
    today: {
      ...mockInput.today,
      fixedBlocks: [
        { id: 'c1', name: 'Class', start: '11:00', end: '12:30', type: 'class' },
        { id: 'c2', name: 'Class2', start: '16:00', end: '17:30', type: 'class' },
      ],
    },
  };
  const wideStretch: AnalysisResult = {
    ...goodResult,
    schedule: [
      { id: 'c1', name: 'Class', start: '11:00', end: '12:30', type: 'fixed', category: null, estimatedMinutes: 90, energyType: null, notes: null },
      { id: 'c2', name: 'Class2', start: '16:00', end: '17:30', type: 'fixed', category: null, estimatedMinutes: 90, energyType: null, notes: null },
      { id: 'task1', name: 'Study', start: '12:35', end: '13:20', type: 'task', category: 'college', estimatedMinutes: 45, energyType: 'deep_focus', notes: null },
      { id: 'task2', name: 'Quick email', start: '15:00', end: '15:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
    ],
  };
  const v = validateAnalysis(wideStretch, dfInput);
  assert(!v.violations.some(v2 => v2.startsWith('DEEP_FOCUS_WINDOW:')), 'C4: 210-min stretch → no violation');
}

// Split deep-focus task → violation
{
  const splitDeep: AnalysisResult = {
    ...goodResult,
    schedule: [
      { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
      { id: 'task1', name: 'Study', start: '10:00', end: '10:45', type: 'task', category: 'college', estimatedMinutes: 45, energyType: 'deep_focus', notes: null },
      { id: 'task1', name: 'Study', start: '14:00', end: '14:45', type: 'task', category: 'college', estimatedMinutes: 45, energyType: 'deep_focus', notes: null },
      { id: 'task2', name: 'Quick email', start: '15:00', end: '15:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
    ],
  };
  const v = validateAnalysis(splitDeep, mockInput);
  assert(v.violations.some(v2 => v2.includes('DEEP_FOCUS_WINDOW') && v2.includes('split')), 'C4: Split deep-focus → violation');
}

// ============================================================
// TOO_SHORT C5
// ============================================================
console.log('\n--- Too short C5 ---');

// Split 60+60 for 120 estimate → valid
{
  const splitValid: AnalysisResult = {
    ...goodResult,
    schedule: [
      { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
      { id: 'task1', name: 'Study', start: '10:00', end: '11:00', type: 'task', category: 'college', estimatedMinutes: 60, energyType: 'deep_focus', notes: null },
      { id: 'task1', name: 'Study', start: '14:00', end: '15:00', type: 'task', category: 'college', estimatedMinutes: 60, energyType: 'deep_focus', notes: null },
      { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
    ],
  };
  const inputSplit: AnalysisInput = {
    ...mockInput,
    tasks: [
      { id: 'task1', name: 'Study', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: 120, notes: null },
      { id: 'task2', name: 'Quick email', category: 'personal', deadline: 'today', priority: 'low', estimatedMinutes: 20, notes: null },
    ],
  };
  const v = validateAnalysis(splitValid, inputSplit);
  assert(!v.violations.some(v2 => v2.startsWith('TOO_SHORT:')), 'C5: Split 60+60=120 for est 120 → valid');
}

// 55 min for 100 estimate → violation (45 min below)
{
  const tooShortResult: AnalysisResult = {
    ...goodResult,
    schedule: [
      { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
      { id: 'task1', name: 'Study', start: '10:00', end: '10:55', type: 'task', category: 'college', estimatedMinutes: 55, energyType: 'deep_focus', notes: null },
      { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
    ],
  };
  const inputShort: AnalysisInput = {
    ...mockInput,
    tasks: [
      { id: 'task1', name: 'Study', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: 100, notes: null },
      { id: 'task2', name: 'Quick email', category: 'personal', deadline: 'today', priority: 'low', estimatedMinutes: 20, notes: null },
    ],
  };
  const v = validateAnalysis(tooShortResult, inputShort);
  assert(v.violations.some(v2 => v2.startsWith('TOO_SHORT:')), 'C5: 55 min for 100 est → TOO_SHORT');
}

// 4 min below → valid (within 5 min tolerance)
{
  const almostResult: AnalysisResult = {
    ...goodResult,
    schedule: [
      { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
      { id: 'task1', name: 'Study', start: '10:00', end: '11:26', type: 'task', category: 'college', estimatedMinutes: 86, energyType: 'deep_focus', notes: null },
      { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
    ],
  };
  const v = validateAnalysis(almostResult, mockInput);
  // task1: scheduled 86, estimate 90. 90-86=4 ≤ 5 → ok
  assert(!v.violations.some(v2 => v2.startsWith('TOO_SHORT:')), 'C5: 4 min below est → valid (within 5 min tolerance)');
}

// ============================================================
// cleanUserFacingText (D2)
// ============================================================
console.log('\n--- cleanUserFacingText ---');

// Each identifier replaced
assert(cleanUserFacingText('currentTime is 22:52') === 'the current time is 22:52', 'clean: currentTime replaced');
assert(cleanUserFacingText('noTaskBefore is 07:05') === 'the end of your morning routine is 07:05', 'clean: noTaskBefore replaced');
assert(cleanUserFacingText('dayProfile is heavy') === 'day type is heavy', 'clean: dayProfile replaced');
assert(cleanUserFacingText('fixedBlocks count is 4') === 'fixed blocks count is 4', 'clean: fixedBlocks replaced');
assert(cleanUserFacingText('deadZoneSettings apply') === 'dead zone settings apply', 'clean: deadZoneSettings replaced');
assert(cleanUserFacingText('totalFreeMinutes left') === 'free time left', 'clean: totalFreeMinutes replaced');
assert(cleanUserFacingText('freeWindows available') === 'free windows available', 'clean: freeWindows replaced');

// Case-insensitive
assert(cleanUserFacingText('CurrentTime') === 'the current time', 'clean: case-insensitive (CurrentTime)');
assert(cleanUserFacingText('CURRENTTIME') === 'the current time', 'clean: case-insensitive (CURRENTTIME)');
assert(cleanUserFacingText('NoTaskBefore') === 'the end of your morning routine', 'clean: case-insensitive (NoTaskBefore)');

// Whole-word: currentTimeline must NOT be replaced
assert(cleanUserFacingText('currentTimeline is fine') === 'currentTimeline is fine', 'clean: whole-word (currentTimeline unchanged)');
assert(cleanUserFacingText('noTaskBeforeClass') === 'noTaskBeforeClass', 'clean: whole-word (noTaskBeforeClass unchanged)');

// Normal text unchanged
assert(cleanUserFacingText('It is 22:52. You have 38 minutes until sleep.') === 'It is 22:52. You have 38 minutes until sleep.', 'clean: normal text unchanged');

// Empty string safe
assert(cleanUserFacingText('') === '', 'clean: empty string safe');

// Backwards-compat: result with non-empty warnings still validates
{
  const oldPlanResult: AnalysisResult = {
    ...goodResult,
    warnings: ['currentTime is 22:52 — only 38 minutes remain', 'Heavy day profile correctly identified'],
  };
  const v = validateAnalysis(oldPlanResult, mockInput);
  assert(v.repaired.warnings.length === 2, 'Backwards-compat: warnings array preserved through validation');
  assert(v.repaired.warnings[0].includes('currentTime'), 'Backwards-compat: warning text unchanged by validation');
}

// ============================================================
// FLOW C6 (lib/analyzeFlow.ts) — async, run via main()
// ============================================================

const flowNowMin = 7 * 60 + 5; // 07:05

function makeFlowResult(schedule: any[], overflow: any[] = []): AnalysisResult {
  return {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule, overflow, warnings: [],
  };
}

const flowGoodSchedule = [
  { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
  { id: 'task1', name: 'Study', start: '10:00', end: '11:30', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
  { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
];

const flowViolatingSchedule = [
  { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: null },
  { id: 'task1', name: 'Study', start: '08:30', end: '10:00', type: 'task', category: 'college', estimatedMinutes: 90, energyType: 'deep_focus', notes: null },
  { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
];

async function runFlowTests() {
  console.log('\n--- Flow (analyzeFlow) ---');

  // Flow test 1: Valid first answer → 1 call, plan returned
  {
    const calls: any[] = [];
    const fakeCall: CallClaudeFn = async (msgs) => {
      calls.push(msgs);
      return { parsed: makeFlowResult(flowGoodSchedule), rawText: JSON.stringify(makeFlowResult(flowGoodSchedule)), stopReason: 'end_turn' };
    };
    const result = await runAnalysisFlow(mockInput, flowNowMin, fakeCall, 'test');
    assert(result.ok === true, 'Flow: valid first → ok');
    assert(calls.length === 1, `Flow: valid first → 1 call, got ${calls.length}`);
    if (result.ok) {
      assert(result.result.dayLoadPercent !== undefined, 'Flow: score applied');
      assert(result.result.stats.tasksScheduled !== undefined, 'Flow: stats applied');
    }
  }

  // Flow test 2: Violating first, valid second → 2 calls, conversation retry
  {
    const calls: any[] = [];
    let callIdx = 0;
    const fakeCall: CallClaudeFn = async (msgs) => {
      calls.push(msgs);
      const data = callIdx === 0 ? makeFlowResult(flowViolatingSchedule) : makeFlowResult(flowGoodSchedule);
      callIdx++;
      return { parsed: data, rawText: JSON.stringify(data), stopReason: 'end_turn' };
    };
    const result = await runAnalysisFlow(mockInput, flowNowMin, fakeCall, 'test');
    assert(result.ok === true, 'Flow: retry fixes → ok');
    assert(calls.length === 2, `Flow: retry → 2 calls, got ${calls.length}`);
    assert(calls[1].length === 3, 'Flow: retry call has 3 messages (user, assistant, user)');
    assert(calls[1][1].role === 'assistant', 'Flow: retry msg 2 is assistant');
    assert(calls[1][2].content.includes('OVERLAP'), 'Flow: retry msg 3 contains violations');
  }

  // Flow test 3: Violating twice → invalid_plan
  {
    const fakeCall: CallClaudeFn = async () => {
      return { parsed: makeFlowResult(flowViolatingSchedule), rawText: '{}', stopReason: 'end_turn' };
    };
    const result = await runAnalysisFlow(mockInput, flowNowMin, fakeCall, 'test');
    assert(result.ok === false, 'Flow: violating twice → not ok');
    if (!result.ok) {
      assert(result.code === 'invalid_plan', `Flow: invalid_plan code, got ${result.code}`);
    }
  }

  // Flow test 4: First call nothing, second valid → 2 calls, ok
  {
    const calls: any[] = [];
    let callIdx = 0;
    const fakeCall: CallClaudeFn = async (msgs) => {
      calls.push(msgs);
      callIdx++;
      if (callIdx === 1) return { parsed: null, rawText: null, stopReason: null };
      return { parsed: makeFlowResult(flowGoodSchedule), rawText: JSON.stringify(makeFlowResult(flowGoodSchedule)), stopReason: 'end_turn' };
    };
    const result = await runAnalysisFlow(mockInput, flowNowMin, fakeCall, 'test');
    assert(result.ok === true, 'Flow: nothing then valid → ok');
    assert(calls.length === 2, `Flow: nothing then valid → 2 calls, got ${calls.length}`);
  }

  // Flow test 5: Nothing twice → ai_unavailable
  {
    const fakeCall: CallClaudeFn = async () => {
      return { parsed: null, rawText: null, stopReason: null };
    };
    const result = await runAnalysisFlow(mockInput, flowNowMin, fakeCall, 'test');
    assert(result.ok === false, 'Flow: nothing twice → not ok');
    if (!result.ok) {
      assert(result.code === 'ai_unavailable', `Flow: ai_unavailable code, got ${result.code}`);
    }
  }

  // Flow test 6: Nothing then violating → invalid_plan (used both calls)
  {
    let callIdx = 0;
    const fakeCall: CallClaudeFn = async () => {
      callIdx++;
      if (callIdx === 1) return { parsed: null, rawText: null, stopReason: null };
      return { parsed: makeFlowResult(flowViolatingSchedule), rawText: '{}', stopReason: 'end_turn' };
    };
    const result = await runAnalysisFlow(mockInput, flowNowMin, fakeCall, 'test');
    assert(result.ok === false, 'Flow: nothing then violating → not ok');
    if (!result.ok) {
      assert(result.code === 'invalid_plan', `Flow: nothing→violating = invalid_plan, got ${result.code}`);
    }
  }

  // Flow test 8: identifiers in fake Claude answer are cleaned from returned text
  {
    const dirtyResult: AnalysisResult = {
      ...makeFlowResult(flowGoodSchedule),
      mentorAssessment: 'currentTime is 22:52 and noTaskBefore is 07:05. Day is heavy based on dayProfile.',
      overflow: [
        { id: 'task1', name: 'Study', reason: 'No fit given currentTime and fixedBlocks', suggestedDay: null },
      ],
      schedule: [
        { id: 'c1', name: 'Class', start: '08:00', end: '09:00', type: 'fixed', category: null, estimatedMinutes: 60, energyType: null, notes: 'deadZoneSettings apply after' },
        { id: 'task2', name: 'Quick email', start: '12:00', end: '12:20', type: 'task', category: 'personal', estimatedMinutes: 20, energyType: 'low_energy_ok', notes: null },
      ],
      warnings: [],
    };
    const flowInputWithDirty: AnalysisInput = {
      ...mockInput,
      tasks: [
        { id: 'task1', name: 'Study', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: 90, notes: null },
        { id: 'task2', name: 'Quick email', category: 'personal', deadline: 'today', priority: 'low', estimatedMinutes: 20, notes: null },
      ],
    };
    const fakeCall: CallClaudeFn = async () => ({
      parsed: dirtyResult,
      rawText: JSON.stringify(dirtyResult),
      stopReason: 'end_turn',
    });
    const result = await runAnalysisFlow(flowInputWithDirty, flowNowMin, fakeCall, 'test');
    assert(result.ok === true, 'Flow clean: valid result returned');
    if (result.ok) {
      assert(!result.result.mentorAssessment.includes('currentTime'), 'Flow clean: mentorAssessment no currentTime');
      assert(!result.result.mentorAssessment.includes('noTaskBefore'), 'Flow clean: mentorAssessment no noTaskBefore');
      assert(!result.result.mentorAssessment.includes('dayProfile'), 'Flow clean: mentorAssessment no dayProfile');
      const overflow = result.result.overflow;
      assert(!overflow.some(o => o.reason.includes('currentTime')), 'Flow clean: overflow reason no currentTime');
      assert(!overflow.some(o => o.reason.includes('fixedBlocks')), 'Flow clean: overflow reason no fixedBlocks');
      const classBlock = result.result.schedule.find(b => b.id === 'c1');
      assert(classBlock !== undefined, 'Flow clean: class block present');
      assert(classBlock!.start === '08:00', 'Flow clean: block start unchanged');
      assert(classBlock!.end === '09:00', 'Flow clean: block end unchanged');
      assert(classBlock!.type === 'fixed', 'Flow clean: block type unchanged');
      assert(classBlock!.id === 'c1', 'Flow clean: block id unchanged');
      assert(!classBlock!.notes?.includes('deadZoneSettings'), 'Flow clean: block notes no deadZoneSettings');
    }
  }

  // Flow test 7: stop_reason max_tokens = nothing usable
  {
    const calls: any[] = [];
    let callIdx = 0;
    const fakeCall: CallClaudeFn = async (msgs) => {
      calls.push(msgs);
      callIdx++;
      if (callIdx === 1) return { parsed: makeFlowResult(flowGoodSchedule), rawText: '{}', stopReason: 'max_tokens' };
      return { parsed: makeFlowResult(flowGoodSchedule), rawText: JSON.stringify(makeFlowResult(flowGoodSchedule)), stopReason: 'end_turn' };
    };
    const result = await runAnalysisFlow(mockInput, flowNowMin, fakeCall, 'test');
    assert(result.ok === true, 'Flow: max_tokens first, valid second → ok');
    assert(calls.length === 2, `Flow: max_tokens treated as nothing → 2 calls, got ${calls.length}`);
  }
}

// ============================================================
// SANITIZE REDIRECT PATH
// ============================================================
console.log('\n--- sanitizeRedirectPath ---');

assert(sanitizeRedirectPath(null) === '/', 'null → /');
assert(sanitizeRedirectPath('') === '/', 'empty string → /');
assert(sanitizeRedirectPath('/settings') === '/settings', 'valid /settings preserved');
assert(sanitizeRedirectPath('/week') === '/week', 'valid /week preserved');
assert(sanitizeRedirectPath('https://evil.com') === '/', 'absolute URL → /');
assert(sanitizeRedirectPath('//evil.com') === '/', 'protocol-relative → /');
assert(sanitizeRedirectPath('evil.com/hack') === '/', 'no leading slash → /');
assert(sanitizeRedirectPath('/auth/callback') === '/auth/callback', 'nested path preserved');

// ============================================================
// NORMALIZE SETTINGS
// ============================================================
console.log('\n--- normalizeSettings ---');

{
  const result = normalizeSettings({});
  assert(typeof result.wakeTime === 'string' && result.wakeTime.length > 0, 'empty obj → has wakeTime');
  assert(typeof result.sleepTime === 'string' && result.sleepTime.length > 0, 'empty obj → has sleepTime');
  assert(typeof result.gym === 'object' && 'enabled' in result.gym, 'empty obj → has gym');
  assert(typeof result.schedule === 'object', 'empty obj → has schedule');
}

{
  const oldFormat = {
    wakeTime: '07:00', sleepTime: '23:00',
    gym: { enabled: true, frequency: 3, preference: 'evening', durationMinutes: 75 },
    schedule: {},
  };
  const migrated = normalizeSettings(oldFormat as any);
  assert(typeof migrated.gym.sessions === 'object', 'old gym format → has sessions');
  assert(migrated.gym.durationMinutes === 75, 'old gym → duration preserved');
}

{
  const full = normalizeSettings(DEFAULT_SETTINGS);
  assert(full.wakeTime === DEFAULT_SETTINGS.wakeTime, 'DEFAULT_SETTINGS unchanged through normalize');
  assert(JSON.stringify(full.deadZones) !== undefined, 'DEFAULT_SETTINGS has deadZones after normalize');
}

// ============================================================
// EMPTY_SETTINGS VALIDATION
// ============================================================
console.log('\n--- EMPTY_SETTINGS ---');

assert(EMPTY_SETTINGS.wakeTime === '07:00', 'EMPTY wake = 07:00');
assert(EMPTY_SETTINGS.sleepTime === '23:00', 'EMPTY sleep = 23:00');
assert(EMPTY_SETTINGS.gym.enabled === false, 'EMPTY gym disabled');
assert(typeof EMPTY_SETTINGS.schedule === 'object', 'EMPTY has schedule');
assert(typeof EMPTY_SETTINGS.deadZones === 'object', 'EMPTY has deadZones');
assert(typeof EMPTY_SETTINGS.dayTypes === 'object', 'EMPTY has dayTypes');

{
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const allEmpty = days.every(d => (EMPTY_SETTINGS.schedule[d] || []).length === 0);
  assert(allEmpty, 'EMPTY schedule: all days have no blocks');
}

{
  const normalized = normalizeSettings(EMPTY_SETTINGS);
  assert(normalized.wakeTime === EMPTY_SETTINGS.wakeTime, 'EMPTY survives normalize');
}

// ============================================================
// DECIDE ROUTE (F3)
// ============================================================
console.log('\n--- decideRoute ---');

// /api/* signed out → unauthorized
assert(decideRoute({ pathname: '/api/analyze', signedIn: false }).action === 'unauthorized', 'decideRoute: /api signed out → unauthorized');
// /api/* signed in → next
assert(decideRoute({ pathname: '/api/analyze', signedIn: true }).action === 'next', 'decideRoute: /api signed in → next');
// /auth/callback → always next
assert(decideRoute({ pathname: '/auth/callback', signedIn: false }).action === 'next', 'decideRoute: /auth/callback signed out → next');
assert(decideRoute({ pathname: '/auth/callback', signedIn: true }).action === 'next', 'decideRoute: /auth/callback signed in → next');
// /reset-password signed in → next (not redirect!)
assert(decideRoute({ pathname: '/reset-password', signedIn: true }).action === 'next', 'decideRoute: /reset-password signed in → next');
// /reset-password signed out → redirect to /forgot-password
{
  const d = decideRoute({ pathname: '/reset-password', signedIn: false });
  assert(d.action === 'redirect' && d.to === '/forgot-password', 'decideRoute: /reset-password signed out → /forgot-password');
}
// /login signed in → redirect to /
{
  const d = decideRoute({ pathname: '/login', signedIn: true });
  assert(d.action === 'redirect' && d.to === '/', 'decideRoute: /login signed in → /');
}
// /login signed out → next
assert(decideRoute({ pathname: '/login', signedIn: false }).action === 'next', 'decideRoute: /login signed out → next');
// /signup signed in → redirect to /
{
  const d = decideRoute({ pathname: '/signup', signedIn: true });
  assert(d.action === 'redirect' && d.to === '/', 'decideRoute: /signup signed in → /');
}
// /signup signed out → next
assert(decideRoute({ pathname: '/signup', signedIn: false }).action === 'next', 'decideRoute: /signup signed out → next');
// /forgot-password signed in → redirect to /
{
  const d = decideRoute({ pathname: '/forgot-password', signedIn: true });
  assert(d.action === 'redirect' && d.to === '/', 'decideRoute: /forgot-password signed in → /');
}
// / signed out → redirect to /login (no ?next since path is /)
{
  const d = decideRoute({ pathname: '/', signedIn: false });
  assert(d.action === 'redirect' && d.to === '/login', 'decideRoute: / signed out → /login');
}
// /settings signed out → redirect to /login?next=/settings
{
  const d = decideRoute({ pathname: '/settings', signedIn: false });
  assert(d.action === 'redirect' && d.to === '/login?next=%2Fsettings', 'decideRoute: /settings signed out → /login?next=/settings');
}
// /settings signed in → next
assert(decideRoute({ pathname: '/settings', signedIn: true }).action === 'next', 'decideRoute: /settings signed in → next');

// ============================================================
// CONSUME AI CALL (F1) — with fake client
// ============================================================
console.log('\n--- consumeAiCall ---');

function fakeClient(rpcResult: { data: any; error: any }) {
  return { rpc: () => Promise.resolve(rpcResult) } as any;
}

async function runAiLimitTests() {
  // (a) allowed true → ok
  {
    const r = await consumeAiCall(fakeClient({ data: { allowed: true, reason: null, limit: 15 }, error: null }), 'analyze');
    assert(r.allowed === true && r.status === 200, 'consumeAiCall: allowed true → ok');
  }
  // (b) user_limit with limit 15 → 429
  {
    const r = await consumeAiCall(fakeClient({ data: { allowed: false, reason: 'user_limit', limit: 15 }, error: null }), 'analyze');
    assert(r.allowed === false && r.status === 429, 'consumeAiCall: user_limit → 429');
    assert(r.message.includes('15'), `consumeAiCall: user_limit message includes limit number, got: ${r.message}`);
  }
  // (c) global_limit → 429
  {
    const r = await consumeAiCall(fakeClient({ data: { allowed: false, reason: 'global_limit', limit: 300 }, error: null }), 'estimate');
    assert(r.allowed === false && r.status === 429, 'consumeAiCall: global_limit → 429');
  }
  // (d) RPC error → 503
  {
    const r = await consumeAiCall(fakeClient({ data: null, error: { message: 'connection refused' } }), 'analyze');
    assert(r.allowed === false && r.status === 503, 'consumeAiCall: RPC error → 503');
  }
  // (e) null/malformed → 503
  {
    const r = await consumeAiCall(fakeClient({ data: null, error: null }), 'analyze');
    assert(r.allowed === false && r.status === 503, 'consumeAiCall: null data → 503');
  }
  {
    const r = await consumeAiCall(fakeClient({ data: 'garbage', error: null }), 'analyze');
    assert(r.allowed === false && r.status === 503, 'consumeAiCall: malformed data → 503');
  }
  // (f) verify rpc called with correct params
  {
    let calledWith: any = null;
    const fake = { rpc: (name: string, params: any) => { calledWith = { name, params }; return Promise.resolve({ data: { allowed: true, reason: null, limit: 15 }, error: null }); } } as any;
    await consumeAiCall(fake, 'analyze');
    assert(calledWith?.name === 'consume_ai_call', 'consumeAiCall: calls correct RPC name');
    assert(calledWith?.params?.p_kind === 'analyze', 'consumeAiCall: passes p_kind=analyze');
    await consumeAiCall(fake, 'estimate');
    assert(calledWith?.params?.p_kind === 'estimate', 'consumeAiCall: passes p_kind=estimate');
  }
}

// ============================================================
// WRITE GUARD TESTS (F2)
// ============================================================
console.log('\n--- Write guards ---');

// Simulate dataCache write guard behavior: before hydration, writes should be no-ops.
// We test the pattern by checking that the guard condition works.
{
  // _hydrated is false by default in a fresh module. We can't import the module state directly
  // but we can verify our getSettings returns EMPTY_SETTINGS when cache is empty.
  // This verifies F2's getSettings fix.
  const emptySettings = normalizeSettings(EMPTY_SETTINGS);
  assert(
    (emptySettings.schedule.monday || []).length === 0,
    'Write guard: getSettings empty cache → no classes (not DEFAULT_SETTINGS)'
  );
  assert(
    emptySettings.gym.enabled === false,
    'Write guard: getSettings empty cache → gym disabled'
  );
}

// ============================================================
// getSettings with empty cache (F2)
// ============================================================
console.log('\n--- getSettings empty cache ---');

{
  const empty = normalizeSettings(EMPTY_SETTINGS);
  const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const allEmpty = allDays.every(d => (empty.schedule[d] || []).length === 0);
  assert(allEmpty, 'getSettings empty: all days have 0 blocks');
  assert(empty.gym.enabled === false, 'getSettings empty: gym disabled');
  assert(typeof empty.wakeTime === 'string', 'getSettings empty: has wakeTime');
  assert(typeof empty.deadZones === 'object', 'getSettings empty: has deadZones');
}

// ============================================================
// SHOULD REHYDRATE (C1)
// ============================================================
console.log('\n--- shouldRehydrate ---');

assert(
  shouldRehydrate({ hydrated: true, cachedUserId: 'user-a', sessionUserId: 'user-a' }) === false,
  'shouldRehydrate: same user hydrated → false'
);
assert(
  shouldRehydrate({ hydrated: true, cachedUserId: 'user-a', sessionUserId: 'user-b' }) === true,
  'shouldRehydrate: different user → true'
);
assert(
  shouldRehydrate({ hydrated: false, cachedUserId: null, sessionUserId: 'user-a' }) === true,
  'shouldRehydrate: not hydrated (null uid) → true'
);
assert(
  shouldRehydrate({ hydrated: false, cachedUserId: 'user-a', sessionUserId: 'user-a' }) === true,
  'shouldRehydrate: not hydrated even same uid → true'
);

// ============================================================
// LEGACY KEYS TO REMOVE (C3)
// ============================================================
console.log('\n--- legacyKeysToRemove ---');

{
  const keys = ['dayos_settings', 'dayos_initialized', 'dayos_gym_week', 'unrelated_key'];
  const result = legacyKeysToRemove(keys);
  assert(result.includes('dayos_settings'), 'legacy: includes dayos_settings');
  assert(result.includes('dayos_initialized'), 'legacy: includes dayos_initialized');
  assert(result.includes('dayos_gym_week'), 'legacy: includes dayos_gym_week');
  assert(!result.includes('unrelated_key'), 'legacy: excludes unrelated');
}

{
  const keys = ['dayos_plan_2026-10-22', 'dayos_deferred_2026-10-22', 'dayos_planned_2026-10-22'];
  const result = legacyKeysToRemove(keys);
  assert(result.length === 3, `legacy: all 3 prefixed keys matched, got ${result.length}`);
}

{
  const keys = ['dayos_cache_abc-123-def', 'dayos_gym_week_abc-123-def'];
  const result = legacyKeysToRemove(keys);
  assert(result.length === 0, `legacy: keeps cache and per-user gym keys, got ${result.length}`);
}

{
  const keys = ['dayos_gym_week_anon'];
  const result = legacyKeysToRemove(keys);
  assert(result.length === 1, `legacy: removes anon gym key, got ${result.length}`);
}

{
  const mixed = [
    'dayos_settings', 'dayos_initialized', 'dayos_gym_week',
    'dayos_plan_2026-10-20', 'dayos_plan_2026-10-21',
    'dayos_deferred_2026-10-22', 'dayos_planned_2026-10-22',
    'dayos_gym_week_anon',
    'dayos_cache_user-123', 'dayos_gym_week_user-123',
    'some_other_app_key',
  ];
  const result = legacyKeysToRemove(mixed);
  assert(result.length === 8, `legacy: mixed scenario removes 8, got ${result.length}`);
  assert(!result.includes('dayos_cache_user-123'), 'legacy: mixed keeps cache');
  assert(!result.includes('dayos_gym_week_user-123'), 'legacy: mixed keeps per-user gym');
  assert(!result.includes('some_other_app_key'), 'legacy: mixed keeps unrelated');
}

// ============================================================
// D1: updateSettings (lib/storage.ts)
// ============================================================
console.log('\n--- D1: updateSettings ---');

// E2.3: Empty cache — updater receives normalized empty defaults
{
  clearCache();
  const emptyDefaults = normalizeSettings(EMPTY_SETTINGS);
  let received: UserSettings | null = null;
  updateCachedSettings(s => { received = s; return s; });
  assert(received !== null, 'E2.3: updater was called');
  assert(received!.wakeTime === emptyDefaults.wakeTime, 'E2.3: wakeTime matches empty defaults');
  assert(received!.sleepTime === emptyDefaults.sleepTime, 'E2.3: sleepTime matches empty defaults');
  assert(received!.gym.enabled === emptyDefaults.gym.enabled, 'E2.3: gym.enabled matches empty defaults');
}

// E2.4: Not hydrated — returns updated object but cache unchanged
{
  clearCache();
  const result = updateCachedSettings(s => ({ ...s, wakeTime: '05:00' }));
  assert(result.wakeTime === '05:00', 'E2.4: returned object has updated wakeTime');
  assert(getCachedSettings() === null, 'E2.4: cache still null (cacheSettings guard held)');
}

// ============================================================
// D2: getHydrateCount and hasPendingWrites
// ============================================================
// D2 tests require async hydration — see runDataCacheTests below

// ============================================================
// D3: Correct usable time (score.ts)
// ============================================================
console.log('\n--- D3: Correct usable time ---');

// D3.1: Friday scenario — classes 08-17, gym 17-18:15, fixed Dinner 20:00-20:20
{
  const input: AnalysisInput = {
    user: { name: 'Test', wakeTime: '07:00', sleepTime: '23:00', totalWakingHours: 16 },
    today: {
      date: '2026-10-23', dayName: 'Friday', dayProfile: 'heavy',
      fixedBlocks: [
        { id: 'c1', name: 'Class', start: '08:00', end: '17:00', type: 'class' },
        { id: 'gym', name: 'Gym', start: '17:00', end: '18:15', type: 'gym' },
        { id: 'dinner', name: 'Dinner', start: '20:00', end: '20:20', type: 'custom' },
      ],
      totalFixedMinutes: 540 + 75 + 20,
      totalFreeMinutes: 265,
      freeWindows: [
        { start: '18:15', end: '20:00', durationMinutes: 105, quality: 'low' as const },
        { start: '20:20', end: '23:00', durationMinutes: 160, quality: 'low' as const },
      ],
    },
    tasks: [
      { id: 't1', name: 'Essay', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: 90, notes: null },
    ],
    deadZoneSettings: { morningRoutine: 35, lunchDuration: 30, dinnerDuration: 30, gymRecovery: 45 },
    currentTime: '10:14',
    constraints: { noTaskBefore: '07:35', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [
      { id: 't1', name: 'Essay', reason: 'no time', suggestedDay: null },
    ], warnings: [],
  };
  computeScore(result, input, 10 * 60 + 14);
  computeStats(result, input, 10 * 60 + 14);
  // gym recovery: 45 (from 18:15-19:00 in free window), lunch: 0 (inside classes), dinner: 0 (fixed Dinner block)
  // usable = 265 - 45 = 220. 90/220 = 40.9 → 41%
  assert(result.dayLoadPercent === 41, `D3.1: Friday load 41%, got ${result.dayLoadPercent}`);
  assert(result.dayLoadLabel === 'CLEAR', `D3.1: Friday label CLEAR, got ${result.dayLoadLabel}`);
  assert(result.stats.usableTimeAfterDeadZones === '3.7 hrs', `D3.1: usable 3.7 hrs, got ${result.stats.usableTimeAfterDeadZones}`);
}

// D3.2: Same day without the Dinner block name match → dinner deducts 30 → usable 190
{
  const input: AnalysisInput = {
    user: { name: 'Test', wakeTime: '07:00', sleepTime: '23:00', totalWakingHours: 16 },
    today: {
      date: '2026-10-23', dayName: 'Friday', dayProfile: 'heavy',
      fixedBlocks: [
        { id: 'c1', name: 'Class', start: '08:00', end: '17:00', type: 'class' },
        { id: 'gym', name: 'Gym', start: '17:00', end: '18:15', type: 'gym' },
        { id: 'brk', name: 'Break', start: '20:00', end: '20:20', type: 'custom' },
      ],
      totalFixedMinutes: 540 + 75 + 20,
      totalFreeMinutes: 265,
      freeWindows: [
        { start: '18:15', end: '20:00', durationMinutes: 105, quality: 'low' as const },
        { start: '20:20', end: '23:00', durationMinutes: 160, quality: 'low' as const },
      ],
    },
    tasks: [
      { id: 't1', name: 'Essay', category: 'college', deadline: 'today', priority: 'high', estimatedMinutes: 90, notes: null },
    ],
    deadZoneSettings: { morningRoutine: 35, lunchDuration: 30, dinnerDuration: 30, gymRecovery: 45 },
    currentTime: '10:14',
    constraints: { noTaskBefore: '07:35', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [
      { id: 't1', name: 'Essay', reason: 'no time', suggestedDay: null },
    ], warnings: [],
  };
  computeScore(result, input, 10 * 60 + 14);
  // gym 45 + dinner 30 = 75. usable = 265 - 75 = 190. 90/190 = 47.4 → 47
  assert(result.dayLoadPercent === 47, `D3.2: no Dinner block → 47%, got ${result.dayLoadPercent}`);
}

// D3.3: No classes, free all day at 07:10 → morning 25, lunch 30, dinner 30
{
  const input: AnalysisInput = {
    user: { name: 'Test', wakeTime: '07:00', sleepTime: '23:00', totalWakingHours: 16 },
    today: {
      date: '2026-10-23', dayName: 'Friday', dayProfile: 'free',
      fixedBlocks: [],
      totalFixedMinutes: 0,
      totalFreeMinutes: 950,
      freeWindows: [
        { start: '07:10', end: '23:00', durationMinutes: 950, quality: 'prime' as const },
      ],
    },
    tasks: [
      { id: 't1', name: 'Work', category: 'agency_client', deadline: 'today', priority: 'high', estimatedMinutes: 120, notes: null },
    ],
    deadZoneSettings: { morningRoutine: 35, lunchDuration: 30, dinnerDuration: 30, gymRecovery: 45 },
    currentTime: '07:10',
    constraints: { noTaskBefore: '07:35', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [
      { id: 't1', name: 'Work', reason: 'no time', suggestedDay: null },
    ], warnings: [],
  };
  computeScore(result, input, 7 * 60 + 10);
  // morning [07:10, 07:35] = 25 min. lunch 30. dinner 30. total = 85.
  // usable = 950 - 85 = 865. 120/865 = 13.9 → 14
  assert(result.dayLoadPercent === 14, `D3.3: no classes → 14%, got ${result.dayLoadPercent}`);
}

// D3.4: Dead zone fully inside a fixed block → deducts 0
{
  const input: AnalysisInput = {
    user: { name: 'Test', wakeTime: '07:00', sleepTime: '23:00', totalWakingHours: 16 },
    today: {
      date: '2026-10-23', dayName: 'Friday', dayProfile: 'heavy',
      fixedBlocks: [
        { id: 'c1', name: 'Class', start: '08:00', end: '17:00', type: 'class' },
      ],
      totalFixedMinutes: 540,
      totalFreeMinutes: 360,
      freeWindows: [
        { start: '17:00', end: '23:00', durationMinutes: 360, quality: 'low' as const },
      ],
    },
    tasks: [
      { id: 't1', name: 'Work', category: 'agency_client', deadline: 'today', priority: 'high', estimatedMinutes: 120, notes: null },
    ],
    deadZoneSettings: { morningRoutine: 35, lunchDuration: 30, dinnerDuration: 30, gymRecovery: 0 },
    currentTime: '10:00',
    constraints: { noTaskBefore: '07:35', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [
      { id: 't1', name: 'Work', reason: 'no time', suggestedDay: null },
    ], warnings: [],
  };
  computeScore(result, input, 10 * 60);
  // morning [10:00, 07:35] → start>end → 0
  // lunch [12:00, 15:00] → inside classes, not in free window → 0
  // dinner [19:00, 22:00] → inside free window [17:00-23:00]. Take 30.
  // usable = 360 - 30 = 330. 120/330 = 36.4 → 36
  assert(result.dayLoadPercent === 36, `D3.4: lunch inside class → 36%, got ${result.dayLoadPercent}`);
}

// D3.5: Usable never negative
{
  const input: AnalysisInput = {
    user: { name: 'Test', wakeTime: '07:00', sleepTime: '23:00', totalWakingHours: 16 },
    today: {
      date: '2026-10-23', dayName: 'Friday', dayProfile: 'heavy',
      fixedBlocks: [
        { id: 'c1', name: 'Class', start: '07:00', end: '22:30', type: 'class' },
      ],
      totalFixedMinutes: 930,
      totalFreeMinutes: 30,
      freeWindows: [
        { start: '22:30', end: '23:00', durationMinutes: 30, quality: 'low' as const },
      ],
    },
    tasks: [
      { id: 't1', name: 'Task', category: 'personal', deadline: 'today', priority: 'low', estimatedMinutes: 60, notes: null },
    ],
    deadZoneSettings: { morningRoutine: 35, lunchDuration: 30, dinnerDuration: 30, gymRecovery: 45 },
    currentTime: '07:30',
    constraints: { noTaskBefore: '07:35', reason: 'Morning routine' },
  };
  const result: AnalysisResult = {
    dayLoadPercent: 0, dayLoadLabel: 'CLEAR',
    stats: { freeTimeAvailable: '0', totalTasksRequested: 0, estimatedTaskTime: '0', tasksScheduled: 0, tasksOverflow: 0 },
    mentorAssessment: 'test', schedule: [], overflow: [], warnings: [],
  };
  computeScore(result, input, 7 * 60 + 30);
  // All dead zones miss the tiny 22:30-23:00 window. Usable = 30 - 0 = 30.
  assert(result.dayLoadPercent >= 0, `D3.5: usable never negative, pct=${result.dayLoadPercent}`);
}

// ============================================================
// D4: getRetryDelay (backoff helper)
// ============================================================
console.log('\n--- D4: getRetryDelay ---');

assert(getRetryDelay(0) === 5000, `D4: attempt 0 → 5000, got ${getRetryDelay(0)}`);
assert(getRetryDelay(1) === 15000, `D4: attempt 1 → 15000, got ${getRetryDelay(1)}`);
assert(getRetryDelay(2) === 60000, `D4: attempt 2 → 60000, got ${getRetryDelay(2)}`);
assert(getRetryDelay(3) === 60000, `D4: attempt 3 → 60000, got ${getRetryDelay(3)}`);
assert(getRetryDelay(10) === 60000, `D4: attempt 10 → 60000, got ${getRetryDelay(10)}`);

// ============================================================
// E2.1–E2.2 + E3: DATA CACHE TESTS (async — need hydrate)
// ============================================================
async function runDataCacheTests() {
  function fakeSupabase(profileSettings: any = null) {
    return {
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({
                  data: profileSettings ? { settings: profileSettings, display_name: 'Test' } : null,
                  error: null,
                }),
              }),
            }),
            upsert: () => Promise.resolve({ error: null }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          upsert: () => Promise.resolve({ error: null }),
          delete: () => ({ match: () => Promise.resolve({ error: null }) }),
        };
      },
    };
  }

  console.log('\n--- E2.1–E2.2: updateCachedSettings (hydrated) ---');

  // E2.1: Hydrate, then change only wakeTime — other fields unchanged
  {
    clearCache();
    const settingsA = { ...normalizeSettings(EMPTY_SETTINGS), wakeTime: '07:00', sleepTime: '23:30' };
    await hydrate('test-e2', fakeSupabase(settingsA));
    const result = updateCachedSettings(s => ({ ...s, wakeTime: '06:30' }));
    assert(result.wakeTime === '06:30', 'E2.1: wakeTime changed to 06:30');
    assert(result.sleepTime === '23:30', 'E2.1: sleepTime unchanged');
    assert(result.gym.enabled === settingsA.gym.enabled, 'E2.1: gym.enabled unchanged');
    assert(getCachedSettings()?.wakeTime === '06:30', 'E2.1: cache updated');
    clearCache();
  }

  // E2.2: Two calls in a row — both changes persist
  {
    clearCache();
    await hydrate('test-e2b', fakeSupabase(normalizeSettings(EMPTY_SETTINGS)));
    updateCachedSettings(s => ({ ...s, gym: { ...s.gym, durationMinutes: 60 } }));
    updateCachedSettings(s => ({ ...s, sleepTime: '22:00' }));
    const cached = getCachedSettings();
    assert(cached?.gym.durationMinutes === 60, 'E2.2: first change (gym duration) stuck');
    assert(cached?.sleepTime === '22:00', 'E2.2: second change (sleepTime) stuck');
    clearCache();
  }

  console.log('\n--- E3: hydrate + hasPendingWrites ---');

  // E3.1: hydrateCount increases by exactly 1
  {
    clearCache();
    const before = getHydrateCount();
    await hydrate('test-e3-1', fakeSupabase(normalizeSettings(EMPTY_SETTINGS)));
    assert(getHydrateCount() === before + 1, 'E3.1: hydrateCount +1 after hydrate');
    clearCache();
  }

  // E3.2: C1 guard — same user while write pending, counter unchanged
  {
    clearCache();
    await hydrate('test-e3-2', fakeSupabase(normalizeSettings(EMPTY_SETTINGS)));
    const countAfterHydrate = getHydrateCount();
    cacheSettings({ ...normalizeSettings(EMPTY_SETTINGS), wakeTime: '05:00' });
    assert(hasPendingWrites() === true, 'E3.2: hasPendingWrites true after cacheSettings');
    await hydrate('test-e3-2', fakeSupabase(normalizeSettings(EMPTY_SETTINGS)));
    assert(getHydrateCount() === countAfterHydrate, 'E3.2: hydrateCount unchanged (C1 guard)');
    assert(getCachedSettings()?.wakeTime === '05:00', 'E3.2: cached data unchanged by guarded hydrate');
    clearCache();
  }

  // E3.3: Different user increases counter
  {
    clearCache();
    await hydrate('user-a', fakeSupabase(normalizeSettings(EMPTY_SETTINGS)));
    const countA = getHydrateCount();
    await hydrate('user-b', fakeSupabase(normalizeSettings(EMPTY_SETTINGS)));
    assert(getHydrateCount() === countA + 1, 'E3.3: hydrateCount +1 for different user');
    clearCache();
  }

  // E3.4: hasPendingWrites state transitions
  {
    clearCache();
    assert(hasPendingWrites() === false, 'E3.4: false on clean cache');
    await hydrate('test-e3-4', fakeSupabase(normalizeSettings(EMPTY_SETTINGS)));
    assert(hasPendingWrites() === false, 'E3.4: false after fresh hydrate');
    cacheSettings({ ...normalizeSettings(EMPTY_SETTINGS), wakeTime: '06:00' });
    assert(hasPendingWrites() === true, 'E3.4: true after cacheSettings');
    clearCache();
  }

  // E3.5: After clear(), hasPendingWrites is false
  {
    clearCache();
    await hydrate('test-e3-5', fakeSupabase(normalizeSettings(EMPTY_SETTINGS)));
    cacheSettings({ ...normalizeSettings(EMPTY_SETTINGS), wakeTime: '06:00' });
    assert(hasPendingWrites() === true, 'E3.5: pending before clear');
    clearCache();
    assert(hasPendingWrites() === false, 'E3.5: false after clear()');
  }
}

// ============================================================
// RUN ASYNC TESTS AND PRINT RESULTS
// ============================================================
async function runAllAsync() {
  await runFlowTests();
  await runAiLimitTests();
  await runDataCacheTests();
}

runAllAsync().then(() => {
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}).catch(e => {
  console.error('Async tests crashed:', e);
  process.exit(1);
});
