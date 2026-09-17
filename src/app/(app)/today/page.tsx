import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TodayView } from "./TodayView";
import { TodayNoSessionCard } from "./TodayNoSessionCard";
import { TodayRestDayCard } from "./TodayRestDayCard";
import { TodayRestDayRow } from "./TodayRestDayRow";
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
      <div className="py-6 space-y-5 pt-16">
        <div>
          <h1 className="text-2xl font-bold text-white">今日のメニュー</h1>
          <p className="text-xs text-[#8E8E93] mt-1">
            まだトレーニングが登録されていません
          </p>
        </div>
        <TodayNoSessionCard date={todayStr} initialIsRest={isRestDay} />
      </div>
    );
  }

  const sessionIds = sessionList.map((s) => s.id);

  // 完了セットが1件以上あるか確認
  const { count: setsCount } = await supabase
    .from("workout_sets")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds)
    .eq("status", "completed");
  const hasCompletedSets = (setsCount ?? 0) > 0;

  // セッションあり・完了セット0・休息日ON → 休息日カード
  if (isRestDay && !hasCompletedSets) {
    return (
      <div className="py-6 space-y-5 pt-16">
        <div>
          <h1 className="text-2xl font-bold text-white">今日のメニュー</h1>
        </div>
        <TodayRestDayCard date={todayStr} />
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
      {/* セット0件のみ休息日トグルを表示 */}
      {!hasCompletedSets && (
        <div
          className="mt-4 rounded-xl px-4"
          style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <TodayRestDayRow date={todayStr} />
        </div>
      )}
    </div>
  );
}
