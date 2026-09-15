"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER, MuscleCategory } from "@/lib/muscleCategory";

interface WorkoutCalendarProps {
  initialYear: number;
  initialMonth: number;
  /** 過去3ヶ月分のデータをまとめて受け取る（"YYYY-MM-DD" → categories） */
  initialData: Record<string, MuscleCategory[]>;
  /** 表示を許可する最古の年月 */
  oldestYear: number;
  oldestMonth: number;
}

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export function WorkoutCalendar({
  initialYear,
  initialMonth,
  initialData,
  oldestYear,
  oldestMonth,
}: WorkoutCalendarProps) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const todayStr = getTodayJST();
  const todayDate = new Date(todayStr + "T00:00:00+09:00");
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth() + 1;

  const isNextMonthDisabled =
    year > currentYear || (year === currentYear && month >= currentMonth);
  const isPrevMonthDisabled =
    year < oldestYear || (year === oldestYear && month <= oldestMonth);

  const prevMonth = () => {
    if (isPrevMonthDisabled) return;
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (isNextMonthDisabled) return;
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const firstDay = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const formatDateStr = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          disabled={isPrevMonthDisabled}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] active:bg-white/[0.12] text-[#8E8E93] disabled:opacity-30 disabled:cursor-default"
          aria-label="前の月"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-base font-bold text-white tracking-wide">
          {year}年{month}月
        </span>
        <button
          onClick={nextMonth}
          disabled={isNextMonthDisabled}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] active:bg-white/[0.12] text-[#8E8E93] disabled:opacity-30 disabled:cursor-default"
          aria-label="次の月"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day of week header */}
      <div className="grid grid-cols-7 mb-2">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold pb-2"
            style={{ color: "#636366" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`pad-${idx}`} />;
          }
          const dateStr = formatDateStr(day);
          const categories = initialData[dateStr] ?? [];
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const handleClick = () => {
            if (isToday) router.push("/today");
            else if (!isFuture) router.push(`/day/${dateStr}`);
          };

          // Day number style
          let numBg = "transparent";
          let numColor = "#FFFFFF";
          let numWeight = "600";
          if (isToday) {
            numBg = "#CAFF4D";
            numColor = "#0D0D0F";
            numWeight = "700";
          } else if (isFuture) {
            numColor = "#38383A";
          }

          return (
            <button
              key={dateStr}
              onClick={handleClick}
              disabled={isFuture}
              className="flex flex-col items-center py-1 rounded-xl transition-colors hover:bg-white/[0.05] active:bg-white/[0.08] disabled:cursor-default disabled:hover:bg-transparent"
            >
              {/* Day number */}
              <div
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm"
                style={{
                  backgroundColor: numBg,
                  color: numColor,
                  fontWeight: numWeight,
                }}
              >
                {day}
              </div>

              {/* Category dots — overlap to fit all in one row */}
              <div className="flex items-center justify-center mt-1 h-2">
                {categories.map((cat, i) => (
                  <span
                    key={cat}
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: CATEGORY_COLORS[cat],
                      marginLeft: i === 0 ? 0 : "-3px",
                      boxShadow: "0 0 0 1px #2C2C2E",
                    }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap gap-x-3 gap-y-1.5 mt-4 pt-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            />
            <span className="text-xs" style={{ color: "#8E8E93" }}>
              {CATEGORY_LABELS[cat]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
