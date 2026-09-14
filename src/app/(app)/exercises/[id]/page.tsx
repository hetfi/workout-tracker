import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExerciseEditForm } from "./ExerciseEditForm";
import { classifyExercise, CATEGORY_LABELS, type MuscleCategory } from "@/lib/muscleCategory";

export default async function ExerciseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, name, muscle_category, is_one_arm, default_rest_seconds")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!exercise) notFound();

  const autoCategory = classifyExercise(exercise.name);
  const currentCategory = (exercise.muscle_category ?? autoCategory) as MuscleCategory;

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/exercises"
          className="text-blue-600 dark:text-blue-400 text-sm font-medium"
        >
          ← 戻る
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {exercise.name}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          種目の設定を編集
        </p>
      </div>
      <ExerciseEditForm
        exerciseId={id}
        currentCategory={currentCategory}
        isOneArm={exercise.is_one_arm ?? false}
        defaultRestSeconds={exercise.default_rest_seconds ?? 90}
      />
    </div>
  );
}
