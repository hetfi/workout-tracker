import { createClient } from "@/lib/supabase/client";
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from "@/domain/types";
import type { PreviousExerciseData } from "@/lib/preset";
import type { WorkoutPlan, WorkoutPlanExercise } from "@/domain/types";

// ---- Type mappers ----

function toSession(row: Record<string, unknown>): WorkoutSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    planId: (row.plan_id as string) ?? null,
    date: row.date as string,
    title: row.title as string,
    status: row.status as WorkoutSession["status"],
    startedAt: (row.started_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    bodyCondition: (row.body_condition as number) ?? null,
    fatigueLevel: (row.fatigue_level as number) ?? null,
    pain: (row.pain as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toSessionExercise(row: Record<string, unknown>): WorkoutSessionExercise {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    sessionId: row.session_id as string,
    exerciseId: (row.exercise_id as string) ?? null,
    exerciseName: row.exercise_name as string,
    plannedSets: Number(row.planned_sets),
    plannedRepsTarget: {
      min: Number(row.planned_reps_min),
      max: Number(row.planned_reps_max),
    },
    restSeconds: Number(row.rest_seconds),
    sortOrder: Number(row.sort_order),
    skipped: Boolean(row.skipped),
    notes: (row.notes as string) ?? null,
    isOneArm: Boolean(row.is_one_arm),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toSet(row: Record<string, unknown>): WorkoutSet {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    sessionExerciseId: row.session_exercise_id as string,
    sessionId: row.session_id as string,
    setNumber: Number(row.set_number),
    weight: Number(row.weight),
    reps: Number(row.reps),
    status: row.status as WorkoutSet["status"],
    completedAt: (row.completed_at as string) ?? null,
    notes: (row.notes as string) ?? null,
    clientId: row.client_id as string,
    side: (row.side as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---- Sessions ----

export async function listSessions(limit = 20): Promise<WorkoutSession[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .neq("status", "abandoned")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toSession);
}

export async function getSessionById(
  id: string
): Promise<WorkoutSession | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return toSession(data);
}

export async function getTodaySession(): Promise<WorkoutSession | null> {
  const supabase = createClient();
  const today = new Date();
  const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("date", todayStr)
    .in("status", ["not_started", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data ? toSession(data) : null;
}

/**
 * Create a session from a plan.
 * Also creates session exercises with preset values.
 */
export async function createSessionFromPlan(
  plan: WorkoutPlan,
  planExercises: WorkoutPlanExercise[]
): Promise<WorkoutSession> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: sessionData, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      plan_id: plan.id,
      date: plan.date,
      title: plan.title,
      status: "not_started",
    })
    .select()
    .single();

  if (sessionError) throw sessionError;
  const session = toSession(sessionData);

  // Create session exercises
  for (const pe of planExercises.sort((a, b) => a.sortOrder - b.sortOrder)) {
    await supabase.from("workout_session_exercises").insert({
      user_id: user.id,
      session_id: session.id,
      exercise_id: pe.exerciseId,
      exercise_name: pe.exerciseName,
      planned_sets: pe.sets,
      planned_reps_min: pe.repsTarget.min,
      planned_reps_max: pe.repsTarget.max,
      rest_seconds: pe.restSeconds,
      sort_order: pe.sortOrder,
      notes: pe.notes,
      is_one_arm: false,
    });
  }

  return session;
}

export async function updateSession(
  id: string,
  updates: Partial<
    Pick<
      WorkoutSession,
      | "status"
      | "startedAt"
      | "completedAt"
      | "bodyCondition"
      | "fatigueLevel"
      | "pain"
      | "notes"
    >
  >
): Promise<WorkoutSession> {
  const supabase = createClient();
  const dbUpdates: Record<string, unknown> = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.startedAt !== undefined) dbUpdates.started_at = updates.startedAt;
  if (updates.completedAt !== undefined)
    dbUpdates.completed_at = updates.completedAt;
  if (updates.bodyCondition !== undefined)
    dbUpdates.body_condition = updates.bodyCondition;
  if (updates.fatigueLevel !== undefined)
    dbUpdates.fatigue_level = updates.fatigueLevel;
  if (updates.pain !== undefined) dbUpdates.pain = updates.pain;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

  const { data, error } = await supabase
    .from("workout_sessions")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toSession(data);
}

// ---- Session Exercises ----

export async function getSessionExercises(
  sessionId: string
): Promise<WorkoutSessionExercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_session_exercises")
    .select("*")
    .eq("session_id", sessionId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map(toSessionExercise);
}

export async function updateSessionExercise(
  id: string,
  updates: Partial<Pick<WorkoutSessionExercise, "skipped" | "notes">>
): Promise<WorkoutSessionExercise> {
  const supabase = createClient();
  const dbUpdates: Record<string, unknown> = {};
  if (updates.skipped !== undefined) dbUpdates.skipped = updates.skipped;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

  const { data, error } = await supabase
    .from("workout_session_exercises")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toSessionExercise(data);
}

// ---- Sets ----

export async function getSessionSets(
  sessionId: string
): Promise<WorkoutSet[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_sets")
    .select("*")
    .eq("session_id", sessionId)
    .order("set_number");
  if (error) throw error;
  return (data ?? []).map(toSet);
}

export async function upsertSet(
  setData: Pick<
    WorkoutSet,
    | "sessionExerciseId"
    | "sessionId"
    | "setNumber"
    | "weight"
    | "reps"
    | "status"
    | "completedAt"
    | "notes"
    | "clientId"
    | "side"
  >
): Promise<WorkoutSet> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("workout_sets")
    .upsert(
      {
        user_id: user.id,
        session_exercise_id: setData.sessionExerciseId,
        session_id: setData.sessionId,
        set_number: setData.setNumber,
        weight: setData.weight,
        reps: setData.reps,
        status: setData.status,
        completed_at: setData.completedAt,
        notes: setData.notes,
        client_id: setData.clientId,
        side: setData.side ?? null,
      },
      { onConflict: "client_id", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) throw error;
  return toSet(data);
}

/**
 * Get the most recent COMPLETED session for a given exercise.
 * Excludes in_progress and abandoned sessions.
 */
export async function getPreviousSessionData(
  exerciseId: string | null,
  exerciseName: string
): Promise<PreviousExerciseData | null> {
  const supabase = createClient();

  // Find the latest completed session that includes this exercise
  const query = supabase
    .from("workout_session_exercises")
    .select(
      `
      id,
      exercise_id,
      exercise_name,
      workout_sessions!inner(id, status),
      workout_sets(set_number, weight, reps, status)
    `
    )
    .eq("workout_sessions.status", "completed");

  if (exerciseId) {
    query.eq("exercise_id", exerciseId);
  } else {
    query.ilike("exercise_name", exerciseName);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const row = data[0] as Record<string, unknown>;

  return {
    exerciseId: (row.exercise_id as string) ?? null,
    exerciseName: row.exercise_name as string,
    sets: ((row.workout_sets as Record<string, unknown>[]) ?? []).map((s) => ({
      setNumber: Number(s.set_number),
      weight: Number(s.weight),
      reps: Number(s.reps),
      status: s.status as WorkoutSet["status"],
    })),
  };
}

// ---- Delete helpers ----

export async function deleteSessionExercise(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("workout_session_exercises").delete().eq("id", id);
}

export async function deleteWorkoutSet(clientId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("workout_sets").delete().eq("client_id", clientId);
}
