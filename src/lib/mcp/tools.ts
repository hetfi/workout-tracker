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
    name: "delete_today_session",
    description:
      "本日の未開始トレーニングセッションを削除します。メニューを作り直す前の準備や、休息日に変更する前処理として使います。進行中・完了済みのセッションは削除できません。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_rest_day",
    description:
      "本日を休息日として登録します。今日の未開始セッションがある場合は同時に削除します。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_today_session",
    description:
      "[WORKOUT]...[/WORKOUT] 形式のテキストを受け取り、本日のトレーニングセッションとしてアプリに登録します。登録後はアプリのホーム画面に反映されます。",
    inputSchema: {
      type: "object",
      properties: {
        workout_text: {
          type: "string",
          description:
            "[WORKOUT]〜[/WORKOUT] を含む形式のワークアウトテキスト。例:\n[WORKOUT]\ndate: 2026-09-27\ntitle: 背中・肩\nexercise: ラットプルダウン | muscle: back | sets: 3 | reps: 8-12 | rest: 120 | one_arm: false\n[/WORKOUT]",
        },
      },
      required: ["workout_text"],
    },
  },
  {
    name: "list_recent_sessions",
    description:
      "最近のトレーニングセッション一覧を取得します。日付・タイトル・総セット数・運動時間を返します。",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "取得件数（デフォルト10、最大100）",
        },
        months: {
          type: "number",
          description: "過去N か月分を取得（1〜12。指定すると件数上限より優先して日付でフィルタ）",
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
        months: {
          type: "number",
          description: "過去N か月分を取得（デフォルト3、最大12）",
        },
      },
      required: ["exercise_name"],
    },
  },
];

// ---- Workout text parser ----

interface ParsedWorkoutExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  isOneArm: boolean;
  isDuration: boolean;
}

interface ParsedWorkout {
  title: string;
  exercises: ParsedWorkoutExercise[];
}

function parseWorkoutText(text: string): ParsedWorkout | null {
  const match = text.match(/\[WORKOUT\]([\s\S]*?)\[\/WORKOUT\]/);
  if (!match) return null;
  const lines = match[1].split("\n").map((l) => l.trim()).filter(Boolean);

  let title = "";
  const exercises: ParsedWorkoutExercise[] = [];

  for (const line of lines) {
    if (line.startsWith("title:")) {
      title = line.slice("title:".length).trim();
    } else if (line.startsWith("exercise:")) {
      const parts = line.split("|").map((p) => p.trim());
      const name = parts[0].replace(/^exercise:\s*/, "").trim();
      const get = (key: string) => {
        const part = parts.find((p) => p.startsWith(key + ":"));
        return part ? part.slice(key.length + 1).trim() : "";
      };

      const sets = Math.max(1, parseInt(get("sets")) || 1);
      const restSeconds = parseInt(get("rest")) || 60;
      const isOneArm = get("one_arm") === "true";
      const durationStr = get("duration");
      const repsStr = get("reps");

      let repsMin = 0, repsMax = 0, isDuration = false;
      if (durationStr) {
        isDuration = true;
        repsMin = repsMax = parseInt(durationStr) || 0;
      } else if (repsStr) {
        const [minStr, maxStr] = repsStr.split("-");
        repsMin = parseInt(minStr) || 0;
        repsMax = parseInt(maxStr ?? minStr) || repsMin;
      }

      if (name) exercises.push({ name, sets, repsMin, repsMax, restSeconds, isOneArm, isDuration });
    }
  }

  return title && exercises.length > 0 ? { title, exercises } : null;
}

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

async function deleteTodaySession(
  userId: string
): Promise<McpToolResult> {
  const supabase = createServiceRoleClient();
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, title, status")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .in("status", ["not_started", "in_progress", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return { content: [{ type: "text", text: `本日（${todayStr}）のセッションはありません。` }] };
  }

  const s = session as Record<string, unknown>;
  if (s.status !== "not_started") {
    return {
      content: [{ type: "text", text: `セッション「${s.title}」は${s.status === "in_progress" ? "進行中" : "完了済み"}のため削除できません。` }],
      isError: true,
    };
  }

  await supabase.from("workout_sessions").delete().eq("id", s.id).eq("user_id", userId);

  return { content: [{ type: "text", text: `✅ 本日のセッション「${s.title}」を削除しました。` }] };
}

async function setRestDay(
  userId: string
): Promise<McpToolResult> {
  const supabase = createServiceRoleClient();
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  // Delete today's not_started session if exists
  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, title, status")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .eq("status", "not_started")
    .maybeSingle();

  if (session) {
    const s = session as Record<string, unknown>;
    await supabase.from("workout_sessions").delete().eq("id", s.id).eq("user_id", userId);
  }

  // Register rest day (upsert to handle duplicates)
  const { error } = await supabase
    .from("rest_days")
    .upsert({ user_id: userId, date: todayStr }, { onConflict: "user_id,date", ignoreDuplicates: true });

  if (error) {
    return { content: [{ type: "text", text: "休息日の登録に失敗しました" }], isError: true };
  }

  const lines = [`✅ 本日（${todayStr}）を休息日として登録しました。`];
  if (session) lines.push(`（トレーニングセッション「${(session as Record<string, unknown>).title}」も削除しました）`);
  lines.push("アプリのホーム画面を更新すると反映されます。");

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function createTodaySession(
  userId: string,
  args: Record<string, unknown>
): Promise<McpToolResult> {
  const workoutText = String(args.workout_text ?? "");
  const parsed = parseWorkoutText(workoutText);
  if (!parsed) {
    return {
      content: [{ type: "text", text: "[WORKOUT]...[/WORKOUT] 形式のテキストを workout_text に渡してください。" }],
      isError: true,
    };
  }

  const supabase = createServiceRoleClient();

  // Today's date in JST
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);

  // Duplicate check
  const { data: existing } = await supabase
    .from("workout_sessions")
    .select("id, title")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .in("status", ["not_started", "in_progress"])
    .maybeSingle();

  if (existing) {
    return {
      content: [{
        type: "text",
        text: `本日（${todayStr}）のセッション「${(existing as Record<string, unknown>).title}」がすでに存在します。既存セッションを削除してから再登録してください。`,
      }],
      isError: true,
    };
  }

  // Create session
  const { data: sessionData, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({ user_id: userId, date: todayStr, title: parsed.title, status: "not_started" })
    .select()
    .single();

  if (sessionError || !sessionData) {
    return { content: [{ type: "text", text: "セッションの作成に失敗しました" }], isError: true };
  }

  const session = sessionData as Record<string, unknown>;

  // Create session exercises
  const exerciseRows = parsed.exercises.map((ex, i) => ({
    user_id: userId,
    session_id: session.id,
    exercise_name: ex.name,
    planned_sets: ex.sets,
    planned_reps_min: ex.repsMin,
    planned_reps_max: ex.repsMax,
    rest_seconds: ex.restSeconds,
    sort_order: i,
    is_one_arm: ex.isOneArm,
    is_duration: ex.isDuration,
  }));

  const { error: exError } = await supabase
    .from("workout_session_exercises")
    .insert(exerciseRows);

  if (exError) {
    await supabase.from("workout_sessions").delete().eq("id", session.id);
    return { content: [{ type: "text", text: "種目の登録に失敗しました" }], isError: true };
  }

  const lines = [
    `✅ 本日（${todayStr}）のセッション「${parsed.title}」を登録しました。`,
    `種目数: ${parsed.exercises.length}件`,
    "",
  ];
  for (const ex of parsed.exercises) {
    const rep = ex.isDuration ? `${ex.repsMin}分` : `${ex.repsMin}-${ex.repsMax}回`;
    const arm = ex.isOneArm ? "（片腕）" : "";
    lines.push(`• ${ex.name}${arm}  ${ex.sets}セット × ${rep}  休憩${ex.restSeconds}秒`);
  }
  lines.push("", "アプリのホーム画面を更新すると反映されています。");

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function listRecentSessions(
  userId: string,
  args: Record<string, unknown>
): Promise<McpToolResult> {
  const limit = Math.min(Number(args.limit ?? 10), 100);
  const months = args.months != null ? Math.min(Math.max(Number(args.months), 1), 12) : null;

  const supabase = createServiceRoleClient();

  let query = supabase
    .from("workout_sessions")
    .select("id, date, title, status, started_at, completed_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("date", { ascending: false })
    .limit(limit);

  if (months != null) {
    const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    jst.setMonth(jst.getMonth() - months);
    query = query.gte("date", jst.toISOString().slice(0, 10));
  }

  const { data: sessions, error } = await query;

  if (error) return { content: [{ type: "text", text: "データ取得に失敗しました" }], isError: true };
  if (!sessions || sessions.length === 0) {
    const rangeNote = months != null ? `（過去${months}か月）` : "";
    return { content: [{ type: "text", text: `完了済みのセッションがまだありません${rangeNote}` }] };
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

  const rangeLabel = months != null ? `過去${months}か月の` : "直近";
  const lines = [`${rangeLabel}${sessions.length}件のトレーニング記録:\n`];
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
      .select("session_exercise_id, set_number, weight, reps, status, side")
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
  const months = Math.min(Math.max(Number(args.months ?? 3), 1), 12);

  const supabase = createServiceRoleClient();

  // Calculate date range in JST
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const sinceDate = new Date(jst);
  sinceDate.setMonth(sinceDate.getMonth() - months);
  const sinceDateStr = sinceDate.toISOString().slice(0, 10);

  // Step 1: Get completed sessions within the date range (limit 150 to avoid URL query length issues)
  const { data: sessionRows, error: sessErr } = await supabase
    .from("workout_sessions")
    .select("id, date")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("date", sinceDateStr)
    .order("date", { ascending: false })
    .limit(150);

  if (sessErr) return { content: [{ type: "text", text: "データ取得に失敗しました" }], isError: true };
  if (!sessionRows || sessionRows.length === 0) {
    return { content: [{ type: "text", text: `「${exerciseName}」の記録はまだありません（過去${months}か月）` }] };
  }

  const sessionIdToDate: Record<string, string> = {};
  for (const s of sessionRows) sessionIdToDate[s.id] = s.date;
  const sessionIds = Object.keys(sessionIdToDate);

  // Step 2: Get session exercises matching the name
  const { data: exercises, error: exErr } = await supabase
    .from("workout_session_exercises")
    .select("id, session_id, is_duration")
    .eq("user_id", userId)
    .in("session_id", sessionIds)
    .ilike("exercise_name", exerciseName)
    .eq("skipped", false);

  if (exErr) return { content: [{ type: "text", text: "データ取得に失敗しました" }], isError: true };
  if (!exercises || exercises.length === 0) {
    return { content: [{ type: "text", text: `「${exerciseName}」の記録はまだありません（過去${months}か月）` }] };
  }

  // Sort by session date descending
  const sorted = exercises
    .map((e) => ({ ...e, date: sessionIdToDate[e.session_id] ?? "" }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const exIds = sorted.map((e) => e.id);
  const { data: sets, error: setsErr } = await supabase
    .from("workout_sets")
    .select("session_exercise_id, set_number, weight, reps, side")
    .in("session_exercise_id", exIds)
    .eq("status", "completed")
    .order("set_number");

  if (setsErr) return { content: [{ type: "text", text: "データ取得に失敗しました" }], isError: true };

  const setsByEx: Record<string, typeof sets> = {};
  for (const s of sets ?? []) {
    if (!setsByEx[s.session_exercise_id]) setsByEx[s.session_exercise_id] = [];
    setsByEx[s.session_exercise_id]!.push(s);
  }

  const lines = [`「${exerciseName}」の過去${months}か月（${sorted.length}セッション）:\n`];
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
    case "delete_today_session":
      return deleteTodaySession(userId);
    case "set_rest_day":
      return setRestDay(userId);
    case "create_today_session":
      return createTodaySession(userId, safeArgs);
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
