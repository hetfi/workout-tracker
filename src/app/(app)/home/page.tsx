import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { startTrainingFromPlan, getCalendarData } from "./actions";
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

  const today = new Date();
  const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);
  const yesterday = new Date(jst);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) return 0;

  let streak = 0;
  let checkDate = new Date(uniqueDates[0] + "T00:00:00+09:00");
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
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  const dow = daysOfWeek[date.getDay()];
  return `${y}年${parseInt(m)}月${parseInt(d)}日（${dow}）`;
}

// ---- Data fetching ----

async function getTodayData(userId: string) {
  const supabase = await createClient();
  const today = new Date();
  const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  const [{ data: sessions }, { data: plans }, { data: streakSessions }] =
    await Promise.all([
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("date", todayStr)
        .in("status", ["not_started", "in_progress", "completed"])
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("workout_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("date", todayStr)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1),
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

  // 完了セット数を session ごとにカウント（0件の完了セッションを除外するため）
  const sessionSetCounts: Record<string, number> = {};
  if (sessionIds.length > 0) {
    const { data: setCounts } = await supabase
      .from("workout_sets")
      .select("session_id")
      .in("session_id", sessionIds)
      .eq("status", "completed");
    for (const r of setCounts ?? []) {
      sessionSetCounts[r.session_id] = (sessionSetCounts[r.session_id] ?? 0) + 1;
    }
  }

  // 0セットの完了済みセッションは除外
  const validSessions = sessionList.filter(
    (s) => s.status !== "completed" || (sessionSetCounts[s.id] ?? 0) > 0
  );

  return {
    todayStr,
    sessions: validSessions,
    todayPlan: plans?.[0] ?? null,
    streakSessions: streakSessions ?? [],
    sessionSetCounts,
  };
}

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

  const names = [...new Set((exercises ?? []).map((e) => e.exercise_name))];
  const { data: masterExercises } = names.length > 0
    ? await supabase
        .from("exercises")
        .select("name, muscle_category")
        .eq("user_id", userId)
        .in("name", names)
    : { data: [] };

  const categoryMap: Record<string, MuscleCategory> = {};
  for (const ex of masterExercises ?? []) {
    if (ex.muscle_category) categoryMap[ex.name] = ex.muscle_category as MuscleCategory;
  }

  const setsByExId: Record<string, { weight: number; reps: number }[]> = {};
  for (const s of sets ?? []) {
    if (!setsByExId[s.session_exercise_id]) setsByExId[s.session_exercise_id] = [];
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

// ---- Page ----

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { todayStr, sessions, todayPlan, streakSessions } =
    await getTodayData(user.id);

  const jstYear = parseInt(todayStr.slice(0, 4));
  const jstMonth = parseInt(todayStr.slice(5, 7));
  const calendarData = await getCalendarData(jstYear, jstMonth);

  const activeSession = sessions.find(
    (s) => s.status === "in_progress" || s.status === "not_started"
  );
  const allCompleted =
    sessions.length > 0 && sessions.every((s) => s.status === "completed");

  // 全完了の場合は実績サマリを取得
  let achievement: AchievementExercise[] = [];
  let achievementTitle = "";
  if (allCompleted) {
    achievement = await getTodayAchievement(
      user.id,
      sessions.map((s) => s.id)
    );
    const cats = [...new Set(achievement.map((e) => e.category))];
    achievementTitle =
      CATEGORY_ORDER.filter((c) => cats.includes(c))
        .map((c) => CATEGORY_LABELS[c])
        .join("・") || "今日のトレーニング";
  }

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
        <div className="flex items-center gap-2 bg-[#2C2C2E] border border-white/[0.08] rounded-xl px-4 py-3">
          <div>
            <p className="font-bold text-[#CAFF4D]">{streak}日連続トレーニング中！</p>
            <p className="text-xs text-[#8E8E93]">この調子で続けよう</p>
          </div>
        </div>
      )}

      {/* ====== Primary section ====== */}

      {allCompleted ? (
        /* 全完了 → 実績サマリ */
        <div className="space-y-3">
          <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-white">{achievementTitle}</p>
              <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-[#CAFF4D]/20 text-[#CAFF4D]">
                完了
              </span>
            </div>
            {achievement.length > 0 && (
              <ul className="space-y-1.5">
                {achievement.map((ex, i) => (
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
            )}
          </div>

          {/* 追加ボタン */}
          <Link
            href={`/day/${todayStr}/add`}
            className="block text-center text-sm py-2.5 rounded-xl border border-white/[0.08] text-[#8E8E93] hover:border-white/20 hover:text-white transition-colors"
          >
            ＋ 別のメニューを追加
          </Link>
        </div>
      ) : activeSession?.status === "in_progress" ? (
        /* 実施中 */
        <div className="space-y-2">
          <Link
            href={`/session/${activeSession.id}`}
            className="block rounded-xl bg-[#CAFF4D] text-black text-center py-4 px-6"
          >
            <p className="text-sm opacity-70 mb-1">{activeSession.title}</p>
            <p className="text-xl font-bold">トレーニングを再開 →</p>
          </Link>
          <Link
            href={`/day/${todayStr}/add`}
            className="block text-center text-xs py-2 text-[#8E8E93] hover:text-white transition-colors"
          >
            ＋ 手動でメニューを追加
          </Link>
        </div>
      ) : activeSession?.status === "not_started" ? (
        /* 未開始セッションあり */
        <div className="space-y-2">
          <Link
            href={`/session/${activeSession.id}`}
            className="block rounded-xl bg-[#CAFF4D] text-black text-center py-4 px-6"
          >
            <p className="text-sm opacity-70 mb-1">{activeSession.title}</p>
            <p className="text-xl font-bold">トレーニング開始 →</p>
          </Link>
          <Link
            href={`/day/${todayStr}/add`}
            className="block text-center text-xs py-2 text-[#8E8E93] hover:text-white transition-colors"
          >
            ＋ 手動でメニューを追加
          </Link>
        </div>
      ) : todayPlan ? (
        /* プランあり・未開始 */
        <div className="space-y-2">
          <Card>
            <p className="text-sm text-[#8E8E93] mb-2">今日のメニュー</p>
            <p className="font-semibold text-white">{todayPlan.title}</p>
            <form action={startTrainingFromPlan.bind(null, todayPlan.id)}>
              <button
                type="submit"
                className="block w-full mt-3 rounded-xl bg-[#CAFF4D] text-black text-center py-3 font-semibold"
              >
                トレーニング開始
              </button>
            </form>
          </Card>
          <Link
            href={`/day/${todayStr}/add`}
            className="block text-center text-xs py-2 text-[#8E8E93] hover:text-white transition-colors"
          >
            ＋ 手動でメニューを追加
          </Link>
        </div>
      ) : (
        /* セッションなし・プランなし */
        <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4">
          <p className="text-[#8E8E93] text-sm mb-3">今日のトレーニングは未登録</p>
          <div className="flex gap-2">
            <Link
              href="/import"
              className="flex-1 text-center text-sm py-2.5 rounded-lg bg-white/[0.08] text-white font-medium"
            >
              GPTで取り込む
            </Link>
            <Link
              href={`/day/${todayStr}/add`}
              className="flex-1 text-center text-sm py-2.5 rounded-lg bg-white/[0.08] text-white font-medium"
            >
              手動で追加
            </Link>
          </div>
        </div>
      )}

      {/* 今日のセッション（全完了以外かつ複数存在する場合） */}
      {!allCompleted && sessions.length > 1 && (
        <div>
          <h2 className="text-sm font-medium text-[#8E8E93] mb-2 px-1">
            今日のセッション
          </h2>
          <div className="space-y-2">
            {sessions.map((s) => (
              <Link key={s.id} href={`/session/${s.id}`} className="block">
                <Card className="flex items-center justify-between">
                  <span className="font-medium text-white">{s.title}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.status === "in_progress"
                        ? "bg-[#CAFF4D]/20 text-[#CAFF4D]"
                        : s.status === "completed"
                        ? "bg-[#CAFF4D]/10 text-[#CAFF4D]/70"
                        : "bg-[#3A3A3C] text-[#8E8E93]"
                    }`}
                  >
                    {s.status === "in_progress"
                      ? "実施中"
                      : s.status === "completed"
                      ? "完了"
                      : "未開始"}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
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
