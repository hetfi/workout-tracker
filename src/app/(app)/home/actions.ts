"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classifyExercise, getSessionCategories, MuscleCategory } from "@/lib/muscleCategory";

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
    // Look up is_one_arm from exercises master for each exercise name
    const exerciseNames = planExercises.map((pe) => pe.exercise_name);
    const { data: exerciseMaster } = await supabase
      .from("exercises")
      .select("name, is_one_arm")
      .eq("user_id", user.id)
      .in("name", exerciseNames);

    const oneArmMap: Record<string, boolean> = {};
    for (const ex of exerciseMaster ?? []) {
      oneArmMap[ex.name] = Boolean(ex.is_one_arm);
    }

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
      is_one_arm: oneArmMap[pe.exercise_name] ?? false,
    }));

    await supabase.from("workout_session_exercises").insert(sessionExercises);
  }

  redirect(`/session/${session.id}`);
}

export async function getCalendarData(
  year: number,
  month: number
): Promise<Record<string, MuscleCategory[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, date")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .neq("status", "abandoned");

  if (!sessions || sessions.length === 0) return {};

  const sessionIds = sessions.map((s) => s.id);

  // 種目と完了セットを同時取得
  const [{ data: exercises }, { data: completedSets }] = await Promise.all([
    supabase
      .from("workout_session_exercises")
      .select("id, session_id, exercise_name")
      .in("session_id", sessionIds),
    supabase
      .from("workout_sets")
      .select("session_exercise_id")
      .in("session_id", sessionIds)
      .eq("status", "completed"),
  ]);

  if (!exercises) return {};

  // 完了セットがある session_exercise_id のセット
  const completedExerciseIds = new Set(
    (completedSets ?? []).map((s) => s.session_exercise_id)
  );

  // Map session_id -> date
  const sessionDateMap: Record<string, string> = {};
  for (const s of sessions) {
    sessionDateMap[s.id] = s.date;
  }

  // Group exercise names by date（完了セットがある種目のみ）
  const dateExercises: Record<string, string[]> = {};
  for (const ex of exercises) {
    if (!completedExerciseIds.has(ex.id)) continue; // 0セット除外
    const date = sessionDateMap[ex.session_id];
    if (!date) continue;
    if (!dateExercises[date]) dateExercises[date] = [];
    dateExercises[date].push(ex.exercise_name);
  }

  const result: Record<string, MuscleCategory[]> = {};
  for (const [date, names] of Object.entries(dateExercises)) {
    result[date] = getSessionCategories(names);
  }

  return result;
}
