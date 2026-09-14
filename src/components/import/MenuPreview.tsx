"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatRepsTarget } from "@/lib/parser";
import type { ParsedWorkout, ParsedExercise } from "@/domain/types";

interface MenuPreviewProps {
  workout: ParsedWorkout;
  rawText: string;
  onConfirm: (workout: ParsedWorkout, rawText: string) => Promise<void>;
  onBack: () => void;
  saving?: boolean;
  defaultDate?: string;
}

function formatDateJP(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

const MUSCLE_LABELS: Record<string, string> = {
  chest: "胸", shoulder: "肩", back: "背", leg: "脚",
  arm: "腕", ab: "腹", cardio: "有酸素",
};

const MUSCLE_COLORS: Record<string, string> = {
  chest: "#EF4444", shoulder: "#F97316", back: "#A855F7",
  leg: "#22C55E", arm: "#EAB308", ab: "#3B82F6", cardio: "#E5E7EB",
};

export function MenuPreview({
  workout,
  rawText,
  onConfirm,
  onBack,
  saving = false,
  defaultDate,
}: MenuPreviewProps) {
  const [date, setDate] = useState(defaultDate ?? workout.date);
  const [title, setTitle] = useState(workout.title);
  const [exercises, setExercises] = useState<ParsedExercise[]>(workout.exercises);

  const moveUp = (i: number) => {
    if (i === 0) return;
    const arr = [...exercises];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    setExercises(arr);
  };

  const moveDown = (i: number) => {
    if (i === exercises.length - 1) return;
    const arr = [...exercises];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    setExercises(arr);
  };

  const updateExercise = (i: number, field: keyof ParsedExercise, value: unknown) => {
    const arr = [...exercises];
    arr[i] = { ...arr[i], [field]: value };
    setExercises(arr);
  };

  const handleConfirm = async () => {
    const finalWorkout: ParsedWorkout = {
      date,
      title,
      exercises,
      warnings: workout.warnings,
    };
    await onConfirm(finalWorkout, rawText);
  };

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {workout.warnings.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)" }}
        >
          <p className="text-sm font-medium mb-2" style={{ color: "#EAB308" }}>
            ⚠️ 解析時の警告
          </p>
          <ul className="space-y-1">
            {workout.warnings.map((w, i) => (
              <li key={i} className="text-xs" style={{ color: "#CA8A04" }}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Date and Title */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div>
          <label className="text-xs block mb-1" style={{ color: "#8E8E93" }}>日付</label>
          <div
            className="w-full rounded-xl px-3 py-2.5 text-sm font-medium"
            style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            {formatDateJP(date)}
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "#8E8E93" }}>タイトル</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>
      </div>

      {/* Exercises */}
      <div className="space-y-3">
        <p className="text-sm font-medium px-1" style={{ color: "#FFFFFF" }}>
          種目（{exercises.length}件）
        </p>

        {exercises.map((ex, i) => (
          <div
            key={i}
            className="rounded-xl p-4 space-y-3"
            style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* Name + category + sort */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {ex.muscleCategory && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                      style={{
                        backgroundColor: `${MUSCLE_COLORS[ex.muscleCategory] ?? "#8E8E93"}22`,
                        color: MUSCLE_COLORS[ex.muscleCategory] ?? "#8E8E93",
                        border: `1px solid ${MUSCLE_COLORS[ex.muscleCategory] ?? "#8E8E93"}44`,
                      }}
                    >
                      {MUSCLE_LABELS[ex.muscleCategory] ?? ex.muscleCategory}
                    </span>
                  )}
                  <span className="font-medium truncate" style={{ color: "#FFFFFF" }}>
                    {ex.name}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="p-1.5 rounded-lg disabled:opacity-30"
                  style={{ color: "#8E8E93" }}
                  aria-label="上に移動"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === exercises.length - 1}
                  className="p-1.5 rounded-lg disabled:opacity-30"
                  style={{ color: "#8E8E93" }}
                  aria-label="下に移動"
                >
                  ↓
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-xs block mb-1" style={{ color: "#8E8E93" }}>セット数</span>
                <input
                  type="number"
                  value={ex.sets}
                  min={1}
                  onChange={(e) =>
                    updateExercise(i, "sets", parseInt(e.target.value, 10) || 1)
                  }
                  className="w-full rounded-lg px-2 py-1 text-center outline-none"
                  style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
              <div>
                <span className="text-xs block mb-1" style={{ color: "#8E8E93" }}>
                  {ex.isDuration ? "時間（分）" : "目標回数"}
                </span>
                <input
                  type="text"
                  value={ex.isDuration
                    ? `${ex.repsTarget.min}分`
                    : formatRepsTarget(ex.repsTarget)}
                  readOnly
                  className="w-full rounded-lg px-2 py-1 text-center text-xs outline-none"
                  style={{ backgroundColor: "#1C1C1E", color: "#8E8E93", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>
              <div>
                <span className="text-xs block mb-1" style={{ color: "#8E8E93" }}>インターバル</span>
                <input
                  type="number"
                  value={ex.restSeconds}
                  min={0}
                  onChange={(e) =>
                    updateExercise(i, "restSeconds", parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full rounded-lg px-2 py-1 text-center outline-none"
                  style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
            </div>

            {ex.notes && (
              <p className="text-xs" style={{ color: "#64B5F6" }}>
                ✦ {ex.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {exercises.length === 0 && (
        <div className="text-center py-8" style={{ color: "#8E8E93" }}>
          解析できた種目がありません。テキストを確認してください。
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 pb-safe-bottom">
        <Button variant="secondary" size="lg" onClick={onBack} className="flex-1">
          戻る
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleConfirm}
          disabled={exercises.length === 0 || saving}
          loading={saving}
          className="flex-2"
        >
          登録する
        </Button>
      </div>
    </div>
  );
}
