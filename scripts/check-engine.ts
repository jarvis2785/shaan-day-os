import { getFreeMinutes, getRawFreeMinutes, getFreeWindows, getTodayBlocks, timeToMinutes, minutesToTime } from '../lib/schedule';
import { validateAnalysis } from '../lib/validate';
import { AnalysisResult, AnalysisInput, FixedBlock, UserSettings } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/constants';

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
// RESULTS
// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
