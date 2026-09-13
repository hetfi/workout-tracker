"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseWorkoutText } from "@/lib/parser";
import type { ParsedWorkout } from "@/domain/types";

interface MenuTextInputProps {
  onParsed: (workout: ParsedWorkout, rawText: string) => void;
}

export function MenuTextInput({ onParsed }: MenuTextInputProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const handleAnalyze = () => {
    if (!text.trim()) {
      setError("テキストを貼り付けてください");
      return;
    }
    setError("");
    const result = parseWorkoutText(text);
    onParsed(result, text);
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="menu-text"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
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
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
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
