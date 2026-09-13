// ============================================================
// Core domain types for Workout Tracker
// All business logic depends on these types.
// ============================================================

// ------ Shared base ------

export interface BaseRecord {
  id: string;
  userId: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

// ------ User / Profile ------

export interface Profile extends BaseRecord {
  email: string;
  displayName: string | null;
}

// ------ Exercise (種目マスター) ------

export type ExerciseType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "other";

/**
 * How weight should be interpreted/displayed:
 * - total: total weight on the bar
 * - per_hand: weight per hand (multiply by 2 for volume)
 * - machine_display: machine stack display value
 * - bodyweight: bodyweight movement (weight = 0 or added load)
 */
export type WeightType = "total" | "per_hand" | "machine_display" | "bodyweight";

export interface Exercise extends BaseRecord {
  name: string;
  aliases: string[];
  targetMuscles: string[];
  exerciseType: ExerciseType;
  weightType: WeightType;
  /** Small increment for weight buttons (kg) */
  smallWeightStep: number;
  /** Large increment for weight buttons (kg) */
  largeWeightStep: number;
  /** Default rest interval in seconds */
  defaultRestSeconds: number;
  notes: string | null;
  deletedAt: string | null;
}

export interface ExerciseAlias extends BaseRecord {
  exerciseId: string;
  alias: string;
}

// ------ Workout Plan (取り込んだメニュー) ------

export type WorkoutPlanStatus = "active" | "archived" | "deleted";

export interface WorkoutPlan extends BaseRecord {
  date: string; // YYYY-MM-DD (Asia/Tokyo)
  title: string;
  rawText: string;
  status: WorkoutPlanStatus;
  sortOrder: number;
  notes: string | null;
}

/** Reps target: can be a single value or a range */
export interface RepsTarget {
  min: number;
  max: number; // same as min for single value
}

export interface WorkoutPlanExercise extends BaseRecord {
  planId: string;
  exerciseId: string | null; // null if not yet matched to master
  exerciseName: string; // snapshot from parse
  sets: number;
  repsTarget: RepsTarget;
  restSeconds: number; // always populated (default 90)
  sortOrder: number;
  notes: string | null;
}

// ------ Workout Session (実施したトレーニング) ------

export type WorkoutSessionStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "abandoned";

export interface WorkoutSession extends BaseRecord {
  planId: string | null;
  date: string; // YYYY-MM-DD (Asia/Tokyo)
  title: string;
  status: WorkoutSessionStatus;
  startedAt: string | null;
  completedAt: string | null;
  /** Body condition 1-5 */
  bodyCondition: number | null;
  /** Fatigue level 1-5 */
  fatigueLevel: number | null;
  pain: string | null;
  notes: string | null;
}

/** Per-exercise record within a session */
export interface WorkoutSessionExercise extends BaseRecord {
  sessionId: string;
  exerciseId: string | null;
  /** Snapshot: name at time of recording */
  exerciseName: string;
  /** Snapshot: plan target */
  plannedSets: number;
  plannedRepsTarget: RepsTarget;
  /** Snapshot: rest from plan */
  restSeconds: number;
  sortOrder: number;
  skipped: boolean;
  notes: string | null;
}

export type SetStatus = "pending" | "completed" | "skipped";

export interface WorkoutSet extends BaseRecord {
  sessionExerciseId: string;
  sessionId: string;
  setNumber: number; // 1-indexed
  /** Weight in kg */
  weight: number;
  reps: number;
  status: SetStatus;
  completedAt: string | null;
  notes: string | null;
  /** Idempotency key to prevent duplicate saves */
  clientId: string;
}

// ------ Rest Timer ------

export type TimerStatus = "running" | "paused" | "finished" | "cancelled";

export interface RestTimer extends BaseRecord {
  sessionId: string;
  sessionExerciseId: string;
  /** The set that triggered this timer */
  triggerSetId: string;
  nextSetNumber: number;
  /** Total duration configured (seconds) */
  durationSeconds: number;
  startedAt: string; // ISO 8601
  /** Absolute deadline – remaining = endsAt - now */
  endsAt: string; // ISO 8601
  status: TimerStatus;
  /** Adjustment applied (positive = added time, negative = subtracted) */
  adjustmentSeconds: number;
}

// ------ User Settings ------

export interface UserSettings extends BaseRecord {
  /** Notification sound on/off */
  soundEnabled: boolean;
  /** Vibration on/off */
  vibrationEnabled: boolean;
  /** Browser notification on/off */
  browserNotificationEnabled: boolean;
}

// ============================================================
// Parser types (not persisted directly)
// ============================================================

export interface ParsedExercise {
  name: string;
  sets: number;
  repsTarget: RepsTarget;
  /** seconds */
  restSeconds: number;
  notes: string | null;
}

export interface ParsedWorkout {
  date: string; // YYYY-MM-DD
  title: string;
  exercises: ParsedExercise[];
  /** Lines that could not be parsed */
  warnings: string[];
}

// ============================================================
// Preset types
// ============================================================

export interface PreviousSetRecord {
  setNumber: number;
  weight: number;
  reps: number;
}

export interface ExercisePreset {
  exerciseId: string | null;
  exerciseName: string;
  sets: PreviousSetRecord[];
  source: "previous_session" | "default";
}

// ============================================================
// Draft types (IndexedDB local storage)
// ============================================================

export interface LocalDraftSession {
  sessionId: string;
  updatedAt: string;
  sets: LocalDraftSet[];
}

export interface LocalDraftSet {
  clientId: string;
  sessionExerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  status: SetStatus;
  completedAt: string | null;
  notes: string | null;
}

export interface LocalDraftTimer {
  sessionId: string;
  sessionExerciseId: string;
  triggerSetId: string;
  nextSetNumber: number;
  durationSeconds: number;
  startedAt: string;
  endsAt: string;
  status: TimerStatus;
  adjustmentSeconds: number;
}

// ============================================================
// Save status (UI feedback)
// ============================================================

export type SaveStatus = "idle" | "saving" | "saved" | "error";
