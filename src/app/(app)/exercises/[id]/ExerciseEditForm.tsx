"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CATEGORY_COLORS, CATEGORY_LABELS, type MuscleCategory } from "@/lib/muscleCategory";
import { saveExerciseMeta } from "./actions";

interface ExerciseEditFormProps {
  exerciseId: string;
  currentCategory: MuscleCategory;
  isOneArm: boolean;
  defaultRestSeconds: number;
}

const REST_PRESETS = [
  { label: "30秒", value: 30 },
  { label: "1分", value: 60 },
  { label: "1分30秒", value: 90 },
  { label: "2分", value: 120 },
  { label: "3分", value: 180 },
] as const;

const CATEGORIES: MuscleCategory[] = [
  "chest",
  "shoulder",
  "back",
  "leg",
  "arm",
  "ab",
  "cardio",
];

export function ExerciseEditForm({
  exerciseId,
  currentCategory,
  isOneArm,
  defaultRestSeconds,
}: ExerciseEditFormProps) {
  const router = useRouter();
  const [category, setCategory] = useState<MuscleCategory>(currentCategory);
  const [oneArm, setOneArm] = useState(isOneArm);
  const [restSeconds, setRestSeconds] = useState(defaultRestSeconds);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      await saveExerciseMeta(exerciseId, category, oneArm, restSeconds);
      setSaved(true);
      setTimeout(() => router.push("/exercises"), 1000);
    });
  };

  return (
    <div className="space-y-5">
      {/* Category selection */}
      <Card>
        <p className="text-sm font-medium text-white mb-3">筋肉グループ</p>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="py-2 px-1 rounded-xl text-sm font-medium transition-colors border flex flex-col items-center gap-1"
              style={
                category === cat
                  ? {
                      backgroundColor: CATEGORY_COLORS[cat],
                      borderColor: CATEGORY_COLORS[cat],
                      color: cat === "arm" || cat === "cardio" ? "#000" : "#fff",
                    }
                  : {
                      backgroundColor: "#3A3A3C",
                      borderColor: "rgba(255,255,255,0.08)",
                      color: "#fff",
                    }
              }
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    category === cat ? "rgba(0,0,0,0.3)" : CATEGORY_COLORS[cat],
                }}
              />
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
          {/* 空セルで 2×4 グリッドを埋める */}
          <div />
        </div>
      </Card>

      {/* One arm toggle */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-white">片手種目</p>
            <p className="text-xs text-[#8E8E93] mt-0.5">左右それぞれ記録します</p>
          </div>
          <button
            onClick={() => setOneArm(!oneArm)}
            aria-pressed={oneArm}
            className="relative shrink-0 w-12 h-7 rounded-full overflow-hidden"
            style={{
              backgroundColor: oneArm ? "#ffffff" : "#3A3A3C",
              transition: "background-color 0.15s",
            }}
          >
            <span
              className="absolute top-1 w-5 h-5 rounded-full shadow"
              style={{
                backgroundColor: oneArm ? "#1C1C1E" : "#8E8E93",
                left: oneArm ? "24px" : "4px",
                transition: "left 0.15s ease-in-out, background-color 0.15s",
              }}
            />
          </button>
        </div>
      </Card>

      {/* Default rest interval */}
      <Card>
        <p className="text-sm font-medium text-white mb-3">デフォルトインターバル</p>
        <p className="text-xs mb-3" style={{ color: "#8E8E93" }}>
          セット完了後のインターバルタイマーの初期値
        </p>
        <div className="flex flex-wrap gap-2">
          {REST_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setRestSeconds(preset.value)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={
                restSeconds === preset.value
                  ? { backgroundColor: "#CAFF4D", color: "#0D0D0F" }
                  : { backgroundColor: "#3A3A3C", color: "#FFFFFF" }
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Card>

      {saved ? (
        <p className="text-center text-[#CAFF4D] font-medium">✓ 保存しました</p>
      ) : (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSave}
          loading={isPending}
        >
          保存する
        </Button>
      )}
    </div>
  );
}
