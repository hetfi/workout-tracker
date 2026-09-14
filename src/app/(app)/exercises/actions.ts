"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addNewExercise(
  name: string,
  muscleCategory: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const trimmed = name.trim();
  if (!trimmed) return;

  await supabase.from("exercises").insert({
    user_id: user.id,
    name: trimmed,
    muscle_category: muscleCategory,
    is_one_arm: false,
  });

  revalidatePath("/exercises");
}

/**
 * 種目名を変更する。
 * 過去のセッション記録（exercise_name）は変更しない（コピー保存のため）。
 */
export async function renameExercise(
  exerciseId: string,
  newName: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const trimmed = newName.trim();
  if (!trimmed) return;

  await supabase
    .from("exercises")
    .update({ name: trimmed })
    .eq("id", exerciseId)
    .eq("user_id", user.id);

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${exerciseId}`);
}

/**
 * 種目をソフト削除する（deleted_at を設定）。
 * 過去のセッション記録には影響しない。
 */
export async function deleteExercise(exerciseId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("exercises")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", exerciseId)
    .eq("user_id", user.id);

  revalidatePath("/exercises");
}
