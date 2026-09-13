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
}

const CATEGORIES: MuscleCategory[] = [
  "chest",
  "shoulder",
  "arm",
  "back",
  "leg",
  "ab",
  "cardio",
];

export function ExerciseEditForm({
  exerciseId,
  currentCategory,
  isOneArm,
}: ExerciseEditFormProps) {
  const router = useRouter();
  const [category, setCategory] = useState<MuscleCategory>(currentCategory);
  const [oneArm, setOneArm] = useState(isOneArm);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      await saveExerciseMeta(exerciseId, category, oneArm);
      setSaved(true);
      setTimeout(() => router.push("/exercises"), 1000);
    });
  };

  return (
    <div className="space-y-5">
      {/* Category selection */}
      <Card>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          筋肉グループ
        </p>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`py-2 px-1 rounded-xl text-sm font-medium transition-colors border-2 ${
                category === cat
                  ? "border-transparent text-white"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800"
              }`}
              style={
                category === cat
                  ? {
                      backgroundColor: CATEGORY_COLORS[cat],
                      borderColor: CATEGORY_COLORS[cat],
                    }
                  : {}
              }
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </Card>

      {/* One arm toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              片手種目
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              左右それぞれ記録します
            </p>
          </div>
          <button
            onClick={() => setOneArm(!oneArm)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              oneArm ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                oneArm ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </Card>

      {saved ? (
        <p className="text-center text-green-600 font-medium">保存しました</p>
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
