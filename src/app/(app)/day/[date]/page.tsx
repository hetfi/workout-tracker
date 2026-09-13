import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { DayActions } from "./DayActions";
import { CATEGORY_COLORS, classifyExercise } from "@/lib/muscleCategory";

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
  if (status === "completed")
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#CAFF4D]/20 text-[#CAFF4D]">
        完了
      </span>
    );
  if (status === "in_progress")
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
        実施中
      </span>
    );
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/[0.08] text-[#8E8E93]">
      未開始
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
          className="text-[#CAFF4D] text-sm font-medium"
        >
          ← ホーム
        </Link>
      </div>

      {/* Date heading */}
      <div>
        <h1 className="text-xl font-bold text-white">
          {formatJapaneseDate(date)}
        </h1>
      </div>

      {/* Sessions */}
      {sessionList.length > 0 && (
        <div className="space-y-4">
          {sessionList.map((session) => {
            const exes = exercisesMap[session.id] ?? [];
            return (
              <div
                key={session.id}
                className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white flex-1 truncate">
                    {session.title}
                  </p>
                  <SessionStatusBadge status={session.status} />
                </div>
                {exes.length > 0 && (
                  <ul className="space-y-1.5">
                    {exes.map((ex, i) => {
                      const cat = classifyExercise(ex.exercise_name);
                      return (
                        <li key={i} className="flex items-center gap-2 text-sm text-white">
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
                  className="block text-xs text-[#CAFF4D] text-right"
                >
                  詳細を見る →
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {sessionList.length === 0 && (
        <div className="text-center py-10 text-[#8E8E93]">
          この日のトレーニング記録はありません
        </div>
      )}

      {/* Actions */}
      <div>
        <h2 className="text-sm font-medium text-[#8E8E93] mb-3 px-1">
          この日にトレーニングを追加
        </h2>
        <DayActions date={date} />
      </div>
    </div>
  );
}
