import { createClient } from "@/lib/supabase/client";
import type { WorkoutPlan, WorkoutPlanExercise } from "@/domain/types";
import type { ParsedWorkout } from "@/domain/types";
import { findExerciseByNameOrAlias, createExercise } from "./exercises";

function toPlan(row: Record<string, unknown>): WorkoutPlan {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    date: row.date as string,
    title: row.title as string,
    rawText: (row.raw_text as string) ?? "",
    status: row.status as WorkoutPlan["status"],
    sortOrder: Number(row.sort_order),
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toPlanExercise(row: Record<string, unknown>): WorkoutPlanExercise {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    planId: row.plan_id as string,
    exerciseId: (row.exercise_id as string) ?? null,
    exerciseName: row.exercise_name as string,
    sets: Number(row.sets),
    repsTarget: {
      min: Number(row.reps_min),
      max: Number(row.reps_max),
    },
    restSeconds: Number(row.rest_seconds),
    sortOrder: Number(row.sort_order),
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listPlans(date?: string): Promise<WorkoutPlan[]> {
  const supabase = createClient();
  let query = supabase
    .from("workout_plans")
    .select("*")
    .neq("status", "deleted")
    .order("date", { ascending: false });

  if (date) {
    query = query.eq("date", date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toPlan);
}

export async function getPlanById(id: string): Promise<WorkoutPlan | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return toPlan(data);
}

export async function getPlanExercises(
  planId: string
): Promise<WorkoutPlanExercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_plan_exercises")
    .select("*")
    .eq("plan_id", planId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map(toPlanExercise);
}

/**
 * Save a parsed workout as a new plan.
 * Matches exercise names/aliases to existing exercises.
 * Creates new exercises when no match found.
 */
export async function saveParsedWorkout(
  parsed: ParsedWorkout,
  rawText: string
): Promise<WorkoutPlan> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Create the plan
  const { data: planData, error: planError } = await supabase
    .from("workout_plans")
    .insert({
      user_id: user.id,
      date: parsed.date,
      title: parsed.title,
      raw_text: rawText,
    })
    .select()
    .single();

  if (planError) throw planError;
  const plan = toPlan(planData);

  // Create plan exercises
  for (let i = 0; i < parsed.exercises.length; i++) {
    const ex = parsed.exercises[i];

    // Try to match to existing exercise
    let exerciseId: string | null = null;
    const matched = await findExerciseByNameOrAlias(ex.name);
    if (matched) {
      exerciseId = matched.id;
      // isDuration / muscleCategory / isOneArm フラグが変わっていたら更新
      const updates: Record<string, unknown> = {};
      if (ex.isDuration && !matched.isDuration) updates.is_duration = true;
      if (ex.muscleCategory && !matched.muscleCategory) updates.muscle_category = ex.muscleCategory;
      if (ex.isOneArm && !matched.isOneArm) updates.is_one_arm = true;
      if (Object.keys(updates).length > 0) {
        await supabase.from("exercises").update(updates).eq("id", matched.id);
      }
    } else {
      // Create a new exercise with defaults from parsed data
      try {
        const newEx = await createExercise({
          name: ex.name,
          targetMuscles: [],
          exerciseType: "other",
          weightType: "total",
          smallWeightStep: 2.5,
          largeWeightStep: 5.0,
          defaultRestSeconds: ex.restSeconds > 0 ? ex.restSeconds : 90,
          notes: null,
        });
        exerciseId = newEx.id;
        // Set is_duration / muscle_category / is_one_arm when needed
        const newUpdates: Record<string, unknown> = {};
        if (ex.isDuration) newUpdates.is_duration = true;
        if (ex.muscleCategory) newUpdates.muscle_category = ex.muscleCategory;
        if (ex.isOneArm) newUpdates.is_one_arm = true;
        if (Object.keys(newUpdates).length > 0 && newEx.id) {
          await supabase.from("exercises").update(newUpdates).eq("id", newEx.id);
        }
      } catch {
        // Ignore if already exists (race condition)
        const retry = await findExerciseByNameOrAlias(ex.name);
        exerciseId = retry?.id ?? null;
      }
    }

    const { error: exError } = await supabase
      .from("workout_plan_exercises")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        exercise_id: exerciseId,
        exercise_name: ex.name,
        sets: ex.sets,
        reps_min: ex.repsTarget.min,
        reps_max: ex.repsTarget.max,
        rest_seconds: ex.restSeconds,
        sort_order: i,
        notes: ex.notes,
      });

    if (exError) throw exError;
  }

  return plan;
}

export async function updatePlan(
  id: string,
  updates: Partial<Pick<WorkoutPlan, "date" | "title" | "status" | "notes">>
): Promise<WorkoutPlan> {
  const supabase = createClient();
  const dbUpdates: Record<string, unknown> = {};
  if (updates.date !== undefined) dbUpdates.date = updates.date;
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

  const { data, error } = await supabase
    .from("workout_plans")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toPlan(data);
}

export async function deletePlan(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("workout_plans")
    .update({ status: "deleted" })
    .eq("id", id);
  if (error) throw error;
}
