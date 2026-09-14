"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ManualExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  isOneArm?: boolean;
}

export async function getPastExercises(): Promise<
  { id: string; name: string; muscle_category: string | null; is_one_arm: boolean }[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("exercises")
    .select("id, name, muscle_category, is_one_arm")
    .eq("user_id", user.id)
    .order("name")
    .limit(200);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    muscle_category: row.muscle_category ?? null,
    is_one_arm: Boolean(row.is_one_arm),
  }));
}

/**
 * 種目名ごとに最新の完了セッションから「完了セット数・計画レップ範囲」を取得する。
 * セット数 = 最新完了セッションの完了セット数（ユニーク set_number 数）
 * レップ目安 = その完了セッションエクササイズの planned_reps_min/max
 */
interface ExerciseHistoryData {
  completedSets: number;
  repsMin: number;
  repsMax: number;
}

async function getLatestHistoryForExercises(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  exerciseNames: string[]
): Promise<Record<string, ExerciseHistoryData>> {
  if (exerciseNames.length === 0) return {};

  // 1. 最新の完了セッション種目を取得（降順なので先頭が最新）
  const { data: seRows } = await supabase
    .from("workout_session_exercises")
    .select(`
      id,
      exercise_name,
      planned_reps_min,
      planned_reps_max,
      workout_sessions!inner(status)
    `)
    .eq("user_id", userId)
    .in("exercise_name", exerciseNames)
    .eq("workout_sessions.status", "completed")
    .order("created_at", { ascending: false })
    .limit(exerciseNames.length * 5);

  // 種目名ごとに最新1件だけ保持
  const latestByName = new Map<string, { id: string; repsMin: number; repsMax: number }>();
  for (const row of seRows ?? []) {
    const r = row as Record<string, unknown>;
    const name = r.exercise_name as string;
    if (!latestByName.has(name)) {
      latestByName.set(name, {
        id: r.id as string,
        repsMin: Number(r.planned_reps_min ?? 0),
        repsMax: Number(r.planned_reps_max ?? 0),
      });
    }
  }

  if (latestByName.size === 0) return {};

  // 2. その session_exercise の完了セットを取得し、ユニーク set_number 数を数える
  const seIds = Array.from(latestByName.values()).map((v) => v.id);
  const { data: setRows } = await supabase
    .from("workout_sets")
    .select("session_exercise_id, set_number")
    .in("session_exercise_id", seIds)
    .eq("status", "completed");

  const result: Record<string, ExerciseHistoryData> = {};
  for (const [name, info] of latestByName) {
    const setsForEx = (setRows ?? []).filter(
      (s: Record<string, unknown>) => s.session_exercise_id === info.id
    );
    // ユニークな set_number でペア数（片側種目も通常種目も同じロジックで OK）
    const uniqueSetNums = new Set(
      setsForEx.map((s: Record<string, unknown>) => Number(s.set_number))
    );
    const completedSets = uniqueSetNums.size;
    result[name] = {
      completedSets: completedSets > 0 ? completedSets : 0,
      repsMin: info.repsMin,
      repsMax: info.repsMax,
    };
  }

  return result;
}

/** 種目名 → default_rest_seconds のマップを取得する */
async function getRestSecondsMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  exerciseNames: string[]
): Promise<Record<string, number>> {
  if (exerciseNames.length === 0) return {};
  const { data } = await supabase
    .from("exercises")
    .select("name, default_rest_seconds")
    .eq("user_id", userId)
    .in("name", exerciseNames)
    .is("deleted_at", null);
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.default_rest_seconds != null) {
      map[row.name as string] = row.default_rest_seconds as number;
    }
  }
  return map;
}

/** 新規セッションを作成して種目を追加する */
export async function addManualSession(
  date: string,
  exercises: ManualExercise[],
  backTo?: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (exercises.length === 0) throw new Error("種目を1つ以上追加してください");

  // 種目マスターから default_rest_seconds を取得
  const restMap = await getRestSecondsMap(supabase, user.id, exercises.map((e) => e.name));

  // 最新の履歴からセット数・レップ目安を取得して上書き
  const historyMap = await getLatestHistoryForExercises(supabase, user.id, exercises.map((e) => e.name));
  exercises = exercises.map((e) => {
    const hist = historyMap[e.name];
    if (hist && hist.completedSets > 0) {
      return { ...e, sets: hist.completedSets, repsMin: hist.repsMin, repsMax: hist.repsMax };
    }
    return { ...e, sets: 1, repsMin: 0, repsMax: 0 }; // 履歴なし → 1セット、目安なし
  });

  // Derive title from first exercise
  const title =
    exercises.length === 1
      ? exercises[0].name
      : `${exercises[0].name} 他${exercises.length - 1}種目`;

  // Create workout plan
  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .insert({
      user_id: user.id,
      date,
      title,
      raw_text: exercises
        .map((e) => `${e.name} ${e.sets}×${e.repsMin}-${e.repsMax}`)
        .join("\n"),
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
    rest_seconds: restMap[e.name] ?? 90,
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
    rest_seconds: restMap[e.name] ?? 90,
    sort_order: i,
    is_one_arm: e.isOneArm ?? false,
  }));
  await supabase.from("workout_session_exercises").insert(sessionExercises);

  redirect(backTo ?? `/session/${session.id}`);
}

/**
 * 日付のアクティブセッション（in_progress / not_started）に種目を追加する。
 * アクティブセッションがなければ新規セッションを作成する。
 */
export async function addExercisesForDate(
  date: string,
  exercises: ManualExercise[],
  backTo?: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: activeSessions } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .in("status", ["not_started", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (activeSessions && activeSessions.length > 0) {
    // アクティブセッションへ追加
    return addExercisesToSession(activeSessions[0].id, exercises, backTo);
  }

  // なければ新規作成
  return addManualSession(date, exercises, backTo);
}

/** 既存セッションに種目を追加する */
export async function addExercisesToSession(
  sessionId: string,
  exercises: ManualExercise[],
  backTo?: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (exercises.length === 0) throw new Error("種目を1つ以上追加してください");

  // 現在の sort_order の最大値を取得
  const { data: existing } = await supabase
    .from("workout_session_exercises")
    .select("sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxSortOrder = existing?.[0]?.sort_order ?? -1;

  // 種目マスターから default_rest_seconds を取得
  const restMap = await getRestSecondsMap(supabase, user.id, exercises.map((e) => e.name));

  // 最新の履歴からセット数・レップ目安を取得して上書き
  const historyMap = await getLatestHistoryForExercises(supabase, user.id, exercises.map((e) => e.name));
  exercises = exercises.map((e) => {
    const hist = historyMap[e.name];
    if (hist && hist.completedSets > 0) {
      return { ...e, sets: hist.completedSets, repsMin: hist.repsMin, repsMax: hist.repsMax };
    }
    return { ...e, sets: 1, repsMin: 0, repsMax: 0 };
  });

  const sessionExercises = exercises.map((e, i) => ({
    user_id: user.id,
    session_id: sessionId,
    exercise_name: e.name,
    planned_sets: e.sets,
    planned_reps_min: e.repsMin,
    planned_reps_max: e.repsMax,
    rest_seconds: restMap[e.name] ?? 90,
    sort_order: maxSortOrder + 1 + i,
    is_one_arm: e.isOneArm ?? false,
  }));

  await supabase.from("workout_session_exercises").insert(sessionExercises);

  // completed セッションに追加した場合は in_progress に戻す（ホームで「再開」ボタンが出るように）
  const { data: session } = await supabase
    .from("workout_sessions")
    .select("status")
    .eq("id", sessionId)
    .single();

  if (session?.status === "completed") {
    await supabase
      .from("workout_sessions")
      .update({ status: "in_progress", completed_at: null })
      .eq("id", sessionId);
  }

  redirect(backTo ?? `/session/${sessionId}`);
}
