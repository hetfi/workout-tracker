"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { ExerciseCard } from "@/components/training/ExerciseCard";
import { IntervalTimer } from "@/components/training/IntervalTimer";
import { Button } from "@/components/ui/Button";
import { SaveStatusIndicator } from "@/components/ui/SaveStatus";
import { useToast } from "@/components/ui/Toast";
import {
  getSessionById,
  getSessionExercises,
  getSessionSets,
  updateSession,
  updateSessionExercise,
  upsertSet,
  getPreviousSessionData,
  deleteSessionExercise,
  deleteWorkoutSet,
} from "@/repositories/workoutSessions";
import {
  getRunningTimer,
  createTimer,
  updateTimer,
} from "@/repositories/restTimers";
import {
  saveDraftSession,
  loadDraftSession,
  saveDraftTimer,
  loadDraftTimer,
  deleteDraftTimer,
} from "@/lib/storage/draft";
import { buildExercisePreset } from "@/lib/preset";
import {
  createTimerState,
  fromRestTimer,
} from "@/lib/timer";
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  SaveStatus,
} from "@/domain/types";
import type { TimerState } from "@/lib/timer";

// Generate a unique client ID for idempotency
function newClientId(): string {
  return crypto.randomUUID();
}

export default function SessionPage({
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
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [activeExerciseName, setActiveExerciseName] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    soundEnabled: true,
    vibrationEnabled: true,
  });
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load session data ----
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sessionData, exData] = await Promise.all([
          getSessionById(sessionId),
          getSessionExercises(sessionId),
        ]);

        if (!sessionData) {
          showToast("セッションが見つかりません", "error");
          router.push("/home");
          return;
        }

        setSession(sessionData);
        setExercises(exData);

        const setsData = await getSessionSets(sessionId);

        // Group sets by sessionExerciseId
        const grouped: Record<string, WorkoutSet[]> = {};
        for (const ex of exData) {
          grouped[ex.id] = [];
        }
        for (const s of setsData) {
          if (!grouped[s.sessionExerciseId]) {
            grouped[s.sessionExerciseId] = [];
          }
          grouped[s.sessionExerciseId].push(s);
        }

        // If no sets yet, create initial sets from presets
        for (const ex of exData) {
          if (grouped[ex.id].length === 0) {
            const prev = await getPreviousSessionData(
              ex.exerciseId,
              ex.exerciseName
            );
            const preset = buildExercisePreset(ex, prev);
            const sets: WorkoutSet[] = preset.sets.map((p) => ({
              id: newClientId(), // temp ID (replaced after save)
              userId: "",
              sessionExerciseId: ex.id,
              sessionId,
              setNumber: p.setNumber,
              weight: p.weight,
              reps: p.reps,
              status: "pending",
              completedAt: null,
              notes: null,
              clientId: newClientId(),
              side: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }));
            grouped[ex.id] = sets;
          }
        }

        setSetsMap(grouped);

        // Restore local draft
        const draft = await loadDraftSession(sessionId);
        if (draft) {
          // Merge draft sets over db sets (draft is more recent)
          for (const draftSet of draft.sets) {
            const exId = draftSet.sessionExerciseId;
            if (grouped[exId]) {
              const idx = grouped[exId].findIndex(
                (s) => s.clientId === draftSet.clientId
              );
              if (idx !== -1) {
                grouped[exId][idx] = {
                  ...grouped[exId][idx],
                  ...draftSet,
                  side: draftSet.side ?? null,
                };
              } else if (draftSet.side) {
                // One-arm set not in presets — reconstruct and push
                grouped[exId].push({
                  id: crypto.randomUUID(),
                  userId: "",
                  sessionExerciseId: draftSet.sessionExerciseId,
                  sessionId,
                  setNumber: draftSet.setNumber,
                  weight: draftSet.weight,
                  reps: draftSet.reps,
                  status: draftSet.status,
                  completedAt: draftSet.completedAt,
                  notes: draftSet.notes,
                  clientId: draftSet.clientId,
                  side: draftSet.side,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          }
          setSetsMap({ ...grouped });
        }

        // Restore timer
        const [dbTimer, localTimer] = await Promise.all([
          getRunningTimer(sessionId),
          loadDraftTimer(sessionId),
        ]);

        const timerToUse = dbTimer ?? localTimer
          ? fromRestTimer(dbTimer!) ?? localTimer
          : null;

        if (timerToUse) {
          const state = dbTimer ? fromRestTimer(dbTimer) : timerToUse as TimerState;
          setTimerState(state);
          // Find exercise name for timer
          const timerEx = exData.find((e) => e.id === state.sessionExerciseId);
          if (timerEx) setActiveExerciseName(timerEx.exerciseName);
        }

        // Start session if not started
        if (sessionData.status === "not_started") {
          await updateSession(sessionId, {
            status: "in_progress",
            startedAt: new Date().toISOString(),
          });
          setSession((prev) =>
            prev ? { ...prev, status: "in_progress" } : prev
          );
        }

        // Load settings
        const { getUserSettings } = await import("@/repositories/userSettings");
        const userSettings = await getUserSettings();
        if (userSettings) {
          setSettings({
            soundEnabled: userSettings.soundEnabled,
            vibrationEnabled: userSettings.vibrationEnabled,
          });
        }
      } catch (err) {
        console.error(err);
        showToast("データの読み込みに失敗しました", "error");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ---- Save draft to IndexedDB (debounced) ----
  const saveDraft = useCallback(
    (newSetsMap: Record<string, WorkoutSet[]>) => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(async () => {
        try {
          const allSets = Object.values(newSetsMap).flat();
          await saveDraftSession({
            sessionId,
            updatedAt: new Date().toISOString(),
            sets: allSets.map((s) => ({
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
          // Ignore draft save errors
        }
      }, 300);
    },
    [sessionId]
  );

  // ---- Handle set completion ----
  const handleSetComplete = useCallback(
    async (exerciseId: string, completedSet: WorkoutSet) => {
      // Optimistically update UI
      setSetsMap((prev) => {
        const updated = { ...prev };
        const existingIdx = (prev[exerciseId] ?? []).findIndex(
          (s) =>
            s.setNumber === completedSet.setNumber &&
            s.side === completedSet.side
        );
        if (existingIdx !== -1) {
          updated[exerciseId] = prev[exerciseId].map((s, i) =>
            i === existingIdx ? completedSet : s
          );
        } else {
          // One-arm set not yet in presets — push it
          updated[exerciseId] = [...(prev[exerciseId] ?? []), completedSet];
        }
        saveDraft(updated);
        return updated;
      });

      // Save to Supabase
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
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);

        // Start interval timer if there's a next set
        const ex = exercises.find((e) => e.id === exerciseId);
        if (!ex) return;

        const currentSets = setsMap[exerciseId] ?? [];
        const pendingSets = currentSets.filter(
          (s) =>
            s.status === "pending" && s.setNumber > completedSet.setNumber
        );

        if (pendingSets.length > 0 && session?.status === "in_progress") {
          const nextSet = pendingSets[0];
          const state = createTimerState({
            sessionId,
            sessionExerciseId: exerciseId,
            triggerSetId: completedSet.clientId,
            nextSetNumber: nextSet.setNumber,
            durationSeconds: ex.restSeconds,
          });

          setTimerState(state);
          setActiveExerciseName(ex.exerciseName);

          // Persist timer
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
            // Timer persist failure is non-critical
          }
        }
      } catch (err) {
        console.error(err);
        setSaveStatus("error");
        showToast("セットの保存に失敗しました", "error");
      }
    },
    [exercises, setsMap, session, sessionId, saveDraft, showToast]
  );

  // ---- Handle sets update (apply to remaining, etc.) ----
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

  // ---- Handle skip exercise ----
  const handleSkipExercise = useCallback(
    async (exerciseId: string) => {
      if (!confirm("この種目をスキップしますか？")) return;
      try {
        await updateSessionExercise(exerciseId, { skipped: true });
        setExercises((prev) =>
          prev.map((e) => (e.id === exerciseId ? { ...e, skipped: true } : e))
        );
      } catch {
        showToast("スキップの保存に失敗しました", "error");
      }
    },
    [showToast]
  );

  const handleUnskipExercise = useCallback(
    async (exerciseId: string) => {
      try {
        await updateSessionExercise(exerciseId, { skipped: false });
        setExercises((prev) =>
          prev.map((e) => (e.id === exerciseId ? { ...e, skipped: false } : e))
        );
      } catch {
        showToast("スキップ解除の保存に失敗しました", "error");
      }
    },
    [showToast]
  );

  // ---- Handle delete exercise ----
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

  // ---- Handle delete set ----
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

  // ---- Handle add set ----
  const handleAddSet = useCallback(
    async (exerciseId: string) => {
      const existingSets = setsMap[exerciseId] ?? [];
      const maxSetNumber = existingSets.reduce(
        (max, s) => Math.max(max, s.setNumber),
        0
      );
      const lastSet = existingSets[existingSets.length - 1];
      const newClientId = crypto.randomUUID();
      const newSet: WorkoutSet = {
        id: newClientId,
        userId: lastSet?.userId ?? "",
        sessionExerciseId: exerciseId,
        sessionId,
        setNumber: maxSetNumber + 1,
        weight: lastSet?.weight ?? 0,
        reps: lastSet?.reps ?? 0,
        status: "pending",
        completedAt: null,
        notes: null,
        clientId: newClientId,
        side: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSetsMap((prev) => {
        const updated = { ...prev, [exerciseId]: [...(prev[exerciseId] ?? []), newSet] };
        saveDraft(updated);
        return updated;
      });

      // completed セッションにセットを追加した場合は in_progress に戻す
      if (session?.status === "completed") {
        try {
          await updateSession(sessionId, {
            status: "in_progress",
            completedAt: null,
          });
          setSession((prev) =>
            prev ? { ...prev, status: "in_progress", completedAt: null } : prev
          );
        } catch {
          // Non-critical
        }
      }

      // Persist to DB
      try {
        await upsertSet({
          sessionExerciseId: exerciseId,
          sessionId,
          setNumber: newSet.setNumber,
          weight: newSet.weight,
          reps: newSet.reps,
          status: "pending",
          completedAt: null,
          notes: null,
          clientId: newClientId,
          side: null,
        });
      } catch {
        // Non-critical: draft will sync later
      }
    },
    [setsMap, sessionId, session, saveDraft]
  );

  // ---- Timer callbacks ----
  const handleTimerUpdate = useCallback(
    async (updated: TimerState) => {
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
        // Update DB timer (find by session)
        const dbTimer = await getRunningTimer(sessionId);
        if (dbTimer) {
          await updateTimer(dbTimer.id, {
            endsAt: updated.endsAt,
            adjustmentSeconds: updated.adjustmentSeconds,
          });
        }
      } catch {
        // Non-critical
      }
    },
    [sessionId]
  );

  const handleTimerFinish = useCallback(
    async (finished: TimerState) => {
      setTimerState(finished);
      try {
        await deleteDraftTimer(sessionId);
        const dbTimer = await getRunningTimer(sessionId);
        if (dbTimer) {
          await updateTimer(dbTimer.id, { status: "finished" });
        }
      } catch {
        // Non-critical
      }
      setTimeout(() => setTimerState(null), 3000);
    },
    [sessionId]
  );

  // ---- Complete session ----
  const handleComplete = async () => {
    // If already completed (edit mode), just go back
    if (session?.status === "completed") {
      router.back();
      return;
    }

    const allSets = Object.values(setsMap).flat();
    const completedCount = allSets.filter((s) => s.status === "completed").length;
    const totalCount = allSets.length;
    const pendingCount = totalCount - completedCount;

    // セットがゼロ（プリセット未生成など）か未完了あり → 完了扱いにしない
    if (pendingCount > 0 || totalCount === 0) {
      const msg =
        totalCount === 0
          ? "完了したセットがありません。ホームに戻りますか？"
          : completedCount === 0
          ? "完了したセットがありません。ホームに戻りますか？"
          : `まだ${pendingCount}セット完了していません。ホームに戻りますか？`;
      if (!confirm(msg)) return;
      // in_progress のままホームへ（ホームで「トレーニングを再開」が表示される）
      router.push("/home");
      return;
    }

    // 全セット完了 → /complete へ
    router.push(`/session/${sessionId}/complete`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!session) return null;

  const totalSets = Object.values(setsMap).flat().length;
  const completedSets = Object.values(setsMap)
    .flat()
    .filter((s) => s.status === "completed").length;

  return (
    <div className="py-6 space-y-4">
      {/* Timer bar */}
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

      {/* Header */}
      <div className="flex items-center justify-between pt-12">
        <div>
          <h1 className="text-xl font-bold text-white truncate">
            {session.title}
          </h1>
          <p className="text-xs text-[#8E8E93] mt-0.5">
            {completedSets}/{totalSets} セット完了
            {session.status === "completed" && (
              <span className="ml-2 text-[#CAFF4D]">（編集モード）</span>
            )}
          </p>
        </div>
        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#CAFF4D] rounded-full transition-all duration-300"
          style={{
            width:
              totalSets > 0 ? `${(completedSets / totalSets) * 100}%` : "0%",
          }}
        />
      </div>

      {/* Exercises */}
      {exercises.map((ex) => (
        <ExerciseCard
          key={ex.id}
          sessionExercise={ex}
          sets={setsMap[ex.id] ?? []}
          onSetComplete={(set) => handleSetComplete(ex.id, set)}
          onSetsUpdate={(sets) => handleSetsUpdate(ex.id, sets)}
          onSkipExercise={() => handleSkipExercise(ex.id)}
          onUnskipExercise={() => handleUnskipExercise(ex.id)}
          onDeleteExercise={() => handleDeleteExercise(ex.id)}
          onDeleteSet={(clientId) => handleDeleteSet(ex.id, clientId)}
          onAddSet={() => handleAddSet(ex.id)}
        />
      ))}

      {/* Add exercise link (always visible) */}
      <div className="text-center">
        <a
          href={`/day/${session?.date}/add?sessionId=${sessionId}`}
          className="text-sm text-[#8E8E93] hover:text-white transition-colors"
        >
          ＋ 種目を追加
        </a>
      </div>

      {/* Complete button */}
      <div className="pt-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleComplete}
        >
          {session?.status === "completed" ? "編集を完了する" : "トレーニングを完了する"}
        </Button>
      </div>
    </div>
  );
}
