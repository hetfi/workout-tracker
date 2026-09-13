import { createClient } from "@/lib/supabase/client";
import type { RestTimer } from "@/domain/types";
import type { TimerState } from "@/lib/timer";

function toTimer(row: Record<string, unknown>): RestTimer {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    sessionId: row.session_id as string,
    sessionExerciseId: row.session_exercise_id as string,
    triggerSetId: row.trigger_set_id as string,
    nextSetNumber: Number(row.next_set_number),
    durationSeconds: Number(row.duration_seconds),
    startedAt: row.started_at as string,
    endsAt: row.ends_at as string,
    status: row.status as RestTimer["status"],
    adjustmentSeconds: Number(row.adjustment_seconds),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getRunningTimer(
  sessionId: string
): Promise<RestTimer | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rest_timers")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toTimer(data);
}

export async function createTimer(state: TimerState): Promise<RestTimer> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Cancel any existing running timer for this session first
  await supabase
    .from("rest_timers")
    .update({ status: "cancelled" })
    .eq("session_id", state.sessionId)
    .eq("status", "running");

  const { data, error } = await supabase
    .from("rest_timers")
    .insert({
      user_id: user.id,
      session_id: state.sessionId,
      session_exercise_id: state.sessionExerciseId,
      trigger_set_id: state.triggerSetId,
      next_set_number: state.nextSetNumber,
      duration_seconds: state.durationSeconds,
      started_at: state.startedAt,
      ends_at: state.endsAt,
      status: state.status,
      adjustment_seconds: state.adjustmentSeconds,
    })
    .select()
    .single();

  if (error) throw error;
  return toTimer(data);
}

export async function updateTimer(
  id: string,
  updates: Partial<
    Pick<RestTimer, "status" | "endsAt" | "adjustmentSeconds">
  >
): Promise<RestTimer> {
  const supabase = createClient();
  const dbUpdates: Record<string, unknown> = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.endsAt !== undefined) dbUpdates.ends_at = updates.endsAt;
  if (updates.adjustmentSeconds !== undefined)
    dbUpdates.adjustment_seconds = updates.adjustmentSeconds;

  const { data, error } = await supabase
    .from("rest_timers")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toTimer(data);
}

export async function cancelTimersForSession(
  sessionId: string
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("rest_timers")
    .update({ status: "cancelled" })
    .eq("session_id", sessionId)
    .eq("status", "running");
}
