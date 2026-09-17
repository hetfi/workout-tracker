export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getCalendarDataRange } from "./actions";
import { getRestDaysInRange } from "@/app/(app)/day/rest-day-actions";
import { WorkoutCalendar } from "@/components/calendar/WorkoutCalendar";
import { TodayNoSessionCard } from "@/app/(app)/today/TodayNoSessionCard";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  classifyExercise,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type MuscleCategory,
} from "@/lib/muscleCategory";

// ---- Types ----

interface AchievementSet {
  setNumber: number;
  weight: number;
  reps: number;
  side: string | null;
}

interface AchievementExercise {
  name: string;
  category: MuscleCategory;
  completedSets: number;
  totalVolume: number;
  sets: AchievementSet[];
  isDuration: boolean;
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

  // セット数カウント + アクティブセッションIDを事前に取得して並列クエリ
  const activeSessionIdsCandidates = sessionList
    .filter((s) => s.status === "not_started" || s.status === "in_progress")
    .map((s) => s.id);

  const [setCountResult, exerciseCountResult] = await Promise.all([
    sessionIds.length > 0
      ? supabase
          .from("workout_sets")
          .select("session_id")
          .in("session_id", sessionIds)
          .eq("status", "completed")
      : Promise.resolve({ data: [] as { session_id: string }[] }),
    activeSessionIdsCandidates.length > 0
      ? supabase
          .from("workout_session_exercises")
          .select("id", { count: "exact", head: true })
          .in("session_id", activeSessionIdsCandidates)
      : Promise.resolve({ count: 0 }),
  ]);

  const sessionSetCounts: Record<string, number> = {};
  for (const r of (setCountResult.data ?? []) as { session_id: string }[]) {
    sessionSetCounts[r.session_id] = (sessionSetCounts[r.session_id] ?? 0) + 1;
  }

  // 0セットの completed セッションは除外
  const validSessions = sessionList.filter(
    (s) =>
      s.status !== "completed" || (sessionSetCounts[s.id] ?? 0) > 0
  );

  const activeSessionIds = validSessions
    .filter((s) => s.status === "not_started" || s.status === "in_progress")
    .map((s) => s.id);
  const hasExercises = ((exerciseCountResult as { count: number | null }).count ?? 0) > 0;

  return {
    todayStr,
    sessions: validSessions,
    streakSessions: streakSessions ?? [],
    firstActiveSessionId: activeSessionIds[0] ?? null,
    activeSessionIds,
    hasExercises,
  };
}

/** 今日の実績 + 未完了カテゴリを1回のDB往復セットで取得 */
async function getTodayStats(
  userId: string,
  sessionIds: string[],
  activeSessionIds: string[]
): Promise<{ achievement: AchievementExercise[]; incompleteCategories: MuscleCategory[] }> {
  if (sessionIds.length === 0) return { achievement: [], incompleteCategories: [] };
  const supabase = await createClient();

  const [{ data: exercises }, { data: sets }] = await Promise.all([
    supabase
      .from("workout_session_exercises")
      .select("id, session_id, exercise_name, planned_sets, sort_order")
      .in("session_id", sessionIds)
      .order("sort_order"),
    supabase
      .from("workout_sets")
      .select("session_exercise_id, set_number, weight, reps, side")
      .in("session_id", sessionIds)
      .eq("status", "completed")
      .order("set_number"),
  ]);

  const names = [...new Set((exercises ?? []).map((e) => e.exercise_name))];
  const { data: masterExercises } =
    names.length > 0
      ? await supabase
          .from("exercises")
          .select("name, muscle_category, is_duration")
          .eq("user_id", userId)
          .in("name", names)
      : { data: [] };

  const categoryMap: Record<string, MuscleCategory> = {};
  const durationMap: Record<string, boolean> = {};
  for (const ex of masterExercises ?? []) {
    if (ex.muscle_category) categoryMap[ex.name] = ex.muscle_category as MuscleCategory;
    durationMap[ex.name] = Boolean(ex.is_duration);
  }

  const setsByExId: Record<string, AchievementSet[]> = {};
  const completedCountByExId: Record<string, number> = {};
  for (const s of sets ?? []) {
    if (!setsByExId[s.session_exercise_id]) setsByExId[s.session_exercise_id] = [];
    setsByExId[s.session_exercise_id].push({
      setNumber: Number(s.set_number),
      weight: Number(s.weight),
      reps: Number(s.reps),
      side: (s.side as string | null) ?? null,
    });
    completedCountByExId[s.session_exercise_id] = (completedCountByExId[s.session_exercise_id] ?? 0) + 1;
  }

  // 実績：完了セットがある種目のみ
  const achievement = (exercises ?? [])
    .map((ex) => {
      const exSets = setsByExId[ex.id] ?? [];
      if (exSets.length === 0) return null;
      return {
        name: ex.exercise_name,
        category: (categoryMap[ex.exercise_name] ?? classifyExercise(ex.exercise_name)) as MuscleCategory,
        completedSets: exSets.length,
        totalVolume: Math.round(exSets.reduce((acc, s) => acc + s.weight * s.reps, 0)),
        sets: exSets,
        isDuration: durationMap[ex.exercise_name] ?? false,
      };
    })
    .filter(Boolean) as AchievementExercise[];

  // 未完了カテゴリ：アクティブセッションのみ対象、planned > completed の種目
  const activeSet = new Set(activeSessionIds);
  const incompleteCats = new Set<MuscleCategory>();
  for (const ex of exercises ?? []) {
    if (!activeSet.has(ex.session_id)) continue;
    if ((completedCountByExId[ex.id] ?? 0) < Number(ex.planned_sets)) {
      incompleteCats.add((categoryMap[ex.exercise_name] ?? classifyExercise(ex.exercise_name)) as MuscleCategory);
    }
  }
  const incompleteCategories = CATEGORY_ORDER.filter((c) => incompleteCats.has(c));

  return { achievement, incompleteCategories };
}

// ---- Sub-components ----

function AchievementList({ exercises }: { exercises: AchievementExercise[] }) {
  if (exercises.length === 0) return null;

  // カテゴリ別にグループ化
  const byCategory: Record<string, AchievementExercise[]> = {};
  for (const ex of exercises) {
    if (!byCategory[ex.category]) byCategory[ex.category] = [];
    byCategory[ex.category].push(ex);
  }
  const cats = CATEGORY_ORDER.filter((c) => byCategory[c]?.length > 0);

  return (
    <div className="space-y-3 mt-3">
      {cats.map((cat) => {
        const exList = byCategory[cat];
        const catSets = exList.reduce((acc, ex) => acc + ex.completedSets, 0);
        const catVol = exList.reduce((acc, ex) => acc + ex.totalVolume, 0);
        return (
          <div key={cat}>
            {/* カテゴリヘッダー */}
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              />
              <span className="text-xs font-semibold" style={{ color: CATEGORY_COLORS[cat] }}>
                {CATEGORY_LABELS[cat]}
              </span>
              <span className="text-xs text-[#8E8E93]">
                {catSets}セット{catVol > 0 ? ` / ${catVol.toLocaleString()}kg` : ""}
              </span>
            </div>
            {/* 種目リスト */}
            <ul className="space-y-1 pl-4">
              {exList.map((ex, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-white flex-1 truncate">{ex.name}</span>
                  <span className="text-[#8E8E93] text-xs shrink-0">
                    {ex.completedSets}セット
                    {ex.totalVolume > 0 && ` / ${ex.totalVolume.toLocaleString()}kg`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ---- Page ----

function getJSTYearMonth(): { year: number; month: number } {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return { year: parseInt(jst.toISOString().slice(0, 4)), month: parseInt(jst.toISOString().slice(5, 7)) };
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 日付は独立して計算できるので getTodayData と getCalendarData を並列実行
  const { year: jstYear, month: jstMonth } = getJSTYearMonth();

  // カレンダー範囲の日付を計算（3ヶ月分）
  const calStartDate = new Date(jstYear, jstMonth - 3, 1);
  const calStartStr = `${calStartDate.getFullYear()}-${String(calStartDate.getMonth() + 1).padStart(2, "0")}-01`;
  const calLastDay = new Date(jstYear, jstMonth, 0).getDate();
  const calEndStr = `${jstYear}-${String(jstMonth).padStart(2, "0")}-${String(calLastDay).padStart(2, "0")}`;

  const [{ todayStr, sessions, streakSessions, firstActiveSessionId, activeSessionIds, hasExercises }, calendarData, restDaysList] =
    await Promise.all([
      getTodayData(user.id),
      getCalendarDataRange(jstYear, jstMonth, 3),
      getRestDaysInRange(calStartStr, calEndStr),
    ]);

  const isRestDay = restDaysList.includes(todayStr);
  const hasAnySessions = sessions.length > 0;
  const hasActiveSessions = sessions.some(
    (s) => s.status === "in_progress" || s.status === "not_started"
  );
  const allComplete = hasAnySessions && !hasActiveSessions;
  // セッションがあっても種目が0件の場合は「追加」UIを出す
  const showAddUI = !hasAnySessions || (hasActiveSessions && !hasExercises);

  // 実績 + 未完了カテゴリを1回のDB往復セットで取得
  const { achievement, incompleteCategories } = hasAnySessions
    ? await getTodayStats(user.id, sessions.map((s) => s.id), activeSessionIds)
    : { achievement: [], incompleteCategories: [] };

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

  // 種目0件のアクティブセッションを破棄（今日のメニューと同様）
  if (showAddUI && hasAnySessions && activeSessionIds.length > 0) {
    await supabase
      .from("workout_sessions")
      .update({ status: "abandoned" })
      .in("id", activeSessionIds);
  }

  return (
    <div className="py-6 space-y-5">
      {/* Date header */}
      <div>
        <p className="text-xs text-[#8E8E93]">{formatJapaneseDate(todayStr)}</p>
        <h1 className="text-xl font-bold text-white">今日のトレーニング</h1>
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
        /* セッションなし or 種目0件 → 休息日トグル付きカード */
        <TodayNoSessionCard date={todayStr} initialIsRest={isRestDay} backTo="/home" />
      ) : allComplete ? (
        /* 全完了 → お疲れ様 + 今日の実績 */
        (() => {
          const achievementByCategory: Record<string, AchievementExercise[]> = {};
          for (const ex of achievement) {
            if (!achievementByCategory[ex.category]) achievementByCategory[ex.category] = [];
            achievementByCategory[ex.category].push(ex);
          }
          const achievementCats = CATEGORY_ORDER.filter((c) => achievementByCategory[c]?.length > 0);
          const copyText = [
            `📋 トレーニング記録｜${formatJapaneseDate(todayStr)}`,
            achievementTitle,
            "",
            ...achievementCats.flatMap((cat) => [
              `【${CATEGORY_LABELS[cat]}】`,
              ...achievementByCategory[cat].flatMap((ex) => [
                `・${ex.name}: ${ex.completedSets}セット${
                  ex.totalVolume > 0 ? ` / ${ex.totalVolume.toLocaleString()}kg` : ""
                }`,
                ...ex.sets.map((s) => {
                  const sideLabel = s.side ? `(${s.side}) ` : "";
                  const valueStr = ex.isDuration && s.weight === 0 && s.reps > 0
                    ? `${s.reps}分`
                    : `${s.weight}kg × ${s.reps}回`;
                  return `  ${s.setNumber}${sideLabel}: ${valueStr}`;
                }),
              ]),
            ]),
          ].join("\n");
          return (
            <div className="space-y-3">
              <div className="rounded-xl bg-[#2C2C2E] border border-[#CAFF4D]/20 p-4">
                <p className="font-bold text-[#CAFF4D] text-lg">お疲れ様でした！🎉</p>
                <p className="text-xs text-[#8E8E93] mt-0.5">
                  今日のトレーニングはすべて完了しました
                </p>
              </div>

              <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-medium text-[#8E8E93]">今日の実績</p>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#CAFF4D]/20 text-[#CAFF4D]">
                    {achievementTitle}
                  </span>
                </div>
                <AchievementList exercises={achievement} />
                {achievement.length > 0 && (
                  <div className="mt-3">
                    <CopyButton
                      text={copyText}
                      label="実績をChatGPTにコピー"
                      className="w-full py-2.5 rounded-xl text-xs font-medium transition-colors"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })()
      ) : (
        /* 進行中 → 再開ボタン + 完了済み種目 */
        <div className="space-y-3">
          {/* 未完了部位の案内 */}
          {incompleteCategories.length > 0 && (
            <p className="text-xs text-center" style={{ color: "#8E8E93" }}>
              まだ{incompleteCategories.map((c) => CATEGORY_LABELS[c]).join("・")}が未完了です
            </p>
          )}
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
        <h2 className="text-xl font-bold text-white mb-3">
          トレーニング記録
        </h2>
        <WorkoutCalendar
          initialYear={jstYear}
          initialMonth={jstMonth}
          initialData={calendarData}
          restDays={restDaysList}
          oldestYear={new Date(jstYear, jstMonth - 3, 1).getFullYear()}
          oldestMonth={new Date(jstYear, jstMonth - 3, 1).getMonth() + 1}
        />
      </div>
    </div>
  );
}
