"use client";

import { useState, useEffect, useTransition } from "react";
import { getPastExercises, addManualSession, ManualExercise } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  classifyExercise,
  MuscleCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from "@/lib/muscleCategory";

interface AddExercisesFormProps {
  date: string;
}

interface SelectedExercise extends ManualExercise {
  key: number;
}

let keyCounter = 0;

const TABS = [
  { key: "all", label: "全て", color: null },
  { key: "chest", label: "胸", color: CATEGORY_COLORS.chest },
  { key: "shoulder", label: "肩", color: CATEGORY_COLORS.shoulder },
  { key: "arm", label: "腕", color: CATEGORY_COLORS.arm },
  { key: "back", label: "背", color: CATEGORY_COLORS.back },
  { key: "leg", label: "脚", color: CATEGORY_COLORS.leg },
  { key: "ab", label: "腹", color: CATEGORY_COLORS.ab },
  { key: "cardio", label: "有酸素", color: CATEGORY_COLORS.cardio },
  { key: "custom", label: "＋新規", color: null },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AddExercisesForm({ date }: AddExercisesFormProps) {
  const [pastExercises, setPastExercises] = useState<{ id: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [selected, setSelected] = useState<SelectedExercise[]>([]);
  const [customName, setCustomName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPastExercises().then(setPastExercises);
  }, []);

  const filteredExercises = (() => {
    if (activeTab === "all" || activeTab === "custom") return pastExercises;
    return pastExercises.filter(
      (e) => classifyExercise(e.name) === (activeTab as MuscleCategory)
    );
  })();

  const selectedNames = new Set(selected.map((e) => e.name));

  const addExercise = (name: string) => {
    if (selectedNames.has(name)) return;
    setSelected((prev) => [
      ...prev,
      { key: keyCounter++, name, sets: 3, repsMin: 8, repsMax: 12 },
    ]);
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    addExercise(name);
    setCustomName("");
  };

  const remove = (key: number) => {
    setSelected((prev) => prev.filter((e) => e.key !== key));
  };

  const updateField = (key: number, field: keyof ManualExercise, value: number | string) => {
    setSelected((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: value } : e))
    );
  };

  const handleSubmit = () => {
    if (selected.length === 0) {
      setError("種目を1つ以上追加してください");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addManualSession(date, selected);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Category tabs */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-2 flex-nowrap pb-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                {tab.color && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tab.color }}
                  />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom input or exercise pills */}
      {activeTab === "custom" ? (
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="種目名を入力..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustom();
              }}
              autoFocus
            />
          </div>
          <Button variant="primary" size="sm" onClick={addCustom}>
            追加
          </Button>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {filteredExercises.length === 0
              ? "この部位の種目はまだありません"
              : `${filteredExercises.length}件`}
          </p>
          <div className="flex flex-wrap gap-2">
            {filteredExercises.map((e) => {
              const isSelected = selectedNames.has(e.name);
              return (
                <button
                  key={e.id}
                  onClick={() => addExercise(e.name)}
                  disabled={isSelected}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    isSelected
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-default"
                      : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600 active:bg-blue-50"
                  }`}
                >
                  <span>{isSelected ? "✓" : "＋"}</span>
                  <span>{e.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected exercises */}
      {selected.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            追加した種目（{selected.length}件）
          </p>
          {selected.map((ex) => (
            <Card key={ex.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900 dark:text-gray-100 flex-1 truncate">
                  {ex.name}
                </p>
                <button
                  onClick={() => remove(ex.key)}
                  className="text-gray-400 hover:text-red-500 ml-2 p-1"
                  aria-label="削除"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">セット数</span>
                  <input
                    type="number"
                    value={ex.sets}
                    min={1}
                    onChange={(e) =>
                      updateField(ex.key, "sets", parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">最小回数</span>
                  <input
                    type="number"
                    value={ex.repsMin}
                    min={1}
                    onChange={(e) =>
                      updateField(ex.key, "repsMin", parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">最大回数</span>
                  <input
                    type="number"
                    value={ex.repsMax}
                    min={1}
                    onChange={(e) =>
                      updateField(ex.key, "repsMax", parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 px-1">{error}</p>
      )}

      {/* Submit */}
      <div className="pt-2 pb-safe-bottom">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={selected.length === 0 || isPending}
          loading={isPending}
          className="w-full"
        >
          トレーニングを開始
        </Button>
      </div>
    </div>
  );
}
