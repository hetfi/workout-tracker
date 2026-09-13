/**
 * ChatGPT export – generates a plain-text training report.
 * Independent module: no React dependencies.
 */

import type {
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from "@/domain/types";
import { formatRestSeconds, formatRepsTarget } from "@/lib/parser";

export interface ExportSession {
  session: Pick<
    WorkoutSession,
    | "date"
    | "title"
    | "startedAt"
    | "completedAt"
    | "bodyCondition"
    | "fatigueLevel"
    | "pain"
    | "notes"
  >;
  exercises: ExportExercise[];
}

export interface ExportExercise {
  exercise: Pick<
    WorkoutSessionExercise,
    | "exerciseName"
    | "plannedSets"
    | "plannedRepsTarget"
    | "restSeconds"
    | "skipped"
    | "notes"
  > & { weightType?: string };
  sets: Pick<
    WorkoutSet,
    "setNumber" | "weight" | "reps" | "status" | "notes"
  >[];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "不明";
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return `${minutes}分`;
}

function formatWeight(
  weight: number,
  weightType?: string
): string {
  if (weightType === "per_hand") {
    return `${weight}kg（片手）`;
  }
  return `${weight}kg`;
}

/**
 * Generate ChatGPT-ready plain text from a completed session.
 */
export function generateChatGPTText(data: ExportSession): string {
  const { session, exercises } = data;
  const lines: string[] = [];

  lines.push("[トレーニング記録]");
  lines.push(`日付：${formatDate(session.date)}`);
  lines.push(`タイトル：${session.title}`);
  lines.push(
    `運動時間：${formatDuration(session.startedAt, session.completedAt)}`
  );

  if (session.bodyCondition !== null) {
    lines.push(`体調：${session.bodyCondition}/5`);
  }
  if (session.fatigueLevel !== null) {
    lines.push(`疲労度：${session.fatigueLevel}/5`);
  }

  lines.push("");

  for (const { exercise, sets } of exercises) {
    if (exercise.skipped) {
      lines.push(`■ ${exercise.exerciseName}（スキップ）`);
      lines.push("");
      continue;
    }

    lines.push(`■ ${exercise.exerciseName}`);
    lines.push(
      `目標：${exercise.plannedSets}セット・${formatRepsTarget(
        exercise.plannedRepsTarget
      )}回`
    );
    lines.push(`インターバル：${formatRestSeconds(exercise.restSeconds)}`);

    for (const s of sets.sort((a, b) => a.setNumber - b.setNumber)) {
      if (s.status === "completed") {
        lines.push(
          `${s.setNumber}セット目：${formatWeight(s.weight, exercise.weightType)} × ${s.reps}回`
        );
      } else if (s.status === "skipped") {
        lines.push(`${s.setNumber}セット目：実施せず`);
      }
    }

    if (exercise.notes) {
      lines.push(`メモ：${exercise.notes}`);
    }

    lines.push("");
  }

  if (session.pain) {
    lines.push(`痛み・違和感：${session.pain}`);
  }
  if (session.notes) {
    lines.push(`全体メモ：\n${session.notes}`);
  }

  lines.push("[/トレーニング記録]");

  return lines.join("\n");
}
