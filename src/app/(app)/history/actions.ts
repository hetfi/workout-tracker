"use server";

import { createClient } from "@/lib/supabase/server";

export interface HistoryExercise {
  name: string;
  completedSets: number;
  totalVolume: number; // sum of weight × reps
}

export interface HistorySession {
  id: string;
  date: string;
  title: string;
  status: string;
  exercises: HistoryExercise[];
}

/**
 * Fetch sessions for the given date range (exclusive of endDate).
 */
export async function getHistorySessions(
  endDate: string, // exclusive upper bound (fetch before this date)
  days: number = 14
): Promise<HistorySession[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Calculate start date
  const endMs = new Date(endDate).getTime();
  const startDate = new Date(endMs - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // 1. Fetch sessions in range
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, date, title, status")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lt("date", endDate)
    .neq("status", "abandoned")
    .order("date", { ascending: false });

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  // 2. Fetch exercises for those sessions
  const { data: exercises } = await supabase
    .from("workout_session_exercises")
    .select("id, session_id, exercise_name, sort_order")
    .in("session_id", sessionIds)
    .order("sort_order");

  // 3. Fetch completed sets for those sessions
  const { data: sets } = await supabase
    .from("workout_sets")
    .select("session_exercise_id, weight, reps")
    .in("session_id", sessionIds)
    .eq("status", "completed");

  // Group sets by session_exercise_id
  const setsByExId: Record<string, { weight: number; reps: number }[]> = {};
  for (const s of sets ?? []) {
    if (!setsByExId[s.session_exercise_id])
      setsByExId[s.session_exercise_id] = [];
    setsByExId[s.session_exercise_id].push({
      weight: Number(s.weight),
      reps: Number(s.reps),
    });
  }

  // Group exercises by session_id
  const exercisesBySession: Record<
    string,
    { id: string; exercise_name: string }[]
  > = {};
  for (const ex of exercises ?? []) {
    if (!exercisesBySession[ex.session_id])
      exercisesBySession[ex.session_id] = [];
    exercisesBySession[ex.session_id].push(ex);
  }

  return sessions.map((session) => ({
    id: session.id,
    date: session.date,
    title: session.title,
    status: session.status,
    exercises: (exercisesBySession[session.id] ?? []).map((ex) => {
      const exSets = setsByExId[ex.id] ?? [];
      return {
        name: ex.exercise_name,
        completedSets: exSets.length,
        totalVolume: Math.round(
          exSets.reduce((acc, s) => acc + s.weight * s.reps, 0)
        ),
      };
    }),
  }));
}
