import { describe, it, expect } from "vitest";
import {
  computeRemainingSeconds,
  createTimerState,
  getTimerSnapshot,
  adjustTimer,
  skipTimer,
  resetTimer,
  cancelTimer,
  formatTimerDisplay,
} from "./index";

const fixedNow = new Date("2026-09-20T10:00:00.000Z");

function makeTimer(overrides?: { durationSeconds?: number } & Partial<ReturnType<typeof createTimerState>>) {
  const duration = overrides?.durationSeconds ?? 90;
  const base = createTimerState({
    sessionId: "s1",
    sessionExerciseId: "se1",
    triggerSetId: "set1",
    nextSetNumber: 2,
    durationSeconds: duration,
    now: fixedNow,
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { durationSeconds: _d, ...rest } = overrides ?? {};
  return { ...base, ...rest };
}

describe("computeRemainingSeconds", () => {
  it("returns correct remaining seconds", () => {
    const endsAt = new Date(fixedNow.getTime() + 90000).toISOString();
    expect(computeRemainingSeconds(endsAt, fixedNow)).toBe(90);
  });

  it("never returns negative", () => {
    const pastEndsAt = new Date(fixedNow.getTime() - 5000).toISOString();
    expect(computeRemainingSeconds(pastEndsAt, fixedNow)).toBe(0);
  });

  it("returns 0 when exactly at deadline", () => {
    expect(computeRemainingSeconds(fixedNow.toISOString(), fixedNow)).toBe(0);
  });
});

describe("createTimerState", () => {
  it("creates a running timer with correct endsAt", () => {
    const timer = makeTimer();
    expect(timer.status).toBe("running");
    expect(timer.durationSeconds).toBe(90);
    const remaining = computeRemainingSeconds(timer.endsAt, fixedNow);
    expect(remaining).toBe(90);
  });
});

describe("getTimerSnapshot", () => {
  it("returns correct remaining seconds for running timer", () => {
    const timer = makeTimer();
    const snap = getTimerSnapshot(timer, fixedNow);
    expect(snap.remainingSeconds).toBe(90);
    expect(snap.status).toBe("running");
    expect(snap.isUrgent).toBe(false);
    expect(snap.isCritical).toBe(false);
  });

  it("marks timer as urgent when <= 30s", () => {
    const now = new Date(fixedNow.getTime() + 61000); // 29s left
    const timer = makeTimer();
    const snap = getTimerSnapshot(timer, now);
    expect(snap.isUrgent).toBe(true);
    expect(snap.isCritical).toBe(false);
  });

  it("marks timer as critical when <= 10s", () => {
    const now = new Date(fixedNow.getTime() + 81000); // 9s left
    const timer = makeTimer();
    const snap = getTimerSnapshot(timer, now);
    expect(snap.isUrgent).toBe(true);
    expect(snap.isCritical).toBe(true);
  });

  it("returns 0 and finished status after deadline", () => {
    const now = new Date(fixedNow.getTime() + 120000); // 30s past
    const timer = makeTimer();
    const snap = getTimerSnapshot(timer, now);
    expect(snap.remainingSeconds).toBe(0);
    expect(snap.status).toBe("finished");
  });

  it("returns 0 for cancelled timer", () => {
    const timer = cancelTimer(makeTimer());
    const snap = getTimerSnapshot(timer, fixedNow);
    expect(snap.remainingSeconds).toBe(0);
    expect(snap.status).toBe("cancelled");
  });

  it("returns 0 for finished timer", () => {
    const timer = skipTimer(makeTimer());
    const snap = getTimerSnapshot(timer, fixedNow);
    expect(snap.remainingSeconds).toBe(0);
  });
});

describe("adjustTimer", () => {
  it("adds 30 seconds", () => {
    const timer = makeTimer();
    const adjusted = adjustTimer(timer, 30, fixedNow);
    const remaining = computeRemainingSeconds(adjusted.endsAt, fixedNow);
    expect(remaining).toBe(120);
    expect(adjusted.adjustmentSeconds).toBe(30);
  });

  it("subtracts 30 seconds", () => {
    const timer = makeTimer();
    const adjusted = adjustTimer(timer, -30, fixedNow);
    const remaining = computeRemainingSeconds(adjusted.endsAt, fixedNow);
    expect(remaining).toBe(60);
  });

  it("does not go below 0 remaining", () => {
    const timer = makeTimer({ durationSeconds: 10 });
    const adjusted = adjustTimer(timer, -60, fixedNow);
    const remaining = computeRemainingSeconds(adjusted.endsAt, fixedNow);
    expect(remaining).toBe(0);
  });

  it("does not adjust a finished timer", () => {
    const timer = skipTimer(makeTimer());
    const adjusted = adjustTimer(timer, 30, fixedNow);
    expect(adjusted.status).toBe("finished");
  });

  it("accumulates adjustments", () => {
    const timer = makeTimer();
    const a1 = adjustTimer(timer, 30, fixedNow);
    const a2 = adjustTimer(a1, -10, fixedNow);
    expect(a2.adjustmentSeconds).toBe(20);
  });
});

describe("resetTimer", () => {
  it("resets to original duration", () => {
    const timer = makeTimer();
    const adjusted = adjustTimer(timer, 30, fixedNow);
    const later = new Date(fixedNow.getTime() + 50000);
    const reset = resetTimer(adjusted, later);
    const remaining = computeRemainingSeconds(reset.endsAt, later);
    expect(remaining).toBe(90);
    expect(reset.adjustmentSeconds).toBe(0);
    expect(reset.status).toBe("running");
  });
});

describe("skipTimer", () => {
  it("marks timer as finished", () => {
    const timer = makeTimer();
    const skipped = skipTimer(timer);
    expect(skipped.status).toBe("finished");
  });
});

describe("formatTimerDisplay", () => {
  it("formats 90s as 01:30", () => expect(formatTimerDisplay(90)).toBe("01:30"));
  it("formats 0s as 00:00", () => expect(formatTimerDisplay(0)).toBe("00:00"));
  it("formats 65s as 01:05", () => expect(formatTimerDisplay(65)).toBe("01:05"));
  it("never shows negative", () =>
    expect(formatTimerDisplay(-10)).toBe("00:00"));
});
