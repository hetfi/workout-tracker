/**
 * Timer logic – independent of React and UI.
 *
 * Design: Instead of counting down 1s at a time, we store
 * an absolute `endsAt` timestamp. Remaining seconds are computed
 * as `Math.ceil((endsAt - now) / 1000)` on each tick.
 * This survives background tabs, screen lock, and page reloads.
 */

import type { RestTimer, TimerStatus } from "@/domain/types";

export interface TimerState {
  sessionId: string;
  sessionExerciseId: string;
  triggerSetId: string;
  nextSetNumber: number;
  /** Configured duration (seconds) */
  durationSeconds: number;
  /** ISO 8601 */
  startedAt: string;
  /** ISO 8601 – the only source of truth for remaining time */
  endsAt: string;
  status: TimerStatus;
  adjustmentSeconds: number;
}

export interface TimerSnapshot {
  /** Remaining seconds (never negative) */
  remainingSeconds: number;
  status: TimerStatus;
  isUrgent: boolean; // <= 30s
  isCritical: boolean; // <= 10s
}

/** Compute remaining seconds from an absolute endsAt timestamp */
export function computeRemainingSeconds(endsAt: string, now?: Date): number {
  const end = new Date(endsAt).getTime();
  const current = (now ?? new Date()).getTime();
  return Math.max(0, Math.ceil((end - current) / 1000));
}

/** Get current snapshot of a timer */
export function getTimerSnapshot(
  timer: TimerState,
  now?: Date
): TimerSnapshot {
  let remainingSeconds: number;

  if (timer.status === "finished" || timer.status === "cancelled") {
    remainingSeconds = 0;
  } else {
    remainingSeconds = computeRemainingSeconds(timer.endsAt, now);
    if (remainingSeconds === 0 && timer.status === "running") {
      // Timer has naturally expired
    }
  }

  return {
    remainingSeconds,
    status:
      remainingSeconds === 0 && timer.status === "running"
        ? "finished"
        : timer.status,
    isUrgent: remainingSeconds <= 30,
    isCritical: remainingSeconds <= 10,
  };
}

/** Create a new timer state when a set is completed */
export function createTimerState(params: {
  sessionId: string;
  sessionExerciseId: string;
  triggerSetId: string;
  nextSetNumber: number;
  durationSeconds: number;
  now?: Date;
}): TimerState {
  const now = params.now ?? new Date();
  const endsAt = new Date(now.getTime() + params.durationSeconds * 1000);

  return {
    sessionId: params.sessionId,
    sessionExerciseId: params.sessionExerciseId,
    triggerSetId: params.triggerSetId,
    nextSetNumber: params.nextSetNumber,
    durationSeconds: params.durationSeconds,
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    status: "running",
    adjustmentSeconds: 0,
  };
}

/** Apply a time adjustment (+30 or -30) to a running timer */
export function adjustTimer(
  timer: TimerState,
  adjustSeconds: number,
  now?: Date
): TimerState {
  if (timer.status !== "running") return timer;

  const currentEnd = new Date(timer.endsAt).getTime();
  const adjustMs = adjustSeconds * 1000;
  const newEndMs = Math.max(
    (now ?? new Date()).getTime(), // never go below "now"
    currentEnd + adjustMs
  );

  return {
    ...timer,
    endsAt: new Date(newEndMs).toISOString(),
    adjustmentSeconds: timer.adjustmentSeconds + adjustSeconds,
  };
}

/** Skip the current timer (set to finished) */
export function skipTimer(timer: TimerState): TimerState {
  return { ...timer, status: "finished" };
}

/** Reset the timer to its original duration */
export function resetTimer(timer: TimerState, now?: Date): TimerState {
  const current = now ?? new Date();
  const newEnd = new Date(
    current.getTime() + timer.durationSeconds * 1000
  );
  return {
    ...timer,
    startedAt: current.toISOString(),
    endsAt: newEnd.toISOString(),
    status: "running",
    adjustmentSeconds: 0,
  };
}

/** Cancel the timer */
export function cancelTimer(timer: TimerState): TimerState {
  return { ...timer, status: "cancelled" };
}

/** Mark the timer as finished */
export function finishTimer(timer: TimerState): TimerState {
  return { ...timer, status: "finished" };
}

/** Convert a DB RestTimer row to TimerState */
export function fromRestTimer(rt: RestTimer): TimerState {
  return {
    sessionId: rt.sessionId,
    sessionExerciseId: rt.sessionExerciseId,
    triggerSetId: rt.triggerSetId,
    nextSetNumber: rt.nextSetNumber,
    durationSeconds: rt.durationSeconds,
    startedAt: rt.startedAt,
    endsAt: rt.endsAt,
    status: rt.status,
    adjustmentSeconds: rt.adjustmentSeconds,
  };
}

/** Format seconds as MM:SS */
export function formatTimerDisplay(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}
