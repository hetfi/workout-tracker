/**
 * Menu Parser – independent module.
 * Parses the ChatGPT standard format into ParsedWorkout.
 *
 * Standard format:
 * [WORKOUT]
 * date: 2026-09-20
 * title: 胸・背中
 * exercise: ベンチプレス | sets: 4 | reps: 6-8 | rest: 150 | note: 肩甲骨を寄せる
 * [/WORKOUT]
 */

import type { ParsedExercise, ParsedWorkout, RepsTarget } from "@/domain/types";

const DEFAULT_REST_SECONDS = 90;

// ---- Normalisation helpers ----

/** Convert full-width digits and spaces to half-width */
function normalise(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .trim();
}

/** Strip leading/trailing whitespace from key and value */
function splitKV(s: string): [string, string] {
  const idx = s.indexOf(":");
  if (idx === -1) return [s.trim(), ""];
  return [s.slice(0, idx).trim().toLowerCase(), s.slice(idx + 1).trim()];
}

// ---- Rest parser ----

/**
 * Parses rest time from various formats to integer seconds.
 * Returns null if the value cannot be parsed (caller should warn and use default).
 */
export function parseRestSeconds(raw: string): number | null {
  const s = normalise(raw).trim();
  if (!s) return null;

  // "90" or "90s" or "90秒"
  const simple = s.match(/^(\d+)(?:s|秒)?$/);
  if (simple) {
    const v = parseInt(simple[1], 10);
    return v > 0 ? v : null;
  }

  // "1:30" (mm:ss)
  const mmss = s.match(/^(\d+):(\d{2})$/);
  if (mmss) {
    const v = parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
    return v > 0 ? v : null;
  }

  // "2分30秒" or "2分" or "30秒" (full Japanese)
  const jpFull = s.match(/^(?:(\d+)分)?(?:(\d+)秒)?$/);
  if (jpFull && (jpFull[1] || jpFull[2])) {
    const mins = parseInt(jpFull[1] ?? "0", 10);
    const secs = parseInt(jpFull[2] ?? "0", 10);
    const v = mins * 60 + secs;
    return v > 0 ? v : null;
  }

  return null;
}

// ---- Reps parser ----

/**
 * Parses reps target: "8", "6-8", "6〜8"
 */
export function parseRepsTarget(raw: string): RepsTarget | null {
  const s = normalise(raw).replace(/〜/g, "-").trim();

  const range = s.match(/^(\d+)-(\d+)$/);
  if (range) {
    const min = parseInt(range[1], 10);
    const max = parseInt(range[2], 10);
    if (min > 0 && max >= min) return { min, max };
    return null;
  }

  const single = s.match(/^(\d+)$/);
  if (single) {
    const v = parseInt(single[1], 10);
    return v > 0 ? { min: v, max: v } : null;
  }

  return null;
}

// ---- Exercise line parser ----

/**
 * Parses a single exercise line:
 * "exercise: ベンチプレス | sets: 4 | reps: 6-8 | rest: 150 | note: ..."
 * Returns null if the line cannot be parsed as an exercise.
 */
export function parseExerciseLine(line: string): ParsedExercise | null {
  const normLine = normalise(line);

  // Must start with "exercise:" (case-insensitive)
  const exMatch = normLine.match(/^exercise\s*:\s*(.+)/i);
  if (!exMatch) return null;

  const rest = exMatch[1];
  const parts = rest.split("|").map((p) => p.trim());

  // First part is the exercise name
  const name = parts[0].trim();
  if (!name) return null;

  const fields: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const [k, v] = splitKV(parts[i]);
    fields[k] = v;
  }

  // sets
  const setsRaw = fields["sets"] ?? "";
  const setsNorm = normalise(setsRaw);
  const sets = parseInt(setsNorm, 10);
  if (!sets || sets <= 0) return null;

  // duration (時間記録: "duration: 20" or "duration: 20分")
  const durationRaw = fields["duration"] ?? fields["time"] ?? null;
  if (durationRaw) {
    // Parse minutes from values like "20", "20分", "20分30秒"
    const durationNorm = normalise(durationRaw);
    const minMatch = durationNorm.match(/^(\d+)(?:分)?/);
    if (minMatch) {
      const durationMins = parseInt(minMatch[1], 10);
      if (durationMins > 0) {
        const restRaw = fields["rest"] ?? fields["rest_seconds"] ?? "";
        const parsedRest = parseRestSeconds(restRaw);
        const restSeconds = parsedRest !== null && parsedRest > 0 ? parsedRest : 0;
        const noteRaw = fields["note"] ?? fields["notes"] ?? null;
        return {
          name,
          sets,
          repsTarget: { min: durationMins, max: durationMins },
          restSeconds,
          notes: noteRaw ? noteRaw.trim() : null,
          isDuration: true,
        };
      }
    }
  }

  // reps
  const repsRaw = fields["reps"] ?? "";
  const repsTarget = parseRepsTarget(repsRaw);
  if (!repsTarget) return null;

  // rest
  const restRaw = fields["rest"] ?? fields["rest_seconds"] ?? "";
  let restSeconds: number;
  let restWarning = false;
  const parsedRest = parseRestSeconds(restRaw);
  if (parsedRest !== null && parsedRest > 0) {
    restSeconds = parsedRest;
  } else {
    restSeconds = DEFAULT_REST_SECONDS;
    restWarning = true;
  }

  // note
  const noteRaw = fields["note"] ?? fields["notes"] ?? null;
  const notes = noteRaw ? noteRaw.trim() : null;

  // muscle category
  const muscleRaw = fields["muscle"] ?? fields["category"] ?? null;
  const MUSCLE_MAP: Record<string, string> = {
    胸: "chest", chest: "chest",
    肩: "shoulder", shoulder: "shoulder",
    背: "back", 背中: "back", back: "back",
    脚: "leg", 下半身: "leg", leg: "leg",
    腕: "arm", arm: "arm",
    腹: "ab", 腹筋: "ab", ab: "ab",
    有酸素: "cardio", カーディオ: "cardio", cardio: "cardio",
  };
  const muscleCategory = muscleRaw
    ? (MUSCLE_MAP[muscleRaw.trim()] ?? null)
    : null;

  const exercise: ParsedExercise = {
    name,
    sets,
    repsTarget,
    restSeconds,
    notes,
    muscleCategory,
  };

  // Attach warning marker for caller (warn even when rest is missing)
  if (restWarning) {
    (exercise as ParsedExercise & { _restWarning?: string })._restWarning =
      restRaw || "(未設定)";
  }

  return exercise;
}

// ---- Main parser ----

/**
 * Parse a ChatGPT workout text into a structured ParsedWorkout.
 * Fails gracefully: exercises that cannot be parsed are noted in warnings.
 */
export function parseWorkoutText(raw: string): ParsedWorkout {
  // Normalise line endings
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const warnings: string[] = [];
  const exercises: ParsedExercise[] = [];

  let date = "";
  let title = "";

  // Extract the [WORKOUT]...[/WORKOUT] block if present
  const blockMatch = text.match(/\[WORKOUT\]([\s\S]*?)\[\/WORKOUT\]/i);
  const workoutBlock = blockMatch ? blockMatch[1] : text;

  const lines = workoutBlock
    .split("\n")
    .map((l) => normalise(l))
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const [key, value] = splitKV(line);

    if (key === "date") {
      // Validate YYYY-MM-DD
      const d = normalise(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        date = d;
      } else {
        warnings.push(`日付の形式が無効です: "${value}"`);
      }
      continue;
    }

    if (key === "title") {
      title = value.trim();
      continue;
    }

    if (key === "exercise") {
      const exercise = parseExerciseLine(line);
      if (exercise) {
        // Check for rest warning
        const w = (
          exercise as ParsedExercise & { _restWarning?: string }
        )._restWarning;
        if (w) {
          warnings.push(
            `"${exercise.name}" のインターバル "${w}" を解析できませんでした。90秒を使用します。`
          );
          delete (exercise as ParsedExercise & { _restWarning?: string })
            ._restWarning;
        }
        exercises.push(exercise);
      } else {
        warnings.push(`種目の解析に失敗しました: "${line}"`);
      }
      continue;
    }

    // Unknown line – skip silently (don't fail)
  }

  // Fallbacks
  if (!date) {
    const today = new Date();
    const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
    date = jst.toISOString().slice(0, 10);
    if (workoutBlock.trim()) {
      warnings.push("日付が見つかりませんでした。今日の日付を使用します。");
    }
  }

  if (!title) {
    title = "トレーニング";
    if (workoutBlock.trim()) {
      warnings.push("タイトルが見つかりませんでした。");
    }
  }

  if (exercises.length === 0 && workoutBlock.trim()) {
    warnings.push("解析できる種目が見つかりませんでした。");
  }

  return { date, title, exercises, warnings };
}

// ---- Formatting helpers ----

/** Format seconds to human readable "2分30秒" */
export function formatRestSeconds(seconds: number): string {
  if (seconds <= 0) return "0秒";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}秒`;
  if (s === 0) return `${m}分`;
  return `${m}分${s}秒`;
}

/** Format RepsTarget to "6〜8" or "8" */
export function formatRepsTarget(reps: RepsTarget): string {
  if (reps.min === reps.max) return String(reps.min);
  return `${reps.min}〜${reps.max}`;
}
