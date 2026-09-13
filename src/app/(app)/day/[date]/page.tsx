import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  classifyExercise,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type MuscleCategory,
} from "@/lib/muscleCategory";

interface PageProps {
  params: Promise<{ date: string }>;
}

function formatJapaneseDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  const dow = daysOfWeek[date.getDay()];
  return `${y}年${parseInt(m)}月${parseInt(d)}日（${dow}）`;
}

export default async function DayPage({ params }: PageProps) {
  const { date } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. その日のセッション
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, title, status, created_at")
    .eq("user_id", user.id)
    .eq("date", date)
    .neq("status", "abandoned")
    .order("created_at", { ascending: true });

  const sessionList = sessions ?? [];

  // 完了セットがあるセッションIDを把握（0セットのセッションを編集リストから除外するため）
  const allSessionIds = sessionList.map((s) => s.id);
  const sessionsWithSets = new Set<string>();
  if (allSessionIds.length > 0) {
    const { data: setRows } = await supabase
      .from("workout_sets")
      .select("session_id")
      .in("session_id", allSessionIds)
      .eq("status", "completed");
    for (const r of setRows ?? []) sessionsWithSets.add(r.session_id);
  }

  // 編集リストに表示するセッション：完了セットがある or アクティブ
  const editableSessions = sessionList.filter(
    (s) =>
      s.status === "in_progress" ||
      s.status === "not_started" ||
      sessionsWithSets.has(s.id)
  );

  if (sessionList.length === 0) {
    return (
      <div className="py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/home" className="text-[#CAFF4D] text-sm font-medium">
            ← ホーム
          </Link>
        </div>
        <h1 className="text-xl font-bold text-white">{formatJapaneseDate(date)}</h1>
        <div className="text-center py-10 text-[#8E8E93]">
          この日のトレーニング記録はありません
        </div>
      </div>
    );
  }

  const sessionIds = sessionList.map((s) => s.id);

  // 2. セッション種目（全セッション分）
  const { data: sessionExercises } = await supabase
    .from("workout_session_exercises")
    .select("id, session_id, exercise_name, sort_order")
    .in("session_id", sessionIds)
    .order("sort_order");

  // 3. 完了セット（重量・回数含む）
  const { data: completedSets } = await supabase
    .from("workout_sets")
    .select("session_exercise_id, session_id, weight, reps")
    .in("session_id", sessionIds)
    .eq("status", "completed");

  // 4. exercises master でカテゴリ取得
  const allExerciseNames = [
    ...new Set((sessionExercises ?? []).map((e) => e.exercise_name)),
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

  // 5. 種目ごとの完了セット数・総量を集計
  const setsByExId: Record<string, { weight: number; reps: number }[]> = {};
  for (const s of completedSets ?? []) {
    if (!setsByExId[s.session_exercise_id])
      setsByExId[s.session_exercise_id] = [];
    setsByExId[s.session_exercise_id].push({
      weight: Number(s.weight),
      reps: Number(s.reps),
    });
  }

  // 6. 全種目をマージ（0セットは除外）
  interface MergedExercise {
    name: string;
    category: MuscleCategory;
    completedSets: number;
    totalVolume: number;
  }
  const mergedExercises: MergedExercise[] = [];
  const seenNames = new Set<string>();

  for (const ex of sessionExercises ?? []) {
    const exSets = setsByExId[ex.id] ?? [];
    if (exSets.length === 0) continue; // 0セット除外
    if (seenNames.has(ex.exercise_name)) {
      // 同名種目は集計をマージ
      const existing = mergedExercises.find(
        (m) => m.name === ex.exercise_name
      );
      if (existing) {
        existing.completedSets += exSets.length;
        existing.totalVolume += Math.round(
          exSets.reduce((acc, s) => acc + s.weight * s.reps, 0)
        );
      }
    } else {
      seenNames.add(ex.exercise_name);
      mergedExercises.push({
        name: ex.exercise_name,
        category: getCategory(ex.exercise_name),
        completedSets: exSets.length,
        totalVolume: Math.round(
          exSets.reduce((acc, s) => acc + s.weight * s.reps, 0)
        ),
      });
    }
  }

  // 7. タイトル・ステータス算出
  const presentCats = [
    ...new Set(mergedExercises.map((e) => e.category)),
  ];
  const title =
    CATEGORY_ORDER.filter((c) => presentCats.includes(c))
      .map((c) => CATEGORY_LABELS[c])
      .join("・") || "トレーニング";

  const hasInProgress = sessionList.some((s) => s.status === "in_progress");
  const hasNotStarted = sessionList.some((s) => s.status === "not_started");
  const allCompleted = sessionList.every((s) => s.status === "completed");
  const overallStatus = hasInProgress
    ? "in_progress"
    : hasNotStarted
    ? "not_started"
    : allCompleted
    ? "completed"
    : "not_started";

  return (
    <div className="py-6 space-y-5">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/home" className="text-[#CAFF4D] text-sm font-medium">
          ← ホーム
        </Link>
      </div>

      <h1 className="text-xl font-bold text-white">{formatJapaneseDate(date)}</h1>

      {/* 実績サマリ（マージ済み） */}
      {mergedExercises.length > 0 && (
        <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-white">{title}</p>
            {overallStatus === "completed" && (
              <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-[#CAFF4D]/20 text-[#CAFF4D]">
                完了
              </span>
            )}
            {overallStatus === "in_progress" && (
              <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                実施中
              </span>
            )}
          </div>
          <ul className="space-y-1.5">
            {mergedExercises.map((ex, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[ex.category] }}
                />
                <span className="text-white flex-1 truncate">{ex.name}</span>
                <span className="text-[#8E8E93] text-xs shrink-0">
                  {ex.completedSets}セット
                  {ex.totalVolume > 0 &&
                    ` (${ex.totalVolume.toLocaleString()}kg)`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* セッション編集リンク（0セットのものは非表示） */}
      {editableSessions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#8E8E93] px-1">
            セッション（編集）
          </p>
          {editableSessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="flex items-center justify-between rounded-xl bg-[#2C2C2E] border border-white/[0.08] px-4 py-3"
            >
              <span className="text-sm text-white truncate flex-1">{s.title}</span>
              <span className="text-xs text-[#CAFF4D] shrink-0 ml-2">
                編集 →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
