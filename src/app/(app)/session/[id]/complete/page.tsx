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

  // ロード時にデータ取得 + セッション完了を自動保存
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

      // 完了を自動保存（タイマー停止・ドラフト削除含む）
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
      } catch (err) {
        console.error("Auto-save failed:", err);
        // 致命的ではないので画面はそのまま表示
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
        <div className="text-[#8E8E93]">読み込み中...</div>
      </div>
    );
  }

  const volume = Math.round(
    Object.values(setsMap)
      .flat()
      .filter((s) => s.status === "completed")
      .reduce((acc, s) => acc + s.weight * s.reps, 0)
  );
  const allSets = Object.values(setsMap).flat();
  const completedCount = allSets.filter((s) => s.status === "completed").length;
  const motivationalMessage = MESSAGES[completedCount % MESSAGES.length];

  return (
    <div className="py-6 space-y-5">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-white">🎉 お疲れ様でした！</h1>
        <p className="text-[#8E8E93] mt-0.5">{session.title}</p>
        <p className="font-medium mt-1" style={{ color: "#CAFF4D" }}>
          {motivationalMessage}
        </p>
      </div>

      {/* 集計 */}
      <div
        className="rounded-xl p-4 grid grid-cols-2 gap-4 text-center"
        style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div>
          <p className="text-3xl font-bold" style={{ color: "#CAFF4D" }}>{completedCount}</p>
          <p className="text-xs mt-1" style={{ color: "#8E8E93" }}>完了セット</p>
        </div>
        <div>
          <p className="text-3xl font-bold" style={{ color: "#CAFF4D" }}>
            {volume.toLocaleString()}
          </p>
          <p className="text-xs mt-1" style={{ color: "#8E8E93" }}>kg（総ボリューム）</p>
        </div>
      </div>

      {/* 実施内容 */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium px-1" style={{ color: "#8E8E93" }}>実施内容</h2>
        {exercises.map((ex) => {
          const exSets = (setsMap[ex.id] ?? []).filter((s) => s.status === "completed");
          return (
            <div
              key={ex.id}
              className="rounded-xl px-4 py-3"
              style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{ex.exerciseName}</p>
                {ex.skipped && (
                  <span className="text-xs" style={{ color: "#8E8E93" }}>スキップ</span>
                )}
              </div>
              {!ex.skipped && exSets.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {exSets.map((s) => (
                    <p key={s.id} className="text-xs" style={{ color: "#8E8E93" }}>
                      {s.setNumber}セット{s.side ? ` (${s.side})` : ""}: {s.weight}kg × {s.reps}回
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* アクション */}
      <div className="space-y-2 pb-safe-bottom">
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={handleCopyText}
        >
          📋 ChatGPT用テキストをコピー
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => router.push("/home")}
        >
          ホームに戻る
        </Button>
        <div className="text-center pt-1">
          <button
            onClick={() => router.push("/today")}
            className="text-sm"
            style={{ color: "#8E8E93" }}
          >
            今日のメニューに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
