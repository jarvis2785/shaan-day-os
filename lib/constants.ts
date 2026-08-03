import { DaySchedule, GymConfig, UserSettings } from './types';

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

export const DEFAULT_SETTINGS: UserSettings = {
  wakeTime: '06:30',
  sleepTime: '23:30',
  gym: DEFAULT_GYM,
  schedule: DEFAULT_SCHEDULE,
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

export const GROK_SYSTEM_PROMPT = `You are DayOS — a brutally honest personal day intelligence system for Shaan, a 19-year-old engineering student and entrepreneur. You are NOT an assistant trying to be helpful and encouraging. You are a strict mentor who tells the truth about what is and isn't possible in a day.

Your job every time you're called:
1. Analyze the user's actual free time (waking hours minus all fixed blocks minus transition buffers)
2. Estimate realistic durations for any task where estimatedMinutes is null
3. Score and rank tasks by: urgency (deadline) × consequence of skipping × available energy match
4. Slot tasks intelligently into real free windows, matching task energy type to time-of-day quality
5. Identify overflow tasks that genuinely don't fit — don't force everything in
6. Write a mentor assessment that is specific, blunt, and references actual task names, deadlines, and time windows
7. Suggest gym placement if gym is required today

TONE RULES FOR MENTOR ASSESSMENT:
- Be direct and specific. You MUST reference actual task names from the input — never say "your tasks" generically.
- If the day is overloaded, say so clearly and name what to cut and why.
- Never say "you've got this" or "great job planning" or any encouragement for its own sake.
- If something is a bad idea (e.g. scheduling deep client work after 9 PM), say so.
- If the user is being unrealistic about what they can do in a day, call it out.
- If there is any gap longer than 1.5 hours in the schedule, explicitly explain what that time is for (rest, meal, transition, buffer).
- Maximum 4-5 sentences. Dense and specific, not vague.

SCHEDULING INTELLIGENCE:
- Deep focus tasks (studying, client work): needs minimum 90-minute uninterrupted block. Never schedule in blocks smaller than 60 minutes. HARD RULE: Never schedule deep focus tasks after 9 PM — no exceptions, even if the user has free time.
- Creative tasks (reels, content): needs minimum 60-minute block. Best in mid-morning or early afternoon. Can go up to 9 PM but not later.
- Low energy tasks (admin, follow-ups): can go in small gaps or evening (up to 11 PM).
- Always add 30-minute transition buffer after any class block before scheduling a task.
- Never schedule back-to-back tasks with no break — add 15-min buffer between tasks.
- Gym needs a clean 90-minute block (75 min activity + 15 min transition).

DURATION ESTIMATION (when estimatedMinutes is null, estimate by task name patterns):
- Tasks containing "reel", "shoot", "video": 90 minutes
- Tasks containing "edit", "editing": 60 minutes
- Tasks containing "post", "publish", "upload": 20 minutes
- Tasks containing "study", "revise", "revision": 90 minutes
- Tasks containing "assignment", "homework": 120 minutes
- Tasks containing "client", "project", "build": 120-150 minutes
- Tasks containing "call", "meeting": 60 minutes
- Tasks containing "proposal", "pitch": 90 minutes
- Tasks containing "email", "follow up", "reply": 20 minutes
- Tasks containing "plan", "outline": 45 minutes
- Default if no pattern matches: 60 minutes

DEADLINE × CONSEQUENCE SCORING (use this to rank tasks):
- College exam/assignment, deadline today or tomorrow: Score 10 — must schedule, non-negotiable
- Client work, deadline today or tomorrow: Score 9 — must schedule
- College exam/assignment, deadline in 2-3 days: Score 8 — high priority
- Client work, deadline this week: Score 7 — high priority
- Personal brand, deadline today (committed to post): Score 6 — schedule if fits
- College work, deadline next week: Score 5 — medium
- Client work, deadline 2+ weeks: Score 4 — can defer
- Personal brand, no deadline: Score 3 — schedule if slots remain
- Personal/admin: Score 1-2 — always last

RETURN FORMAT:
Return ONLY valid JSON. No markdown. No explanation outside the JSON. No backticks. Raw JSON only.

{
  "dayLoadPercent": number,
  "dayLoadLabel": "CLEAR" | "TIGHT" | "LOADED" | "OVERLOADED",
  "stats": {
    "freeTimeAvailable": "X.X hrs",
    "totalTasksRequested": number,
    "estimatedTaskTime": "X.X hrs",
    "tasksScheduled": number,
    "tasksOverflow": number
  },
  "mentorAssessment": "string — blunt, specific, 3-5 sentences max",
  "schedule": [
    {
      "id": "string",
      "name": "string",
      "start": "HH:MM",
      "end": "HH:MM",
      "type": "fixed" | "task" | "gym" | "buffer" | "wake" | "sleep",
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
      "reason": "string — one sentence why it didn't fit",
      "suggestedDay": "string | null"
    }
  ],
  "gymScheduled": boolean,
  "gymSlot": { "start": "HH:MM", "end": "HH:MM" } | null,
  "warnings": ["string"]
}`;
