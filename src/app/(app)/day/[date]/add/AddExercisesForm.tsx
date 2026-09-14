"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
  getPastExercises,
  addExercisesForDate,
  addExercisesToSession,
  ManualExercise,
} from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  classifyExercise,
  MuscleCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from "@/lib/muscleCategory";

interface AddExercisesFormProps {
  date: string;
  sessionId?: string;   // 既存セッションに追加する場合
  backTo?: string;      // 「戻る」ボタンの遷移先
  saveTo?: string;      // 種目追加完了後の遷移先
  submitLabel?: string; // 送信ボタンのラベル
}

interface SelectedExercise extends ManualExercise {
  key: number;
  isOneArm: boolean;
  muscleCategory: MuscleCategory;
}

let keyCounter = 0;

const TABS = [
  { key: "chest",    label: "胸",    color: CATEGORY_COLORS.chest },
  { key: "shoulder", label: "肩",    color: CATEGORY_COLORS.shoulder },
  { key: "back",     label: "背",    color: CATEGORY_COLORS.back },
  { key: "leg",      label: "脚",    color: CATEGORY_COLORS.leg },
  { key: "arm",      label: "腕",    color: CATEGORY_COLORS.arm },
  { key: "ab",       label: "腹",    color: CATEGORY_COLORS.ab },
  { key: "cardio",   label: "有酸素", color: CATEGORY_COLORS.cardio },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AddExercisesForm({ date, sessionId, backTo, saveTo, submitLabel }: AddExercisesFormProps) {
  const [pastExercises, setPastExercises] = useState<
    { id: string; name: string; muscle_category: string | null; is_one_arm: boolean }[]
  >([]);
  const [activeTab, setActiveTab] = useState<TabKey>("chest");
  const [selected, setSelected] = useState<SelectedExercise[]>([]);
  const [customName, setCustomName] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPastExercises().then(setPastExercises);
  }, []);

  // タブ切替時は新規入力を閉じる
  useEffect(() => {
    setShowCustomInput(false);
    setCustomName("");
  }, [activeTab]);

  useEffect(() => {
    if (showCustomInput) {
      setTimeout(() => customInputRef.current?.focus(), 50);
    }
  }, [showCustomInput]);

  const effectiveCategory = (e: { name: string; muscle_category: string | null }) =>
    (e.muscle_category as MuscleCategory) ?? classifyExercise(e.name);

  const filteredExercises = pastExercises.filter(
    (e) => effectiveCategory(e) === (activeTab as MuscleCategory)
  );

  const selectedNames = new Set(selected.map((e) => e.name));

  const addExercise = (name: string, isOneArm: boolean = false, cat?: MuscleCategory) => {
    if (selectedNames.has(name)) return;
    const muscleCategory = cat ?? (activeTab as MuscleCategory);
    setSelected((prev) => [
      ...prev,
      { key: keyCounter++, name, sets: 3, repsMin: 8, repsMax: 12, isOneArm, muscleCategory },
    ]);
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    addExercise(name, false, activeTab as MuscleCategory);
    setCustomName("");
    setShowCustomInput(false);
  };

  const remove = (key: number) => {
    setSelected((prev) => prev.filter((e) => e.key !== key));
  };

  const handleSubmit = () => {
    if (selected.length === 0) {
      setError("種目を1つ以上追加してください");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (sessionId) {
          await addExercisesToSession(sessionId, selected, saveTo);
        } else {
          await addExercisesForDate(date, selected, saveTo);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  };

  const activeTabColor = TABS.find((t) => t.key === activeTab)?.color ?? "#8E8E93";

  return (
    <div className="space-y-5">
      {/* Category tabs */}
      <div className="grid grid-cols-4 gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className="py-2 px-1 rounded-xl text-sm font-medium transition-colors border flex flex-col items-center gap-1"
              style={
                isActive
                  ? { backgroundColor: tab.color, borderColor: tab.color, color: tab.key === "arm" || tab.key === "cardio" ? "#000" : "#fff" }
                  : { backgroundColor: "#3A3A3C", borderColor: "rgba(255,255,255,0.08)", color: "#fff" }
              }
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isActive ? "rgba(0,0,0,0.3)" : tab.color }}
              />
              {tab.label}
            </button>
          );
        })}
        {/* spacer to fill 4th slot in last row */}
        <div />
      </div>

      {/* Exercise list for active category */}
      <div className="space-y-3">
        {filteredExercises.length === 0 && !showCustomInput && (
          <p className="text-sm text-[#8E8E93]">この部位の種目はまだありません</p>
        )}

        {filteredExercises.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filteredExercises.map((e) => {
              const isSelected = selectedNames.has(e.name);
              return (
                <button
                  key={e.id}
                  onClick={() => addExercise(e.name, Boolean(e.is_one_arm))}
                  disabled={isSelected}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors"
                  style={
                    isSelected
                      ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#8E8E93", borderColor: "rgba(255,255,255,0.08)", cursor: "default" }
                      : { backgroundColor: "#3A3A3C", borderColor: "rgba(255,255,255,0.08)", color: "#fff" }
                  }
                >
                  <span>{isSelected ? "✓" : "＋"}</span>
                  <span>{e.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 新規種目追加 */}
        {showCustomInput ? (
          <div className="flex gap-2 items-center">
            <input
              ref={customInputRef}
              type="text"
              placeholder={`${CATEGORY_LABELS[activeTab as MuscleCategory]}の新規種目名...`}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCustom(); if (e.key === "Escape") { setShowCustomInput(false); setCustomName(""); } }}
              className="flex-1 rounded-xl px-3 py-2 text-sm text-white outline-none border"
              style={{ backgroundColor: "#2C2C2E", borderColor: "rgba(255,255,255,0.12)" }}
            />
            <button
              onClick={addCustom}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: activeTabColor, color: activeTab === "arm" || activeTab === "cardio" ? "#000" : "#fff" }}
            >
              追加
            </button>
            <button
              onClick={() => { setShowCustomInput(false); setCustomName(""); }}
              className="px-3 py-2 rounded-xl text-sm"
              style={{ backgroundColor: "#3A3A3C", color: "#8E8E93" }}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            className="text-sm font-medium flex items-center gap-1"
            style={{ color: activeTabColor }}
          >
            <span className="text-lg leading-none">＋</span> 新規種目を追加
          </button>
        )}
      </div>

      {/* Selected exercises */}
      {selected.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ color: "#8E8E93" }}>
            追加した種目（{selected.length}件）
          </p>
          {selected.map((ex) => (
            <Card key={ex.key}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* 部位ラベル */}
                  <span
                    className="text-xs font-semibold block mb-0.5"
                    style={{ color: CATEGORY_COLORS[ex.muscleCategory] }}
                  >
                    {CATEGORY_LABELS[ex.muscleCategory]}
                  </span>
                  <p className="font-medium text-white truncate">{ex.name}</p>
                </div>
                <button
                  onClick={() => remove(ex.key)}
                  className="shrink-0 p-2 rounded-full"
                  style={{ color: "#8E8E93" }}
                  aria-label="削除"
                >
                  ✕
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#FF453A" }}>{error}</p>}

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
          {submitLabel ?? (sessionId ? "種目を追加する" : "トレーニングを開始")}
        </Button>
      </div>
    </div>
  );
}
