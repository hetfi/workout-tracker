"use client";

import { useState, useRef } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { clampWeight, clampReps, adjustWeight, adjustReps } from "@/lib/preset";

interface WeightRepsPickerProps {
  open: boolean;
  onClose: () => void;
  /** Set metadata */
  setNumber: number;
  exerciseName: string;
  /** For one-arm exercises: 'L' or 'R' */
  side?: "L" | "R";
  /** Current values */
  weight: number;
  reps: number;
  /** Increment steps */
  smallStep?: number;
  largeStep?: number;
  /** Called when user taps "残りのセットに適用" */
  onApplyToRemaining?: (weight: number, reps: number) => void;
  /** Called when user taps "セット完了" */
  onComplete: (weight: number, reps: number) => void;
  /** Whether this is the last incomplete set */
  isLastSet?: boolean;
  /**
   * When true, shows a minutes picker instead of weight × reps.
   * `reps` stores minutes; `weight` is always 0.
   */
  isDuration?: boolean;
}

export function WeightRepsPicker({
  open,
  onClose,
  setNumber,
  exerciseName,
  side,
  weight: initialWeight,
  reps: initialReps,
  smallStep = 0.5,
  largeStep = 2.5,
  onApplyToRemaining,
  onComplete,
  isLastSet = false,
  isDuration = false,
}: WeightRepsPickerProps) {
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  // duration mode: reps stores minutes (1–300)
  const [minutes, setMinutes] = useState(initialReps > 0 ? initialReps : 20);
  const [editingMinutes, setEditingMinutes] = useState(false);
  const [minutesInput, setMinutesInput] = useState(String(initialReps > 0 ? initialReps : 20));
  const [editingWeight, setEditingWeight] = useState(false);
  const [editingReps, setEditingReps] = useState(false);
  const [weightInput, setWeightInput] = useState(String(initialWeight));
  const [repsInput, setRepsInput] = useState(String(initialReps));
  const weightInputRef = useRef<HTMLInputElement>(null);
  const repsInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);

  const handleWeightChange = (delta: number) => {
    setWeight((prev) => {
      const next = adjustWeight(prev, delta);
      setWeightInput(String(next));
      return next;
    });
  };

  const handleRepsChange = (delta: number) => {
    setReps((prev) => {
      const next = adjustReps(prev, delta);
      setRepsInput(String(next));
      return next;
    });
  };

  const commitWeight = () => {
    const v = parseFloat(weightInput);
    if (!isNaN(v)) {
      const clamped = clampWeight(v);
      setWeight(clamped);
      setWeightInput(String(clamped));
    } else {
      setWeightInput(String(weight));
    }
    setEditingWeight(false);
  };

  const commitReps = () => {
    const v = parseInt(repsInput, 10);
    if (!isNaN(v)) {
      const clamped = clampReps(v);
      setReps(clamped);
      setRepsInput(String(clamped));
    } else {
      setRepsInput(String(reps));
    }
    setEditingReps(false);
  };

  const stepButton = (
    label: string,
    onClick: () => void,
    size: "sm" | "lg" = "sm"
  ) => (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center",
        "rounded-xl font-bold",
        "bg-[#3A3A3C]",
        "text-white",
        "active:bg-[#48484A]",
        "transition-colors select-none touch-manipulation",
        size === "lg" ? "h-12 w-16 text-sm" : "h-11 w-14 text-base"
      )}
      aria-label={label}
    >
      {label}
    </button>
  );

  const sideLabel = side ? ` (${side})` : "";

  const commitMinutes = () => {
    const v = parseInt(minutesInput, 10);
    if (!isNaN(v) && v > 0) {
      const clamped = Math.min(300, Math.max(1, v));
      setMinutes(clamped);
      setMinutesInput(String(clamped));
    } else {
      setMinutesInput(String(minutes));
    }
    setEditingMinutes(false);
  };

  const handleMinutesChange = (delta: number) => {
    setMinutes((prev) => {
      const next = Math.min(300, Math.max(1, prev + delta));
      setMinutesInput(String(next));
      return next;
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`${exerciseName} - ${setNumber}セット目${sideLabel}`}>
      <div className="space-y-6">
        {isDuration ? (
          /* Duration (minutes) mode */
          <div>
            <p className="text-xs font-medium text-[#8E8E93] mb-2 uppercase tracking-wide">
              時間（分）
            </p>
            <div className="flex items-center justify-between gap-2">
              {stepButton("-10", () => handleMinutesChange(-10), "lg")}
              {stepButton("-5", () => handleMinutesChange(-5))}

              <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
                {editingMinutes ? (
                  <input
                    ref={minutesInputRef}
                    type="number"
                    value={minutesInput}
                    onChange={(e) => setMinutesInput(e.target.value)}
                    onBlur={commitMinutes}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitMinutes();
                      if (e.key === "Escape") {
                        setMinutesInput(String(minutes));
                        setEditingMinutes(false);
                      }
                    }}
                    className={cn(
                      "w-full text-center text-5xl font-bold",
                      "bg-transparent border-b-2 border-[#CAFF4D]",
                      "text-white focus:outline-none"
                    )}
                    inputMode="numeric"
                    step="1"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingMinutes(true);
                      setMinutesInput(String(minutes));
                      setTimeout(() => minutesInputRef.current?.select(), 50);
                    }}
                    className="text-5xl font-bold text-white tabular-nums"
                    aria-label={`${minutes}分 タップして編集`}
                  >
                    {minutes}
                  </button>
                )}
                <span className="text-sm text-[#8E8E93]">分</span>
              </div>

              {stepButton("+5", () => handleMinutesChange(5))}
              {stepButton("+10", () => handleMinutesChange(10), "lg")}
            </div>
          </div>
        ) : (
          <>
            {/* Weight section */}
            <div>
              <p className="text-xs font-medium text-[#8E8E93] mb-2 uppercase tracking-wide">
                重量 (kg)
              </p>
              <div className="flex items-center justify-between gap-2">
                {stepButton(`-${largeStep}`, () => handleWeightChange(-largeStep), "lg")}
                {stepButton(`-${smallStep}`, () => handleWeightChange(-smallStep))}

                <div className="flex-1 flex justify-center">
                  {editingWeight ? (
                    <input
                      ref={weightInputRef}
                      type="number"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      onBlur={commitWeight}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitWeight();
                        if (e.key === "Escape") {
                          setWeightInput(String(weight));
                          setEditingWeight(false);
                        }
                      }}
                      className={cn(
                        "w-full text-center text-5xl font-bold",
                        "bg-transparent border-b-2 border-[#CAFF4D]",
                        "text-white focus:outline-none"
                      )}
                      inputMode="decimal"
                      step="0.01"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingWeight(true);
                        setWeightInput(String(weight));
                        setTimeout(() => weightInputRef.current?.select(), 50);
                      }}
                      className="text-5xl font-bold text-white tabular-nums"
                      aria-label={`重量 ${weight}kg タップして編集`}
                    >
                      {weight}
                    </button>
                  )}
                </div>

                {stepButton(`+${smallStep}`, () => handleWeightChange(smallStep))}
                {stepButton(`+${largeStep}`, () => handleWeightChange(largeStep), "lg")}
              </div>
            </div>

            {/* Reps section */}
            <div>
              <p className="text-xs font-medium text-[#8E8E93] mb-2 uppercase tracking-wide">
                回数
              </p>
              <div className="flex items-center justify-between gap-2">
                {stepButton("-5", () => handleRepsChange(-5), "lg")}
                {stepButton("-1", () => handleRepsChange(-1))}

                <div className="flex-1 flex justify-center">
                  {editingReps ? (
                    <input
                      ref={repsInputRef}
                      type="number"
                      value={repsInput}
                      onChange={(e) => setRepsInput(e.target.value)}
                      onBlur={commitReps}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitReps();
                        if (e.key === "Escape") {
                          setRepsInput(String(reps));
                          setEditingReps(false);
                        }
                      }}
                      className={cn(
                        "w-full text-center text-5xl font-bold",
                        "bg-transparent border-b-2 border-[#CAFF4D]",
                        "text-white focus:outline-none"
                      )}
                      inputMode="numeric"
                      step="1"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingReps(true);
                        setRepsInput(String(reps));
                        setTimeout(() => repsInputRef.current?.select(), 50);
                      }}
                      className="text-5xl font-bold text-white tabular-nums"
                      aria-label={`回数 ${reps}回 タップして編集`}
                    >
                      {reps}
                    </button>
                  )}
                </div>

                {stepButton("+1", () => handleRepsChange(1))}
                {stepButton("+5", () => handleRepsChange(5), "lg")}
              </div>
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          {!isDuration && onApplyToRemaining && !isLastSet && (
            <Button
              variant="outline"
              fullWidth
              size="md"
              onClick={() => onApplyToRemaining(weight, reps)}
            >
              残りのセットに適用
            </Button>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setWeight(0);
                setWeightInput("0");
                setReps(0);
                setRepsInput("0");
                setMinutes(0);
                setMinutesInput("0");
              }}
              className="flex-1"
            >
              リセット
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => isDuration ? onComplete(0, minutes) : onComplete(weight, reps)}
              className="flex-2"
            >
              セット完了
            </Button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
