"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CATEGORY_COLORS, CATEGORY_LABELS, type MuscleCategory } from "@/lib/muscleCategory";
import { saveExerciseMeta } from "./actions";
import { renameExercise, deleteExercise } from "../actions";

interface ExerciseEditFormProps {
  exerciseId: string;
  exerciseName: string;
  currentCategory: MuscleCategory;
  isOneArm: boolean;
  defaultRestSeconds: number;
  isDuration: boolean;
}

const REST_PRESETS = [
  { label: "1分", value: 60 },
  { label: "1分30秒", value: 90 },
  { label: "2分", value: 120 },
  { label: "3分", value: 180 },
] as const;

const CATEGORIES: MuscleCategory[] = [
  "chest", "shoulder", "back", "leg", "arm", "ab", "cardio",
];

/** 秒数を "X分Y秒" / "X秒" 形式に変換 */
function formatSeconds(s: number): string {
  if (s <= 0) return "0秒";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}秒`;
  if (sec === 0) return `${m}分`;
  return `${m}分${sec}秒`;
}

export function ExerciseEditForm({
  exerciseId,
  exerciseName,
  currentCategory,
  isOneArm,
  defaultRestSeconds,
  isDuration,
}: ExerciseEditFormProps) {
  const router = useRouter();
  const [category, setCategory] = useState<MuscleCategory>(currentCategory);
  const [oneArm, setOneArm] = useState(isOneArm);
  const [duration, setDuration] = useState(isDuration);
  const [restSeconds, setRestSeconds] = useState(defaultRestSeconds);
  const [restInput, setRestInput] = useState(String(defaultRestSeconds));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  // 名称変更
  const [showRename, setShowRename] = useState(false);
  const [nameInput, setNameInput] = useState(exerciseName);
  const [isRenamePending, startRenameTransition] = useTransition();
  const [renameError, setRenameError] = useState("");

  // 削除確認ダイアログ
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletePending, startDeleteTransition] = useTransition();

  const handleRestInputChange = (v: string) => {
    setRestInput(v);
    const n = parseInt(v, 10);
    if (!isNaN(n) && n > 0) setRestSeconds(n);
  };

  const handlePresetClick = (value: number) => {
    setRestSeconds(value);
    setRestInput(String(value));
  };

  const handleSave = () => {
    startTransition(async () => {
      await saveExerciseMeta(exerciseId, category, oneArm, restSeconds, duration);
      setSaved(true);
      setTimeout(() => router.push("/exercises"), 1000);
    });
  };

  const handleRename = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setRenameError("種目名を入力してください"); return; }
    if (trimmed === exerciseName) { setShowRename(false); return; }
    startRenameTransition(async () => {
      await renameExercise(exerciseId, trimmed);
      setShowRename(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startDeleteTransition(async () => {
      await deleteExercise(exerciseId);
      router.push("/exercises");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {/* 名称変更 */}
      {showRename ? (
        <Card>
          <p className="text-sm font-medium text-white mb-3">種目名を変更</p>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => { setNameInput(e.target.value); setRenameError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setShowRename(false); }}
            autoFocus
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none border mb-3"
            style={{ backgroundColor: "#2C2C2E", borderColor: "rgba(255,255,255,0.12)" }}
          />
          {renameError && <p className="text-xs mb-2" style={{ color: "#FF453A" }}>{renameError}</p>}
          <p className="text-xs mb-3" style={{ color: "#8E8E93" }}>
            ※ 過去の記録の種目名は変わりません
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRename}
              disabled={isRenamePending}
              className="flex-1 py-2 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: "#CAFF4D", color: "#0D0D0F", opacity: isRenamePending ? 0.6 : 1 }}
            >
              変更する
            </button>
            <button
              onClick={() => { setShowRename(false); setNameInput(exerciseName); setRenameError(""); }}
              className="px-4 py-2 rounded-xl text-sm"
              style={{ backgroundColor: "#3A3A3C", color: "#8E8E93" }}
            >
              取消
            </button>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setShowRename(true)}
          className="w-full text-left rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="text-sm text-white">種目名を変更する</span>
          <span style={{ color: "#8E8E93" }}>›</span>
        </button>
      )}

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
          <div />
        </div>
      </Card>

      {/* One arm toggle */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-white">片側種目</p>
            <p className="text-xs text-[#8E8E93] mt-0.5">左右それぞれ記録します</p>
          </div>
          <button
            onClick={() => setOneArm(!oneArm)}
            aria-pressed={oneArm}
            className="relative shrink-0 w-12 h-7 rounded-full overflow-hidden"
            style={{ backgroundColor: oneArm ? "#ffffff" : "#3A3A3C", transition: "background-color 0.15s" }}
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

      {/* Duration mode toggle */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-white">時間で記録</p>
            <p className="text-xs text-[#8E8E93] mt-0.5">重量・回数ではなく、分数で記録します（有酸素など）</p>
          </div>
          <button
            onClick={() => setDuration(!duration)}
            aria-pressed={duration}
            className="relative shrink-0 w-12 h-7 rounded-full overflow-hidden"
            style={{ backgroundColor: duration ? "#ffffff" : "#3A3A3C", transition: "background-color 0.15s" }}
          >
            <span
              className="absolute top-1 w-5 h-5 rounded-full shadow"
              style={{
                backgroundColor: duration ? "#1C1C1E" : "#8E8E93",
                left: duration ? "24px" : "4px",
                transition: "left 0.15s ease-in-out, background-color 0.15s",
              }}
            />
          </button>
        </div>
      </Card>

      {/* Default rest interval */}
      <Card>
        <p className="text-sm font-medium text-white mb-1">デフォルトインターバル</p>
        <p className="text-xs mb-3" style={{ color: "#8E8E93" }}>
          セット完了後のインターバルタイマーの初期値
        </p>
        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {REST_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePresetClick(preset.value)}
              className="px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"
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
        {/* Free input */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 flex-1">
            <input
              type="number"
              min={1}
              max={600}
              value={restInput}
              onChange={(e) => handleRestInputChange(e.target.value)}
              className="w-20 rounded-xl px-3 py-2 text-sm text-white text-center outline-none border"
              style={{ backgroundColor: "#2C2C2E", borderColor: "rgba(255,255,255,0.12)" }}
            />
            <span className="text-sm" style={{ color: "#8E8E93" }}>秒</span>
          </div>
          {restInput && !isNaN(parseInt(restInput, 10)) && parseInt(restInput, 10) > 0 && (
            <span className="text-sm" style={{ color: "#CAFF4D" }}>
              = {formatSeconds(parseInt(restInput, 10))}
            </span>
          )}
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

      {/* Delete section */}
      <div className="pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {showDeleteConfirm ? (
          <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,80,80,0.3)" }}>
            <p className="font-medium text-white">この種目を削除しますか？</p>
            <p className="text-xs" style={{ color: "#8E8E93" }}>
              過去の記録は削除されません。この操作は取り消せません。
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeletePending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: "#FF453A", color: "#fff", opacity: isDeletePending ? 0.6 : 1 }}
              >
                {isDeletePending ? "削除中..." : "削除する"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ backgroundColor: "#3A3A3C", color: "#8E8E93" }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 text-sm font-medium rounded-xl"
            style={{ color: "#FF453A", backgroundColor: "rgba(255,69,58,0.1)" }}
          >
            この種目を削除する
          </button>
        )}
      </div>
    </div>
  );
}
