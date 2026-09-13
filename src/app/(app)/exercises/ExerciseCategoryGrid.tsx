"use client";

import { useState } from "react";
import Link from "next/link";
import {
  classifyExercise,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type MuscleCategory,
} from "@/lib/muscleCategory";

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
  "chest", "shoulder", "arm", "back", "leg", "ab", "cardio",
];

export function ExerciseCategoryGrid({ exercises }: Props) {
  const [active, setActive] = useState<MuscleCategory>("chest");

  const effectiveCategory = (ex: Exercise): MuscleCategory =>
    ex.muscle_category
      ? (ex.muscle_category as MuscleCategory)
      : classifyExercise(ex.name);

  const filtered = exercises.filter((ex) => effectiveCategory(ex) === active);

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
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-[#8E8E93] text-sm">
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
    </div>
  );
}
