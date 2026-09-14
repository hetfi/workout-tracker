import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { TodayView } from "./TodayView";

export const revalidate = 0;

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  // 今日のセッションを全取得（abandoned 以外）
  // フィルタは最小限に：abandoned でなければ全部対象
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, status, created_at")
    .eq("user_id", user.id)
    .eq("date", todayStr)
    .neq("status", "abandoned")
    .order("created_at", { ascending: true })
    .limit(20);

  const sessionList = sessions ?? [];

  if (sessionList.length === 0) {
    // セッションなし → 作成オプション
    return (
      <div className="py-6 space-y-5 pt-16">
        <div>
          <h1 className="text-2xl font-bold text-white">今日のメニュー</h1>
          <p className="text-xs text-[#8E8E93] mt-1">
            まだトレーニングが登録されていません
          </p>
        </div>
        <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4 space-y-3">
          <p className="text-sm text-[#8E8E93]">
            今日のトレーニングを追加しましょう
          </p>
          <div className="flex gap-2">
            <Link
              href={`/import?date=${todayStr}`}
              className="flex-1 text-center text-sm py-3 rounded-xl bg-white/[0.08] text-white font-medium"
            >
              GPTで取り込む
            </Link>
            <Link
              href={`/day/${todayStr}/add?backTo=/today`}
              className="flex-1 text-center text-sm py-3 rounded-xl bg-white/[0.08] text-white font-medium"
            >
              手動で追加
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // セッションがあれば → TodayView に全セッション ID を渡す
  // completed でも completed でなくても全部渡す（TodayView 内で種目を表示）
  const sessionIds = sessionList.map((s) => s.id);

  // 種目追加リンク用：最優先セッションID
  // in_progress > not_started > 最新 completed
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
