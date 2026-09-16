"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
  getPastExercises,
  addExercisesForDate,
  addExercisesToSession,
  registerNewExercise,
  ManualExercise,
} from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
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
  isDuration: boolean;
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
    { id: string; name: string; muscle_category: string | null; is_one_arm: boolean; is_duration: boolean }[]
  >([]);
  const [activeTab, setActiveTab] = useState<TabKey>("chest");
  const [selected, setSelected] = useState<SelectedExercise[]>([]);
  const [customName, setCustomName] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // 新規種目登録ポップアップ
  const [newExercisePending, setNewExercisePending] = useState<{ name: string; muscleCategory: MuscleCategory } | null>(null);
  const [newExerciseIsOneArm, setNewExerciseIsOneArm] = useState(false);
  const [newExerciseIsDuration, setNewExerciseIsDuration] = useState(false);
  const [newExerciseRestSeconds, setNewExerciseRestSeconds] = useState(90);

  const REST_OPTIONS = [0, 60, 90, 120, 180] as const;
  const formatRest = (s: number) => s === 0 ? "なし" : s < 60 ? `${s}秒` : s % 60 === 0 ? `${s / 60}分` : `${Math.floor(s / 60)}分${s % 60}秒`;

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
    (e.muscle_category as MuscleCategory) ?? "back";

  const filteredExercises = pastExercises.filter(
    (e) => effectiveCategory(e) === (activeTab as MuscleCategory)
  );

  const selectedNames = new Set(selected.map((e) => e.name));

  const addExercise = (name: string, isOneArm: boolean = false, cat?: MuscleCategory, isDuration: boolean = false) => {
    if (selectedNames.has(name)) return;
    const muscleCategory = cat ?? (activeTab as MuscleCategory);
    setSelected((prev) => [
      ...prev,
      { key: keyCounter++, name, sets: 3, repsMin: 8, repsMax: 12, isOneArm, isDuration, muscleCategory },
    ]);
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    // 既存種目リストにない場合はポップアップで種目属性を選択させる
    const existingInMaster = pastExercises.find((e) => e.name === name);
    if (existingInMaster) {
      addExercise(name, Boolean(existingInMaster.is_one_arm), activeTab as MuscleCategory, Boolean(existingInMaster.is_duration));
      setCustomName("");
      setShowCustomInput(false);
    } else {
      // 新規種目: ポップアップ表示
      setNewExercisePending({ name, muscleCategory: activeTab as MuscleCategory });
      setNewExerciseIsOneArm(false);
      setNewExerciseIsDuration(false);
      setNewExerciseRestSeconds(90);
    }
  };

  const confirmNewExercise = async () => {
    if (!newExercisePending) return;
    const { name, muscleCategory } = newExercisePending;
    const isOneArm = newExerciseIsOneArm;
    const isDuration = newExerciseIsDuration;
    const restSeconds = newExerciseRestSeconds;

    // ポップアップを即座に閉じて二重タップを防ぐ
    setNewExercisePending(null);
    setCustomName("");
    setShowCustomInput(false);

    const result = await registerNewExercise(name, muscleCategory, isOneArm, isDuration, restSeconds);
    if (result?.error) {
      setError(`種目マスターへの登録に失敗しました（${result.error}）。種目はセッションに追加されますが、次回以降の表示が正しくならない場合があります。`);
    } else {
      setPastExercises((prev) =>
        prev.some((e) => e.name === name)
          ? prev
          : [...prev, { id: crypto.randomUUID(), name, muscle_category: muscleCategory, is_one_arm: isOneArm, is_duration: isDuration }]
      );
    }
    // selectedNames はレンダリング時点の値で stale になるため、関数型更新で重複チェック
    setSelected((prev) => {
      if (prev.some((e) => e.name === name)) return prev;
      return [...prev, { key: keyCounter++, name, sets: 3, repsMin: 8, repsMax: 12, isOneArm, isDuration, muscleCategory }];
    });
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
      {/* 新規種目登録ポップアップ */}
      {newExercisePending && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setNewExercisePending(null); }}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-6 space-y-5"
            style={{ backgroundColor: "#1C1C2E", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "#8E8E93" }}>新規種目を追加</p>
              <p className="text-lg font-semibold text-white">{newExercisePending.name}</p>
              <p className="text-xs mt-0.5" style={{ color: CATEGORY_COLORS[newExercisePending.muscleCategory] }}>
                {CATEGORY_LABELS[newExercisePending.muscleCategory]}
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => setNewExerciseIsDuration((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ backgroundColor: newExerciseIsDuration ? "rgba(202,255,77,0.12)" : "#2C2C2E", border: `1px solid ${newExerciseIsDuration ? "rgba(202,255,77,0.4)" : "rgba(255,255,255,0.08)"}` }}
              >
                <span className="text-sm text-white">時間で記録（秒・分）</span>
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                  style={newExerciseIsDuration ? { backgroundColor: "#CAFF4D", color: "#0D0D0F" } : { border: "1.5px solid #48484A" }}
                >
                  {newExerciseIsDuration ? "✓" : ""}
                </span>
              </button>
              <button
                onClick={() => setNewExerciseIsOneArm((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ backgroundColor: newExerciseIsOneArm ? "rgba(202,255,77,0.12)" : "#2C2C2E", border: `1px solid ${newExerciseIsOneArm ? "rgba(202,255,77,0.4)" : "rgba(255,255,255,0.08)"}` }}
              >
                <span className="text-sm text-white">片側ずつ記録（左右別々）</span>
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                  style={newExerciseIsOneArm ? { backgroundColor: "#CAFF4D", color: "#0D0D0F" } : { border: "1.5px solid #48484A" }}
                >
                  {newExerciseIsOneArm ? "✓" : ""}
                </span>
              </button>

              {/* インターバル選択 */}
              <div>
                <p className="text-xs mb-2" style={{ color: "#8E8E93" }}>インターバル</p>
                <div className="flex gap-1.5 flex-wrap">
                  {REST_OPTIONS.map((s) => {
                    const isSelected = newExerciseRestSeconds === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setNewExerciseRestSeconds(s)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        style={
                          isSelected
                            ? { backgroundColor: "#CAFF4D", color: "#0D0D0F" }
                            : { backgroundColor: "#2C2C2E", color: "#8E8E93", border: "1px solid rgba(255,255,255,0.08)" }
                        }
                      >
                        {formatRest(s)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setNewExercisePending(null)}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "#3A3A3C", color: "#8E8E93" }}
              >
                キャンセル
              </button>
              <button
                onClick={confirmNewExercise}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: "#CAFF4D", color: "#0D0D0F" }}
              >
                追加して登録
              </button>
            </div>
          </div>
        </div>
      )}

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
                  onClick={() => addExercise(e.name, Boolean(e.is_one_arm), undefined, Boolean(e.is_duration))}
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
