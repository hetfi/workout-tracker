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

const MESSAGES = [
  "今日も最高の自分を更新した 💪",
  "積み重ねが力になる。また明日！🔥",
  "筋肉は裏切らない。今日の努力が未来の自分を作る ⚡",
  "GJ! 着実に強くなっている 🏋️",
  "今日もやり切った！それが全て 💯",
];

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
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
        bodyCondition: null,
        fatigueLevel: null,
        pain: null,
        notes: null,
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

  const volume = calcVolume();
  const allSets = Object.values(setsMap).flat();
  const completedCount = allSets.filter((s) => s.status === "completed").length;
  const motivationalMessage = MESSAGES[completedCount % MESSAGES.length];

  return (
    <div className="py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          🎉 お疲れ様でした！
        </h1>
        <p className="text-gray-500 dark:text-gray-400">{session.title}</p>
        <p className="text-blue-600 dark:text-blue-400 font-medium mt-1">
          {motivationalMessage}
        </p>
      </div>

      {/* Summary */}
      <Card>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-blue-600">{completedCount}</p>
            <p className="text-xs text-gray-500 mt-1">完了セット</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-blue-600">
              {Math.round(volume).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">kg（総ボリューム）</p>
          </div>
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
                      {s.setNumber}セット{s.side ? ` (${s.side})` : ""}: {s.weight}kg × {s.reps}回
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
