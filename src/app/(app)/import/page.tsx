"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MenuTextInput } from "@/components/import/MenuTextInput";
import { MenuPreview } from "@/components/import/MenuPreview";
import { saveParsedWorkout, listPlans, getPlanExercises } from "@/repositories/workoutPlans";
import { createSessionFromPlanWithDuration } from "@/repositories/workoutSessions";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import type { ParsedWorkout } from "@/domain/types";

type Step = "input" | "preview";

export interface ExistingExercise {
  name: string;
  isOneArm: boolean;
  isDuration: boolean;
}

function ImportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("input");
  const [parsed, setParsed] = useState<ParsedWorkout | null>(null);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);
  const [existingExercises, setExistingExercises] = useState<ExistingExercise[]>([]);

  // 既存種目をロード（GPTプロンプトに表示するため）
  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("exercises")
          .select("name, is_one_arm, is_duration")
          .is("deleted_at", null)
          .order("name")
          .limit(300);
        setExistingExercises(
          (data ?? []).map((e) => ({
            name: e.name as string,
            isOneArm: Boolean(e.is_one_arm),
            isDuration: Boolean(e.is_duration),
          }))
        );
      } catch {
        // 取得失敗は無視（プロンプトに種目名が出ないだけで機能は問題なし）
      }
    };
    load();
  }, []);

  const handleParsed = (workout: ParsedWorkout, raw: string) => {
    setParsed(workout);
    setRawText(raw);
    setStep("preview");
  };

  const handleConfirm = async (workout: ParsedWorkout, raw: string) => {
    setSaving(true);
    try {
      // Check for duplicate
      const existing = await listPlans(workout.date);
      const duplicate = existing.find(
        (p) => p.title === workout.title && p.date === workout.date
      );

      if (duplicate) {
        const choice = window.confirm(
          `「${workout.title}」（${workout.date}）は既に登録されています。\n\n「OK」で既存メニューを置き換え、「キャンセル」で別メニューとして保存します。`
        );
        if (choice) {
          const { updatePlan } = await import("@/repositories/workoutPlans");
          await updatePlan(duplicate.id, { status: "archived" });
        }
      }

      // 1. プラン + 種目マスター保存
      const plan = await saveParsedWorkout(workout, raw);

      // 2. プラン種目を取得してセッション作成
      const planExercises = await getPlanExercises(plan.id);

      // ParsedExercise からルックアップマップを構築
      const isDurationByName: Record<string, boolean> = {};
      const isOneArmByName: Record<string, boolean> = {};
      for (const ex of workout.exercises) {
        if (ex.isDuration) isDurationByName[ex.name] = true;
        if (ex.isOneArm) isOneArmByName[ex.name] = true;
      }

      await createSessionFromPlanWithDuration(
        plan,
        planExercises,
        isDurationByName,
        isOneArmByName
      );

      showToast("メニューを登録しました", "success");
      // router.push はクライアント側キャッシュを使うことがあるため
      // フルリロードで確実に最新データを取得する
      window.location.href = "/today";
    } catch (err) {
      console.error(err);
      showToast("登録に失敗しました。もう一度お試しください。", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => step === "input" ? router.back() : setStep("input")}
          className="text-sm font-medium"
          style={{ color: "#CAFF4D" }}
        >
          ← 戻る
        </button>
        <h1 className="text-xl font-bold text-white">
          {step === "input"
            ? dateParam
              ? `${dateParam.slice(5, 7)}月${parseInt(dateParam.slice(8, 10))}日のメニューを追加`
              : "メニューを取り込む"
            : "確認・編集"}
        </h1>
      </div>

      {step === "input" && (
        <MenuTextInput
          onParsed={handleParsed}
          existingExercises={existingExercises}
        />
      )}

      {step === "preview" && parsed && (
        <MenuPreview
          workout={parsed}
          rawText={rawText}
          onConfirm={handleConfirm}
          onBack={() => setStep("input")}
          saving={saving}
          defaultDate={dateParam ?? undefined}
        />
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<div className="py-6 text-center text-gray-400">読み込み中...</div>}>
      <ImportPageInner />
    </Suspense>
  );
}
