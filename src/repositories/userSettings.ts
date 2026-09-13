import { createClient } from "@/lib/supabase/client";
import type { UserSettings } from "@/domain/types";

function toSettings(row: Record<string, unknown>): UserSettings {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    soundEnabled: Boolean(row.sound_enabled),
    vibrationEnabled: Boolean(row.vibration_enabled),
    browserNotificationEnabled: Boolean(row.browser_notification_enabled),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getUserSettings(): Promise<UserSettings | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return toSettings(data);
}

export async function updateUserSettings(
  updates: Partial<
    Pick<
      UserSettings,
      "soundEnabled" | "vibrationEnabled" | "browserNotificationEnabled"
    >
  >
): Promise<UserSettings> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const dbUpdates: Record<string, unknown> = {};
  if (updates.soundEnabled !== undefined)
    dbUpdates.sound_enabled = updates.soundEnabled;
  if (updates.vibrationEnabled !== undefined)
    dbUpdates.vibration_enabled = updates.vibrationEnabled;
  if (updates.browserNotificationEnabled !== undefined)
    dbUpdates.browser_notification_enabled =
      updates.browserNotificationEnabled;

  const { data, error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, ...dbUpdates }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return toSettings(data);
}
