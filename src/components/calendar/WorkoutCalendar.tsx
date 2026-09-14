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

  // 翌月：当月以降は非表示
  const isNextMonthDisabled =
    year > currentYear || (year === currentYear && month >= currentMonth);

  // 前月：oldest より前には戻れない
  const isPrevMonthDisabled =
    year < oldestYear || (year === oldestYear && month <= oldestMonth);

  // クライアントサイドのみでナビ（サーバー呼び出しなし）
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

  // Build calendar grid
  const firstDay = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Cells: null = padding, number = day
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const formatDateStr = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const allCategories = CATEGORY_ORDER;

  return (
    <div className="bg-[#2C2C2E] rounded-xl p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          disabled={isPrevMonthDisabled}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-[#8E8E93] disabled:opacity-40 disabled:cursor-default"
          aria-label="前の月"
        >
          ◀
        </button>
        <span className="text-base font-semibold text-white">
          {year}年{month}月
        </span>
        <button
          onClick={nextMonth}
          disabled={isNextMonthDisabled}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.08] text-[#8E8E93] disabled:opacity-40 disabled:cursor-default"
          aria-label="次の月"
        >
          ▶
        </button>
      </div>

      {/* Day of week header */}
      <div className="grid grid-cols-7 mb-1">
        {DOW_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium pb-1 text-[#8E8E93]">
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
            if (isToday) {
              router.push("/today");
            } else if (!isFuture) {
              router.push(`/day/${dateStr}`);
            }
            // 未来日はタップ無効
          };

          return (
            <button
              key={dateStr}
              onClick={handleClick}
              disabled={isFuture}
              className="flex flex-col items-center py-1 rounded-lg hover:bg-white/[0.06] disabled:cursor-default disabled:hover:bg-transparent"
            >
              {/* Day number */}
              <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                isToday
                  ? "bg-[#CAFF4D] text-black font-bold"
                  : isFuture
                  ? "text-[#48484A]"
                  : "text-white"
              }`}>
                {day}
              </div>
              {/* Category dots */}
              <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 min-h-[8px]">
                {categories.slice(0, 4).map((cat) => (
                  <span
                    key={cat}
                    style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    className="w-1.5 h-1.5 rounded-full"
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-4 pt-3 border-t border-white/[0.08]">
        {allCategories.map((cat) => (
          <div key={cat} className="flex items-center gap-1">
            <span
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              className="w-2 h-2 rounded-full"
            />
            <span className="text-xs text-[#8E8E93]">
              {CATEGORY_LABELS[cat]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
