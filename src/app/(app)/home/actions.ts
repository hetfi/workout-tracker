"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function startTrainingFromPlan(planId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load plan
  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("id", planId)
    .single();
  if (planError || !plan) throw new Error("Plan not found");

  // Load plan exercises
  const { data: planExercises } = await supabase
    .from("workout_plan_exercises")
    .select("*")
    .eq("plan_id", planId)
    .order("sort_order");

  // Create session
  const today = new Date();
  const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      plan_id: planId,
      date: todayStr,
      title: plan.title,
      status: "not_started",
    })
    .select()
    .single();
  if (sessionError || !session) throw new Error("Failed to create session");

  // Create session exercises from plan exercises
  if (planExercises && planExercises.length > 0) {
    const sessionExercises = planExercises.map((pe) => ({
      user_id: user.id,
      session_id: session.id,
      exercise_id: pe.exercise_id ?? null,
      exercise_name: pe.exercise_name,
      planned_sets: pe.sets,
      planned_reps_min: pe.reps_min,
      planned_reps_max: pe.reps_max,
      rest_seconds: pe.rest_seconds,
      sort_order: pe.sort_order,
    }));

    await supabase.from("workout_session_exercises").insert(sessionExercises);
  }

  redirect(`/session/${session.id}`);
}
