export const revalidate = 60;

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  classifyExercise,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from "@/lib/muscleCategory";

export default async function ExercisesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name, exercise_type, weight_type, target_muscles, muscle_category, is_one_arm")
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
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            種目マスター
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            種目のカテゴリや設定を確認・編集できます
          </p>
        </div>
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
          {exerciseList.map((ex) => {
            const category = ex.muscle_category
              ? (ex.muscle_category as keyof typeof CATEGORY_COLORS)
              : classifyExercise(ex.name);
            return (
              <Link key={ex.id} href={`/exercises/${ex.id}`} className="block">
                <Card className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {ex.name}
                    </p>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: CATEGORY_COLORS[category] }}
                      >
                        {CATEGORY_LABELS[category]}
                      </span>
                      {ex.is_one_arm && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                          片手
                        </span>
                      )}
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
                  <span className="text-gray-400 text-lg ml-2">›</span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
