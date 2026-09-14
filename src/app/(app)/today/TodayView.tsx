"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ExerciseCard } from "@/components/training/ExerciseCard";
import { Button } from "@/components/ui/Button";
import { SaveStatusIndicator } from "@/components/ui/SaveStatus";
import { useToast } from "@/components/ui/Toast";
import {
  getSessionExercises,
  getSessionSets,
  updateSession,
  updateSessionExercise,
  upsertSet,
  getPreviousSessionData,
  deleteSessionExercise,
  deleteWorkoutSet,
} from "@/repositories/workoutSessions";
import { getExerciseCategoryMap } from "@/repositories/exercises";
import {
  saveDraftSession,
  loadDraftSession,
} from "@/lib/storage/draft";
import { buildExercisePreset } from "@/lib/preset";
import {
  classifyExercise,
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
  // セッションIDごとに in_progress に戻したかどうかを追跡（1回だけ更新する）
  const reopenedSessions = useRef<Set<string>>(new Set());
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load all exercises + sets across all sessions ----
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const allExercises: WorkoutSessionExercise[] = [];
        const allSets: WorkoutSet[] = [];

        for (const sid of sessionIds) {
          const [exData, setsData] = await Promise.all([
            getSessionExercises(sid),
            getSessionSets(sid),
          ]);
          allExercises.push(...exData);
          allSets.push(...setsData);
        }

        setExercises(allExercises);

        // 種目マスターから部位カテゴリを取得
        const masterMap = await getExerciseCategoryMap();
        const catMap: Record<string, MuscleCategory> = {};
        for (const ex of allExercises) {
          catMap[ex.id] =
            (masterMap[ex.exerciseName] as MuscleCategory | undefined) ??
            classifyExercise(ex.exerciseName);
        }
        setCategoriesMap(catMap);

        const grouped: Record<string, WorkoutSet[]> = {};
        for (const ex of allExercises) grouped[ex.id] = [];
        for (const s of allSets) {
          if (!grouped[s.sessionExerciseId]) grouped[s.sessionExerciseId] = [];
          grouped[s.sessionExerciseId].push(s);
        }

        // Generate presets for exercises with no sets yet
        for (const ex of allExercises) {
          if (grouped[ex.id].length === 0) {
            const prev = await getPreviousSessionData(
              ex.exerciseId,
              ex.exerciseName
            );
            const preset = buildExercisePreset(ex, prev);
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

        // Merge drafts from IndexedDB
        for (const sid of sessionIds) {
          const draft = await loadDraftSession(sid);
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
      } catch {
        setSaveStatus("error");
        showToast("セットの保存に失敗しました", "error");
      }
    },
    [saveDraft, showToast, exercises]
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
    async (exerciseId: string) => {
      const ex = exercises.find((e) => e.id === exerciseId);
      const existingSets = setsMap[exerciseId] ?? [];
      const maxSetNumber = existingSets.reduce(
        (max, s) => Math.max(max, s.setNumber),
        0
      );
      const lastSet = existingSets[existingSets.length - 1];
      const clientId = newId();
      const newSet: WorkoutSet = {
        id: clientId,
        userId: lastSet?.userId ?? "",
        sessionExerciseId: exerciseId,
        sessionId: ex?.sessionId ?? "",
        setNumber: maxSetNumber + 1,
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
      setSetsMap((prev) => {
        const updated = {
          ...prev,
          [exerciseId]: [...(prev[exerciseId] ?? []), newSet],
        };
        saveDraft(updated);
        return updated;
      });
      try {
        await upsertSet({
          sessionExerciseId: exerciseId,
          sessionId: ex?.sessionId ?? "",
          setNumber: newSet.setNumber,
          weight: newSet.weight,
          reps: newSet.reps,
          status: "pending",
          completedAt: null,
          notes: null,
          clientId,
          side: null,
        });
      } catch {
        /* non-critical */
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
          ? "完了したセットがありません。今日のメニューに戻りますか？"
          : completedCount === 0
          ? "完了したセットがありません。今日のメニューに戻りますか？"
          : `まだ${pendingCount}セット完了していません。今日のメニューに戻りますか？`;
      if (!confirm(msg)) return;
      router.push("/home");
      return;
    }

    // 全セット完了 → 全セッションを completed に
    try {
      await Promise.all(
        sessionIds.map((sid) =>
          updateSession(sid, {
            status: "completed",
            completedAt: new Date().toISOString(),
          })
        )
      );
    } catch {
      /* non-critical */
    }
    router.push("/home");
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
            href={`/day/${todayStr}/add?sessionId=${firstActiveSessionId}&backTo=/today`}
            className="block text-center text-sm py-3 rounded-xl bg-white/[0.08] text-white font-medium"
          >
            ＋ 種目を追加
          </a>
        </div>
      </div>
    );
  }

  const totalSets = Object.values(setsMap).flat().length;
  const completedSets = Object.values(setsMap)
    .flat()
    .filter((s) => s.status === "completed").length;

  return (
    <div className="py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-12">
        <div>
          <h1 className="text-xl font-bold text-white">今日のメニュー</h1>
          <p className="text-xs text-[#8E8E93] mt-0.5">
            {completedSets}/{totalSets} セット完了
          </p>
        </div>
        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#CAFF4D] rounded-full transition-all duration-300"
          style={{
            width: totalSets > 0 ? `${(completedSets / totalSets) * 100}%` : "0%",
          }}
        />
      </div>

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
          onAddSet={() => handleAddSet(ex.id)}
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
