import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getCalendarData } from "./actions";
import { WorkoutCalendar } from "@/components/calendar/WorkoutCalendar";
import {
  classifyExercise,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type MuscleCategory,
} from "@/lib/muscleCategory";

// ---- Types ----

interface AchievementExercise {
  name: string;
  category: MuscleCategory;
  completedSets: number;
  totalVolume: number;
}

// ---- Helpers ----

function calcStreak(sessions: { date: string; status: string }[]): number {
  const completed = sessions
    .filter((s) => s.status === "completed")
    .map((s) => s.date)
    .sort((a, b) => b.localeCompare(a));

  if (completed.length === 0) return 0;
  const uniqueDates = [...new Set(completed)];

  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);
  const yesterday = new Date(jst);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) return 0;

  let streak = 0;
  const checkDate = new Date(uniqueDates[0] + "T00:00:00+09:00");
  for (const date of uniqueDates) {
    if (date === checkDate.toISOString().slice(0, 10)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }
  return streak;
}

function formatJapaneseDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];
  // T12:00:00+09:00 = 03:00 UTC — サーバー(UTC)でも同一暦日になる
  const date = new Date(`${dateStr}T12:00:00+09:00`);
  const dow = daysOfWeek[date.getDay()];
  return `${y}年${parseInt(m)}月${parseInt(d)}日（${dow}）`;
}

// ---- Data fetching ----

async function getTodayData(userId: string) {
  const supabase = await createClient();
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  const [{ data: sessions }, { data: streakSessions }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, title, status, date")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .in("status", ["not_started", "in_progress", "completed"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("workout_sessions")
      .select("date, status")
      .eq("user_id", userId)
      .gte(
        "date",
        new Date(jst.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      )
      .order("date", { ascending: false })
      .limit(30),
  ]);

  const sessionList = sessions ?? [];
  const sessionIds = sessionList.map((s) => s.id);

  // 完了セット数をセッションごとにカウント
  const sessionSetCounts: Record<string, number> = {};
  if (sessionIds.length > 0) {
    const { data: setCounts } = await supabase
      .from("workout_sets")
      .select("session_id")
      .in("session_id", sessionIds)
      .eq("status", "completed");
    for (const r of setCounts ?? []) {
      sessionSetCounts[r.session_id] =
        (sessionSetCounts[r.session_id] ?? 0) + 1;
    }
  }

  // 0セットの completed セッションは除外
  const validSessions = sessionList.filter(
    (s) =>
      s.status !== "completed" || (sessionSetCounts[s.id] ?? 0) > 0
  );

  // アクティブセッションに種目が1件でもあるか確認
  const activeSessionIds = validSessions
    .filter((s) => s.status === "not_started" || s.status === "in_progress")
    .map((s) => s.id);
  let hasExercises = false;
  if (activeSessionIds.length > 0) {
    const { count } = await supabase
      .from("workout_session_exercises")
      .select("id", { count: "exact", head: true })
      .in("session_id", activeSessionIds);
    hasExercises = (count ?? 0) > 0;
  }

  return {
    todayStr,
    sessions: validSessions,
    streakSessions: streakSessions ?? [],
    firstActiveSessionId: activeSessionIds[0] ?? null,
    hasExercises,
  };
}

/** 今日の完了済み種目を取得（completed set がある種目のみ） */
async function getTodayAchievement(
  userId: string,
  sessionIds: string[]
): Promise<AchievementExercise[]> {
  if (sessionIds.length === 0) return [];
  const supabase = await createClient();

  const [{ data: exercises }, { data: sets }] = await Promise.all([
    supabase
      .from("workout_session_exercises")
      .select("id, session_id, exercise_name, sort_order")
      .in("session_id", sessionIds)
      .order("sort_order"),
    supabase
      .from("workout_sets")
      .select("session_exercise_id, weight, reps")
      .in("session_id", sessionIds)
      .eq("status", "completed"),
  ]);

  const names = [
    ...new Set((exercises ?? []).map((e) => e.exercise_name)),
  ];
  const { data: masterExercises } =
    names.length > 0
      ? await supabase
          .from("exercises")
          .select("name, muscle_category")
          .eq("user_id", userId)
          .in("name", names)
      : { data: [] };

  const categoryMap: Record<string, MuscleCategory> = {};
  for (const ex of masterExercises ?? []) {
    if (ex.muscle_category)
      categoryMap[ex.name] = ex.muscle_category as MuscleCategory;
  }

  const setsByExId: Record<
    string,
    { weight: number; reps: number }[]
  > = {};
  for (const s of sets ?? []) {
    if (!setsByExId[s.session_exercise_id])
      setsByExId[s.session_exercise_id] = [];
    setsByExId[s.session_exercise_id].push({
      weight: Number(s.weight),
      reps: Number(s.reps),
    });
  }

  return (exercises ?? [])
    .map((ex) => {
      const exSets = setsByExId[ex.id] ?? [];
      if (exSets.length === 0) return null;
      return {
        name: ex.exercise_name,
        category: (categoryMap[ex.exercise_name] ??
          classifyExercise(ex.exercise_name)) as MuscleCategory,
        completedSets: exSets.length,
        totalVolume: Math.round(
          exSets.reduce((acc, s) => acc + s.weight * s.reps, 0)
        ),
      };
    })
    .filter(Boolean) as AchievementExercise[];
}

// ---- Sub-components ----

function AchievementList({ exercises }: { exercises: AchievementExercise[] }) {
  if (exercises.length === 0) return null;
  return (
    <ul className="space-y-1.5 mt-3">
      {exercises.map((ex, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: CATEGORY_COLORS[ex.category] }}
          />
          <span className="text-white flex-1 truncate">{ex.name}</span>
          <span className="text-[#8E8E93] text-xs shrink-0">
            {ex.completedSets}セット
            {ex.totalVolume > 0 && ` (${ex.totalVolume.toLocaleString()}kg)`}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---- Page ----

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { todayStr, sessions, streakSessions, firstActiveSessionId, hasExercises } =
    await getTodayData(user.id);

  const jstYear = parseInt(todayStr.slice(0, 4));
  const jstMonth = parseInt(todayStr.slice(5, 7));
  const calendarData = await getCalendarData(jstYear, jstMonth);

  const hasAnySessions = sessions.length > 0;
  const hasActiveSessions = sessions.some(
    (s) => s.status === "in_progress" || s.status === "not_started"
  );
  const allComplete = hasAnySessions && !hasActiveSessions;
  // セッションがあっても種目が0件の場合は「追加」UIを出す
  const showAddUI = !hasAnySessions || (hasActiveSessions && !hasExercises);

  // 実績データ（セッションがある場合は常に取得）
  const achievement = hasAnySessions
    ? await getTodayAchievement(
        user.id,
        sessions.map((s) => s.id)
      )
    : [];

  // 実績タイトル（完了時のみ使う）
  const achievementTitle = (() => {
    const cats = [...new Set(achievement.map((e) => e.category))];
    return (
      CATEGORY_ORDER.filter((c) => cats.includes(c))
        .map((c) => CATEGORY_LABELS[c])
        .join("・") || "今日のトレーニング"
    );
  })();

  const streak = calcStreak(streakSessions);

  return (
    <div className="py-6 space-y-5">
      {/* Date header */}
      <div>
        <p className="text-xs text-[#8E8E93]">{formatJapaneseDate(todayStr)}</p>
        <h1 className="text-2xl font-bold text-white">今日のトレーニング</h1>
      </div>

      {/* Streak */}
      {streak > 1 && (
        <div className="bg-[#2C2C2E] border border-white/[0.08] rounded-xl px-4 py-3">
          <p className="font-bold text-[#CAFF4D]">{streak}日連続トレーニング中！</p>
          <p className="text-xs text-[#8E8E93]">この調子で続けよう</p>
        </div>
      )}

      {/* ====== Main section ====== */}

      {showAddUI ? (
        /* セッションなし or 種目0件 → 作成オプション */
        <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4 space-y-3">
          <p className="text-sm text-[#8E8E93]">
            {hasAnySessions ? "種目を追加してトレーニングを始めましょう" : "今日のトレーニングは未登録です"}
          </p>
          <Link
            href={`/import?date=${todayStr}`}
            className="block text-center text-sm py-3 rounded-xl font-semibold"
            style={{ backgroundColor: "#CAFF4D", color: "#0D0D0F" }}
          >
            ChatGPTから取り込む
          </Link>
          <Link
            href={
              firstActiveSessionId
                ? `/day/${todayStr}/add?sessionId=${firstActiveSessionId}&backTo=/today`
                : `/day/${todayStr}/add`
            }
            className="block text-center text-sm py-3 rounded-xl font-medium"
            style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF" }}
          >
            ＋ 種目を追加
          </Link>
        </div>
      ) : allComplete ? (
        /* 全完了 → お疲れ様 + 今日の実績 */
        <div className="space-y-3">
          <div className="rounded-xl bg-[#2C2C2E] border border-[#CAFF4D]/20 p-4">
            <p className="font-bold text-[#CAFF4D] text-lg">お疲れ様でした！🎉</p>
            <p className="text-xs text-[#8E8E93] mt-0.5">
              今日のトレーニングはすべて完了しました
            </p>
          </div>

          <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#8E8E93]">今日の実績</p>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#CAFF4D]/20 text-[#CAFF4D]">
                {achievementTitle}
              </span>
            </div>
            <AchievementList exercises={achievement} />
          </div>
        </div>
      ) : (
        /* 進行中 → 再開ボタン + 完了済み種目 */
        <div className="space-y-3">
          <Link
            href="/today"
            className="block rounded-xl bg-[#CAFF4D] text-black text-center py-4 px-6"
          >
            <p className="text-xl font-bold">トレーニングを再開 →</p>
          </Link>

          {achievement.length > 0 && (
            <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4">
              <p className="text-sm font-medium text-[#8E8E93] mb-0.5">今日の実績</p>
              <AchievementList exercises={achievement} />
            </div>
          )}
        </div>
      )}

      {/* Calendar */}
      <div>
        <h2 className="text-sm font-medium text-[#8E8E93] mb-3 px-1">
          トレーニング記録
        </h2>
        <WorkoutCalendar
          initialYear={jstYear}
          initialMonth={jstMonth}
          initialData={calendarData}
        />
      </div>
    </div>
  );
}
