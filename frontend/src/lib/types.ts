export interface WorkingDay {
  id?: number;
  day_name: string;
  is_half_day: boolean;
  day_order: number;
}

export interface Period {
  id?: number;
  period_number: number;
  start_time: string;
  end_time: string;
  label?: string | null;
}

export interface Break {
  id?: number;
  name: string;
  after_period: number;
  duration_minutes: number;
}

export interface School {
  id: number;
  name: string;
  board: string;
  periods_per_day: number;
  half_day_periods?: number | null;
  academic_year: string;
  working_days: WorkingDay[];
  periods: Period[];
  breaks: Break[];
}

export interface Subject {
  id: number;
  school_id: number;
  name: string;
  code?: string | null;
  requires_room_type: string;
  color: string;
}

export interface Section {
  id: number;
  standard_id: number;
  name: string;
  strength: number;
}

export interface Standard {
  id: number;
  school_id: number;
  name: string;
  order: number;
  sections: Section[];
}

export interface Room {
  id: number;
  school_id: number;
  name: string;
  room_type: string;
  capacity: number;
  is_available: boolean;
}

export interface FixedSlot {
  id: number;
  school_id?: number;
  section_id: number;
  subject_id?: number | null;
  label: string;
  day_index: number;
  period_index: number;
}

export interface Teacher {
  id: number;
  school_id: number;
  name: string;
  email?: string | null;
  max_periods_per_day: number;
  min_periods_per_week: number;
}

export interface Assignment {
  id: number;
  school_id: number;
  teacher_id: number;
  subject_id: number;
  section_id: number;
  lectures_per_week: number;
  lectures_per_week_max?: number | null;
  preferred_time?: string | null;
}

export interface TimetableSlot {
  id: number;
  section_id: number;
  teacher_id?: number | null;
  subject_id?: number | null;
  room_id?: number | null;
  day_index: number;
  period_index: number;
  is_free: boolean;
  is_fixed: boolean;
  conflict: boolean;
  teacher_name?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  room_name?: string | null;
}

export interface Timetable {
  id: number;
  school_id: number;
  name: string;
  status: string;
  created_at: string;
  published_at?: string | null;
  generation_log?: string | null;
  slots?: TimetableSlot[];
}

export interface PreflightResult {
  feasible: boolean;
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
}

export interface RuleConfig {
  id: number;
  keep_key_periods_filled: boolean;
  teacher_rest_after_two: boolean;
  avoid_back_to_back_free: boolean;
  spread_subjects: boolean;
  morning_hard_subjects: boolean;
  max_doubles_per_week: number;
  solve_time_limit: number;
  ai_provider: string;
  has_ai_key: boolean;
}

export interface CustomRule {
  id: number;
  rule_type: string; // subject_time | subject_max_per_day | subject_position
  subject_name?: string | null;
  param_text?: string | null;
  param_int?: number | null;
  enabled: boolean;
}
