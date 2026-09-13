"use client";

import { cn } from "@/lib/cn";
import type { WorkoutSet } from "@/domain/types";

interface SetRowProps {
  set: WorkoutSet;
  /** Called when row is tapped */
  onTap: () => void;
}

export function SetRow({ set, onTap }: SetRowProps) {
  const isCompleted = set.status === "completed";
  const isSkipped = set.status === "skipped";

  return (
    <button
      onClick={onTap}
      className={cn(
        "flex items-center w-full",
        "rounded-xl px-4 py-3 gap-3",
        "transition-all duration-200",
        "touch-manipulation select-none",
        "text-left",
        isCompleted
          ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          : isSkipped
          ? "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 opacity-50"
          : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 active:bg-gray-50"
      )}
      aria-label={`${set.setNumber}セット目: 重量${set.weight}kg 回数${set.reps}回 ${isCompleted ? "完了" : "未完了"}`}
    >
      {/* Set number */}
      <span
        className={cn(
          "text-sm font-medium w-6 text-center shrink-0",
          isCompleted
            ? "text-green-700 dark:text-green-400"
            : "text-gray-500 dark:text-gray-400"
        )}
      >
        {set.setNumber}
      </span>

      {/* Values */}
      <div className="flex-1 flex items-baseline gap-2">
        <span
          className={cn(
            "text-xl font-bold tabular-nums",
            isCompleted
              ? "text-green-800 dark:text-green-300"
              : "text-gray-900 dark:text-gray-100"
          )}
        >
          {set.weight}
          <span className="text-sm font-normal ml-0.5">kg</span>
        </span>
        <span className="text-gray-400 dark:text-gray-500">×</span>
        <span
          className={cn(
            "text-xl font-bold tabular-nums",
            isCompleted
              ? "text-green-800 dark:text-green-300"
              : "text-gray-900 dark:text-gray-100"
          )}
        >
          {set.reps}
          <span className="text-sm font-normal ml-0.5">回</span>
        </span>
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        {isCompleted ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white text-sm">
            ✓
          </span>
        ) : isSkipped ? (
          <span className="text-xs text-gray-400">スキップ</span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600 text-gray-400 text-xs">
            →
          </span>
        )}
      </div>
    </button>
  );
}
