import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: session },
    { data: exercises },
    { data: sets },
  ] = await Promise.all([
    supabase.from("workout_sessions").select("*").eq("id", id).single(),
    supabase
      .from("workout_session_exercises")
      .select("*")
      .eq("session_id", id)
      .order("sort_order"),
    supabase
      .from("workout_sets")
      .select("*")
      .eq("session_id", id)
      .order("set_number"),
  ]);

  if (!session) notFound();

  const exerciseList = exercises ?? [];
  const setList = sets ?? [];

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${y}年${parseInt(m)}月${parseInt(day)}日`;
  };

  const duration =
    session.started_at && session.completed_at
      ? Math.round(
          (new Date(session.completed_at).getTime() -
            new Date(session.started_at).getTime()) /
            60000
        )
      : null;

  const volume = setList
    .filter((s) => s.status === "completed")
    .reduce((acc: number, s: { weight: number; reps: number }) => acc + s.weight * s.reps, 0);

  return (
    <div className="py-6 space-y-4">
      <div>
        <Link
          href="/history"
          className="text-sm text-blue-600 dark:text-blue-400 mb-2 block"
        >
          ← 履歴一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {session.title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(session.date)}
        </p>
      </div>

      {/* Summary */}
      <Card>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {setList.filter((s) => s.status === "completed").length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">完了セット</p>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {duration ?? "–"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">分</p>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {Math.round(volume).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">kg (Vol)</p>
          </div>
        </div>

        {(session.body_condition || session.fatigue_level) && (
          <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            {session.body_condition && (
              <div>
                <p className="text-xs text-gray-500">体調</p>
                <p className="text-sm font-medium">
                  {"★".repeat(session.body_condition)}{"☆".repeat(5 - session.body_condition)}
                </p>
              </div>
            )}
            {session.fatigue_level && (
              <div>
                <p className="text-xs text-gray-500">疲労度</p>
                <p className="text-sm font-medium">
                  {"★".repeat(session.fatigue_level)}{"☆".repeat(5 - session.fatigue_level)}
                </p>
              </div>
            )}
          </div>
        )}

        {session.pain && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
            <span className="font-medium">痛み・違和感：</span>{session.pain}
          </p>
        )}
        {session.notes && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            <span className="font-medium">メモ：</span>{session.notes}
          </p>
        )}
      </Card>

      {/* Exercises */}
      <div className="space-y-3">
        {exerciseList.map((ex) => {
          const exSets = setList
            .filter((s) => s.session_exercise_id === ex.id)
            .sort((a, b) => a.set_number - b.set_number);

          return (
            <Card key={ex.id}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {ex.exercise_name}
                </h3>
                {ex.skipped && (
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    スキップ
                  </span>
                )}
              </div>
              {!ex.skipped && (
                <div className="space-y-1">
                  {exSets.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="text-gray-400 w-5 text-right">
                        {s.set_number}
                      </span>
                      <span
                        className={
                          s.status === "completed"
                            ? "text-gray-900 dark:text-gray-100"
                            : "text-gray-400 line-through"
                        }
                      >
                        {s.weight}kg × {s.reps}回
                      </span>
                      {s.status !== "completed" && (
                        <span className="text-xs text-gray-400">
                          ({s.status === "skipped" ? "スキップ" : "未実施"})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {ex.notes && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  ✦ {ex.notes}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
