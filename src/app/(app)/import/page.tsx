"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MenuTextInput } from "@/components/import/MenuTextInput";
import { MenuPreview } from "@/components/import/MenuPreview";
import { saveParsedWorkout, listPlans, getPlanExercises } from "@/repositories/workoutPlans";
import { createSessionFromPlanWithDuration } from "@/repositories/workoutSessions";
import { useToast } from "@/components/ui/Toast";
import type { ParsedWorkout } from "@/domain/types";

type Step = "input" | "preview";

function ImportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("input");
  const [parsed, setParsed] = useState<ParsedWorkout | null>(null);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);

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
          // Replace: archive existing
          const { updatePlan } = await import("@/repositories/workoutPlans");
          await updatePlan(duplicate.id, { status: "archived" });
        }
        // else: save as new (fall through)
      }

      const plan = await saveParsedWorkout(workout, raw);

      // Create a session from the plan so it appears immediately in today's menu
      const planExercises = await getPlanExercises(plan.id);
      const isDurationByName: Record<string, boolean> = {};
      for (const ex of workout.exercises) {
        if (ex.isDuration) isDurationByName[ex.name] = true;
      }
      await createSessionFromPlanWithDuration(plan, planExercises, isDurationByName);

      showToast("メニューを登録しました", "success");
      router.push("/today");
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
        {step === "input" ? (
          <button
            onClick={() => router.back()}
            className="text-sm font-medium"
            style={{ color: "#CAFF4D" }}
          >
            ← 戻る
          </button>
        ) : (
          <button
            onClick={() => setStep("input")}
            className="text-sm font-medium"
            style={{ color: "#CAFF4D" }}
          >
            ← 戻る
          </button>
        )}
        <h1 className="text-xl font-bold text-white">
          {step === "input"
            ? dateParam
              ? `${dateParam.slice(5, 7)}月${parseInt(dateParam.slice(8, 10))}日のメニューを追加`
              : "メニューを取り込む"
            : "確認・編集"}
        </h1>
      </div>

      {step === "input" && <MenuTextInput onParsed={handleParsed} />}

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
