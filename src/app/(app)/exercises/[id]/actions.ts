"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveExerciseMeta(
  exerciseId: string,
  muscleCategory: string,
  isOneArm: boolean
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
    })
    .eq("id", exerciseId)
    .eq("user_id", user.id);

  if (error) throw error;
}
