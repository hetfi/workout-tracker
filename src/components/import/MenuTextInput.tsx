"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseWorkoutText } from "@/lib/parser";
import type { ParsedWorkout } from "@/domain/types";

interface MenuTextInputProps {
  onParsed: (workout: ParsedWorkout, rawText: string) => void;
}

const CHATGPT_PROMPT = `以下のフォーマットでトレーニングメニューを出力してください。他のテキストは一切含めないでください。

[WORKOUT]
date: YYYY-MM-DD
title: 部位名（例：胸・背中）
exercise: 種目名 | sets: セット数 | reps: 回数範囲（例：8-10） | rest: インターバル秒数
exercise: 種目名 | sets: セット数 | reps: 回数範囲 | rest: インターバル秒数
[/WORKOUT]

例：
[WORKOUT]
date: 2026-09-20
title: 胸・背中
exercise: ベンチプレス | sets: 4 | reps: 6-8 | rest: 150
exercise: インクラインダンベルプレス | sets: 3 | reps: 8-10 | rest: 120
exercise: ラットプルダウン | sets: 3 | reps: 10-12 | rest: 90
[/WORKOUT]`;

export function MenuTextInput({ onParsed }: MenuTextInputProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

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
      await navigator.clipboard.writeText(CHATGPT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-4">
      {/* Prompt copy section */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <button
          onClick={() => setShowPrompt((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm"
        >
          <span style={{ color: "#FFFFFF" }}>💡 ChatGPTへのプロンプトをコピー</span>
          <span style={{ color: "#8E8E93" }}>{showPrompt ? "▲" : "▼"}</span>
        </button>
        {showPrompt && (
          <div className="px-4 pb-4 space-y-3">
            <p className="text-xs" style={{ color: "#8E8E93" }}>
              ChatGPTに以下のプロンプトを送ると、取り込みに対応したフォーマットで出力されます
            </p>
            <pre
              className="text-xs rounded-xl p-3 whitespace-pre-wrap font-mono leading-relaxed"
              style={{ backgroundColor: "#1C1C1E", color: "#CAFF4D" }}
            >
              {CHATGPT_PROMPT}
            </pre>
            <button
              onClick={handleCopyPrompt}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={
                copied
                  ? { backgroundColor: "#3A3A3C", color: "#CAFF4D" }
                  : { backgroundColor: "#CAFF4D", color: "#0D0D0F" }
              }
            >
              {copied ? "✓ コピーしました" : "プロンプトをコピー"}
            </button>
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
title: 胸・背中
exercise: ベンチプレス | sets: 4 | reps: 6-8 | rest: 150 | note: 肩甲骨を寄せる
exercise: インクラインダンベルプレス | sets: 3 | reps: 8-10 | rest: 120
exercise: ラットプルダウン | sets: 3 | reps: 10-12 | rest: 90
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
