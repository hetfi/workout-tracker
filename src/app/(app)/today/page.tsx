import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const revalidate = 0;

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, status, title")
    .eq("user_id", user.id)
    .eq("date", todayStr)
    .in("status", ["not_started", "in_progress", "completed"])
    .order("created_at", { ascending: true })
    .limit(10);

  // Active session（in_progress → not_started → completed の優先順）
  const activeSession =
    sessions?.find((s) => s.status === "in_progress") ??
    sessions?.find((s) => s.status === "not_started") ??
    sessions?.[0];

  if (activeSession) {
    redirect(`/session/${activeSession.id}`);
  }

  // セッションなし → 作成オプションを表示
  return (
    <div className="py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">今日のメニュー</h1>
        <p className="text-xs text-[#8E8E93] mt-1">まだトレーニングが登録されていません</p>
      </div>

      <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4 space-y-3">
        <p className="text-sm text-[#8E8E93]">今日のトレーニングを追加しましょう</p>
        <div className="flex gap-2">
          <Link
            href="/import"
            className="flex-1 text-center text-sm py-3 rounded-xl bg-white/[0.08] text-white font-medium"
          >
            GPTで取り込む
          </Link>
          <Link
            href={`/day/${todayStr}/add`}
            className="flex-1 text-center text-sm py-3 rounded-xl bg-white/[0.08] text-white font-medium"
          >
            手動で追加
          </Link>
        </div>
      </div>
    </div>
  );
}
