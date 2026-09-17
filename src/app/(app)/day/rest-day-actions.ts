"use server";

import { createClient } from "@/lib/supabase/server";

export async function getIsRestDay(date: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("rest_days")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function setRestDay(date: string, isRest: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未認証" };

  if (isRest) {
    const { error } = await supabase
      .from("rest_days")
      .upsert({ user_id: user.id, date }, { onConflict: "user_id,date" });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("rest_days").delete().eq("user_id", user.id).eq("date", date);
    if (error) return { error: error.message };
  }
  return {};
}

export async function getRestDaysInRange(startDate: string, endDate: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("rest_days")
    .select("date")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate);
  return (data ?? []).map((r) => r.date as string);
}
