"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ManualExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
}

export async function getPastExercises(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("exercises")
    .select("id, name")
    .order("name")
    .limit(100);

  return data ?? [];
}

export async function addManualSession(
  date: string,
  exercises: ManualExercise[]
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (exercises.length === 0) throw new Error("種目を1つ以上追加してください");

  // Derive title from first exercise
  const title = exercises.length === 1
    ? exercises[0].name
    : `${exercises[0].name} 他${exercises.length - 1}種目`;

  // Create workout plan
  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .insert({
      user_id: user.id,
      date,
      title,
      raw_text: exercises.map((e) => `${e.name} ${e.sets}×${e.repsMin}-${e.repsMax}`).join("\n"),
      status: "active",
      sort_order: 0,
    })
    .select()
    .single();
  if (planError || !plan) throw new Error("Failed to create plan");

  // Create plan exercises
  const planExercises = exercises.map((e, i) => ({
    user_id: user.id,
    plan_id: plan.id,
    exercise_name: e.name,
    sets: e.sets,
    reps_min: e.repsMin,
    reps_max: e.repsMax,
    rest_seconds: 90,
    sort_order: i,
  }));
  await supabase.from("workout_plan_exercises").insert(planExercises);

  // Create workout session
  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      plan_id: plan.id,
      date,
      title,
      status: "not_started",
    })
    .select()
    .single();
  if (sessionError || !session) throw new Error("Failed to create session");

  // Create session exercises
  const sessionExercises = exercises.map((e, i) => ({
    user_id: user.id,
    session_id: session.id,
    exercise_name: e.name,
    planned_sets: e.sets,
    planned_reps_min: e.repsMin,
    planned_reps_max: e.repsMax,
    rest_seconds: 90,
    sort_order: i,
  }));
  await supabase.from("workout_session_exercises").insert(sessionExercises);

  redirect(`/session/${session.id}`);
}
