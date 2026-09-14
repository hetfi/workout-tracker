/**
 * Preset logic – computes initial weight/reps for each set
 * from the previous completed session.
 *
 * Rules:
 * - Use only "completed" workout sessions (not in_progress / abandoned).
 * - Match by exerciseId (or exerciseName if no ID).
 * - Today's set N → previous set N's weight/reps.
 * - If today has more sets than last time → use last set's values.
 * - If no history → weight=0, reps=repsTarget.min (or 10).
 */

import type {
  WorkoutSet,
  WorkoutSessionExercise,
  RepsTarget,
  ExercisePreset,
  PreviousSetRecord,
} from "@/domain/types";

export interface PreviousExerciseData {
  exerciseId: string | null;
  exerciseName: string;
  sets: Pick<WorkoutSet, "setNumber" | "weight" | "reps" | "status">[];
}

/**
 * Build preset values for each set of an exercise.
 *
 * @param plannedSets    Number of sets in today's plan
 * @param repsTarget     Planned reps target
 * @param previous       Previous session data for this exercise (if any)
 */
export function buildExercisePreset(
  exercise: Pick<
    WorkoutSessionExercise,
    "exerciseId" | "exerciseName" | "plannedSets" | "plannedRepsTarget"
  >,
  previous: PreviousExerciseData | null
): ExercisePreset {
  const { exerciseId, exerciseName, plannedSets, plannedRepsTarget } = exercise;

  if (!previous) {
    // No history: use defaults
    return {
      exerciseId,
      exerciseName,
      sets: buildDefaultSets(plannedSets, plannedRepsTarget),
      source: "default",
    };
  }

  // Use only completed sets from the previous session
  const completedSets = previous.sets
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.setNumber - b.setNumber);

  if (completedSets.length === 0) {
    return {
      exerciseId,
      exerciseName,
      sets: buildDefaultSets(plannedSets, plannedRepsTarget),
      source: "default",
    };
  }

  const presetSets: PreviousSetRecord[] = [];

  for (let i = 1; i <= plannedSets; i++) {
    const prevSet = completedSets.find((s) => s.setNumber === i);
    if (prevSet) {
      presetSets.push({
        setNumber: i,
        weight: prevSet.weight,
        reps: prevSet.reps,
      });
    } else {
      // Today has more sets than last time → use last completed set
      const lastSet = completedSets[completedSets.length - 1];
      presetSets.push({
        setNumber: i,
        weight: lastSet.weight,
        reps: lastSet.reps,
      });
    }
  }

  return {
    exerciseId,
    exerciseName,
    sets: presetSets,
    source: "previous_session",
  };
}

function buildDefaultSets(
  plannedSets: number,
  repsTarget: RepsTarget
): PreviousSetRecord[] {
  const defaultReps = repsTarget.max > 0 ? (repsTarget.min > 0 ? repsTarget.min : 10) : 0;
  return Array.from({ length: plannedSets }, (_, i) => ({
    setNumber: i + 1,
    weight: 0,
    reps: defaultReps,
  }));
}

/**
 * Clamp weight to be >= 0 (kg).
 * Clamp reps to be >= 0 and an integer.
 */
export function clampWeight(weight: number): number {
  return Math.max(0, weight);
}

export function clampReps(reps: number): number {
  return Math.max(0, Math.round(reps));
}

/**
 * Apply an increment to a weight, respecting the step size.
 */
export function adjustWeight(
  current: number,
  delta: number
): number {
  return clampWeight(current + delta);
}

/**
 * Apply a step to reps (±1 or ±5).
 */
export function adjustReps(current: number, delta: number): number {
  return clampReps(current + delta);
}

/**
 * Apply current weight/reps to all remaining (pending) sets
 * in the same exercise. Does not modify completed sets.
 */
export function applyToRemainingSets<
  T extends { setNumber: number; status: string; weight: number; reps: number }
>(
  sets: T[],
  fromSetNumber: number,
  weight: number,
  reps: number
): T[] {
  return sets.map((s) => {
    if (s.setNumber > fromSetNumber && s.status === "pending") {
      return { ...s, weight, reps };
    }
    return s;
  });
}
