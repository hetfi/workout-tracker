"use client";

import { useState, useEffect, useTransition } from "react";
import { getPastExercises, addManualSession, ManualExercise } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

interface AddExercisesFormProps {
  date: string;
}

interface SelectedExercise extends ManualExercise {
  key: number;
}

let keyCounter = 0;

export function AddExercisesForm({ date }: AddExercisesFormProps) {
  const [pastExercises, setPastExercises] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedExercise[]>([]);
  const [customName, setCustomName] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPastExercises().then(setPastExercises);
  }, []);

  const filtered = search.trim()
    ? pastExercises.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase())
      )
    : pastExercises;

  const addExercise = (name: string) => {
    setSelected((prev) => [
      ...prev,
      { key: keyCounter++, name, sets: 3, repsMin: 8, repsMax: 12 },
    ]);
    setSearch("");
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    addExercise(name);
    setCustomName("");
    setShowCustomInput(false);
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
      {/* Search past exercises */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          種目を検索して追加
        </p>
        <Input
          placeholder="種目名を検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search.trim() && (
          <div className="mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">見つかりません</p>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => addExercise(e.name)}
                  className="w-full text-left px-4 py-3 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-b last:border-b-0 border-gray-100 dark:border-gray-700"
                >
                  {e.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Custom exercise */}
      <div>
        {!showCustomInput ? (
          <button
            onClick={() => setShowCustomInput(true)}
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium"
          >
            <span>＋</span>
            <span>種目を追加（カスタム）</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="種目名を入力..."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
                autoFocus
              />
            </div>
            <Button variant="primary" size="sm" onClick={addCustom}>
              追加
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setShowCustomInput(false); setCustomName(""); }}>
              キャンセル
            </Button>
          </div>
        )}
      </div>

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
