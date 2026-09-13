import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { DayActions } from "./DayActions";
import { CATEGORY_COLORS } from "@/lib/muscleCategory";
import { classifyExercise } from "@/lib/muscleCategory";

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

export default async function DayPage({ params }: PageProps) {
  const { date } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .neq("status", "abandoned")
    .order("created_at", { ascending: false });

  const sessionList = sessions ?? [];

  // Fetch exercises for all sessions
  const sessionIds = sessionList.map((s) => s.id);
  const exercisesMap: Record<string, { exercise_name: string; sort_order: number }[]> = {};

  if (sessionIds.length > 0) {
    const { data: exercises } = await supabase
      .from("workout_session_exercises")
      .select("session_id, exercise_name, sort_order")
      .in("session_id", sessionIds)
      .order("sort_order");

    for (const ex of exercises ?? []) {
      if (!exercisesMap[ex.session_id]) exercisesMap[ex.session_id] = [];
      exercisesMap[ex.session_id].push(ex);
    }
  }

  return (
    <div className="py-6 space-y-5">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Link
          href="/home"
          className="text-blue-600 dark:text-blue-400 text-sm font-medium"
        >
          ← ホーム
        </Link>
      </div>

      {/* Date heading */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {formatJapaneseDate(date)}
        </h1>
      </div>

      {/* Sessions */}
      {sessionList.length > 0 && (
        <div className="space-y-4">
          {sessionList.map((session) => {
            const exes = exercisesMap[session.id] ?? [];
            return (
              <Card key={session.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/session/${session.id}`}
                    className="font-semibold text-gray-900 dark:text-gray-100 flex-1"
                  >
                    {session.title}
                  </Link>
                  <SessionStatusBadge status={session.status} />
                </div>
                {exes.length > 0 && (
                  <ul className="space-y-1.5">
                    {exes.map((ex, i) => {
                      const cat = classifyExercise(ex.exercise_name);
                      return (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span
                            style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                            className="w-2 h-2 rounded-full shrink-0"
                          />
                          {ex.exercise_name}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Link
                  href={`/session/${session.id}`}
                  className="block text-xs text-blue-600 dark:text-blue-400 text-right"
                >
                  詳細を見る →
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      {sessionList.length === 0 && (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">
          この日のトレーニング記録はありません
        </div>
      )}

      {/* Actions */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 px-1">
          この日にトレーニングを追加
        </h2>
        <DayActions date={date} />
      </div>
    </div>
  );
}
