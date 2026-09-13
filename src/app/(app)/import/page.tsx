"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MenuTextInput } from "@/components/import/MenuTextInput";
import { MenuPreview } from "@/components/import/MenuPreview";
import { saveParsedWorkout, listPlans } from "@/repositories/workoutPlans";
import { useToast } from "@/components/ui/Toast";
import type { ParsedWorkout } from "@/domain/types";

type Step = "input" | "preview";

export default function ImportPage() {
  const router = useRouter();
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

      await saveParsedWorkout(workout, raw);
      showToast("メニューを登録しました", "success");
      router.push("/home");
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
        {step === "preview" && (
          <button
            onClick={() => setStep("input")}
            className="text-blue-600 dark:text-blue-400 text-sm font-medium"
          >
            ← 戻る
          </button>
        )}
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {step === "input" ? "メニューを取り込む" : "確認・編集"}
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
        />
      )}
    </div>
  );
}
