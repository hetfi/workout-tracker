import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("date", { ascending: false })
    .limit(50);

  const allSessions = sessions ?? [];

  return (
    <div className="py-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        トレーニング履歴
      </h1>

      {allSessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p>まだトレーニング記録がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allSessions.map((s) => (
            <Link key={s.id} href={`/history/${s.id}`} className="block">
              <Card className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {s.title}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {s.date.replace(/-/g, "/")}
                    </p>
                    {s.started_at && s.completed_at && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {Math.round(
                          (new Date(s.completed_at).getTime() -
                            new Date(s.started_at).getTime()) /
                            60000
                        )}分
                      </p>
                    )}
                    {s.body_condition && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        体調{"★".repeat(s.body_condition)}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-gray-400 dark:text-gray-600">›</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
