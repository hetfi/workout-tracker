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
  /** nextSetNumber: 片側モードで呼び出す際にExerciseCardが次のセット番号を渡す */
  onAddSet?: (nextSetNumber?: number) => void;
}

// --- One-arm row sub-component ---

interface OneArmSetRowProps {
  setNumber: number;
  side: "L" | "R";
  set: WorkoutSet | undefined;
  defaultWeight: number;
  defaultReps: number;
  isDuration?: boolean;
  onTap: () => void;
  onDelete?: () => void;
}

function OneArmSetRow({
  setNumber,
  side,
  set,
  defaultWeight,
  defaultReps,
  isDuration = false,
  onTap,
  onDelete,
}: OneArmSetRowProps) {
  const isCompleted = set?.status === "completed";
  const weight = set?.weight ?? defaultWeight;
  const reps = set?.reps ?? defaultReps;

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
            : "bg-white/[0.06] border border-white/[0.08] active:bg-white/[0.1]"
        )}
        aria-label={
          isDuration
            ? `${setNumber}セット目 ${side}: ${reps}分 ${isCompleted ? "完了" : "未完了"}`
            : `${setNumber}セット目 ${side}: 重量${weight}kg 回数${reps}回 ${isCompleted ? "完了" : "未完了"}`
        }
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
        <div className="flex-1 flex items-baseline gap-2 whitespace-nowrap overflow-hidden">
          {isDuration ? (
            <span
              className={cn(
                "text-xl font-bold tabular-nums",
                isCompleted ? "text-[#CAFF4D]" : "text-white"
              )}
            >
              {reps > 0 ? reps : "—"}
              <span className="text-sm font-normal ml-0.5">分</span>
            </span>
          ) : (
            <>
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
            </>
          )}
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

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-[#8E8E93] hover:text-red-400 hover:bg-white/[0.08] transition-colors"
          aria-label={`${setNumber}セット目${side}を削除`}
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

  // One-arm: track locally-deleted pending slots (setNumber → side)
  const [deletedOneArmSlots, setDeletedOneArmSlots] = useState<Set<string>>(new Set());
  // One-arm: アクティブなペア番号リスト（削除・追加によって変動）
  const [activePairNumbers, setActivePairNumbers] = useState<number[]>(() =>
    Array.from({ length: sessionExercise.plannedSets }, (_, i) => i + 1)
  );

  // Delete a pending one-arm slot that has no DB record yet.
  // Removes the set from setsMap and tracks deletion. When both sides of a pair are deleted,
  // removes the pair from activePairNumbers (fixing set number gaps on re-add).
  const handleDeletePendingOneArmSlot = useCallback(
    (slotNumber: number, side: "L" | "R") => {
      const key = `${slotNumber}-${side}`;
      const otherSide = side === "L" ? "R" : "L";
      const otherKey = `${slotNumber}-${otherSide}`;

      // Remove this pending set from setsMap immediately
      onSetsUpdate(sets.filter((s) => !(s.setNumber === slotNumber && s.side === side && s.status === "pending")));

      // Check if other side is already gone (in deletedOneArmSlots or not in setsMap)
      const otherIsGone =
        deletedOneArmSlots.has(otherKey) ||
        !sets.some((s) => s.setNumber === slotNumber && s.side === otherSide && s.status === "pending");

      if (otherIsGone) {
        // Full pair deleted: remove from activePairNumbers, clear slot markers
        setActivePairNumbers((prev) => prev.filter((n) => n !== slotNumber));
        setDeletedOneArmSlots((prev) => {
          const next = new Set(prev);
          next.delete(key);
          next.delete(otherKey);
          return next;
        });
        // Async DB update — fire-and-forget (non-critical)
        void (async () => {
          const newPlannedSets = Math.max(1, activePairNumbers.filter((n) => n !== slotNumber).length);
          await createClient()
            .from("workout_session_exercises")
            .update({ planned_sets: newPlannedSets })
            .eq("id", sessionExercise.id);
        })();
      } else {
        // Only this side deleted — hide it, wait for other side
        setDeletedOneArmSlots((prev) => new Set([...prev, key]));
      }
    },
    [sessionExercise.id, sets, deletedOneArmSlots, activePairNumbers, onSetsUpdate]
  );

  // Hide a completed one-arm slot immediately after onDeleteSet removes it from setsMap.
  // Without this, the slot reappears as "pending" and requires a second tap to delete.
  // No DB planned_sets update needed here — onDeleteSet already handles workout_sets deletion.
  const handleHideOneArmSlot = useCallback(
    (slotNumber: number, side: "L" | "R") => {
      const key = `${slotNumber}-${side}`;
      setDeletedOneArmSlots((prev) => {
        if (prev.has(key)) return prev;
        return new Set([...prev, key]);
      });
    },
    []
  );

  // Toggle one-arm mode (persists to DB)
  // 完了済みセットがある場合はリセット確認ダイアログを表示
  const handleToggleOneArm = useCallback(async () => {
    const next = !isOneArmLocal;

    // 切り替え後のモードと互換性のない完了セットを検出
    const incompatibleSets = next
      ? sets.filter((s) => s.status === "completed" && !s.side) // 両手完了 → 片手切替時
      : sets.filter((s) => s.status === "completed" && (s.side === "L" || s.side === "R")); // 片手完了 → 両手切替時

    if (incompatibleSets.length > 0) {
      const modeLabel = next ? "片側ずつ" : "両側";
      const confirmed = window.confirm(
        `${modeLabel}モードに切り替えると、完了済みのセット（${incompatibleSets.length}件）がリセットされます。よろしいですか？`
      );
      if (!confirmed) return;

      // 完了セットをDBから削除
      const supabase = createClient();
      await Promise.allSettled(
        incompatibleSets.map((s) =>
          supabase.from("workout_sets").delete().eq("client_id", s.clientId)
        )
      );

      // ローカルのセット状態をリセット（ペンディングのみ残す、sideをnullに）
      const resetSets = sets
        .filter((s) => !incompatibleSets.some((r) => r.clientId === s.clientId))
        .map((s) => ({ ...s, status: "pending" as const, side: null }));
      onSetsUpdate(resetSets);
      setDeletedOneArmSlots(new Set());
    }

    setIsOneArmLocal(next);
    const supabase = createClient();
    await supabase
      .from("workout_session_exercises")
      .update({ is_one_arm: next })
      .eq("id", sessionExercise.id);
  }, [isOneArmLocal, sessionExercise.id, sets, onSetsUpdate]);

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
        // client_id カラムは UUID 型のため、composite 文字列（UUID-N-L）は不正。
        // pending スロットにはすでに正規 UUID の clientId が付いているのでそれを使う。
        // 初回完了（pending なし）の場合のみ新規 UUID を生成する。
        const clientId = existingSet?.clientId ?? crypto.randomUUID();
        const updated: WorkoutSet = {
          id: existingSet?.id ?? clientId,
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

  // 片側モード: 現在タップしたスロット以降の pending セット全体に適用
  const handleOneArmApplyToRemaining = useCallback(
    (weight: number, reps: number) => {
      if (!isOneArmLocal || activeSetNumber === null || activeSide === null) return;
      const updated = sets.map((s) => {
        if (s.status !== "pending") return s;
        // 同セット番号の逆サイド、または後続セット番号は全て適用
        const isSameSetOtherSide =
          s.setNumber === activeSetNumber && s.side !== activeSide;
        const isLaterSet = s.setNumber > activeSetNumber;
        return isSameSetOtherSide || isLaterSet ? { ...s, weight, reps } : s;
      });
      onSetsUpdate(updated);
    },
    [activeSetNumber, activeSide, sets, onSetsUpdate, isOneArmLocal]
  );

  // isDuration 種目は常に 1 セット扱い
  const effectivePlannedSets = sessionExercise.isDuration ? 1 : sessionExercise.plannedSets;

  // Progress counts
  let completedCount: number;
  let totalCount: number;

  if (isOneArmLocal) {
    // L と R をそれぞれ独立した1セットとして数える（右2・左2 = 合計4セット）。
    // activePairNumbers がアクティブなペアを管理。deletedOneArmSlots は片側のみ削除中のスロット。
    completedCount = sets.filter(
      (s) =>
        (s.side === "L" || s.side === "R") &&
        activePairNumbers.includes(s.setNumber) &&
        s.status === "completed" &&
        !deletedOneArmSlots.has(`${s.setNumber}-${s.side}`)
    ).length;
    totalCount = Math.max(0, activePairNumbers.length * 2 - deletedOneArmSlots.size);
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
      <div>
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
            {/* One-arm toggle — checkbox style */}
            <button
              onClick={handleToggleOneArm}
              className="shrink-0 flex items-center gap-1 mt-0.5"
              aria-pressed={isOneArmLocal}
            >
              {/* checkbox box */}
              <span
                className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                style={
                  isOneArmLocal
                    ? { backgroundColor: "#CAFF4D", color: "#0D0D0F" }
                    : { border: "1.5px solid #48484A", backgroundColor: "transparent" }
                }
              >
                {isOneArmLocal ? "✓" : ""}
              </span>
              <span className="text-xs" style={{ color: isOneArmLocal ? "#CAFF4D" : "#8E8E93" }}>
                片側ずつ
              </span>
            </button>
          </div>
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
      {!sessionExercise.isDuration && sessionExercise.plannedRepsTarget.max > 0 && (
        <p className="text-xs text-[#8E8E93] mt-1">
          目安：{sessionExercise.plannedSets}セット×{formatRepsTarget(sessionExercise.plannedRepsTarget)}回
          {" · "}
          間隔{formatRestSeconds(sessionExercise.restSeconds)}
        </p>
      )}
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

      {/* Sets */}
      <div className="space-y-2">
        {isOneArmLocal ? (
          // One-arm mode: L and R row for each active pair
          activePairNumbers.flatMap((n) => {
            const lSet = sets.find((s) => s.setNumber === n && s.side === "L");
            const rSet = sets.find((s) => s.setNumber === n && s.side === "R");
            const presetSet = sets.find((s) => s.setNumber === n);
            const lKey = `${n}-L`;
            const rKey = `${n}-R`;
            const rows = [];
            if (!deletedOneArmSlots.has(lKey)) {
              rows.push(
                <OneArmSetRow
                  key={lKey}
                  setNumber={n}
                  side="L"
                  set={lSet}
                  defaultWeight={presetSet?.weight ?? 0}
                  defaultReps={presetSet?.reps ?? 0}
                  isDuration={sessionExercise.isDuration}
                  onTap={() => handleOneArmTap(n, "L")}
                  onDelete={
                    onDeleteSet
                      ? lSet
                        ? () => {
                            // 完了済みセット: DBから削除 + UIスロットを即座に非表示
                            // （非表示にしないと pending として再表示され2回タップ必要になる）
                            onDeleteSet(lSet.clientId);
                            handleHideOneArmSlot(n, "L");
                          }
                        : () => handleDeletePendingOneArmSlot(n, "L")
                      : undefined
                  }
                />
              );
            }
            if (!deletedOneArmSlots.has(rKey)) {
              rows.push(
                <OneArmSetRow
                  key={rKey}
                  setNumber={n}
                  side="R"
                  set={rSet}
                  defaultWeight={presetSet?.weight ?? 0}
                  defaultReps={presetSet?.reps ?? 0}
                  isDuration={sessionExercise.isDuration}
                  onTap={() => handleOneArmTap(n, "R")}
                  onDelete={
                    onDeleteSet
                      ? rSet
                        ? () => {
                            // 完了済みセット: DBから削除 + UIスロットを即座に非表示
                            onDeleteSet(rSet.clientId);
                            handleHideOneArmSlot(n, "R");
                          }
                        : () => handleDeletePendingOneArmSlot(n, "R")
                      : undefined
                  }
                />
              );
            }
            return rows;
          })
        ) : (
          // Normal mode
          sets.map((s, i) => (
            <SetRow
              key={s.clientId}
              set={s}
              isDuration={sessionExercise.isDuration}
              onTap={() => handleSetTap(i)}
              onDelete={onDeleteSet ? () => onDeleteSet(s.clientId) : undefined}
            />
          ))
        )}
      </div>

      {/* Add set button */}
      {onAddSet && !sessionExercise.skipped && (
        <button
          onClick={() => {
            if (isOneArmLocal) {
              // 次のセット番号 = 現在のアクティブペアの最大番号 + 1
              const nextSN = activePairNumbers.length > 0
                ? Math.max(...activePairNumbers) + 1
                : 1;
              setActivePairNumbers((prev) => [...prev, nextSN]);
              onAddSet(nextSN);
            } else {
              onAddSet();
            }
          }}
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
          isDuration={sessionExercise.isDuration}
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
          onApplyToRemaining={handleOneArmApplyToRemaining}
          onComplete={handleComplete}
          isLastSet={false}
          isDuration={sessionExercise.isDuration}
        />
      )}
    </Card>
  );
}
