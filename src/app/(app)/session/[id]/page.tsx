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
  getPreviousSessionDataBatch,
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
import { getExerciseMasterMaps } from "@/repositories/exercises";
import { getUserSettings } from "@/repositories/userSettings";
import { getIntervalEnabled } from "@/lib/storage/localSettings";
import { buildExercisePreset } from "@/lib/preset";
import {
  createTimerState,
  fromRestTimer,
} from "@/lib/timer";
import { useTimerContext } from "@/context/TimerContext";
import {
  classifyExercise,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_ORDER,
  type MuscleCategory,
} from "@/lib/muscleCategory";
import { CopyButton } from "@/components/ui/CopyButton";
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

function getTodayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatJpDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dow = days[new Date(`${dateStr}T12:00:00+09:00`).getDay()];
  return `${y}年${parseInt(m)}月${parseInt(d)}日（${dow}）`;
}

function buildSessionCopyText(
  title: string,
  date: string,
  exercises: WorkoutSessionExercise[],
  setsMap: Record<string, WorkoutSet[]>,
  categoriesMap: Record<string, MuscleCategory>
): string {
  const lines: string[] = [
    `📋 トレーニング記録｜${formatJpDate(date)}`,
    title,
    "",
  ];

  // Group by category
  const byCategory: Record<string, { ex: WorkoutSessionExercise; completedSets: WorkoutSet[] }[]> = {};
  for (const ex of exercises) {
    const completed = (setsMap[ex.id] ?? []).filter((s) => s.status === "completed");
    if (completed.length === 0) continue;
    const cat = categoriesMap[ex.id] ?? "other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ ex, completedSets: completed });
  }

  const orderedCats = CATEGORY_ORDER.filter((c) => byCategory[c]?.length > 0);
  for (const cat of orderedCats) {
    lines.push(`【${CATEGORY_LABELS[cat]}】`);
    for (const { ex, completedSets } of byCategory[cat]) {
      const vol = Math.round(completedSets.reduce((acc, s) => acc + s.weight * s.reps, 0));
      lines.push(`・${ex.exerciseName}: ${completedSets.length}セット${vol > 0 ? ` / ${vol.toLocaleString()}kg` : ""}`);
      for (const s of completedSets) {
        const side = s.side ? `(${s.side}) ` : "";
        const valueStr = ex.isDuration && s.weight === 0 && s.reps > 0
          ? `${s.reps}分`
          : `${s.weight}kg × ${s.reps}回`;
        lines.push(`  ${s.setNumber}${side}: ${valueStr}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
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
  const [categoriesMap, setCategoriesMap] = useState<Record<string, MuscleCategory>>({});
  const [settings, setSettings] = useState({
    soundEnabled: true,
    vibrationEnabled: true,
  });
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Sync timer state to global context (for cross-page persistence) ----
  const {
    setTimerState: setContextTimerState,
    setExerciseName: setContextExerciseName,
    setSoundEnabled,
    setVibrationEnabled,
  } = useTimerContext();

  useEffect(() => {
    setContextTimerState(timerState);
  }, [timerState, setContextTimerState]);

  useEffect(() => {
    setContextExerciseName(activeExerciseName);
  }, [activeExerciseName, setContextExerciseName]);

  useEffect(() => {
    setSoundEnabled(settings.soundEnabled);
    setVibrationEnabled(settings.vibrationEnabled);
  }, [settings.soundEnabled, settings.vibrationEnabled, setSoundEnabled, setVibrationEnabled]);

  // ---- Load session data ----
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // 全依存なしのデータを一括並列取得（7 段逐次 → 1 Promise.all）
        const [
          sessionData,
          exData,
          masterMaps,
          setsData,
          dbTimer,
          localTimer,
          userSettings,
          draft,
        ] = await Promise.all([
          getSessionById(sessionId),
          getSessionExercises(sessionId),
          getExerciseMasterMaps(),
          getSessionSets(sessionId),
          getRunningTimer(sessionId),
          loadDraftTimer(sessionId),
          getUserSettings(),
          loadDraftSession(sessionId),
        ]);

        if (!sessionData) {
          showToast("セッションが見つかりません", "error");
          router.push("/home");
          return;
        }

        const { categoryMap: masterMap, durationMap } = masterMaps;

        setSession(sessionData);

        // isDuration をマスターから上書き
        const enrichedExData = exData.map((ex) => ({
          ...ex,
          isDuration: durationMap[ex.exerciseName] ?? false,
        }));
        setExercises(enrichedExData);

        // 部位カテゴリマップを構築
        const catMap: Record<string, MuscleCategory> = {};
        for (const ex of enrichedExData) {
          catMap[ex.id] =
            (masterMap[ex.exerciseName] as MuscleCategory | undefined) ??
            classifyExercise(ex.exerciseName);
        }
        setCategoriesMap(catMap);

        // ユーザー設定を反映
        if (userSettings) {
          setSettings({
            soundEnabled: userSettings.soundEnabled,
            vibrationEnabled: userSettings.vibrationEnabled,
          });
        }

        // Group sets by sessionExerciseId
        const grouped: Record<string, WorkoutSet[]> = {};
        for (const ex of enrichedExData) {
          grouped[ex.id] = [];
        }
        for (const s of setsData) {
          if (!grouped[s.sessionExerciseId]) {
            grouped[s.sessionExerciseId] = [];
          }
          grouped[s.sessionExerciseId].push(s);
        }

        // プリセットが必要な種目を一括取得（N+1 → 1 クエリ）
        const exercisesNeedingPresets = enrichedExData.filter(
          (ex) => grouped[ex.id].length === 0
        );
        const prevDataMap = await getPreviousSessionDataBatch(exercisesNeedingPresets, sessionData.date);
        for (const ex of exercisesNeedingPresets) {
          const prev = prevDataMap.get(ex.exerciseName) ?? null;
          const preset = buildExercisePreset(ex, prev);
          grouped[ex.id] = preset.sets.map((p) => ({
            id: newClientId(),
            userId: "",
            sessionExerciseId: ex.id,
            sessionId,
            setNumber: p.setNumber,
            weight: p.weight,
            reps: p.reps,
            status: "pending" as const,
            completedAt: null,
            notes: null,
            clientId: newClientId(),
            side: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
        }

        setSetsMap(grouped);

        // 過去日セッションはタイマー不要
        const isPastSessionLoaded = sessionData.date < getTodayJST();

        // IndexedDB ドラフトをマージ
        if (draft) {
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

        // タイマーを復元（過去日セッションはタイマー不要なのでスキップ）
        if (!isPastSessionLoaded) {
          const timerToUse =
            dbTimer ?? localTimer
              ? fromRestTimer(dbTimer!) ?? localTimer
              : null;
          if (timerToUse) {
            const state = dbTimer
              ? fromRestTimer(dbTimer)
              : (timerToUse as TimerState);
            setTimerState(state);
            const timerEx = exData.find((e) => e.id === state?.sessionExerciseId);
            if (timerEx) setActiveExerciseName(timerEx.exerciseName);
          }
        }

        // セッションを in_progress に更新
        if (sessionData.status === "not_started") {
          await updateSession(sessionId, {
            status: "in_progress",
            startedAt: new Date().toISOString(),
          });
          setSession((prev) =>
            prev ? { ...prev, status: "in_progress" } : prev
          );
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

        // Start interval timer if there's a next set（過去日セッションはタイマー不要）
        const ex = exercises.find((e) => e.id === exerciseId);
        if (!ex) return;

        const currentSets = setsMap[exerciseId] ?? [];
        const pendingSets = currentSets.filter(
          (s) =>
            s.status === "pending" && s.setNumber > completedSet.setNumber
        );

        const isToday = session?.date === getTodayJST();
        if (isToday && pendingSets.length > 0 && session?.status === "in_progress" && getIntervalEnabled()) {
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

  // ---- Handle reorder exercises ----
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

      setExercises((prev) => {
        const updated = prev.map((e) => {
          if (e.id === a.id) return { ...e, sortOrder: aNewOrder };
          if (e.id === b.id) return { ...e, sortOrder: bNewOrder };
          return e;
        });
        return [...updated].sort((x, y) => x.sortOrder - y.sortOrder);
      });

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
    // If already completed (edit mode)
    if (session?.status === "completed") {
      // 全種目削除済みなら「記録なし」状態に戻す
      if (exercises.length === 0) {
        try {
          await updateSession(sessionId, { status: "abandoned" });
        } catch {
          /* non-critical */
        }
        window.location.replace(`/day/${session?.date}`);
        return;
      }
      router.back();
      return;
    }

    const allSets = Object.values(setsMap).flat();
    const completedCount = allSets.filter((s) => s.status === "completed").length;
    const totalCount = allSets.length;
    const pendingCount = totalCount - completedCount;

    if (isPastSession) {
      if (totalCount === 0) {
        // セットなし → セッション破棄して「記録なし」状態で表示
        try {
          await updateSession(sessionId, { status: "abandoned" });
        } catch {
          /* non-critical */
        }
        window.location.replace(`/day/${session?.date}`);
        return;
      }
      // pending セットがあれば全て completed に昇格してから完了
      if (pendingCount > 0) {
        const pendingSets = allSets.filter((s) => s.status !== "completed");
        try {
          await Promise.all(
            pendingSets.map((s) =>
              upsertSet({ ...s, status: "completed", completedAt: new Date().toISOString() })
            )
          );
        } catch {
          /* non-critical */
        }
      }
      try {
        await updateSession(sessionId, {
          status: "completed",
          completedAt: new Date().toISOString(),
        });
      } catch {
        /* non-critical */
      }
      window.location.replace(`/day/${session?.date}`);
      return;
    }

    // 通常セッション: セットがゼロか未完了あり → 確認ダイアログ
    if (pendingCount > 0 || totalCount === 0) {
      const msg =
        totalCount === 0
          ? "完了したセットがありません。ホームに戻りますか？"
          : completedCount === 0
          ? "完了したセットがありません。ホームに戻りますか？"
          : `まだ${pendingCount}セット完了していません。ホームに戻りますか？`;
      if (!confirm(msg)) return;
      router.push("/home");
      return;
    }

    // 全セット完了 → グッジョブ画面へ
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

  // 部位カテゴリ別の進捗を集計
  const categoryProgress: Record<string, { completed: number; total: number }> = {};
  for (const ex of exercises) {
    const cat = (categoriesMap[ex.id] ?? classifyExercise(ex.exerciseName)) as string;
    const exSets = setsMap[ex.id] ?? [];
    const isOneArm = ex.isOneArm;
    const total = isOneArm ? ex.plannedSets * 2 : exSets.length;
    const completed = isOneArm
      ? exSets.filter((s) => s.side && s.status === "completed").length
      : exSets.filter((s) => s.status === "completed").length;
    if (total === 0) continue;
    if (!categoryProgress[cat]) categoryProgress[cat] = { completed: 0, total: 0 };
    categoryProgress[cat].completed += completed;
    categoryProgress[cat].total += total;
  }

  // 過去日セッションはタイマー表示・起動しない
  const isPastSession = session?.date ? session.date < getTodayJST() : false;

  return (
    <div className="py-6 space-y-4">
      {/* Timer bar — 過去日セッションでは表示しない */}
      {!isPastSession && timerState && timerState.status === "running" && (
        <IntervalTimer
          timer={timerState}
          exerciseName={activeExerciseName}
          onUpdate={handleTimerUpdate}
          onFinish={handleTimerFinish}
          soundEnabled={settings.soundEnabled}
          vibrationEnabled={settings.vibrationEnabled}
        />
      )}

      {/* Back */}
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm font-medium"
          style={{ color: "#CAFF4D" }}
        >
          ← 戻る
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
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

      {/* Per-category progress bars */}
      <div className="space-y-2">
        {CATEGORY_ORDER.filter((cat) => categoryProgress[cat]).map((cat) => {
          const { completed, total } = categoryProgress[cat];
          const color = CATEGORY_COLORS[cat as MuscleCategory];
          return (
            <div key={cat} className="flex items-center gap-3">
              <span
                className="text-xs font-semibold w-12 shrink-0 whitespace-nowrap"
                style={{ color }}
              >
                {CATEGORY_LABELS[cat as MuscleCategory]}
              </span>
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${total > 0 ? (completed / total) * 100 : 0}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span
                className="text-xs w-10 text-right"
                style={{ color: "#8E8E93" }}
              >
                {completed}/{total}
              </span>
            </div>
          );
        })}
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
          onAddSet={(nextSN) => handleAddSet(ex.id)}
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

      {/* Copy button (show when at least 1 set completed) */}
      {completedSets > 0 && (
        <CopyButton
          text={buildSessionCopyText(
            session.title,
            session.date,
            exercises,
            setsMap,
            categoriesMap
          )}
          label="記録をChatGPTにコピー"
          className="w-full py-3 rounded-xl text-sm font-medium transition-colors"
        />
      )}

      {/* Complete button */}
      <div className="pt-1">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleComplete}
        >
          {session?.status === "completed" ? "編集を完了する" : isPastSession ? "実績を登録する" : "トレーニングを完了する"}
        </Button>
      </div>
    </div>
  );
}
