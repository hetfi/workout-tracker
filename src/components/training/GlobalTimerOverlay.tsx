"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTimerContext } from "@/context/TimerContext";
import { IntervalTimer } from "@/components/training/IntervalTimer";
import { skipTimer } from "@/lib/timer";
import type { TimerState } from "@/lib/timer";

export function GlobalTimerOverlay() {
  const pathname = usePathname();
  const {
    timerState,
    setTimerState,
    exerciseName,
    soundEnabled,
    vibrationEnabled,
  } = useTimerContext();

  const handleUpdate = useCallback(
    (updated: TimerState) => {
      setTimerState(updated);
    },
    [setTimerState]
  );

  const handleFinish = useCallback(
    (finished: TimerState) => {
      setTimerState(finished);
      setTimeout(() => setTimerState(null), 3000);
    },
    [setTimerState]
  );

  // セッション画面には専用の IntervalTimer があるので二重表示しない
  if (pathname.startsWith("/session/")) return null;
  if (!timerState || timerState.status !== "running") return null;

  return (
    <IntervalTimer
      timer={timerState}
      exerciseName={exerciseName}
      onUpdate={handleUpdate}
      onFinish={handleFinish}
      soundEnabled={soundEnabled}
      vibrationEnabled={vibrationEnabled}
    />
  );
}
