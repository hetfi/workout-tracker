"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getTimerSnapshot,
  adjustTimer,
  skipTimer,
  resetTimer,
  formatTimerDisplay,
} from "@/lib/timer";
import type { TimerState } from "@/lib/timer";
import { unlockAudio, playFinishBeep } from "@/lib/audio";
import { requestNotificationPermission, showTimerNotification } from "@/lib/notification";

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
  useEffect(() => {
    timerRef.current = timer;
  });

  // Request notification permission when timer first starts
  useEffect(() => {
    if (timer.status === "running") {
      requestNotificationPermission().catch(() => {});
    }
  }, [timer.status]);

  const triggerVibration = useCallback(() => {
    if (!vibrationEnabled) return;
    if ("vibrate" in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
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
        playFinishBeep(soundEnabled);
        triggerVibration();
        showTimerNotification(exerciseName, timerRef.current.nextSetNumber).catch(() => {});
        onFinish(skipTimer(timerRef.current));
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer.status, soundEnabled, triggerVibration, onFinish, exerciseName]);

  // Reset finishedRef when timer is no longer running
  useEffect(() => {
    if (timer.status !== "running") {
      finishedRef.current = false;
    }
  }, [timer.endsAt, timer.status]);

  const isFinished =
    snapshot.status === "finished" || snapshot.status === "cancelled";

  if (isFinished) return null;

  const { remainingSeconds } = snapshot;

  const handleUserAction = (fn: () => void) => {
    unlockAudio(); // unlock AudioContext on user gesture
    fn();
  };

  return (
    <div
      className="fixed top-safe-top left-0 right-0 z-40 flex items-center justify-between px-4 py-2 bg-blue-600 text-white"
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
        className="tabular-nums font-bold mx-4 text-3xl"
        aria-live="off"
      >
        {formatTimerDisplay(remainingSeconds)}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleUserAction(() => onUpdate(adjustTimer(timer, -30, new Date())))}
          className="px-2 py-1 text-xs rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          aria-label="30秒短縮"
        >
          -30
        </button>
        <button
          onClick={() => handleUserAction(() => onUpdate(adjustTimer(timer, 30, new Date())))}
          className="px-2 py-1 text-xs rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          aria-label="30秒追加"
        >
          +30
        </button>
        <button
          onClick={() => handleUserAction(() => onUpdate(resetTimer(timer, new Date())))}
          className="px-2 py-1 text-xs rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          aria-label="リセット"
        >
          ↺
        </button>
        <button
          onClick={() => handleUserAction(() => onFinish(skipTimer(timer)))}
          className="px-2 py-1 text-xs rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          aria-label="スキップ"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
