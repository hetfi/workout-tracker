import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default async function ExercisesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name, exercise_type, weight_type, target_muscles")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("name");

  const exerciseList = exercises ?? [];

  const typeLabels: Record<string, string> = {
    barbell: "バーベル",
    dumbbell: "ダンベル",
    machine: "マシン",
    cable: "ケーブル",
    bodyweight: "自重",
    other: "その他",
  };

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          種目マスター
        </h1>
      </div>

      {exerciseList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">💪</div>
          <p>メニューを取り込むと種目が自動登録されます</p>
          <Link
            href="/import"
            className="mt-4 inline-block text-blue-600 dark:text-blue-400 text-sm"
          >
            メニューを取り込む →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {exerciseList.map((ex) => (
            <Card key={ex.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {ex.name}
                </p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {typeLabels[ex.exercise_type] ?? ex.exercise_type}
                  </span>
                  {(ex.target_muscles ?? []).slice(0, 2).map((m: string) => (
                    <span
                      key={m}
                      className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Exercise history section */}
      <div className="pt-4">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          種目別の最近の記録
        </h2>
        <div className="space-y-2">
          {exerciseList.slice(0, 5).map((ex) => (
            <Card key={`hist-${ex.id}`} className="py-3">
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {ex.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                履歴は履歴画面から確認できます
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
