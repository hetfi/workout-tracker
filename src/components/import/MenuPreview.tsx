"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
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
        <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
            ⚠️ 解析時の警告
          </p>
          <ul className="space-y-1">
            {workout.warnings.map((w, i) => (
              <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Date and Title */}
      <Card>
        <div className="space-y-3">
          <Input
            label="日付"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </Card>

      {/* Exercises */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
          種目（{exercises.length}件）
        </p>

        {exercises.map((ex, i) => (
          <Card key={i} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                {ex.name}
              </h4>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  aria-label="上に移動"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === exercises.length - 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  aria-label="下に移動"
                >
                  ↓
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">セット数</span>
                <input
                  type="number"
                  value={ex.sets}
                  min={1}
                  onChange={(e) =>
                    updateExercise(i, "sets", parseInt(e.target.value, 10) || 1)
                  }
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">目標回数</span>
                <input
                  type="text"
                  value={formatRepsTarget(ex.repsTarget)}
                  readOnly
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-center bg-gray-50 dark:bg-gray-800 text-gray-500 text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">インターバル</span>
                <input
                  type="number"
                  value={ex.restSeconds}
                  min={1}
                  onChange={(e) =>
                    updateExercise(i, "restSeconds", parseInt(e.target.value, 10) || 90)
                  }
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {ex.notes && (
              <p className="text-xs text-blue-600 dark:text-blue-400">
                ✦ {ex.notes}
              </p>
            )}
          </Card>
        ))}
      </div>

      {exercises.length === 0 && (
        <div className="text-center py-8 text-gray-400">
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
