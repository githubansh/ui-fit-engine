export type Goal = "strength" | "hypertrophy" | "fat_loss" | "endurance" | "mobility";
export type Level = "beginner" | "intermediate" | "expert";
export type Severity = "mild" | "moderate" | "severe";

export type InjuryOption = {
  code: string;
  display_name: string;
  description: string;
};

export type MetaOptions = {
  goals: Goal[];
  levels: Level[];
  equipment: string[];
  injuries: InjuryOption[];
};

export type User = {
  id: number;
  name: string | null;
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  level: Level;
  goal: Goal;
  days_per_week: number;
  minutes_per_session: number;
  equipment: string[];
};

export type Exercise = {
  id: string;
  name: string;
  level: Level;
  force: string | null;
  mechanic: string;
  equipment: string;
  category: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  muscle_groups: string[];
  instructions: string[];
  images: string[];
  image_urls: string[];
};

export type PlanSlot = {
  id: number;
  slot_index: number;
  exercise_id: string;
  exercise: Exercise | null;
  sets: number;
  reps: string;
  rest_sec: number;
  rpe_target: number;
  rationale: string;
  status: string;
};

export type PlanDay = {
  id: number;
  day_index: number;
  focus: string;
  slots: PlanSlot[];
};

export type Plan = {
  id: number;
  user_id: number;
  week_index: number;
  version: number;
  split: string;
  status: string;
  params: {
    feasibility_notes?: string[];
    conditioning_blocks?: Array<{ type: string; description: string; minutes: number }>;
    [key: string]: unknown;
  };
  days: PlanDay[];
};

export type IntakePreview = {
  source: string;
  requires_structured_form: boolean;
  medical_warning?: string;
  injuries: Array<{ injury_code: string; severity: Severity; notes?: string | null }>;
  exclusions: Array<{ exercise_id: string; name: string; reason: string }>;
  unresolved_exclusions_by_name: string[];
  preferences_text: string;
};

export type Alternative = {
  exercise: Exercise;
  score: number;
  similarity: number;
  utility: number;
  primary_group: string | null;
};

export type CoachResponse = {
  message: string;
  source?: "llm" | "fallback";
  tool_results: Array<{ tool: string; result: unknown }>;
};

export type ProgressExercise = {
  slot_id: number;
  exercise_id: string;
  exercise_name: string;
  reward: number;
};

export type ProgressSession = {
  id: number;
  plan_id: number;
  plan_day_id: number;
  week_index: number;
  version: number;
  day_index: number;
  focus: string;
  completed_at: string;
  rpe: number | null;
  duration_min: number | null;
  notes: string | null;
  completed_count: number;
  skipped_count: number;
  completed_exercises: ProgressExercise[];
  skipped_exercises: ProgressExercise[];
};

export type ProgressSummary = {
  user_id: number;
  logged_sessions: number;
  completed_slots: number;
  skipped_slots: number;
  adherence: number;
  average_rpe: number | null;
  most_skipped: Array<{ exercise_name: string; count: number }>;
  recent_sessions: ProgressSession[];
};
