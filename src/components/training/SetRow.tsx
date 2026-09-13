"use client";

import { cn } from "@/lib/cn";
import type { WorkoutSet } from "@/domain/types";

interface SetRowProps {
  set: WorkoutSet;
  /** Called when row is tapped */
  onTap: () => void;
  /** Called when delete button is tapped */
  onDelete?: () => void;
}

export function SetRow({ set, onTap, onDelete }: SetRowProps) {
  const isCompleted = set.status === "completed";
  const isSkipped = set.status === "skipped";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onTap}
        className={cn(
          "flex items-center flex-1",
          "rounded-xl px-4 py-3 gap-3",
          "transition-all duration-200",
          "touch-manipulation select-none",
          "text-left",
          isCompleted
            ? "bg-[#CAFF4D]/10 border border-[#CAFF4D]/30"
            : isSkipped
            ? "bg-white/[0.04] border border-white/[0.08] opacity-50"
            : "bg-white/[0.06] border border-white/[0.08] active:bg-white/[0.1]"
        )}
        aria-label={`${set.setNumber}セット目: 重量${set.weight}kg 回数${set.reps}回 ${isCompleted ? "完了" : "未完了"}`}
      >
        {/* Set number */}
        <span
          className={cn(
            "text-sm font-medium w-6 text-center shrink-0",
            isCompleted ? "text-[#CAFF4D]" : "text-[#8E8E93]"
          )}
        >
          {set.setNumber}
        </span>

        {/* Values */}
        <div className="flex-1 flex items-baseline gap-2">
          <span
            className={cn(
              "text-xl font-bold tabular-nums",
              isCompleted ? "text-[#CAFF4D]" : "text-white"
            )}
          >
            {set.weight}
            <span className="text-sm font-normal ml-0.5">kg</span>
          </span>
          <span className="text-[#8E8E93]">×</span>
          <span
            className={cn(
              "text-xl font-bold tabular-nums",
              isCompleted ? "text-[#CAFF4D]" : "text-white"
            )}
          >
            {set.reps}
            <span className="text-sm font-normal ml-0.5">回</span>
          </span>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          {isCompleted ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#CAFF4D] text-black text-sm font-bold">
              ✓
            </span>
          ) : isSkipped ? (
            <span className="text-xs text-[#8E8E93]">スキップ</span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/[0.2] text-[#8E8E93] text-xs">
              →
            </span>
          )}
        </div>
      </button>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete()}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-[#8E8E93] hover:text-red-400 hover:bg-white/[0.08] transition-colors"
          aria-label={`${set.setNumber}セット目を削除`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}
