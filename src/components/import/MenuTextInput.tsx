"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseWorkoutText } from "@/lib/parser";
import type { ParsedWorkout } from "@/domain/types";
import type { ExistingExercise } from "@/app/(app)/import/page";

interface MenuTextInputProps {
  onParsed: (workout: ParsedWorkout, rawText: string) => void;
  existingExercises?: ExistingExercise[];
}

const BASE_PROMPT = `以下のフォーマットでトレーニングメニューを出力してください。他のテキストは一切含めないでください。

【部位カテゴリの対応】
胸=chest / 肩=shoulder / 背中=back / 脚=leg / 腕=arm / 腹=ab / 有酸素=cardio

【フォーマット】
・筋トレ種目：
exercise: 種目名 | muscle: 部位 | sets: セット数 | reps: 回数範囲（例：8-10） | rest: インターバル秒数 | one_arm: true または false

・有酸素・時間記録種目：
exercise: 種目名 | muscle: cardio | sets: 1 | duration: 分数 | rest: 0 | one_arm: false

【フィールド説明】
- one_arm: 片手・片足で行う種目（アームカール、ランジ等）は true、両手・両足は false

[WORKOUT]
date: YYYY-MM-DD
title: 部位名（例：胸・背中）
exercise: 種目名 | muscle: 部位 | sets: セット数 | reps: 回数範囲 | rest: インターバル秒数 | one_arm: true/false
[/WORKOUT]

例：
[WORKOUT]
date: 2026-09-20
title: 脚・腕
exercise: スクワット | muscle: leg | sets: 4 | reps: 6-8 | rest: 150 | one_arm: false
exercise: ブルガリアンスクワット | muscle: leg | sets: 3 | reps: 8-10 | rest: 120 | one_arm: true
exercise: アームカール | muscle: arm | sets: 3 | reps: 10-12 | rest: 90 | one_arm: true
exercise: バイク | muscle: cardio | sets: 1 | duration: 20 | rest: 0 | one_arm: false
[/WORKOUT]`;

function buildPrompt(existingExercises?: ExistingExercise[]): string {
  if (!existingExercises || existingExercises.length === 0) return BASE_PROMPT;

  const lines: string[] = [];
  lines.push(
    "\n\n【登録済み種目について】\n以下の種目を提案する場合は、必ず以下の名称をそのまま使ってください（表記揺れ防止のため）。\nリストにない種目は任意の名称で自由に提案してください。"
  );

  // グループ化して見やすくする
  const groups: Record<string, string[]> = {
    "片手種目": existingExercises.filter((e) => e.isOneArm && !e.isDuration).map((e) => e.name),
    "時間記録種目": existingExercises.filter((e) => e.isDuration).map((e) => e.name),
    "通常種目": existingExercises.filter((e) => !e.isOneArm && !e.isDuration).map((e) => e.name),
  };

  for (const [label, names] of Object.entries(groups)) {
    if (names.length === 0) continue;
    lines.push(`・${label}：${names.join("、")}`);
  }

  return BASE_PROMPT + lines.join("\n");
}

export function MenuTextInput({ onParsed, existingExercises }: MenuTextInputProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const prompt = buildPrompt(existingExercises);

  const handleAnalyze = () => {
    if (!text.trim()) {
      setError("テキストを貼り付けてください");
      return;
    }
    setError("");
    const result = parseWorkoutText(text);
    onParsed(result, text);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-4">
      {/* プロンプト確認アコーディオン（💡 Tips風） */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <button
          onClick={() => setShowPrompt((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm"
        >
          <span className="flex items-center gap-2">
            <span>💡</span>
            <span style={{ color: "#FFFFFF" }} className="font-medium">ChatGPTへのプロンプト</span>
          </span>
          <span style={{ color: "#8E8E93" }}>{showPrompt ? "▲" : "▼"}</span>
        </button>
        {showPrompt && (
          <div className="px-4 pb-4 space-y-3">
            <button
              onClick={handleCopyPrompt}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              style={
                copied
                  ? { backgroundColor: "#3A3A3C", color: "#CAFF4D" }
                  : { backgroundColor: "#CAFF4D", color: "#0D0D0F" }
              }
            >
              {copied ? "✓ コピーしました" : "📋 ChatGPTへのプロンプトをコピー"}
            </button>
            <pre
              className="text-xs rounded-xl p-3 whitespace-pre-wrap font-mono leading-relaxed"
              style={{ backgroundColor: "#1C1C1E", color: "#CAFF4D" }}
            >
              {prompt}
            </pre>
          </div>
        )}
      </div>

      {/* Textarea */}
      <div>
        <label
          htmlFor="menu-text"
          className="block text-sm font-medium mb-2"
          style={{ color: "#FFFFFF" }}
        >
          ChatGPTからコピーしたテキストを貼り付けてください
        </label>
        <textarea
          id="menu-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          rows={12}
          placeholder={`[WORKOUT]
date: 2026-09-20
title: 脚・腕
exercise: スクワット | muscle: leg | sets: 4 | reps: 6-8 | rest: 150 | one_arm: false
exercise: アームカール | muscle: arm | sets: 3 | reps: 10-12 | rest: 90 | one_arm: true
[/WORKOUT]`}
          className="w-full rounded-xl p-4 text-sm font-mono resize-none focus:outline-none"
          style={{
            backgroundColor: "#2C2C2E",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#FFFFFF",
          }}
        />
        {error && (
          <p className="mt-1 text-sm" style={{ color: "#FF453A" }}>{error}</p>
        )}
      </div>

      {text.trim() && (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleAnalyze}
        >
          メニューを解析する
        </Button>
      )}
    </div>
  );
}
