"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { SetRow } from "./SetRow";
import { WeightRepsPicker } from "./WeightRepsPicker";
import type { WorkoutSet, WorkoutSessionExercise } from "@/domain/types";
import { formatRepsTarget, formatRestSeconds } from "@/lib/parser";
import { applyToRemainingSets } from "@/lib/preset";

interface ExerciseCardProps {
  sessionExercise: WorkoutSessionExercise;
  sets: WorkoutSet[];
  smallStep?: number;
  largeStep?: number;
  previousRecord?: string; // e.g. "前回: 60kg × 8回"
  onSetComplete: (set: WorkoutSet) => void;
  onSetsUpdate: (sets: WorkoutSet[]) => void;
  onSkipExercise: () => void;
}

export function ExerciseCard({
  sessionExercise,
  sets,
  smallStep = 2.5,
  largeStep = 5.0,
  previousRecord,
  onSetComplete,
  onSetsUpdate,
  onSkipExercise,
}: ExerciseCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeSetIndex, setActiveSetIndex] = useState<number | null>(null);

  const handleSetTap = useCallback((index: number) => {
    setActiveSetIndex(index);
    setPickerOpen(true);
  }, []);

  const handleComplete = useCallback(
    (weight: number, reps: number) => {
      if (activeSetIndex === null) return;
      const s = sets[activeSetIndex];
      const updated: WorkoutSet = {
        ...s,
        weight,
        reps,
        status: "completed",
        completedAt: new Date().toISOString(),
      };
      onSetComplete(updated);
      setPickerOpen(false);
      setActiveSetIndex(null);
    },
    [activeSetIndex, sets, onSetComplete]
  );

  const handleApplyToRemaining = useCallback(
    (weight: number, reps: number) => {
      if (activeSetIndex === null) return;
      const fromSetNumber = sets[activeSetIndex].setNumber;
      const updated = applyToRemainingSets(sets, fromSetNumber, weight, reps);
      onSetsUpdate(updated);
    },
    [activeSetIndex, sets, onSetsUpdate]
  );

  const completedCount = sets.filter((s) => s.status === "completed").length;
  const totalCount = sets.length;
  const isAllDone = completedCount === totalCount && totalCount > 0;

  const activeSet = activeSetIndex !== null ? sets[activeSetIndex] : null;
  const pendingSets = sets.filter((s) => s.status === "pending");
  const isLastPendingSet =
    activeSet !== null &&
    pendingSets.length > 0 &&
    pendingSets[pendingSets.length - 1]?.setNumber === activeSet.setNumber;

  return (
    <Card className={cn("space-y-3", sessionExercise.skipped && "opacity-50")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">
            {sessionExercise.exerciseName}
          </h3>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              目標: {sessionExercise.plannedSets}セット ×{" "}
              {formatRepsTarget(sessionExercise.plannedRepsTarget)}回
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              インターバル: {formatRestSeconds(sessionExercise.restSeconds)}
            </span>
          </div>
          {sessionExercise.notes && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              ✦ {sessionExercise.notes}
            </p>
          )}
          {previousRecord && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {previousRecord}
            </p>
          )}
        </div>

        {/* Progress */}
        <div
          className={cn(
            "shrink-0 flex flex-col items-center justify-center",
            "h-10 w-10 rounded-full text-sm font-bold",
            isAllDone
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          )}
        >
          <span>{completedCount}/{totalCount}</span>
        </div>
      </div>

      {/* Sets */}
      <div className="space-y-2">
        {sets.map((s, i) => (
          <SetRow
            key={s.clientId}
            set={s}
            onTap={() => handleSetTap(i)}
          />
        ))}
      </div>

      {/* Skip */}
      {!sessionExercise.skipped && !isAllDone && (
        <div className="pt-1">
          <button
            onClick={onSkipExercise}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline-offset-2 hover:underline"
          >
            この種目をスキップ
          </button>
        </div>
      )}

      {/* Weight/Reps Picker */}
      {activeSet && (
        <WeightRepsPicker
          open={pickerOpen}
          onClose={() => {
            setPickerOpen(false);
            setActiveSetIndex(null);
          }}
          setNumber={activeSet.setNumber}
          exerciseName={sessionExercise.exerciseName}
          weight={activeSet.weight}
          reps={activeSet.reps}
          smallStep={smallStep}
          largeStep={largeStep}
          onApplyToRemaining={handleApplyToRemaining}
          onComplete={handleComplete}
          isLastSet={isLastPendingSet}
        />
      )}
    </Card>
  );
}
