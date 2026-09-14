"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveExerciseMeta(
  exerciseId: string,
  muscleCategory: string,
  isOneArm: boolean,
  defaultRestSeconds: number,
  isDuration: boolean = false
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("exercises")
    .update({
      muscle_category: muscleCategory,
      is_one_arm: isOneArm,
      default_rest_seconds: defaultRestSeconds,
      is_duration: isDuration,
    })
    .eq("id", exerciseId)
    .eq("user_id", user.id);

  if (error) throw error;

  // 種目一覧・手動追加フォームのキャッシュをクリアして即時反映
  revalidatePath("/exercises");
  revalidatePath(`/exercises/${exerciseId}`);
}
