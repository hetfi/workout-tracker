"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ExerciseCard } from "@/components/training/ExerciseCard";
import { Button } from "@/components/ui/Button";
import { SaveStatusIndicator } from "@/components/ui/SaveStatus";
import { useToast } from "@/components/ui/Toast";
import {
  getSessionExercisesForSessions,
  getSessionSetsForSessions,
  updateSession,
  updateSessionExercise,
  upsertSet,
  getPreviousSessionDataBatch,
  deleteSessionExercise,
  deleteWorkoutSet,
} from "@/repositories/workoutSessions";
import { getExerciseMasterMaps } from "@/repositories/exercises";
import { createTimer } from "@/repositories/restTimers";
import { getUserSettings } from "@/repositories/userSettings";
import {
  saveDraftSession,
  loadDraftSession,
  saveDraftTimer,
  deleteDraftTimer,
} from "@/lib/storage/draft";
import { createTimerState } from "@/lib/timer";
import { getIntervalEnabled } from "@/lib/storage/localSettings";
import { IntervalTimer } from "@/components/training/IntervalTimer";
import type { TimerState } from "@/lib/timer";
import { buildExercisePreset } from "@/lib/preset";
import {
  CATEGORY_ORDER,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type MuscleCategory,
} from "@/lib/muscleCategory";
import type {
  WorkoutSet,
  WorkoutSessionExercise,
  SaveStatus,
} from "@/domain/types";

interface TodayViewProps {
  /** 今日の有効セッション ID 一覧（created_at 昇順） */
  sessionIds: string[];
  todayStr: string;
  /** 種目追加フォームへのリンクに使う最初のアクティブセッション ID */
  firstActiveSessionId: string;
}

function newId() {
  return crypto.randomUUID();
}

export function TodayView({
  sessionIds,
  todayStr,
  firstActiveSessionId,
}: TodayViewProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [exercises, setExercises] = useState<WorkoutSessionExercise[]>([]);
  const [setsMap, setSetsMap] = useState<Record<string, WorkoutSet[]>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loading, setLoading] = useState(true);
  /** sessionExerciseId → MuscleCategory */
  const [categoriesMap, setCategoriesMap] = useState<Record<string, MuscleCategory>>({});
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [activeExerciseName, setActiveExerciseName] = useState("");
  const [settings, setSettings] = useState({ soundEnabled: true, vibrationEnabled: true });
  // セッションIDごとに in_progress に戻したかどうかを追跡（1回だけ更新する）
  const reopenedSessions = useRef<Set<string>>(new Set());
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load all exercises + sets across all sessions ----
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // 並列で全データを一括取得（masterMaps は 1 クエリで category + duration 両方取得）
        const [allExercises, allSets, masterMaps, userSettings] = await Promise.all([
          getSessionExercisesForSessions(sessionIds),
          getSessionSetsForSessions(sessionIds),
          getExerciseMasterMaps(),
          getUserSettings(),
        ]);
        const masterMap = masterMaps.categoryMap;
        const durationMap = masterMaps.durationMap;

        // isDuration をマスターから上書き
        const enrichedExercises = allExercises.map((ex) => ({
          ...ex,
          isDuration: durationMap[ex.exerciseName] ?? false,
        }));
        setExercises(enrichedExercises);

        // 部位カテゴリマップを構築
        const catMap: Record<string, MuscleCategory> = {};
        for (const ex of enrichedExercises) {
          catMap[ex.id] =
            (masterMap[ex.exerciseName] as MuscleCategory | undefined) ?? "back";
        }
        setCategoriesMap(catMap);

        // ユーザー設定（通知音・バイブ）を反映
        if (userSettings) {
          setSettings({
            soundEnabled: userSettings.soundEnabled,
            vibrationEnabled: userSettings.vibrationEnabled,
          });
        }

        const grouped: Record<string, WorkoutSet[]> = {};
        for (const ex of enrichedExercises) grouped[ex.id] = [];
        for (const s of allSets) {
          if (!grouped[s.sessionExerciseId]) grouped[s.sessionExerciseId] = [];
          grouped[s.sessionExerciseId].push(s);
        }

        // isDuration 種目の既存 DB セットも 1 セット（完了済み + pending 1件）に制限
        for (const ex of enrichedExercises) {
          if (!ex.isDuration) continue;
          const sets = grouped[ex.id];
          if (sets.length <= 1) continue;
          const completed = sets.filter((s) => s.status === "completed");
          const pending   = sets.filter((s) => s.status === "pending");
          grouped[ex.id] = [...completed, ...pending.slice(0, 1)];
        }

        // 片側種目は DB の stale data に左右されないよう常に L+R 構造を再構築する。
        // 通常種目は DB にセットがない場合だけプリセット生成。
        const exercisesNeedingPresets = enrichedExercises.filter(
          (ex) => ex.isOneArm ? !ex.isDuration : grouped[ex.id].length === 0
        );
        const prevDataMap = await getPreviousSessionDataBatch(exercisesNeedingPresets);
        for (const ex of exercisesNeedingPresets) {
          const prev = prevDataMap.get(ex.exerciseName) ?? null;

          if (ex.isOneArm && !ex.isDuration) {
            // 片側種目: completed セットは保持し、pending スロットだけ再構築
            // stale な高 setNumber セット（旧バグ由来）は除外される
            const completedSets = (grouped[ex.id] ?? []).filter(
              (s) => s.status === "completed"
            );
            // 履歴があれば履歴のユニーク setNumber 数（ペア数）を使い、なければ plannedSets
            const prevCompleted = prev?.sets.filter((s) => s.status === "completed") ?? [];
            const uniqueSetNums = new Set(prevCompleted.map((s) => s.setNumber)).size;
            const historySetCount = uniqueSetNums > 0 ? uniqueSetNums : ex.plannedSets;
            const preset = buildExercisePreset({ ...ex, plannedSets: historySetCount }, prev);
            const rebuilt: WorkoutSet[] = [];
            for (const p of preset.sets) {
              for (const side of ["L", "R"] as const) {
                const existing = completedSets.find(
                  (s) => s.setNumber === p.setNumber && s.side === side
                );
                if (existing) {
                  rebuilt.push(existing);
                } else {
                  const clientId = newId();
                  rebuilt.push({
                    id: clientId,
                    userId: "",
                    sessionExerciseId: ex.id,
                    sessionId: ex.sessionId,
                    setNumber: p.setNumber,
                    weight: p.weight,
                    reps: p.reps,
                    status: "pending" as const,
                    completedAt: null,
                    notes: null,
                    clientId,
                    side,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }
              }
            }
            grouped[ex.id] = rebuilt;
          } else {
            // 通常種目 / isDuration: 履歴があれば履歴のセット数を使う
            const prevCompletedCount = prev?.sets.filter((s) => s.status === "completed").length ?? 0;
            const historySetCount = prevCompletedCount > 0 ? prevCompletedCount : ex.plannedSets;
            const effectiveEx = ex.isDuration ? { ...ex, plannedSets: 1 } : { ...ex, plannedSets: historySetCount };
            const preset = buildExercisePreset(effectiveEx, prev);
            grouped[ex.id] = preset.sets.map((p) => ({
              id: newId(),
              userId: "",
              sessionExerciseId: ex.id,
              sessionId: ex.sessionId,
              setNumber: p.setNumber,
              weight: p.weight,
              reps: p.reps,
              status: "pending" as const,
              completedAt: null,
              notes: null,
              clientId: newId(),
              side: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }));
          }
        }

        // IndexedDB のドラフトをマージ（並列）
        const drafts = await Promise.all(sessionIds.map(loadDraftSession));
        for (const draft of drafts) {
          if (!draft) continue;
          for (const draftSet of draft.sets) {
            const exId = draftSet.sessionExerciseId;
            if (!grouped[exId]) continue;
            const idx = grouped[exId].findIndex(
              (s) => s.clientId === draftSet.clientId
            );
            if (idx !== -1) {
              grouped[exId][idx] = {
                ...grouped[exId][idx],
                ...draftSet,
                side: draftSet.side ?? null,
              };
            }
          }
        }

        setSetsMap(grouped);
      } catch (err) {
        console.error(err);
        showToast("データの読み込みに失敗しました", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionIds, showToast]);

  // ---- Draft save (debounced) ----
  const saveDraft = useCallback(
    (newSetsMap: Record<string, WorkoutSet[]>) => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(async () => {
        // Group sets by session
        const bySession: Record<string, WorkoutSet[]> = {};
        for (const ex of exercises) {
          if (!bySession[ex.sessionId]) bySession[ex.sessionId] = [];
          bySession[ex.sessionId].push(...(newSetsMap[ex.id] ?? []));
        }
        for (const [sid, sets] of Object.entries(bySession)) {
          try {
            await saveDraftSession({
              sessionId: sid,
              updatedAt: new Date().toISOString(),
              sets: sets.map((s) => ({
                clientId: s.clientId,
                sessionExerciseId: s.sessionExerciseId,
                setNumber: s.setNumber,
                weight: s.weight,
                reps: s.reps,
                status: s.status,
                completedAt: s.completedAt,
                notes: s.notes,
                side: s.side,
              })),
            });
          } catch {
            /* ignore */
          }
        }
      }, 300);
    },
    [exercises]
  );

  // ---- Set complete ----
  const handleSetComplete = useCallback(
    async (exerciseId: string, completedSet: WorkoutSet) => {
      setSetsMap((prev) => {
        const updated = { ...prev };
        const idx = (prev[exerciseId] ?? []).findIndex(
          (s) =>
            s.setNumber === completedSet.setNumber &&
            s.side === completedSet.side
        );
        if (idx !== -1) {
          updated[exerciseId] = prev[exerciseId].map((s, i) =>
            i === idx ? completedSet : s
          );
        } else {
          updated[exerciseId] = [...(prev[exerciseId] ?? []), completedSet];
        }
        saveDraft(updated);
        return updated;
      });

      setSaveStatus("saving");
      try {
        await upsertSet({
          sessionExerciseId: completedSet.sessionExerciseId,
          sessionId: completedSet.sessionId,
          setNumber: completedSet.setNumber,
          weight: completedSet.weight,
          reps: completedSet.reps,
          status: completedSet.status,
          completedAt: completedSet.completedAt,
          notes: completedSet.notes,
          clientId: completedSet.clientId,
          side: completedSet.side,
        });

        // セットが完了したセッションを in_progress に戻す（1セッション1回だけ）
        const ex = exercises.find((e) => e.id === exerciseId);
        if (ex && !reopenedSessions.current.has(ex.sessionId)) {
          reopenedSessions.current.add(ex.sessionId);
          try {
            await updateSession(ex.sessionId, {
              status: "in_progress",
              completedAt: null,
            });
          } catch {
            /* non-critical */
          }
        }

        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);

        // インターバルタイマーを起動（設定がオンの場合のみ）
        if (ex && getIntervalEnabled()) {
          const currentSets = setsMap[exerciseId] ?? [];
          const pendingSets = currentSets.filter(
            (s) =>
              s.status === "pending" && s.setNumber > completedSet.setNumber
          );
          if (pendingSets.length > 0) {
            const nextSet = pendingSets[0];
            const state = createTimerState({
              sessionId: completedSet.sessionId,
              sessionExerciseId: exerciseId,
              triggerSetId: completedSet.clientId,
              nextSetNumber: nextSet.setNumber,
              durationSeconds: ex.restSeconds,
            });
            setTimerState(state);
            setActiveExerciseName(ex.exerciseName);
            try {
              await createTimer(state);
              await saveDraftTimer({
                sessionId: state.sessionId,
                sessionExerciseId: state.sessionExerciseId,
                triggerSetId: state.triggerSetId,
                nextSetNumber: state.nextSetNumber,
                durationSeconds: state.durationSeconds,
                startedAt: state.startedAt,
                endsAt: state.endsAt,
                status: state.status,
                adjustmentSeconds: state.adjustmentSeconds,
              });
            } catch {
              /* non-critical */
            }
          }
        }
      } catch {
        setSaveStatus("error");
        showToast("セットの保存に失敗しました", "error");
      }
    },
    [saveDraft, showToast, exercises, setsMap]
  );

  const handleSetsUpdate = useCallback(
    (exerciseId: string, updatedSets: WorkoutSet[]) => {
      setSetsMap((prev) => {
        const updated = { ...prev, [exerciseId]: updatedSets };
        saveDraft(updated);
        return updated;
      });
    },
    [saveDraft]
  );

  const handleMoveExercise = useCallback(
    async (exerciseId: string, direction: "up" | "down") => {
      const idx = exercises.findIndex((e) => e.id === exerciseId);
      if (idx === -1) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= exercises.length) return;

      const a = exercises[idx];
      const b = exercises[swapIdx];
      const aNewOrder = b.sortOrder;
      const bNewOrder = a.sortOrder;

      // ローカル状態を即時更新（sort_order を入れ替えて再ソート）
      setExercises((prev) => {
        const updated = prev.map((e) => {
          if (e.id === a.id) return { ...e, sortOrder: aNewOrder };
          if (e.id === b.id) return { ...e, sortOrder: bNewOrder };
          return e;
        });
        return [...updated].sort((x, y) => x.sortOrder - y.sortOrder);
      });

      // DB に永続化
      try {
        await Promise.all([
          updateSessionExercise(a.id, { sortOrder: aNewOrder }),
          updateSessionExercise(b.id, { sortOrder: bNewOrder }),
        ]);
      } catch {
        showToast("並び替えの保存に失敗しました", "error");
      }
    },
    [exercises, showToast]
  );

  // ---- Timer callbacks ----
  const handleTimerUpdate = useCallback(async (updated: TimerState) => {
    setTimerState(updated);
    try {
      await saveDraftTimer({
        sessionId: updated.sessionId,
        sessionExerciseId: updated.sessionExerciseId,
        triggerSetId: updated.triggerSetId,
        nextSetNumber: updated.nextSetNumber,
        durationSeconds: updated.durationSeconds,
        startedAt: updated.startedAt,
        endsAt: updated.endsAt,
        status: updated.status,
        adjustmentSeconds: updated.adjustmentSeconds,
      });
    } catch {
      /* non-critical */
    }
  }, []);

  const handleTimerFinish = useCallback(async (finished: TimerState) => {
    setTimerState(finished);
    try {
      await deleteDraftTimer(finished.sessionId);
    } catch {
      /* non-critical */
    }
  }, []);

  const handleDeleteExercise = useCallback(
    async (exerciseId: string) => {
      try {
        await deleteSessionExercise(exerciseId);
        setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
        setSetsMap((prev) => {
          const updated = { ...prev };
          delete updated[exerciseId];
          return updated;
        });
      } catch {
        showToast("種目の削除に失敗しました", "error");
      }
    },
    [showToast]
  );

  const handleDeleteSet = useCallback(
    async (exerciseId: string, clientId: string) => {
      try {
        await deleteWorkoutSet(clientId);
        setSetsMap((prev) => {
          const updated = { ...prev };
          updated[exerciseId] = (prev[exerciseId] ?? []).filter(
            (s) => s.clientId !== clientId
          );
          return updated;
        });
      } catch {
        showToast("セットの削除に失敗しました", "error");
      }
    },
    [showToast]
  );

  const handleAddSet = useCallback(
    async (exerciseId: string, nextSetNumber?: number) => {
      const ex = exercises.find((e) => e.id === exerciseId);

      if (ex?.isOneArm) {
        // 片側種目: ExerciseCard が計算した nextSetNumber を使う（stale DB セットに左右されない）
        setSetsMap((prev) => {
          const currentSets = prev[exerciseId] ?? [];
          const lastSet = currentSets[currentSets.length - 1];
          // nextSetNumber が渡された場合はそれを使い、ない場合は max + 1
          const newSN =
            nextSetNumber ??
            currentSets.reduce((mx, s) => Math.max(mx, s.setNumber), 0) + 1;
          const newSets: WorkoutSet[] = (["L", "R"] as const).map((side) => {
            const clientId = newId();
            return {
              id: clientId,
              userId: "",
              sessionExerciseId: exerciseId,
              sessionId: ex.sessionId,
              setNumber: newSN,
              weight: lastSet?.weight ?? 0,
              reps: lastSet?.reps ?? 0,
              status: "pending" as const,
              completedAt: null,
              notes: null,
              clientId,
              side,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          });
          const updated = {
            ...prev,
            [exerciseId]: [...currentSets, ...newSets],
          };
          saveDraft(updated);
          return updated;
        });
      } else {
        setSetsMap((prev) => {
          const currentSets = prev[exerciseId] ?? [];
          const maxSN = currentSets.reduce((mx, s) => Math.max(mx, s.setNumber), 0);
          const lastSet = currentSets[currentSets.length - 1];
          const clientId = newId();
          const newSet: WorkoutSet = {
            id: clientId,
            userId: lastSet?.userId ?? "",
            sessionExerciseId: exerciseId,
            sessionId: ex?.sessionId ?? "",
            setNumber: maxSN + 1,
            weight: lastSet?.weight ?? 0,
            reps: lastSet?.reps ?? 0,
            status: "pending",
            completedAt: null,
            notes: null,
            clientId,
            side: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const updated = {
            ...prev,
            [exerciseId]: [...currentSets, newSet],
          };
          saveDraft(updated);
          return updated;
        });
        // 通常セットはDB保存（fire-and-forget）
        const currentSets = setsMap[exerciseId] ?? [];
        const maxSN = currentSets.reduce((mx, s) => Math.max(mx, s.setNumber), 0);
        const clientId = newId();
        try {
          await upsertSet({
            sessionExerciseId: exerciseId,
            sessionId: ex?.sessionId ?? "",
            setNumber: maxSN + 1,
            weight: currentSets[currentSets.length - 1]?.weight ?? 0,
            reps: currentSets[currentSets.length - 1]?.reps ?? 0,
            status: "pending",
            completedAt: null,
            notes: null,
            clientId,
            side: null,
          });
        } catch {
          /* non-critical */
        }
      }
    },
    [exercises, setsMap, saveDraft]
  );

  // ---- Complete ----
  const handleComplete = async () => {
    const allSets = Object.values(setsMap).flat();
    const completedCount = allSets.filter((s) => s.status === "completed").length;
    const pendingCount = allSets.length - completedCount;

    // セットがゼロ（プリセット未生成など）か未完了あり → 完了扱いにしない
    if (pendingCount > 0 || allSets.length === 0) {
      const msg =
        allSets.length === 0
          ? "完了したセットがありません。ホームに戻りますか？"
          : completedCount === 0
          ? "完了したセットがありません。ホームに戻りますか？"
          : `まだ${pendingCount}セット完了していません。ホームに戻りますか？`;
      if (!confirm(msg)) return;
      router.push("/home");
      return;
    }

    // 全セット完了 → グッジョブ画面へ（完了保存は /complete 画面で行う）
    // firstActiveSessionId 以外のセッションは先に completed に更新しておく
    const otherIds = sessionIds.filter((id) => id !== firstActiveSessionId);
    if (otherIds.length > 0) {
      try {
        await Promise.all(
          otherIds.map((sid) =>
            updateSession(sid, {
              status: "completed",
              completedAt: new Date().toISOString(),
            })
          )
        );
      } catch {
        /* non-critical */
      }
    }
    router.push(`/session/${firstActiveSessionId}/complete`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-[#8E8E93]">読み込み中...</div>
      </div>
    );
  }

  // セッションはあるが種目がゼロ（セッション作成直後など）
  if (exercises.length === 0) {
    return (
      <div className="py-6 space-y-4 pt-16">
        <h1 className="text-xl font-bold text-white">今日のメニュー</h1>
        <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4 space-y-3">
          <p className="text-sm text-[#8E8E93]">種目を追加してトレーニングを始めましょう</p>
          <a
            href={`/import?date=${todayStr}`}
            className="block text-center text-sm py-3 rounded-xl font-medium"
            style={{ backgroundColor: "#CAFF4D", color: "#0D0D0F" }}
          >
            ChatGPTから取り込む
          </a>
          <a
            href={`/day/${todayStr}/add?sessionId=${firstActiveSessionId}&backTo=/today`}
            className="block text-center text-sm py-3 rounded-xl font-medium"
            style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF" }}
          >
            ＋ 手動で種目を追加する
          </a>
        </div>
      </div>
    );
  }

  // 部位ごとの進捗を集計
  const categoryProgress = (() => {
    const result: Partial<Record<MuscleCategory, { completed: number; total: number }>> = {};
    for (const ex of exercises) {
      const cat = categoriesMap[ex.id];
      if (!cat) continue;
      if (!result[cat]) result[cat] = { completed: 0, total: 0 };
      const sets = setsMap[ex.id] ?? [];
      result[cat]!.completed += sets.filter((s) => s.status === "completed").length;
      result[cat]!.total += sets.length;
    }
    return result;
  })();

  return (
    <div className="py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-12">
        <h1 className="text-xl font-bold text-white">今日のメニュー</h1>
        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* 部位別プログレスバー */}
      <div className="space-y-2">
        {CATEGORY_ORDER.filter((cat) => categoryProgress[cat]).map((cat) => {
          const { completed, total } = categoryProgress[cat]!;
          const color = CATEGORY_COLORS[cat];
          const pct = total > 0 ? (completed / total) * 100 : 0;
          return (
            <div key={cat} className="flex items-center gap-3">
              {/* 部位ラベル */}
              <span
                className="text-xs font-semibold w-12 shrink-0 whitespace-nowrap"
                style={{ color }}
              >
                {CATEGORY_LABELS[cat]}
              </span>
              {/* バー */}
              <div className="flex-1 h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              {/* セット数 */}
              <span className="text-xs text-[#8E8E93] w-10 text-right shrink-0">
                {completed}/{total}
              </span>
            </div>
          );
        })}
      </div>

      {/* インターバルタイマー */}
      {timerState && timerState.status === "running" && (
        <IntervalTimer
          timer={timerState}
          exerciseName={activeExerciseName}
          onUpdate={handleTimerUpdate}
          onFinish={handleTimerFinish}
          soundEnabled={settings.soundEnabled}
          vibrationEnabled={settings.vibrationEnabled}
        />
      )}

      {/* Exercises */}
      {exercises.map((ex, idx) => (
        <ExerciseCard
          key={ex.id}
          sessionExercise={ex}
          sets={setsMap[ex.id] ?? []}
          muscleCategory={categoriesMap[ex.id]}
          isFirst={idx === 0}
          isLast={idx === exercises.length - 1}
          onMoveUp={() => handleMoveExercise(ex.id, "up")}
          onMoveDown={() => handleMoveExercise(ex.id, "down")}
          onSetComplete={(set) => handleSetComplete(ex.id, set)}
          onSetsUpdate={(sets) => handleSetsUpdate(ex.id, sets)}
          onDeleteExercise={() => handleDeleteExercise(ex.id)}
          onDeleteSet={(clientId) => handleDeleteSet(ex.id, clientId)}
          onAddSet={(nextSN) => handleAddSet(ex.id, nextSN)}
        />
      ))}

      {/* Add exercise link */}
      <div className="text-center">
        <a
          href={`/day/${todayStr}/add?sessionId=${firstActiveSessionId}&backTo=/today`}
          className="text-sm text-[#8E8E93] hover:text-white transition-colors"
        >
          ＋ 種目を追加
        </a>
      </div>

      {/* Complete button */}
      <div className="pt-2">
        <Button variant="primary" size="lg" fullWidth onClick={handleComplete}>
          トレーニングを完了する
        </Button>
      </div>
    </div>
  );
}
