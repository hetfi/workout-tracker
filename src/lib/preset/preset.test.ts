import { describe, it, expect } from "vitest";
import {
  buildExercisePreset,
  clampWeight,
  clampReps,
  applyToRemainingSets,
} from "./index";
import type { PreviousExerciseData } from "./index";

const baseExercise = {
  exerciseId: "ex1",
  exerciseName: "ベンチプレス",
  plannedSets: 4,
  plannedRepsTarget: { min: 6, max: 8 },
};

function makePrevSets(
  ...vals: { setNumber: number; weight: number; reps: number }[]
): PreviousExerciseData["sets"] {
  return vals.map((v) => ({ ...v, status: "completed" as const }));
}

describe("buildExercisePreset", () => {
  it("uses default values when no previous session", () => {
    const preset = buildExercisePreset(baseExercise, null);
    expect(preset.source).toBe("default");
    expect(preset.sets).toHaveLength(4);
    preset.sets.forEach((s) => {
      expect(s.weight).toBe(0);
      expect(s.reps).toBe(6); // repsTarget.min
    });
  });

  it("uses previous session data when available", () => {
    const prev: PreviousExerciseData = {
      exerciseId: "ex1",
      exerciseName: "ベンチプレス",
      sets: makePrevSets(
        { setNumber: 1, weight: 60, reps: 8 },
        { setNumber: 2, weight: 60, reps: 7 },
        { setNumber: 3, weight: 57.5, reps: 8 },
        { setNumber: 4, weight: 57.5, reps: 7 }
      ),
    };
    const preset = buildExercisePreset(baseExercise, prev);
    expect(preset.source).toBe("previous_session");
    expect(preset.sets[0]).toMatchObject({ setNumber: 1, weight: 60, reps: 8 });
    expect(preset.sets[1]).toMatchObject({ setNumber: 2, weight: 60, reps: 7 });
  });

  it("uses last previous set when today has more sets", () => {
    const prev: PreviousExerciseData = {
      exerciseId: "ex1",
      exerciseName: "ベンチプレス",
      sets: makePrevSets(
        { setNumber: 1, weight: 60, reps: 8 },
        { setNumber: 2, weight: 60, reps: 7 }
      ),
    };
    const exercise = { ...baseExercise, plannedSets: 4 };
    const preset = buildExercisePreset(exercise, prev);
    // Set 3 and 4 should use the last set (set 2)
    expect(preset.sets[2]).toMatchObject({ setNumber: 3, weight: 60, reps: 7 });
    expect(preset.sets[3]).toMatchObject({ setNumber: 4, weight: 60, reps: 7 });
  });

  it("excludes non-completed sets from previous session", () => {
    const prev: PreviousExerciseData = {
      exerciseId: "ex1",
      exerciseName: "ベンチプレス",
      sets: [
        { setNumber: 1, weight: 60, reps: 8, status: "completed" },
        { setNumber: 2, weight: 60, reps: 7, status: "skipped" }, // excluded
        { setNumber: 3, weight: 60, reps: 6, status: "pending" }, // excluded
      ],
    };
    const exercise = { ...baseExercise, plannedSets: 3 };
    const preset = buildExercisePreset(exercise, prev);
    // Only 1 completed set → all use that set's values
    expect(preset.sets[1]).toMatchObject({ weight: 60, reps: 8 });
    expect(preset.sets[2]).toMatchObject({ weight: 60, reps: 8 });
  });

  it("falls back to default when previous session has no completed sets", () => {
    const prev: PreviousExerciseData = {
      exerciseId: "ex1",
      exerciseName: "ベンチプレス",
      sets: [{ setNumber: 1, weight: 60, reps: 8, status: "skipped" }],
    };
    const preset = buildExercisePreset(baseExercise, prev);
    expect(preset.source).toBe("default");
  });

  it("sets default reps to repsTarget.min", () => {
    const preset = buildExercisePreset(
      { ...baseExercise, plannedRepsTarget: { min: 10, max: 12 } },
      null
    );
    expect(preset.sets[0].reps).toBe(10);
  });

  it("falls back to 10 reps when no repsTarget", () => {
    const preset = buildExercisePreset(
      { ...baseExercise, plannedRepsTarget: { min: 0, max: 0 } },
      null
    );
    expect(preset.sets[0].reps).toBe(10);
  });
});

describe("clampWeight", () => {
  it("does not go below 0", () => expect(clampWeight(-5)).toBe(0));
  it("returns 0 for 0", () => expect(clampWeight(0)).toBe(0));
  it("returns positive values", () => expect(clampWeight(60)).toBe(60));
});

describe("clampReps", () => {
  it("does not go below 0", () => expect(clampReps(-1)).toBe(0));
  it("rounds to integer", () => expect(clampReps(7.9)).toBe(8));
  it("accepts 0", () => expect(clampReps(0)).toBe(0));
});

describe("applyToRemainingSets", () => {
  const sets = [
    { setNumber: 1, status: "completed", weight: 60, reps: 8 },
    { setNumber: 2, status: "pending", weight: 60, reps: 8 },
    { setNumber: 3, status: "pending", weight: 60, reps: 8 },
    { setNumber: 4, status: "pending", weight: 60, reps: 8 },
  ];

  it("applies weight and reps to pending sets after the current set", () => {
    const result = applyToRemainingSets(sets, 1, 65, 7);
    expect(result[0]).toMatchObject({ weight: 60, reps: 8 }); // set 1 completed – unchanged
    expect(result[1]).toMatchObject({ weight: 65, reps: 7 }); // set 2 pending – changed
    expect(result[2]).toMatchObject({ weight: 65, reps: 7 }); // set 3 pending – changed
    expect(result[3]).toMatchObject({ weight: 65, reps: 7 }); // set 4 pending – changed
  });

  it("does not modify completed sets", () => {
    const withCompleted = [
      { setNumber: 1, status: "completed", weight: 60, reps: 8 },
      { setNumber: 2, status: "completed", weight: 60, reps: 7 },
      { setNumber: 3, status: "pending", weight: 60, reps: 8 },
    ];
    const result = applyToRemainingSets(withCompleted, 1, 65, 7);
    expect(result[1]).toMatchObject({ weight: 60, reps: 7 }); // completed – not changed
    expect(result[2]).toMatchObject({ weight: 65, reps: 7 }); // pending – changed
  });
});
