"use server";

import { createClient } from "@/lib/supabase/server";
import {
  classifyExercise,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type MuscleCategory,
} from "@/lib/muscleCategory";

export interface HistoryExercise {
  name: string;
  category: MuscleCategory; // exercises master優先、なければ自動分類
  completedSets: number;
  totalVolume: number; // sum of weight × reps
}

export interface HistoryDay {
  date: string;
  title: string; // "胸・背" etc.
  status: "completed" | "in_progress" | "not_started";
  exercises: HistoryExercise[];
}

/**
 * 指定日より前の N 日間を取得し、日単位でまとめて返す。
 * @param endDate 取得範囲の排他的上限日（この日は含まない）
 * @param days    何日分を取得するか
 */
export async function getHistoryDays(
  endDate: string,
  days: number = 14
): Promise<HistoryDay[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 取得範囲
  const endMs = new Date(endDate).getTime();
  const startDate = new Date(endMs - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // 1. セッション取得
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, date, status")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lt("date", endDate)
    .neq("status", "abandoned")
    .order("date", { ascending: false });

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  // 2. 種目取得
  const { data: sessionExercises } = await supabase
    .from("workout_session_exercises")
    .select("id, session_id, exercise_name, sort_order")
    .in("session_id", sessionIds)
    .order("sort_order");

  // 3. 完了セット取得
  const { data: sets } = await supabase
    .from("workout_sets")
    .select("session_exercise_id, weight, reps")
    .in("session_id", sessionIds)
    .eq("status", "completed");

  // 4. exercises master から muscle_category を取得
  const exerciseNames = [...new Set((sessionExercises ?? []).map((e) => e.exercise_name))];
  const { data: masterExercises } = await supabase
    .from("exercises")
    .select("name, muscle_category")
    .eq("user_id", user.id)
    .in("name", exerciseNames);

  const categoryMap: Record<string, MuscleCategory> = {};
  for (const ex of masterExercises ?? []) {
    if (ex.muscle_category) {
      categoryMap[ex.name] = ex.muscle_category as MuscleCategory;
    }
  }
  const getCategory = (name: string): MuscleCategory =>
    categoryMap[name] ?? classifyExercise(name);

  // セット群を exercise_id でグループ化
  const setsByExId: Record<string, { weight: number; reps: number }[]> = {};
  for (const s of sets ?? []) {
    if (!setsByExId[s.session_exercise_id]) setsByExId[s.session_exercise_id] = [];
    setsByExId[s.session_exercise_id].push({
      weight: Number(s.weight),
      reps: Number(s.reps),
    });
  }

  // 種目を session_id でグループ化
  const exercisesBySession: Record<string, typeof sessionExercises> = {};
  for (const ex of sessionExercises ?? []) {
    if (!exercisesBySession[ex.session_id]) exercisesBySession[ex.session_id] = [];
    exercisesBySession[ex.session_id].push(ex);
  }

  // 日単位でセッションをグループ化
  const sessionsByDate: Record<string, typeof sessions> = {};
  for (const s of sessions) {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
    sessionsByDate[s.date].push(s);
  }

  const result: HistoryDay[] = [];

  for (const [date, dateSessions] of Object.entries(sessionsByDate)) {
    // その日の全種目（完了セットがあるものだけ）
    const allExercises: HistoryExercise[] = [];

    for (const session of dateSessions) {
      for (const ex of exercisesBySession[session.id] ?? []) {
        const exSets = setsByExId[ex.id] ?? [];
        if (exSets.length === 0) continue; // 0セットは除外
        allExercises.push({
          name: ex.exercise_name,
          category: getCategory(ex.exercise_name),
          completedSets: exSets.length,
          totalVolume: Math.round(
            exSets.reduce((acc, s) => acc + s.weight * s.reps, 0)
          ),
        });
      }
    }

    // 実施中セッションがあれば表示（completed セットが0でも）
    const hasInProgress = dateSessions.some((s) => s.status === "in_progress");
    if (allExercises.length === 0 && !hasInProgress) continue;

    // ステータス判定
    const status: HistoryDay["status"] = hasInProgress
      ? "in_progress"
      : dateSessions.every((s) => s.status === "completed")
      ? "completed"
      : "not_started";

    // タイトル: 部位分類を順序に従って結合
    const presentCategories = [...new Set(allExercises.map((e) => e.category))];
    const orderedCats = CATEGORY_ORDER.filter((c) => presentCategories.includes(c));
    const title =
      orderedCats.length > 0
        ? orderedCats.map((c) => CATEGORY_LABELS[c]).join("・")
        : dateSessions[0]?.status ?? "トレーニング";

    result.push({ date, title, status, exercises: allExercises });
  }

  // 日付降順でソート
  result.sort((a, b) => b.date.localeCompare(a.date));

  return result;
}
