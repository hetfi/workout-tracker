import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TodayView } from "./TodayView";
import { TodayNoSessionCard } from "./TodayNoSessionCard";
import { TodayRestDayCard } from "./TodayRestDayCard";
import { getIsRestDay } from "@/app/(app)/day/rest-day-actions";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  const [sessionsResult, isRestDay] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .neq("status", "abandoned")
      .order("created_at", { ascending: true })
      .limit(20),
    getIsRestDay(todayStr),
  ]);

  const sessionList = sessionsResult.data ?? [];

  if (sessionList.length === 0) {
    return (
      <div className="py-6 space-y-5">
        <h1 className="text-2xl font-bold text-white mt-4">今日のメニュー</h1>
        <TodayNoSessionCard date={todayStr} initialIsRest={isRestDay} />
      </div>
    );
  }

  const sessionIds = sessionList.map((s) => s.id);

  // 完了セット数・種目数を並列確認
  const [{ count: setsCount }, { count: exercisesCount }] = await Promise.all([
    supabase
      .from("workout_sets")
      .select("id", { count: "exact", head: true })
      .in("session_id", sessionIds)
      .eq("status", "completed"),
    supabase
      .from("workout_session_exercises")
      .select("id", { count: "exact", head: true })
      .in("session_id", sessionIds),
  ]);
  const hasCompletedSets = (setsCount ?? 0) > 0;
  const hasExercises = (exercisesCount ?? 0) > 0;

  // 種目も完了セットも0件 → 空セッションを破棄してノーセッション状態へ戻す
  if (!hasExercises && !hasCompletedSets) {
    await supabase
      .from("workout_sessions")
      .update({ status: "abandoned" })
      .in("id", sessionIds);

    return (
      <div className="py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white mt-4">今日のメニュー</h1>
        </div>
        {isRestDay ? (
          <TodayRestDayCard date={todayStr} />
        ) : (
          <TodayNoSessionCard date={todayStr} initialIsRest={isRestDay} />
        )}
      </div>
    );
  }

  const firstActiveSession =
    sessionList.find((s) => s.status === "in_progress") ??
    sessionList.find((s) => s.status === "not_started") ??
    sessionList[sessionList.length - 1];

  return (
    <div className="px-4">
      <TodayView
        sessionIds={sessionIds}
        todayStr={todayStr}
        firstActiveSessionId={firstActiveSession.id}
      />
    </div>
  );
}
