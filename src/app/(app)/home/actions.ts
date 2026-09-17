"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classifyExercise, CATEGORY_ORDER, MuscleCategory } from "@/lib/muscleCategory";

export async function startTrainingFromPlan(planId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  // プランとプラン種目を並列取得
  const [{ data: plan, error: planError }, { data: planExercises }] = await Promise.all([
    supabase.from("workout_plans").select("*").eq("id", planId).single(),
    supabase.from("workout_plan_exercises").select("*").eq("plan_id", planId).order("sort_order"),
  ]);
  if (planError || !plan) throw new Error("Plan not found");

  const exerciseNames = (planExercises ?? []).map((pe) => pe.exercise_name);

  // セッション作成とマスター取得を並列実行
  const [{ data: session, error: sessionError }, { data: exerciseMaster }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        plan_id: planId,
        date: todayStr,
        title: plan.title,
        status: "not_started",
      })
      .select()
      .single(),
    exerciseNames.length > 0
      ? supabase.from("exercises").select("name, is_one_arm").eq("user_id", user.id).in("name", exerciseNames)
      : Promise.resolve({ data: [] as { name: string; is_one_arm: boolean }[] }),
  ]);
  if (sessionError || !session) throw new Error("Failed to create session");

  // Create session exercises from plan exercises
  if (planExercises && planExercises.length > 0) {

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

/** 過去 N ヶ月分（当月含む）のカレンダーデータを一括取得する */
export async function getCalendarDataRange(
  toYear: number,
  toMonth: number,
  monthCount: number = 6
): Promise<Record<string, MuscleCategory[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  // 開始月を計算（monthCount ヶ月前の1日）
  const fromDate = new Date(toYear, toMonth - monthCount, 1);
  const startDate = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(toYear, toMonth, 0).getDate();
  const endDate = `${toYear}-${String(toMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

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

  // exercises マスターを取得してカテゴリを正確に解決する（day view と同じ方式）
  const allExerciseNames = [
    ...new Set((exercises ?? []).map((e) => e.exercise_name)),
  ];
  const { data: masterExercises } =
    allExerciseNames.length > 0
      ? await supabase
          .from("exercises")
          .select("name, muscle_category")
          .eq("user_id", user.id)
          .in("name", allExerciseNames)
      : { data: [] };

  const categoryMap: Record<string, MuscleCategory> = {};
  for (const ex of masterExercises ?? []) {
    if (ex.muscle_category)
      categoryMap[ex.name] = ex.muscle_category as MuscleCategory;
  }
  const getCategory = (name: string): MuscleCategory =>
    categoryMap[name] ?? classifyExercise(name);

  // Map session_id -> date
  const sessionDateMap: Record<string, string> = {};
  for (const s of sessions) {
    sessionDateMap[s.id] = s.date;
  }

  // Group categories by date（完了セットがある種目のみ）
  const dateCategories: Record<string, Set<MuscleCategory>> = {};
  for (const ex of exercises) {
    if (!completedExerciseIds.has(ex.id)) continue; // 0セット除外
    const date = sessionDateMap[ex.session_id];
    if (!date) continue;
    if (!dateCategories[date]) dateCategories[date] = new Set();
    dateCategories[date].add(getCategory(ex.exercise_name));
  }

  const result: Record<string, MuscleCategory[]> = {};
  for (const [date, catSet] of Object.entries(dateCategories)) {
    result[date] = CATEGORY_ORDER.filter((c) => catSet.has(c));
  }

  return result;
}

/** 後方互換：単月取得（既存コードからの呼び出し用） */
export async function getCalendarData(
  year: number,
  month: number
): Promise<Record<string, MuscleCategory[]>> {
  return getCalendarDataRange(year, month, 1);
}
