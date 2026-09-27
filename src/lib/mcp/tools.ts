/**
 * MCP tool definitions and handlers.
 * Phase 1: read-only access. No writes to DB via MCP.
 * All queries explicitly filter by userId resolved from the access token.
 */
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { McpTool, McpToolResult } from "./types";

// ---- Tool definitions ----

export const TOOLS: McpTool[] = [
  {
    name: "list_recent_sessions",
    description:
      "最近のトレーニングセッション一覧を取得します。日付・タイトル・総セット数・運動時間を返します。",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "取得件数（デフォルト5、最大20）",
        },
      },
    },
  },
  {
    name: "get_session_detail",
    description:
      "指定したセッションの詳細（種目・セット・重量・回数）を取得します。",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "セッションID（list_recent_sessionsで取得できるID）",
        },
      },
      required: ["session_id"],
    },
  },
  {
    name: "get_exercise_history",
    description:
      "指定した種目の過去のセッション記録（重量・回数）を取得します。",
    inputSchema: {
      type: "object",
      properties: {
        exercise_name: {
          type: "string",
          description: "種目名（例: ベンチプレス）",
        },
        limit: {
          type: "number",
          description: "取得セッション数（デフォルト5、最大20）",
        },
      },
      required: ["exercise_name"],
    },
  },
];

// ---- Formatters ----

function formatJpDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "不明";
  const minutes = Math.round(
    (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000
  );
  return `${minutes}分`;
}

// ---- Tool handlers ----

async function listRecentSessions(
  userId: string,
  args: Record<string, unknown>
): Promise<McpToolResult> {
  const limit = Math.min(Number(args.limit ?? 5), 20);
  const supabase = createServiceRoleClient();

  const { data: sessions, error } = await supabase
    .from("workout_sessions")
    .select("id, date, title, status, started_at, completed_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("date", { ascending: false })
    .limit(limit);

  if (error) return { content: [{ type: "text", text: "データ取得に失敗しました" }], isError: true };
  if (!sessions || sessions.length === 0) {
    return { content: [{ type: "text", text: "完了済みのセッションがまだありません" }] };
  }

  const sessionIds = sessions.map((s) => s.id);
  const { data: sets } = await supabase
    .from("workout_sets")
    .select("session_id")
    .in("session_id", sessionIds)
    .eq("status", "completed");

  const setCountBySession: Record<string, number> = {};
  for (const s of sets ?? []) {
    setCountBySession[s.session_id] = (setCountBySession[s.session_id] ?? 0) + 1;
  }

  const lines = [`直近${sessions.length}件のトレーニング記録:\n`];
  sessions.forEach((s, i) => {
    const dur = formatDuration(s.started_at, s.completed_at);
    const cnt = setCountBySession[s.id] ?? 0;
    lines.push(`${i + 1}. ${formatJpDate(s.date)} 「${s.title}」 ${cnt}セット ${dur}`);
    lines.push(`   ID: ${s.id}`);
  });

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function getSessionDetail(
  userId: string,
  args: Record<string, unknown>
): Promise<McpToolResult> {
  const sessionId = String(args.session_id ?? "");
  if (!sessionId) {
    return { content: [{ type: "text", text: "session_idを指定してください" }], isError: true };
  }

  const supabase = createServiceRoleClient();

  // Verify ownership by filtering on user_id — never trust session_id alone
  const { data: session, error: sessErr } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (sessErr || !session) {
    return { content: [{ type: "text", text: "セッションが見つかりません" }], isError: true };
  }

  const [{ data: exercises }, { data: sets }] = await Promise.all([
    supabase
      .from("workout_session_exercises")
      .select("id, exercise_name, planned_sets, skipped, is_duration, sort_order")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("sort_order"),
    supabase
      .from("workout_sets")
      .select("session_exercise_id, set_number, weight, reps, status, side, is_duration")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("set_number"),
  ]);

  const setsByEx: Record<string, typeof sets> = {};
  for (const s of sets ?? []) {
    if (!setsByEx[s.session_exercise_id]) setsByEx[s.session_exercise_id] = [];
    setsByEx[s.session_exercise_id]!.push(s);
  }

  const lines: string[] = [
    `[トレーニング記録] ${formatJpDate(session.date)} 「${session.title}」`,
    `運動時間: ${formatDuration(session.started_at, session.completed_at)}`,
  ];
  if (session.body_condition) lines.push(`体調: ${session.body_condition}/5`);
  if (session.fatigue_level) lines.push(`疲労度: ${session.fatigue_level}/5`);
  if (session.pain) lines.push(`痛み: ${session.pain}`);
  lines.push("");

  for (const ex of exercises ?? []) {
    if (ex.skipped) {
      lines.push(`■ ${ex.exercise_name}（スキップ）`);
      continue;
    }
    const exSets = setsByEx[ex.id] ?? [];
    lines.push(`■ ${ex.exercise_name} (${exSets.length}セット)`);
    for (const s of exSets) {
      const side = s.side ? ` (${s.side})` : "";
      const val =
        ex.is_duration && s.weight === 0 && s.reps > 0
          ? `${s.reps}分`
          : `${s.weight}kg × ${s.reps}回`;
      lines.push(`  ${s.set_number}セット目${side}: ${val}`);
    }
  }

  if (session.notes) lines.push(`\n全体メモ: ${session.notes}`);

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function getExerciseHistory(
  userId: string,
  args: Record<string, unknown>
): Promise<McpToolResult> {
  const exerciseName = String(args.exercise_name ?? "").trim();
  if (!exerciseName) {
    return { content: [{ type: "text", text: "exercise_nameを指定してください" }], isError: true };
  }
  const limit = Math.min(Number(args.limit ?? 5), 20);

  const supabase = createServiceRoleClient();

  // Step 1: Get completed session IDs (latest first)
  const { data: sessionRows } = await supabase
    .from("workout_sessions")
    .select("id, date")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("date", { ascending: false })
    .limit(100);

  if (!sessionRows || sessionRows.length === 0) {
    return { content: [{ type: "text", text: `「${exerciseName}」の記録はまだありません` }] };
  }

  const sessionIdToDate: Record<string, string> = {};
  for (const s of sessionRows) sessionIdToDate[s.id] = s.date;
  const sessionIds = Object.keys(sessionIdToDate);

  // Step 2: Get session exercises matching the name
  const { data: exercises } = await supabase
    .from("workout_session_exercises")
    .select("id, session_id, is_duration")
    .eq("user_id", userId)
    .in("session_id", sessionIds)
    .ilike("exercise_name", exerciseName)
    .eq("skipped", false);

  if (!exercises || exercises.length === 0) {
    return { content: [{ type: "text", text: `「${exerciseName}」の記録はまだありません` }] };
  }

  // Sort by session date descending, take limit
  const sorted = exercises
    .map((e) => ({ ...e, date: sessionIdToDate[e.session_id] ?? "" }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  const exIds = sorted.map((e) => e.id);
  const { data: sets } = await supabase
    .from("workout_sets")
    .select("session_exercise_id, set_number, weight, reps, side")
    .eq("user_id", userId)
    .in("session_exercise_id", exIds)
    .eq("status", "completed")
    .order("set_number");

  const setsByEx: Record<string, typeof sets> = {};
  for (const s of sets ?? []) {
    if (!setsByEx[s.session_exercise_id]) setsByEx[s.session_exercise_id] = [];
    setsByEx[s.session_exercise_id]!.push(s);
  }

  const lines = [`「${exerciseName}」の直近${sorted.length}セッション:\n`];
  for (const ex of sorted) {
    const exSets = setsByEx[ex.id] ?? [];
    if (exSets.length === 0) continue;
    const summary = exSets
      .map((s) => {
        const side = s.side ? `(${s.side})` : "";
        const val =
          ex.is_duration && s.weight === 0 && s.reps > 0
            ? `${s.reps}分`
            : `${s.weight}kg×${s.reps}回`;
        return `${side}${val}`;
      })
      .join(", ");
    lines.push(`${formatJpDate(ex.date)}: ${exSets.length}セット (${summary})`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// ---- Dispatcher ----

export async function callTool(
  name: string,
  args: unknown,
  userId: string
): Promise<McpToolResult> {
  const safeArgs = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
  switch (name) {
    case "list_recent_sessions":
      return listRecentSessions(userId, safeArgs);
    case "get_session_detail":
      return getSessionDetail(userId, safeArgs);
    case "get_exercise_history":
      return getExerciseHistory(userId, safeArgs);
    default:
      return { content: [{ type: "text", text: `ツール「${name}」は存在しません` }], isError: true };
  }
}
