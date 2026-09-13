import { describe, it, expect } from "vitest";
import {
  parseWorkoutText,
  parseRestSeconds,
  parseRepsTarget,
  parseExerciseLine,
  formatRestSeconds,
} from "./index";

// ============================================================
// parseRestSeconds
// ============================================================
describe("parseRestSeconds", () => {
  it("parses bare integer", () => expect(parseRestSeconds("90")).toBe(90));
  it("parses with 's' suffix", () => expect(parseRestSeconds("90s")).toBe(90));
  it("parses with 秒 suffix", () => expect(parseRestSeconds("90秒")).toBe(90));
  it("parses mm:ss format", () => expect(parseRestSeconds("1:30")).toBe(90));
  it("parses 分 only", () => expect(parseRestSeconds("2分")).toBe(120));
  it("parses 分秒 combination", () =>
    expect(parseRestSeconds("1分30秒")).toBe(90));
  it("parses 2分30秒", () => expect(parseRestSeconds("2分30秒")).toBe(150));
  it("handles full-width digits", () =>
    expect(parseRestSeconds("９０秒")).toBe(90));
  it("returns null for empty string", () =>
    expect(parseRestSeconds("")).toBeNull());
  it("returns null for 0", () => expect(parseRestSeconds("0")).toBeNull());
  it("returns null for invalid text", () =>
    expect(parseRestSeconds("abc")).toBeNull());
});

// ============================================================
// parseRepsTarget
// ============================================================
describe("parseRepsTarget", () => {
  it("parses single reps", () =>
    expect(parseRepsTarget("8")).toEqual({ min: 8, max: 8 }));
  it("parses range with dash", () =>
    expect(parseRepsTarget("6-8")).toEqual({ min: 6, max: 8 }));
  it("parses range with 〜", () =>
    expect(parseRepsTarget("8〜10")).toEqual({ min: 8, max: 10 }));
  it("handles full-width digits", () =>
    expect(parseRepsTarget("６-８")).toEqual({ min: 6, max: 8 }));
  it("returns null for invalid input", () =>
    expect(parseRepsTarget("abc")).toBeNull());
  it("returns null for zero", () => expect(parseRepsTarget("0")).toBeNull());
});

// ============================================================
// parseExerciseLine
// ============================================================
describe("parseExerciseLine", () => {
  it("parses a complete exercise line", () => {
    const result = parseExerciseLine(
      "exercise: ベンチプレス | sets: 4 | reps: 6-8 | rest: 150 | note: 肩甲骨を寄せる"
    );
    expect(result).not.toBeNull();
    expect(result!.name).toBe("ベンチプレス");
    expect(result!.sets).toBe(4);
    expect(result!.repsTarget).toEqual({ min: 6, max: 8 });
    expect(result!.restSeconds).toBe(150);
    expect(result!.notes).toBe("肩甲骨を寄せる");
  });

  it("parses without note", () => {
    const result = parseExerciseLine(
      "exercise: インクラインダンベルプレス | sets: 3 | reps: 8-10 | rest: 120"
    );
    expect(result).not.toBeNull();
    expect(result!.notes).toBeNull();
  });

  it("returns null for non-exercise line", () => {
    expect(parseExerciseLine("date: 2026-09-20")).toBeNull();
    expect(parseExerciseLine("title: 胸・背中")).toBeNull();
    expect(parseExerciseLine("")).toBeNull();
  });

  it("uses default rest when rest is missing", () => {
    const result = parseExerciseLine("exercise: テスト | sets: 3 | reps: 10");
    expect(result).not.toBeNull();
    expect(result!.restSeconds).toBe(90);
  });

  it("uses default rest when rest is invalid", () => {
    const result = parseExerciseLine(
      "exercise: テスト | sets: 3 | reps: 10 | rest: abc"
    );
    expect(result).not.toBeNull();
    expect(result!.restSeconds).toBe(90);
  });
});

// ============================================================
// parseWorkoutText (full integration)
// ============================================================
describe("parseWorkoutText", () => {
  const standardInput = `[WORKOUT]
date: 2026-09-20
title: 胸・背中
exercise: ベンチプレス | sets: 4 | reps: 6-8 | rest: 150 | note: 肩甲骨を寄せる
exercise: インクラインダンベルプレス | sets: 3 | reps: 8-10 | rest: 120
exercise: ラットプルダウン | sets: 3 | reps: 10-12 | rest: 90 | note: 腕で引かない
[/WORKOUT]`;

  it("parses standard format correctly", () => {
    const result = parseWorkoutText(standardInput);
    expect(result.date).toBe("2026-09-20");
    expect(result.title).toBe("胸・背中");
    expect(result.exercises).toHaveLength(3);
    expect(result.warnings).toHaveLength(0);
  });

  it("parses first exercise correctly", () => {
    const result = parseWorkoutText(standardInput);
    const ex = result.exercises[0];
    expect(ex.name).toBe("ベンチプレス");
    expect(ex.sets).toBe(4);
    expect(ex.repsTarget).toEqual({ min: 6, max: 8 });
    expect(ex.restSeconds).toBe(150);
    expect(ex.notes).toBe("肩甲骨を寄せる");
  });

  it("handles CRLF line endings", () => {
    const crlf = standardInput.replace(/\n/g, "\r\n");
    const result = parseWorkoutText(crlf);
    expect(result.exercises).toHaveLength(3);
  });

  it("handles full-width digits", () => {
    const input = `[WORKOUT]
date: 2026-09-20
title: テスト
exercise: スクワット | sets: ４ | reps: ８-１０ | rest: １２０
[/WORKOUT]`;
    const result = parseWorkoutText(input);
    expect(result.exercises[0].sets).toBe(4);
    expect(result.exercises[0].repsTarget).toEqual({ min: 8, max: 10 });
    expect(result.exercises[0].restSeconds).toBe(120);
  });

  it("sets default rest (90s) when rest is missing", () => {
    const input = `[WORKOUT]
date: 2026-09-20
title: テスト
exercise: スクワット | sets: 3 | reps: 8
[/WORKOUT]`;
    const result = parseWorkoutText(input);
    expect(result.exercises[0].restSeconds).toBe(90);
    // Warning is issued
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("parses various rest formats", () => {
    const formats = [
      { raw: "rest: 90", expected: 90 },
      { raw: "rest: 90s", expected: 90 },
      { raw: "rest: 90秒", expected: 90 },
      { raw: "rest: 1:30", expected: 90 },
      { raw: "rest: 1分30秒", expected: 90 },
      { raw: "rest: 2分", expected: 120 },
      { raw: "rest: 2分30秒", expected: 150 },
    ];

    for (const { raw, expected } of formats) {
      const line = `exercise: テスト | sets: 3 | reps: 8 | ${raw}`;
      const result = parseExerciseLine(line);
      expect(result?.restSeconds, `Failed for: ${raw}`).toBe(expected);
    }
  });

  it("does not fail when an exercise line is invalid", () => {
    const input = `[WORKOUT]
date: 2026-09-20
title: テスト
exercise: 正常な種目 | sets: 3 | reps: 8 | rest: 60
これは解析できない行です
exercise: | sets: 3 | reps: 8
exercise: 別の種目 | sets: 2 | reps: 10 | rest: 90
[/WORKOUT]`;
    const result = parseWorkoutText(input);
    // Valid exercises should still be captured
    expect(result.exercises.length).toBeGreaterThanOrEqual(2);
    // Warnings should mention the bad line(s)
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("falls back to today when date is missing", () => {
    const input = `[WORKOUT]
title: テスト
exercise: スクワット | sets: 3 | reps: 8 | rest: 90
[/WORKOUT]`;
    const result = parseWorkoutText(input);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.warnings.some((w) => w.includes("日付"))).toBe(true);
  });

  it("parses single reps value", () => {
    const input = `[WORKOUT]
date: 2026-09-20
title: テスト
exercise: スクワット | sets: 3 | reps: 8 | rest: 90
[/WORKOUT]`;
    const result = parseWorkoutText(input);
    expect(result.exercises[0].repsTarget).toEqual({ min: 8, max: 8 });
  });
});

// ============================================================
// formatRestSeconds
// ============================================================
describe("formatRestSeconds", () => {
  it("formats seconds only", () => expect(formatRestSeconds(45)).toBe("45秒"));
  it("formats minutes only", () => expect(formatRestSeconds(120)).toBe("2分"));
  it("formats minutes and seconds", () =>
    expect(formatRestSeconds(150)).toBe("2分30秒"));
  it("handles zero", () => expect(formatRestSeconds(0)).toBe("0秒"));
});
