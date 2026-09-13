import { describe, it, expect } from "vitest";
import { generateChatGPTText } from "./index";
import type { ExportSession } from "./index";

const baseSession: ExportSession = {
  session: {
    date: "2026-09-20",
    title: "胸・背中",
    startedAt: "2026-09-20T01:00:00.000Z",
    completedAt: "2026-09-20T02:02:00.000Z",
    bodyCondition: 4,
    fatigueLevel: 3,
    pain: null,
    notes: null,
  },
  exercises: [
    {
      exercise: {
        exerciseName: "ベンチプレス",
        plannedSets: 4,
        plannedRepsTarget: { min: 6, max: 8 },
        restSeconds: 150,
        skipped: false,
        notes: "左側が先に限界。痛みなし。",
      },
      sets: [
        { setNumber: 1, weight: 60, reps: 8, status: "completed", notes: null, side: null },
        { setNumber: 2, weight: 60, reps: 8, status: "completed", notes: null, side: null },
        { setNumber: 3, weight: 60, reps: 7, status: "completed", notes: null, side: null },
        {
          setNumber: 4,
          weight: 57.5,
          reps: 8,
          status: "completed",
          notes: null,
          side: null,
        },
      ],
    },
    {
      exercise: {
        exerciseName: "ラットプルダウン",
        plannedSets: 3,
        plannedRepsTarget: { min: 10, max: 12 },
        restSeconds: 90,
        skipped: false,
        notes: null,
      },
      sets: [
        {
          setNumber: 1,
          weight: 45,
          reps: 12,
          status: "completed",
          notes: null,
          side: null,
        },
        {
          setNumber: 2,
          weight: 45,
          reps: 10,
          status: "completed",
          notes: null,
          side: null,
        },
        {
          setNumber: 3,
          weight: 40,
          reps: 11,
          status: "completed",
          notes: null,
          side: null,
        },
      ],
    },
  ],
};

describe("generateChatGPTText", () => {
  it("generates a correctly formatted text", () => {
    const text = generateChatGPTText(baseSession);
    expect(text).toContain("[トレーニング記録]");
    expect(text).toContain("[/トレーニング記録]");
    expect(text).toContain("日付：2026年9月20日");
    expect(text).toContain("タイトル：胸・背中");
    expect(text).toContain("体調：4/5");
    expect(text).toContain("疲労度：3/5");
  });

  it("includes exercise name and targets", () => {
    const text = generateChatGPTText(baseSession);
    expect(text).toContain("■ ベンチプレス");
    expect(text).toContain("目標：4セット・6〜8回");
    expect(text).toContain("インターバル：2分30秒");
  });

  it("includes completed set details", () => {
    const text = generateChatGPTText(baseSession);
    expect(text).toContain("1セット目：60kg × 8回");
    expect(text).toContain("4セット目：57.5kg × 8回");
  });

  it("includes exercise notes", () => {
    const text = generateChatGPTText(baseSession);
    expect(text).toContain("メモ：左側が先に限界。痛みなし。");
  });

  it("shows skipped exercises", () => {
    const withSkipped: ExportSession = {
      ...baseSession,
      exercises: [
        {
          exercise: {
            exerciseName: "スキップ種目",
            plannedSets: 3,
            plannedRepsTarget: { min: 8, max: 10 },
            restSeconds: 90,
            skipped: true,
            notes: null,
          },
          sets: [],
        },
      ],
    };
    const text = generateChatGPTText(withSkipped);
    expect(text).toContain("■ スキップ種目（スキップ）");
  });

  it("shows skipped sets", () => {
    const withSkippedSet: ExportSession = {
      ...baseSession,
      exercises: [
        {
          exercise: {
            exerciseName: "スクワット",
            plannedSets: 3,
            plannedRepsTarget: { min: 8, max: 10 },
            restSeconds: 120,
            skipped: false,
            notes: null,
          },
          sets: [
            { setNumber: 1, weight: 80, reps: 10, status: "completed", notes: null, side: null },
            { setNumber: 2, weight: 80, reps: 9, status: "skipped", notes: null, side: null },
          ],
        },
      ],
    };
    const text = generateChatGPTText(withSkippedSet);
    expect(text).toContain("2セット目：実施せず");
  });

  it("shows duration in minutes", () => {
    const text = generateChatGPTText(baseSession);
    expect(text).toContain("運動時間：62分");
  });

  it("does not include pain/notes section when empty", () => {
    const text = generateChatGPTText(baseSession);
    expect(text).not.toContain("痛み・違和感：");
    expect(text).not.toContain("全体メモ：");
  });

  it("includes pain and notes when present", () => {
    const withNotes: ExportSession = {
      ...baseSession,
      session: {
        ...baseSession.session,
        pain: "左肘の痛み：1/10",
        notes: "ベンチプレスは前回より軽く感じた。",
      },
    };
    const text = generateChatGPTText(withNotes);
    expect(text).toContain("痛み・違和感：左肘の痛み：1/10");
    expect(text).toContain("全体メモ：");
  });

  it("shows side label for one-arm sets", () => {
    const withSide: ExportSession = {
      ...baseSession,
      exercises: [
        {
          exercise: {
            exerciseName: "ダンベルカール",
            plannedSets: 3,
            plannedRepsTarget: { min: 10, max: 12 },
            restSeconds: 60,
            skipped: false,
            notes: null,
          },
          sets: [
            { setNumber: 1, weight: 15, reps: 12, status: "completed", notes: null, side: "L" },
            { setNumber: 1, weight: 15, reps: 12, status: "completed", notes: null, side: "R" },
          ],
        },
      ],
    };
    const text = generateChatGPTText(withSide);
    expect(text).toContain("1セット目 (L)：15kg × 12回");
    expect(text).toContain("1セット目 (R)：15kg × 12回");
  });
});
