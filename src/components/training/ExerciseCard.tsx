"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { SetRow } from "./SetRow";
import { WeightRepsPicker } from "./WeightRepsPicker";
import type { WorkoutSet, WorkoutSessionExercise } from "@/domain/types";
import { formatRepsTarget, formatRestSeconds } from "@/lib/parser";
import { applyToRemainingSets } from "@/lib/preset";
import { createClient } from "@/lib/supabase/client";

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

// --- One-arm row sub-component ---

interface OneArmSetRowProps {
  setNumber: number;
  side: "L" | "R";
  set: WorkoutSet | undefined;
  defaultWeight: number;
  defaultReps: number;
  onTap: () => void;
}

function OneArmSetRow({
  setNumber,
  side,
  set,
  defaultWeight,
  defaultReps,
  onTap,
}: OneArmSetRowProps) {
  const isCompleted = set?.status === "completed";
  const weight = set?.weight ?? defaultWeight;
  const reps = set?.reps ?? defaultReps;

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
          : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 active:bg-gray-50"
      )}
      aria-label={`${setNumber}セット目 ${side}: 重量${weight}kg 回数${reps}回 ${isCompleted ? "完了" : "未完了"}`}
    >
      {/* Set number + side */}
      <span
        className={cn(
          "text-sm font-medium w-8 text-center shrink-0",
          isCompleted
            ? "text-green-700 dark:text-green-400"
            : "text-gray-500 dark:text-gray-400"
        )}
      >
        {setNumber}
        <span className="font-bold">{side}</span>
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
          {weight}
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
          {reps}
          <span className="text-sm font-normal ml-0.5">回</span>
        </span>
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        {isCompleted ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white text-sm">
            ✓
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600 text-gray-400 text-xs">
            →
          </span>
        )}
      </div>
    </button>
  );
}

// --- Main ExerciseCard ---

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
  // Normal-mode picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeSetIndex, setActiveSetIndex] = useState<number | null>(null);

  // One-arm mode state
  const [isOneArmLocal, setIsOneArmLocal] = useState(sessionExercise.isOneArm);
  const [activeSetNumber, setActiveSetNumber] = useState<number | null>(null);
  const [activeSide, setActiveSide] = useState<"L" | "R" | null>(null);

  // Toggle one-arm mode (persists to DB)
  const handleToggleOneArm = useCallback(async () => {
    const next = !isOneArmLocal;
    setIsOneArmLocal(next);
    const supabase = createClient();
    await supabase
      .from("workout_session_exercises")
      .update({ is_one_arm: next })
      .eq("id", sessionExercise.id);
  }, [isOneArmLocal, sessionExercise.id]);

  // Normal mode: tap set row
  const handleSetTap = useCallback((index: number) => {
    setActiveSetIndex(index);
    setPickerOpen(true);
  }, []);

  // One-arm mode: tap L or R row
  const handleOneArmTap = useCallback((setNumber: number, side: "L" | "R") => {
    setActiveSetNumber(setNumber);
    setActiveSide(side);
    setPickerOpen(true);
  }, []);

  // Unified complete handler
  const handleComplete = useCallback(
    (weight: number, reps: number) => {
      if (isOneArmLocal) {
        if (activeSetNumber === null || activeSide === null) return;
        // Find an existing side set or use a preset set for userId/sessionId
        const existingSet = sets.find(
          (s) => s.setNumber === activeSetNumber && s.side === activeSide
        );
        const presetSet =
          sets.find((s) => s.setNumber === activeSetNumber) ?? sets[0];
        const clientId = `${sessionExercise.id}-${activeSetNumber}-${activeSide}`;
        const updated: WorkoutSet = {
          id: existingSet?.id ?? crypto.randomUUID(),
          userId: presetSet?.userId ?? "",
          sessionExerciseId: sessionExercise.id,
          sessionId: presetSet?.sessionId ?? sessionExercise.sessionId,
          setNumber: activeSetNumber,
          weight,
          reps,
          status: "completed",
          completedAt: new Date().toISOString(),
          notes: null,
          clientId,
          side: activeSide,
          createdAt: existingSet?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        onSetComplete(updated);
        setPickerOpen(false);
        setActiveSetNumber(null);
        setActiveSide(null);
      } else {
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
      }
    },
    [
      isOneArmLocal,
      activeSetIndex,
      activeSetNumber,
      activeSide,
      sets,
      sessionExercise.id,
      sessionExercise.sessionId,
      onSetComplete,
    ]
  );

  const handleApplyToRemaining = useCallback(
    (weight: number, reps: number) => {
      if (isOneArmLocal || activeSetIndex === null) return;
      const fromSetNumber = sets[activeSetIndex].setNumber;
      const updated = applyToRemainingSets(sets, fromSetNumber, weight, reps);
      onSetsUpdate(updated);
    },
    [activeSetIndex, sets, onSetsUpdate, isOneArmLocal]
  );

  // Progress counts
  let completedCount: number;
  let totalCount: number;

  if (isOneArmLocal) {
    const sideSets = sets.filter((s) => s.side === "L" || s.side === "R");
    completedCount = sideSets.filter((s) => s.status === "completed").length;
    totalCount = sessionExercise.plannedSets * 2;
  } else {
    completedCount = sets.filter((s) => s.status === "completed").length;
    totalCount = sets.length;
  }

  const isAllDone = completedCount === totalCount && totalCount > 0;

  // Normal mode picker values
  const activeSet = !isOneArmLocal && activeSetIndex !== null ? sets[activeSetIndex] : null;
  const pendingSets = sets.filter((s) => s.status === "pending");
  const isLastPendingSet =
    !isOneArmLocal &&
    activeSet !== null &&
    pendingSets.length > 0 &&
    pendingSets[pendingSets.length - 1]?.setNumber === activeSet?.setNumber;

  // One-arm picker values
  const oneArmPresetSet =
    isOneArmLocal && activeSetNumber !== null
      ? sets.find((s) => s.setNumber === activeSetNumber) ?? sets[0]
      : null;
  const oneArmExistingSet =
    isOneArmLocal && activeSetNumber !== null && activeSide !== null
      ? sets.find((s) => s.setNumber === activeSetNumber && s.side === activeSide)
      : null;
  const oneArmPickerWeight = oneArmExistingSet?.weight ?? oneArmPresetSet?.weight ?? 0;
  const oneArmPickerReps = oneArmExistingSet?.reps ?? oneArmPresetSet?.reps ?? 0;

  return (
    <Card className={cn("space-y-3", sessionExercise.skipped && "opacity-50")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">
              {sessionExercise.exerciseName}
            </h3>
            {/* One-arm toggle badge */}
            <button
              onClick={handleToggleOneArm}
              className={cn(
                "shrink-0 text-xs px-2 py-0.5 rounded-full font-medium transition-colors",
                isOneArmLocal
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
              )}
            >
              片手
            </button>
          </div>
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

        {/* Progress badge */}
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
        {isOneArmLocal ? (
          // One-arm mode: L and R row for each planned set
          Array.from(
            { length: sessionExercise.plannedSets },
            (_, i) => i + 1
          ).flatMap((n) => {
            const lSet = sets.find((s) => s.setNumber === n && s.side === "L");
            const rSet = sets.find((s) => s.setNumber === n && s.side === "R");
            const presetSet = sets.find((s) => s.setNumber === n);
            return [
              <OneArmSetRow
                key={`${n}-L`}
                setNumber={n}
                side="L"
                set={lSet}
                defaultWeight={presetSet?.weight ?? 0}
                defaultReps={presetSet?.reps ?? 0}
                onTap={() => handleOneArmTap(n, "L")}
              />,
              <OneArmSetRow
                key={`${n}-R`}
                setNumber={n}
                side="R"
                set={rSet}
                defaultWeight={presetSet?.weight ?? 0}
                defaultReps={presetSet?.reps ?? 0}
                onTap={() => handleOneArmTap(n, "R")}
              />,
            ];
          })
        ) : (
          // Normal mode
          sets.map((s, i) => (
            <SetRow key={s.clientId} set={s} onTap={() => handleSetTap(i)} />
          ))
        )}
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

      {/* Normal mode picker */}
      {!isOneArmLocal && activeSet && (
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

      {/* One-arm picker */}
      {isOneArmLocal && activeSetNumber !== null && activeSide !== null && (
        <WeightRepsPicker
          key={`${activeSetNumber}-${activeSide}`}
          open={pickerOpen}
          onClose={() => {
            setPickerOpen(false);
            setActiveSetNumber(null);
            setActiveSide(null);
          }}
          setNumber={activeSetNumber}
          exerciseName={sessionExercise.exerciseName}
          weight={oneArmPickerWeight}
          reps={oneArmPickerReps}
          smallStep={smallStep}
          largeStep={largeStep}
          side={activeSide}
          onComplete={handleComplete}
          isLastSet={false}
        />
      )}
    </Card>
  );
}
