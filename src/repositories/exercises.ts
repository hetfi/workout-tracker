/**
 * Exercise repository.
 * All data access for exercises and aliases goes through this module.
 * UI components import from here, not directly from supabase client.
 */

import { createClient } from "@/lib/supabase/client";
import type { Exercise, ExerciseAlias } from "@/domain/types";

function toExercise(row: Record<string, unknown>): Exercise {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    aliases: (row.aliases as string[]) ?? [],
    targetMuscles: (row.target_muscles as string[]) ?? [],
    exerciseType: row.exercise_type as Exercise["exerciseType"],
    weightType: row.weight_type as Exercise["weightType"],
    smallWeightStep: Number(row.small_weight_step),
    largeWeightStep: Number(row.large_weight_step),
    defaultRestSeconds: Number(row.default_rest_seconds),
    notes: (row.notes as string) ?? null,
    deletedAt: (row.deleted_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listExercises(): Promise<Exercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .is("deleted_at", null)
    .order("name");

  if (error) throw error;
  return (data ?? []).map(toExercise);
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return toExercise(data);
}

export async function createExercise(
  params: Pick<
    Exercise,
    | "name"
    | "targetMuscles"
    | "exerciseType"
    | "weightType"
    | "smallWeightStep"
    | "largeWeightStep"
    | "defaultRestSeconds"
    | "notes"
  >
): Promise<Exercise> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: user.id,
      name: params.name,
      target_muscles: params.targetMuscles,
      exercise_type: params.exerciseType,
      weight_type: params.weightType,
      small_weight_step: params.smallWeightStep,
      large_weight_step: params.largeWeightStep,
      default_rest_seconds: params.defaultRestSeconds,
      notes: params.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return toExercise(data);
}

export async function updateExercise(
  id: string,
  params: Partial<
    Pick<
      Exercise,
      | "name"
      | "targetMuscles"
      | "exerciseType"
      | "weightType"
      | "smallWeightStep"
      | "largeWeightStep"
      | "defaultRestSeconds"
      | "notes"
    >
  >
): Promise<Exercise> {
  const supabase = createClient();
  const updates: Record<string, unknown> = {};
  if (params.name !== undefined) updates.name = params.name;
  if (params.targetMuscles !== undefined) updates.target_muscles = params.targetMuscles;
  if (params.exerciseType !== undefined) updates.exercise_type = params.exerciseType;
  if (params.weightType !== undefined) updates.weight_type = params.weightType;
  if (params.smallWeightStep !== undefined) updates.small_weight_step = params.smallWeightStep;
  if (params.largeWeightStep !== undefined) updates.large_weight_step = params.largeWeightStep;
  if (params.defaultRestSeconds !== undefined) updates.default_rest_seconds = params.defaultRestSeconds;
  if (params.notes !== undefined) updates.notes = params.notes;

  const { data, error } = await supabase
    .from("exercises")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toExercise(data);
}

export async function softDeleteExercise(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("exercises")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---- Aliases ----

export async function listAliases(exerciseId: string): Promise<ExerciseAlias[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercise_aliases")
    .select("*")
    .eq("exercise_id", exerciseId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    exerciseId: row.exercise_id,
    alias: row.alias,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function addAlias(exerciseId: string, alias: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("exercise_aliases").insert({
    user_id: user.id,
    exercise_id: exerciseId,
    alias,
  });
  if (error) throw error;
}

export async function deleteAlias(aliasId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("exercise_aliases")
    .delete()
    .eq("id", aliasId);
  if (error) throw error;
}

/**
 * Find exercise by name or alias (case-insensitive).
 * Returns the exercise if found, or null.
 */
export async function findExerciseByNameOrAlias(
  nameOrAlias: string
): Promise<Exercise | null> {
  const supabase = createClient();

  // Check exercise names
  const { data: byName } = await supabase
    .from("exercises")
    .select("*")
    .ilike("name", nameOrAlias)
    .is("deleted_at", null)
    .limit(1);

  if (byName && byName.length > 0) {
    return toExercise(byName[0]);
  }

  // Check aliases
  const { data: byAlias } = await supabase
    .from("exercise_aliases")
    .select("exercise_id")
    .ilike("alias", nameOrAlias)
    .limit(1);

  if (byAlias && byAlias.length > 0) {
    return getExerciseById(byAlias[0].exercise_id);
  }

  return null;
}
