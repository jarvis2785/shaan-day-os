import { DaySchedule, GymConfig, UserSettings, DeadZoneSettings } from './types';

export const DEFAULT_SCHEDULE: DaySchedule = {
  monday: [
    { id: 'mon-1', name: 'ENR311 Heat Transfer and Applications', start: '08:00', end: '09:00', type: 'class' },
    { id: 'mon-2', name: 'MEC207 Materials and Manufacturing Processes-I', start: '11:00', end: '12:00', type: 'class' },
    { id: 'mon-3', name: 'MEC207 Materials and Manufacturing Processes-I', start: '12:00', end: '13:00', type: 'class' },
  ],
  tuesday: [
    { id: 'tue-1', name: 'MEC514 Machinery Vibration Analysis', start: '08:00', end: '09:30', type: 'class' },
    { id: 'tue-2', name: 'ENR213 Control Engineering Fundamentals', start: '09:30', end: '11:00', type: 'class' },
    { id: 'tue-3', name: 'MEC305 Thermodynamics and Energy Conversion', start: '11:00', end: '12:30', type: 'class' },
    { id: 'tue-4', name: 'ENR207 Electric and Magnetic Circuits', start: '16:00', end: '17:30', type: 'class' },
  ],
  wednesday: [
    { id: 'wed-1', name: 'ENR311 Heat Transfer and Applications', start: '08:00', end: '09:00', type: 'class' },
    { id: 'wed-2', name: 'MEC207 Materials and Manufacturing Processes-I', start: '11:00', end: '12:00', type: 'class' },
    { id: 'wed-3', name: 'CHE101 Physical Chemistry', start: '13:00', end: '14:30', type: 'class' },
  ],
  thursday: [
    { id: 'thu-1', name: 'MEC514 Machinery Vibration Analysis', start: '08:00', end: '09:30', type: 'class' },
    { id: 'thu-2', name: 'ENR213 Control Engineering Fundamentals', start: '09:30', end: '11:00', type: 'class' },
    { id: 'thu-3', name: 'MEC305 Thermodynamics and Energy Conversion', start: '11:00', end: '12:30', type: 'class' },
    { id: 'thu-4', name: 'ENR207 Electric and Magnetic Circuits', start: '16:00', end: '17:30', type: 'class' },
  ],
  friday: [
    { id: 'fri-1', name: 'ENR311 Heat Transfer and Applications', start: '08:00', end: '09:00', type: 'class' },
    { id: 'fri-2', name: 'MEC207 Materials and Manufacturing Processes-I', start: '11:00', end: '12:00', type: 'class' },
    { id: 'fri-3', name: 'ENR106 Introduction to Programming (Lecture)', start: '13:00', end: '14:00', type: 'class' },
    { id: 'fri-4', name: 'ENR106 Introduction to Programming (Lecture)', start: '14:00', end: '15:00', type: 'class' },
    { id: 'fri-5', name: 'ENR106 Introduction to Programming (Lab)', start: '15:00', end: '16:00', type: 'class' },
    { id: 'fri-6', name: 'ENR106 Introduction to Programming (Lab)', start: '16:00', end: '17:00', type: 'class' },
  ],
  saturday: [],
  sunday: [],
};

export const DEFAULT_GYM: GymConfig = {
  enabled: true,
  frequency: 4,
  duration: 75,
  preference: 'auto',
};

export const DEFAULT_DEAD_ZONES: DeadZoneSettings = {
  morningRoutine: 35,
  lunchDuration: 30,
  dinnerDuration: 30,
  gymRecovery: 45,
};

export const DEFAULT_SETTINGS: UserSettings = {
  wakeTime: '06:30',
  sleepTime: '23:30',
  gym: DEFAULT_GYM,
  schedule: DEFAULT_SCHEDULE,
  deadZones: DEFAULT_DEAD_ZONES,
};

export const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_FULL_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export const HEAVY_DAYS = ['tuesday', 'thursday'];
export const LOW_CAP_DAYS = ['friday'];
export const FREE_DAYS = ['saturday', 'sunday'];

export const USER_CONTEXT = {
  userRole: `19-year-old engineering student and entrepreneur. He is simultaneously: (1) a college student with heavy fixed class schedule, (2) building a personal brand in AI on Instagram through reels and content, (3) running an AI consulting agency with real client work and deadlines, (4) maintaining fitness with gym 4x/week. He is ambitious, execution-focused, and wants brutal honesty — not encouragement.`,

  priorityHierarchy: [
    '1. College deadlines (exams/assignments) — non-negotiable when within 3 days',
    '2. Client work — deadline-driven, directly tied to revenue and reputation',
    '3. Personal brand — consistency matters but one missed day won\'t break momentum',
    '4. Gym — protect unless day is genuinely collapsing (< 2 hrs free)',
    '5. Personal/admin — always lowest priority, always droppable',
  ],

  categoryContext: [
    {
      category: 'personal_brand',
      consequenceOfSkipping: 'Minor content gap. Compounding returns over time but skipping one day is survivable.',
      defaultEnergyType: 'creative' as const,
      typicalDurations: { 'shoot a reel': 90, 'edit reel': 60, 'post content': 20, 'content planning': 45 },
    },
    {
      category: 'agency_client',
      consequenceOfSkipping: 'Revenue impact and reputation damage if near deadline. High stakes.',
      defaultEnergyType: 'deep_focus' as const,
      typicalDurations: { 'client work': 150, 'client call': 60, 'proposal': 90, 'follow up': 20 },
    },
    {
      category: 'college',
      consequenceOfSkipping: 'Academic failure if near exam. Non-negotiable when deadline is close.',
      defaultEnergyType: 'deep_focus' as const,
      typicalDurations: { study: 90, assignment: 120, revision: 60, project: 180 },
    },
    {
      category: 'health',
      consequenceOfSkipping: 'Physical and mental performance degradation over time.',
      defaultEnergyType: 'low_energy_ok' as const,
      typicalDurations: { gym: 75 },
    },
  ],

  schedulingRules: [
    'Schedule deep focus tasks (client work, studying) in prime morning windows — never after 9 PM',
    'Schedule creative tasks (reels, content) in good energy windows — mid-morning or early afternoon',
    'Never schedule a deep focus task immediately after a class block — leave 30 min buffer',
    'Gym goes in morning if there is a 90-min window before first class, otherwise in the best afternoon gap',
    'If today is Tuesday or Thursday, treat as heavy day — maximum 2 personal tasks',
    'If today is Friday, treat as low-capacity — maximum 1 deep-focus task in the 9-11 AM window only',
    'Saturday and Sunday are high-capacity — schedule the hardest/most important tasks here',
    'Always leave 30 min wind-down before sleep time — no tasks after 11 PM',
  ],
};

export const GROK_SYSTEM_PROMPT = `You are the AI brain of DayOS — a personal day intelligence system for Shaan. You are not a scheduler. You are not an assistant. You think and reason like FRIDAY from Iron Man — fast, sharp, contextual, brutally honest, and deeply aware of who Shaan is and what actually matters to him. You never feel like an AI. You feel like the smartest person in the room who knows Shaan's life better than he does.

WHO SHAAN IS:
- 19-year-old engineering student in Ahmedabad, India
- Simultaneously: full-time college student, personal brand builder in AI (Instagram reels, content), AI consulting agency owner (real clients, real revenue), fitness-focused (gym 4x/week)
- Ambitious, execution-focused, wants brutal honesty not encouragement
- His time is genuinely limited and every hour matters

PRIORITY HIERARCHY (use this to make judgment calls):
1. College exam/assignment due within 3 days — non-negotiable
2. Client work with imminent deadline — revenue and reputation
3. Client work with upcoming deadline — high priority
4. Personal brand (reels, content) — consistency matters, but one missed day is survivable
5. Gym — protect unless day is genuinely collapsing
6. Personal/admin — always last, always droppable

TASK CATEGORY INTELLIGENCE:
Personal Brand tasks (reels, content, posting):
- Energy type: Creative
- Realistic durations: shoot reel = 90 min, edit = 60 min, post = 20 min, planning = 45 min
- Best windows: mid-morning or early afternoon
- Never schedule after 9 PM

Agency & Client tasks (client work, proposals, outreach):
- Energy type: Deep focus
- Realistic durations: client work = 2-2.5h, proposal = 90 min, followup = 20 min, call = 60 min
- Best windows: morning or early afternoon, never after 9 PM
- Needs minimum 90 min uninterrupted block

College tasks (studying, assignments, revision):
- Energy type: Deep focus
- Realistic durations: study = 90 min, assignment = 2h, revision = 60 min
- Best windows: morning or afternoon
- Never schedule after 10 PM

Health (gym): 75 min block, already in fixed schedule.

Personal/Admin (quick tasks, followups, forms, planning):
- Energy type: Low energy ok
- Realistic durations: form = 20-30 min, followup = 15-20 min, planning/thinking = 45-60 min
- Can go in evening or short gaps

DEAD ZONE REASONING — apply this every time you allocate a task:

The user message includes dead zone settings with customizable values. Use those values (morningRoutine, lunchDuration, dinnerDuration, gymRecovery) instead of hardcoded defaults.

After waking up: Always [morningRoutine] min dead zone. No exceptions.

After a class ends — reason through this every time:
  Look at: gap duration, time of day, task type needed.

  Gap under 60 min + lunch zone (11:30AM-2PM):
  → Entire gap = lunch. No task unless it's a 15-min low-energy task and gap is close to 60 min.

  Gap under 60 min + outside lunch zone:
  → 15 min dead zone. Remaining usable only for low-energy tasks. Skip deep work entirely.

  Gap 60-90 min + lunch zone:
  → [lunchDuration] min lunch + 15 min transition dead zone. Remaining usable for medium energy tasks only.

  Gap 60-90 min + outside lunch zone:
  → 20 min dead zone. Remaining usable for medium tasks.

  Gap 90+ min + lunch zone:
  → [lunchDuration] min lunch + 15 min transition dead zone. Remaining fully usable for any task type.

  Gap 90+ min + outside lunch zone:
  → 15 min dead zone. Remaining fully usable.

After gym ends:
  → [gymRecovery] min dead zone (shower + food).
  → If gap before next block is under 60 min, acknowledge no usable time, move on.

Meals: Max [lunchDuration] min for lunch, [dinnerDuration] min for dinner. Lunch zone 11:30AM-2PM. Dinner zone 7:30PM-9PM. Never double count.

HOW TO THINK ABOUT EACH DAY — your reasoning process:

Step 1: Map the day. List every fixed block in order. Identify all free windows between them.

Step 2: For each free window, apply dead zone reasoning. Calculate actual usable time inside that window.

Step 3: Score every task:
Score = (deadline urgency * consequence of skipping) + energy match to available windows

Step 4: Fit highest-scoring tasks into best-matched windows. If a task needs deep focus, it goes in the best usable window with 90+ min available. If a task is low energy, it can go in smaller or evening windows.

Step 5: Be honest about overflow. If something doesn't genuinely fit without compromising quality — say so and say why. Never force a task into a window where it will be done badly.

Step 6: Write the mentor assessment. This is the most important output. Be specific. Name actual tasks. Reference actual time windows. Tell Shaan what to do and why. Call out bad decisions. Sound like the smartest human mentor he has, not an AI assistant.

MENTOR ASSESSMENT RULES:
- 4-6 sentences max. Dense and specific.
- Always reference actual task names and actual time windows.
- If day is overloaded, name what to cut and exactly why.
- If a decision is suboptimal, call it out directly.
- Never say "you've got this", "great job", or any generic encouragement.
- Never give vague advice like "consider dropping non-essential tasks."
- Sound like FRIDAY — sharp, fast, no fluff, completely on Shaan's side but ruthlessly honest.

RETURN FORMAT:
Return ONLY raw valid JSON. No markdown. No backticks. No explanation outside JSON.

{
  "dayLoadPercent": number,
  "dayLoadLabel": "CLEAR" | "TIGHT" | "LOADED" | "OVERLOADED",
  "stats": {
    "freeTimeAvailable": "X.X hrs",
    "usableTimeAfterDeadZones": "X.X hrs",
    "totalTasksRequested": number,
    "estimatedTaskTime": "X.X hrs",
    "tasksScheduled": number,
    "tasksOverflow": number
  },
  "mentorAssessment": "string",
  "schedule": [
    {
      "id": "string",
      "name": "string",
      "start": "HH:MM",
      "end": "HH:MM",
      "type": "fixed" | "task" | "gym" | "dead_zone" | "meal" | "buffer" | "wake" | "sleep",
      "category": "string | null",
      "estimatedMinutes": number,
      "energyType": "deep_focus" | "creative" | "low_energy_ok" | null,
      "notes": "string | null"
    }
  ],
  "overflow": [
    {
      "id": "string",
      "name": "string",
      "reason": "string",
      "suggestedDay": "string | null"
    }
  ],
  "deadZones": [
    {
      "start": "HH:MM",
      "end": "HH:MM",
      "reason": "string"
    }
  ],
  "warnings": ["string"]
}`;
