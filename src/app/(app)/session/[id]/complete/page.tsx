"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionById,
  getSessionExercises,
  getSessionSets,
  updateSession,
} from "@/repositories/workoutSessions";
import { cancelTimersForSession } from "@/repositories/restTimers";
import { deleteDraftSession, deleteDraftTimer } from "@/lib/storage/draft";
import { generateChatGPTText } from "@/lib/export";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from "@/domain/types";
import type { ExportSession } from "@/lib/export";

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`text-2xl transition-transform active:scale-90 ${
              value !== null && n <= value
                ? "text-yellow-400"
                : "text-gray-300 dark:text-gray-600"
            }`}
            aria-label={`${label} ${n}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CompletePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<WorkoutSessionExercise[]>([]);
  const [setsMap, setSetsMap] = useState<Record<string, WorkoutSet[]>>({});
  const [bodyCondition, setBodyCondition] = useState<number | null>(null);
  const [fatigueLevel, setFatigueLevel] = useState<number | null>(null);
  const [pain, setPain] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [sessionData, exData, setsData] = await Promise.all([
        getSessionById(sessionId),
        getSessionExercises(sessionId),
        getSessionSets(sessionId),
      ]);
      if (!sessionData) {
        router.push("/home");
        return;
      }
      setSession(sessionData);
      setExercises(exData);
      const grouped: Record<string, WorkoutSet[]> = {};
      for (const ex of exData) grouped[ex.id] = [];
      for (const s of setsData) {
        if (grouped[s.sessionExerciseId]) {
          grouped[s.sessionExerciseId].push(s);
        }
      }
      setSetsMap(grouped);
      if (sessionData.bodyCondition) setBodyCondition(sessionData.bodyCondition);
      if (sessionData.fatigueLevel) setFatigueLevel(sessionData.fatigueLevel);
      if (sessionData.pain) setPain(sessionData.pain);
      if (sessionData.notes) setNotes(sessionData.notes);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const calcDuration = () => {
    if (!session?.startedAt) return null;
    const end = new Date();
    const start = new Date(session.startedAt);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  };

  const calcVolume = () => {
    return Object.values(setsMap)
      .flat()
      .filter((s) => s.status === "completed")
      .reduce((acc, s) => acc + s.weight * s.reps, 0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSession(sessionId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        bodyCondition,
        fatigueLevel,
        pain: pain || null,
        notes: notes || null,
      });
      await Promise.all([
        cancelTimersForSession(sessionId),
        deleteDraftSession(sessionId),
        deleteDraftTimer(sessionId),
      ]);
      setSaved(true);
      showToast("トレーニングを完了しました！", "success");
    } catch (err) {
      console.error(err);
      showToast("保存に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyText = async () => {
    if (!session) return;

    const exportData: ExportSession = {
      session: {
        date: session.date,
        title: session.title,
        startedAt: session.startedAt,
        completedAt: session.completedAt ?? new Date().toISOString(),
        bodyCondition,
        fatigueLevel,
        pain: pain || null,
        notes: notes || null,
      },
      exercises: exercises.map((ex) => ({
        exercise: {
          exerciseName: ex.exerciseName,
          plannedSets: ex.plannedSets,
          plannedRepsTarget: ex.plannedRepsTarget,
          restSeconds: ex.restSeconds,
          skipped: ex.skipped,
          notes: ex.notes,
        },
        sets: (setsMap[ex.id] ?? []).sort((a, b) => a.setNumber - b.setNumber),
      })),
    };

    const text = generateChatGPTText(exportData);

    try {
      await navigator.clipboard.writeText(text);
      showToast("テキストをコピーしました", "success");
    } catch {
      // Fallback: Web Share API
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        showToast("コピーに失敗しました。テキストを長押ししてコピーしてください。", "error");
      }
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const duration = calcDuration();
  const volume = calcVolume();
  const allSets = Object.values(setsMap).flat();
  const completedCount = allSets.filter((s) => s.status === "completed").length;

  return (
    <div className="py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          🎉 お疲れ様でした！
        </h1>
        <p className="text-gray-500 dark:text-gray-400">{session.title}</p>
      </div>

      {/* Summary */}
      <Card>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600">{completedCount}</p>
            <p className="text-xs text-gray-500 mt-1">完了セット</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {duration ?? "–"}
            </p>
            <p className="text-xs text-gray-500 mt-1">分</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {Math.round(volume).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">kg (総Vol)</p>
          </div>
        </div>
      </Card>

      {/* Ratings */}
      <Card className="space-y-4">
        <StarRating
          value={bodyCondition}
          onChange={setBodyCondition}
          label="体調"
        />
        <StarRating
          value={fatigueLevel}
          onChange={setFatigueLevel}
          label="疲労度"
        />
      </Card>

      {/* Notes */}
      <Card className="space-y-3">
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
            痛み・違和感
          </label>
          <input
            type="text"
            value={pain}
            onChange={(e) => setPain(e.target.value)}
            placeholder="例: 左肘に軽い張り"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
            全体メモ
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="トレーニング全体の感想など"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </Card>

      {/* Exercise summary */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 px-1">
          実施内容
        </h2>
        {exercises.map((ex) => {
          const exSets = (setsMap[ex.id] ?? []).filter(
            (s) => s.status === "completed"
          );
          return (
            <Card key={ex.id} className="py-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {ex.exerciseName}
                </p>
                {ex.skipped && (
                  <span className="text-xs text-gray-400">スキップ</span>
                )}
              </div>
              {!ex.skipped && exSets.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {exSets.map((s) => (
                    <p key={s.id} className="text-xs text-gray-500 dark:text-gray-400">
                      {s.setNumber}セット: {s.weight}kg × {s.reps}回
                    </p>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="space-y-2 pb-safe-bottom">
        {!saved ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSave}
            loading={saving}
          >
            完了を保存する
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={handleCopyText}
          >
            📋 ChatGPT用テキストをコピー
          </Button>
        )}

        {saved && (
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => router.push("/home")}
          >
            ホームに戻る
          </Button>
        )}
      </div>
    </div>
  );
}
