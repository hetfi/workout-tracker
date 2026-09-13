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
