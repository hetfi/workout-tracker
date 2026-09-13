import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { startTrainingFromPlan } from "./actions";

async function getTodayData(userId: string) {
  const supabase = await createClient();
  const today = new Date();
  const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  // Today's session
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .in("status", ["not_started", "in_progress", "completed"])
    .order("created_at", { ascending: false })
    .limit(3);

  // Today's plan
  const { data: plans } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  // Recent sessions
  const { data: recentSessions } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .neq("date", todayStr)
    .order("date", { ascending: false })
    .limit(5);

  return {
    todayStr,
    sessions: sessions ?? [],
    todayPlan: plans?.[0] ?? null,
    recentSessions: recentSessions ?? [],
  };
}

function formatJapaneseDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  const dow = daysOfWeek[date.getDay()];
  return `${y}年${parseInt(m)}月${parseInt(d)}日（${dow}）`;
}

function SessionStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    not_started: {
      label: "未開始",
      className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
    },
    in_progress: {
      label: "実施中",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    },
    completed: {
      label: "完了",
      className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    },
  };
  const config = configs[status] ?? { label: status, className: "" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { todayStr, sessions, todayPlan, recentSessions } = await getTodayData(
    user.id
  );

  const activeSession = sessions.find(
    (s) => s.status === "in_progress" || s.status === "not_started"
  );
  const completedSession = sessions.find((s) => s.status === "completed");

  return (
    <div className="py-6 space-y-5">
      {/* Date header */}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatJapaneseDate(todayStr)}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          今日のトレーニング
        </h1>
      </div>

      {/* Primary CTA */}
      {activeSession?.status === "in_progress" ? (
        <Link
          href={`/session/${activeSession.id}`}
          className="block rounded-2xl bg-blue-600 text-white text-center py-5 px-6 shadow-lg shadow-blue-200 dark:shadow-blue-900/30"
        >
          <p className="text-sm opacity-80 mb-1">{activeSession.title}</p>
          <p className="text-xl font-bold">トレーニングを再開 →</p>
        </Link>
      ) : activeSession?.status === "not_started" ? (
        <Link
          href={`/session/${activeSession.id}`}
          className="block rounded-2xl bg-blue-600 text-white text-center py-5 px-6 shadow-lg shadow-blue-200 dark:shadow-blue-900/30"
        >
          <p className="text-sm opacity-80 mb-1">{activeSession.title}</p>
          <p className="text-xl font-bold">トレーニング開始 →</p>
        </Link>
      ) : !todayPlan ? (
        <Link
          href="/import"
          className="block rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-center py-8 px-6"
        >
          <div className="text-3xl mb-2">📋</div>
          <p className="text-lg font-semibold">メニューを取り込む</p>
          <p className="text-sm opacity-70 mt-1">
            ChatGPTのメニューを貼り付けて登録
          </p>
        </Link>
      ) : (
        <Card>
          <p className="text-sm text-gray-500 mb-2">今日のメニュー</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {todayPlan.title}
          </p>
          {completedSession ? (
            <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full">
              完了済み
            </span>
          ) : (
            <form action={startTrainingFromPlan.bind(null, todayPlan.id)}>
              <button
                type="submit"
                className="block w-full mt-3 rounded-xl bg-blue-600 text-white text-center py-3 font-semibold"
              >
                トレーニング開始
              </button>
            </form>
          )}
        </Card>
      )}

      {/* Import button (secondary) */}
      {(activeSession || todayPlan) && (
        <Link
          href="/import"
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 px-1"
        >
          <span>＋</span>
          <span>メニューを取り込む</span>
        </Link>
      )}

      {/* Today's sessions */}
      {sessions.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
            今日のセッション
          </h2>
          <div className="space-y-2">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/session/${s.id}`}
                className="block"
              >
                <Card className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {s.title}
                  </span>
                  <SessionStatusBadge status={s.status} />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent history */}
      {recentSessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              直近のトレーニング
            </h2>
            <Link
              href="/history"
              className="text-xs text-blue-600 dark:text-blue-400"
            >
              すべて見る
            </Link>
          </div>
          <div className="space-y-2">
            {recentSessions.map((s) => (
              <Link key={s.id} href={`/history/${s.id}`} className="block">
                <Card className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {s.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {s.date.replace(/-/g, "/")}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">›</span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/history" className="block">
          <Card className="text-center py-4">
            <div className="text-2xl mb-1">📊</div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              トレーニング履歴
            </p>
          </Card>
        </Link>
        <Link href="/exercises" className="block">
          <Card className="text-center py-4">
            <div className="text-2xl mb-1">💪</div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              種目履歴
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
