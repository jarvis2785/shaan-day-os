export interface FixedBlock {
  id: string;
  name: string;
  start: string;
  end: string;
  type: 'class' | 'gym' | 'custom';
}

export interface TimeWindow {
  start: string;
  end: string;
  durationMinutes: number;
  quality: 'prime' | 'good' | 'low';
}

export type TaskCategory = 'personal_brand' | 'agency_client' | 'college' | 'health' | 'personal';
export type TaskDeadline = 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'two_plus_weeks' | 'none';
export type TaskPriority = 'high' | 'medium' | 'low';
export type EnergyType = 'deep_focus' | 'creative' | 'low_energy_ok';

export interface Task {
  id: string;
  name: string;
  category: TaskCategory;
  deadline: TaskDeadline;
  priority: TaskPriority;
  estimatedMinutes: number | null;
  notes: string | null;
}

export interface DaySchedule {
  [day: string]: FixedBlock[];
}

export interface GymConfig {
  enabled: boolean;
  frequency: number;
  duration: number;
  preference: 'morning' | 'afternoon' | 'evening' | 'auto';
}

export interface DeadZoneSettings {
  morningRoutine: number;
  lunchDuration: number;
  dinnerDuration: number;
  gymRecovery: number;
}

export interface UserSettings {
  wakeTime: string;
  sleepTime: string;
  gym: GymConfig;
  schedule: DaySchedule;
  deadZones?: DeadZoneSettings;
}

export type DayProfile = 'moderate' | 'heavy' | 'low-capacity' | 'free';
export type DayLoadLabel = 'CLEAR' | 'TIGHT' | 'LOADED' | 'OVERLOADED';

export interface ScheduleBlock {
  id: string;
  name: string;
  start: string;
  end: string;
  type: 'fixed' | 'task' | 'gym' | 'buffer' | 'wake' | 'sleep' | 'dead_zone' | 'meal';
  category: string | null;
  estimatedMinutes: number;
  energyType: EnergyType | null;
  notes: string | null;
}

export interface OverflowTask {
  id: string;
  name: string;
  reason: string;
  suggestedDay: string | null;
}

export interface AnalysisResult {
  dayLoadPercent: number;
  dayLoadLabel: DayLoadLabel;
  stats: {
    freeTimeAvailable: string;
    usableTimeAfterDeadZones?: string;
    totalTasksRequested: number;
    estimatedTaskTime: string;
    tasksScheduled: number;
    tasksOverflow: number;
  };
  mentorAssessment: string;
  schedule: ScheduleBlock[];
  overflow: OverflowTask[];
  deadZones?: Array<{ start: string; end: string; reason: string }>;
  gymScheduled?: boolean;
  gymSlot?: { start: string; end: string } | null;
  warnings: string[];
}

export interface AnalysisInput {
  user: {
    name: string;
    wakeTime: string;
    sleepTime: string;
    totalWakingHours: number;
  };
  today: {
    date: string;
    dayName: string;
    dayProfile: DayProfile;
    fixedBlocks: FixedBlock[];
    totalFixedMinutes: number;
    totalFreeMinutes: number;
    freeWindows: TimeWindow[];
  };
  tasks: Task[];
  deadZoneSettings: DeadZoneSettings;
}

export type DayState = 'input' | 'analysis' | 'locked';

export interface DayPlan {
  date: string;
  state: DayState;
  tasks: Task[];
  analysis: AnalysisResult | null;
  lockedAt: string | null;
  completedTaskIds: string[];
}

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  personal_brand: 'Personal Brand',
  agency_client: 'Agency & Client',
  college: 'College',
  health: 'Health',
  personal: 'Personal',
};

export const CATEGORY_EMOJIS: Record<TaskCategory, string> = {
  personal_brand: '🎬',
  agency_client: '💼',
  college: '📚',
  health: '💪',
  personal: '👤',
};

export const DEADLINE_LABELS: Record<TaskDeadline, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'This week',
  next_week: 'Next week',
  two_plus_weeks: '2+ weeks',
  none: 'No deadline',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};
