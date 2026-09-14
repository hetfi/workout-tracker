"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { SetRow } from "./SetRow";
import { WeightRepsPicker } from "./WeightRepsPicker";
import type { WorkoutSet, WorkoutSessionExercise } from "@/domain/types";
import type { MuscleCategory } from "@/lib/muscleCategory";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/muscleCategory";
import { formatRepsTarget, formatRestSeconds } from "@/lib/parser";
import { applyToRemainingSets } from "@/lib/preset";
import { createClient } from "@/lib/supabase/client";

interface ExerciseCardProps {
  sessionExercise: WorkoutSessionExercise;
  sets: WorkoutSet[];
  smallStep?: number;
  largeStep?: number;
  previousRecord?: string; // e.g. "前回: 60kg × 8回"
  /** 部位分類（種目マスターから取得） */
  muscleCategory?: MuscleCategory;
  /** 並び替え */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  onSetComplete: (set: WorkoutSet) => void;
  onSetsUpdate: (sets: WorkoutSet[]) => void;
  onDeleteExercise?: () => void;
  onDeleteSet?: (clientId: string) => void;
  onAddSet?: () => void;
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
          ? "bg-[#CAFF4D]/10 border border-[#CAFF4D]/30"
          : "bg-white/[0.06] border border-white/[0.08] active:bg-white/[0.1]"
      )}
      aria-label={`${setNumber}セット目 ${side}: 重量${weight}kg 回数${reps}回 ${isCompleted ? "完了" : "未完了"}`}
    >
      {/* Set number + side */}
      <span
        className={cn(
          "text-sm font-medium w-8 text-center shrink-0",
          isCompleted ? "text-[#CAFF4D]" : "text-[#8E8E93]"
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
            isCompleted ? "text-[#CAFF4D]" : "text-white"
          )}
        >
          {weight}
          <span className="text-sm font-normal ml-0.5">kg</span>
        </span>
        <span className="text-[#8E8E93]">×</span>
        <span
          className={cn(
            "text-xl font-bold tabular-nums",
            isCompleted ? "text-[#CAFF4D]" : "text-white"
          )}
        >
          {reps}
          <span className="text-sm font-normal ml-0.5">回</span>
        </span>
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        {isCompleted ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#CAFF4D] text-black text-sm font-bold">
            ✓
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/[0.2] text-[#8E8E93] text-xs">
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
  smallStep = 0.5,
  largeStep = 2.5,
  previousRecord,
  muscleCategory,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
  onSetComplete,
  onSetsUpdate,
  onDeleteExercise,
  onDeleteSet,
  onAddSet,
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
    <Card className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* 部位ラベル */}
          {muscleCategory && (
            <span
              className="text-xs font-medium"
              style={{ color: CATEGORY_COLORS[muscleCategory] }}
            >
              {CATEGORY_LABELS[muscleCategory]}
            </span>
          )}
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-semibold text-lg text-white break-words min-w-0">
              {sessionExercise.exerciseName}
            </h3>
            {/* One-arm toggle badge */}
            <button
              onClick={handleToggleOneArm}
              className={cn(
                "shrink-0 text-xs px-2 py-0.5 rounded-full font-medium transition-colors border mt-0.5",
                isOneArmLocal
                  ? "bg-[#CAFF4D]/20 text-[#CAFF4D] border-[#CAFF4D]/40"
                  : "bg-white/[0.06] text-[#8E8E93] border-white/[0.08]"
              )}
            >
              {isOneArmLocal ? "片手" : "両手"}
            </button>
          </div>
          <p className="text-xs text-[#8E8E93] mt-0.5">
            {sessionExercise.plannedSets}セット×{formatRepsTarget(sessionExercise.plannedRepsTarget)}回
            {" · "}
            間隔{formatRestSeconds(sessionExercise.restSeconds)}
          </p>
          {sessionExercise.notes && (
            <p className="text-xs mt-0.5" style={{ color: "#64B5F6" }}>
              ✦ {sessionExercise.notes}
            </p>
          )}
          {previousRecord && (
            <p className="text-xs mt-0.5" style={{ color: "#8E8E93" }}>
              {previousRecord}
            </p>
          )}
        </div>

        {/* Progress badge + reorder + delete */}
        <div className="shrink-0 flex items-center gap-1">
          {/* 並び替えボタン */}
          {(onMoveUp || onMoveDown) && (
            <div className="flex flex-col">
              <button
                onClick={onMoveUp}
                disabled={isFirst}
                className={cn(
                  "w-7 h-6 flex items-center justify-center rounded-t transition-colors",
                  isFirst
                    ? "text-white/[0.15] cursor-default"
                    : "text-[#8E8E93] hover:text-white hover:bg-white/[0.08]"
                )}
                aria-label="上に移動"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
              </button>
              <button
                onClick={onMoveDown}
                disabled={isLast}
                className={cn(
                  "w-7 h-6 flex items-center justify-center rounded-b transition-colors",
                  isLast
                    ? "text-white/[0.15] cursor-default"
                    : "text-[#8E8E93] hover:text-white hover:bg-white/[0.08]"
                )}
                aria-label="下に移動"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>
          )}
          {onDeleteExercise && (
            <button
              onClick={() => {
                if (confirm(`「${sessionExercise.exerciseName}」を削除しますか？`)) {
                  onDeleteExercise();
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#8E8E93] hover:text-red-400 hover:bg-white/[0.08] transition-colors"
              aria-label="種目を削除"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
            </button>
          )}
          <div
            className={cn(
              "shrink-0 flex flex-col items-center justify-center",
              "h-10 w-10 rounded-full text-sm font-bold",
              isAllDone
                ? "bg-[#CAFF4D]/20 text-[#CAFF4D]"
                : "bg-white/[0.08] text-white"
            )}
          >
            <span>{completedCount}/{totalCount}</span>
          </div>
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
            <SetRow
              key={s.clientId}
              set={s}
              onTap={() => handleSetTap(i)}
              onDelete={onDeleteSet ? () => onDeleteSet(s.clientId) : undefined}
            />
          ))
        )}
      </div>

      {/* Add set button */}
      {onAddSet && !sessionExercise.skipped && (
        <button
          onClick={onAddSet}
          className="w-full text-xs text-[#8E8E93] hover:text-[#CAFF4D] py-2 border border-dashed border-white/[0.12] hover:border-[#CAFF4D]/40 rounded-xl transition-colors"
        >
          ＋ セット追加
        </button>
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
