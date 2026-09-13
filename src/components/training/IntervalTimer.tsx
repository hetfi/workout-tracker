"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  getTimerSnapshot,
  adjustTimer,
  skipTimer,
  resetTimer,
  formatTimerDisplay,
} from "@/lib/timer";
import type { TimerState } from "@/lib/timer";

interface IntervalTimerProps {
  timer: TimerState;
  exerciseName: string;
  onUpdate: (updated: TimerState) => void;
  onFinish: (timer: TimerState) => void;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
}

export function IntervalTimer({
  timer,
  exerciseName,
  onUpdate,
  onFinish,
  soundEnabled = true,
  vibrationEnabled = true,
}: IntervalTimerProps) {
  const [snapshot, setSnapshot] = useState(() =>
    getTimerSnapshot(timer, new Date())
  );
  const finishedRef = useRef(false);
  const timerRef = useRef(timer);
  // Keep timerRef in sync with latest timer prop without triggering re-render
  useEffect(() => {
    timerRef.current = timer;
  });

  const playFinishSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // AudioContext not available (SSR or restricted)
    }
  }, [soundEnabled]);

  const triggerVibration = useCallback(() => {
    if (!vibrationEnabled) return;
    if ("vibrate" in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  }, [vibrationEnabled]);

  // Tick every second
  useEffect(() => {
    if (timer.status !== "running") return;

    const tick = () => {
      const now = new Date();
      const snap = getTimerSnapshot(timerRef.current, now);
      setSnapshot(snap);

      if (snap.remainingSeconds === 0 && !finishedRef.current) {
        finishedRef.current = true;
        playFinishSound();
        triggerVibration();
        onFinish(skipTimer(timerRef.current));
      }
    };

    tick(); // immediate
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer.status, playFinishSound, triggerVibration, onFinish]);

  // Reset finishedRef when timer status is no longer running
  useEffect(() => {
    if (timer.status !== "running") {
      finishedRef.current = false;
    }
    // Re-sync snapshot on external timer changes (e.g. +30/-30)
    // The next tick (within 1s) will also sync, but we update eagerly here.
  }, [timer.endsAt, timer.status]);

  const isFinished =
    snapshot.status === "finished" || snapshot.status === "cancelled";

  if (isFinished) return null;

  const { remainingSeconds, isUrgent, isCritical } = snapshot;

  return (
    <div
      className={cn(
        "fixed top-safe-top left-0 right-0 z-40",
        "flex items-center justify-between",
        "px-4 py-2",
        "transition-colors duration-500",
        isCritical
          ? "bg-red-600 text-white"
          : isUrgent
          ? "bg-orange-500 text-white"
          : "bg-blue-600 text-white"
      )}
      role="timer"
      aria-label={`インターバルタイマー: ${formatTimerDisplay(remainingSeconds)}`}
    >
      {/* Left: info */}
      <div className="min-w-0 flex-1">
        <p className="text-xs opacity-80 truncate">{exerciseName}</p>
        <p className="text-xs opacity-80">
          次のセットまで（{timer.nextSetNumber}セット目）
        </p>
      </div>

      {/* Center: big time display */}
      <div
        className={cn(
          "tabular-nums font-bold mx-4 transition-all duration-300",
          isCritical ? "text-5xl scale-110" : isUrgent ? "text-4xl" : "text-3xl"
        )}
        aria-live="off"
      >
        {formatTimerDisplay(remainingSeconds)}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            const updated = adjustTimer(timer, -30, new Date());
            onUpdate(updated);
          }}
          className="px-2 py-1 text-xs rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          aria-label="30秒短縮"
        >
          -30
        </button>
        <button
          onClick={() => {
            const updated = adjustTimer(timer, 30, new Date());
            onUpdate(updated);
          }}
          className="px-2 py-1 text-xs rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          aria-label="30秒追加"
        >
          +30
        </button>
        <button
          onClick={() => {
            const reset = resetTimer(timer, new Date());
            onUpdate(reset);
          }}
          className="px-2 py-1 text-xs rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          aria-label="リセット"
        >
          ↺
        </button>
        <button
          onClick={() => onFinish(skipTimer(timer))}
          className="px-2 py-1 text-xs rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          aria-label="スキップ"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
