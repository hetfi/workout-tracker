"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  classifyExercise,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type MuscleCategory,
} from "@/lib/muscleCategory";
import { addNewExercise } from "./actions";

interface Exercise {
  id: string;
  name: string;
  muscle_category: string | null;
  is_one_arm: boolean;
}

interface Props {
  exercises: Exercise[];
}

const CATEGORIES: MuscleCategory[] = [
  "chest", "shoulder", "back", "leg", "arm", "ab", "cardio",
];

export function ExerciseCategoryGrid({ exercises }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<MuscleCategory>("chest");
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [isPending, startTransition] = useTransition();

  const effectiveCategory = (ex: Exercise): MuscleCategory =>
    ex.muscle_category
      ? (ex.muscle_category as MuscleCategory)
      : classifyExercise(ex.name);

  const filtered = exercises.filter((ex) => effectiveCategory(ex) === active);

  const handleAddExercise = () => {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      await addNewExercise(name, active);
      setNewName("");
      setShowAdd(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* 2×4 category grid */}
      <div className="grid grid-cols-4 gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className="py-2 px-1 rounded-xl text-sm font-medium transition-colors border flex flex-col items-center gap-1"
              style={
                isActive
                  ? {
                      backgroundColor: CATEGORY_COLORS[cat],
                      borderColor: CATEGORY_COLORS[cat],
                      color: cat === "arm" || cat === "cardio" ? "#000" : "#fff",
                    }
                  : {
                      backgroundColor: "#2C2C2E",
                      borderColor: "rgba(255,255,255,0.08)",
                      color: "#fff",
                    }
              }
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isActive ? "rgba(0,0,0,0.3)" : CATEGORY_COLORS[cat] }}
              />
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
        {/* empty cell to fill 2×4 grid */}
        <div />
      </div>

      {/* Exercise list */}
      {filtered.length === 0 && !showAdd ? (
        <div className="text-center py-8 text-[#8E8E93] text-sm">
          {CATEGORY_LABELS[active]}の種目はまだありません
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ex) => (
            <Link key={ex.id} href={`/exercises/${ex.id}`} className="block">
              <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{ex.name}</p>
                  {ex.is_one_arm && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-[#CAFF4D]/40 text-[#CAFF4D] mt-1 inline-block">
                      片手
                    </span>
                  )}
                </div>
                <span className="text-[#8E8E93] text-lg ml-2">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New exercise form */}
      {showAdd ? (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            placeholder={`${CATEGORY_LABELS[active]}の種目名...`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddExercise(); }}
            autoFocus
            className="flex-1 px-3 py-2 rounded-xl bg-[#3A3A3C] border border-white/[0.12] text-white placeholder:text-[#8E8E93] text-sm focus:outline-none focus:border-[#CAFF4D]"
          />
          <button
            onClick={handleAddExercise}
            disabled={!newName.trim() || isPending}
            className="px-4 py-2 rounded-xl bg-[#CAFF4D] text-black text-sm font-semibold disabled:opacity-40"
          >
            追加
          </button>
          <button
            onClick={() => { setShowAdd(false); setNewName(""); }}
            className="px-3 py-2 rounded-xl bg-white/[0.08] text-[#8E8E93] text-sm"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full mt-2 py-2.5 rounded-xl border border-dashed border-white/[0.15] text-[#8E8E93] text-sm hover:border-white/30 hover:text-white transition-colors"
        >
          ＋ {CATEGORY_LABELS[active]}の種目を追加
        </button>
      )}
    </div>
  );
}
