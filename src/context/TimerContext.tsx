"use client";

import { createContext, useContext, useState } from "react";
import type { TimerState } from "@/lib/timer";

interface TimerContextValue {
  timerState: TimerState | null;
  setTimerState: (state: TimerState | null) => void;
  exerciseName: string;
  setExerciseName: (name: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  vibrationEnabled: boolean;
  setVibrationEnabled: (v: boolean) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  return (
    <TimerContext.Provider
      value={{
        timerState,
        setTimerState,
        exerciseName,
        setExerciseName,
        soundEnabled,
        setSoundEnabled,
        vibrationEnabled,
        setVibrationEnabled,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimerContext must be used within TimerProvider");
  return ctx;
}
