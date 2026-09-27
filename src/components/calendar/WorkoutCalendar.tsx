"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER, MuscleCategory } from "@/lib/muscleCategory";
import { fetchCalendarChunk } from "@/app/(app)/home/actions";

interface WorkoutCalendarProps {
  initialYear: number;
  initialMonth: number;
  /** 初期ロード済みデータ（"YYYY-MM-DD" → categories） */
  initialData: Record<string, MuscleCategory[]>;
  /** 初期ロード済みの休息日リスト */
  restDays?: string[];
  /** ナビゲーション可能な絶対下限（通常 24 ヶ月前） */
  oldestYear: number;
  oldestMonth: number;
  /** 初期ロード済みデータの最古月（先読みトリガーの基準） */
  loadedOldestYear: number;
  loadedOldestMonth: number;
}

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const CHUNK_MONTHS = 3;

function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function toMonthNum(y: number, m: number) {
  return y * 12 + m;
}

export function WorkoutCalendar({
  initialYear,
  initialMonth,
  initialData,
  restDays = [],
  oldestYear,
  oldestMonth,
  loadedOldestYear: loadedOldestYearProp,
  loadedOldestMonth: loadedOldestMonthProp,
}: WorkoutCalendarProps) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [calData, setCalData] = useState<Record<string, MuscleCategory[]>>(initialData);
  const [restDaySet, setRestDaySet] = useState(() => new Set(restDays));
  const [loadedOldestYear, setLoadedOldestYear] = useState(loadedOldestYearProp);
  const [loadedOldestMonth, setLoadedOldestMonth] = useState(loadedOldestMonthProp);
  const [isFetching, setIsFetching] = useState(false);
  const isFetchingRef = useRef(false);

  const todayStr = getTodayJST();
  const todayDate = new Date(todayStr + "T00:00:00+09:00");
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth() + 1;

  // 表示月がロード済み境界に近づいたら次のチャンクを先読みする
  useEffect(() => {
    const currentNum = toMonthNum(year, month);
    const loadedOldestNum = toMonthNum(loadedOldestYear, loadedOldestMonth);
    const absoluteOldestNum = toMonthNum(oldestYear, oldestMonth);

    // ロード済み最古の1ヶ月後以内に入ったらトリガー
    if (currentNum > loadedOldestNum + 1) return;
    // 絶対下限まで読み終えていたら終了
    if (loadedOldestNum <= absoluteOldestNum) return;
    // 既にフェッチ中なら重複しない
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsFetching(true);

    // ロード済み最古の 1 ヶ月前を終端として CHUNK_MONTHS ヶ月分取得
    let prevToYear = loadedOldestYear;
    let prevToMonth = loadedOldestMonth - 1;
    if (prevToMonth === 0) { prevToYear--; prevToMonth = 12; }

    fetchCalendarChunk(prevToYear, prevToMonth, CHUNK_MONTHS)
      .then(({ calendarData: chunk, restDays: chunkRestDays }) => {
        setCalData(prev => ({ ...chunk, ...prev }));
        setRestDaySet(prev => {
          const next = new Set(prev);
          for (const d of chunkRestDays) next.add(d);
          return next;
        });
        // JavaScript の Date は month に負値を渡しても正しく処理する
        const newOldest = new Date(prevToYear, prevToMonth - CHUNK_MONTHS, 1);
        setLoadedOldestYear(newOldest.getFullYear());
        setLoadedOldestMonth(newOldest.getMonth() + 1);
      })
      .catch(() => {})
      .finally(() => {
        isFetchingRef.current = false;
        setIsFetching(false);
      });
  }, [year, month, loadedOldestYear, loadedOldestMonth, oldestYear, oldestMonth]);

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

  const PAST_CELL_BG = "#3B3B3D";
  const FUTURE_CELL_BG = "rgba(255,255,255,0.03)";

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

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-base font-bold text-white tracking-wide">
            {year}年{month}月
          </span>
          {isFetching && (
            <span className="text-xs" style={{ color: "#636366" }}>読み込み中…</span>
          )}
        </div>

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
      <div className="grid grid-cols-7 gap-x-1 mb-1.5">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold py-1"
            style={{ color: "#636366" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`pad-${idx}`} />;
          }

          const dateStr = formatDateStr(day);
          const categories = calData[dateStr] ?? [];
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const isRestDay = !isFuture && restDaySet.has(dateStr);

          const handleClick = () => {
            if (isToday) {
              setNavigatingTo("today");
              router.push("/today");
            } else if (!isFuture) {
              setNavigatingTo(dateStr);
              router.push(`/day/${dateStr}`);
            }
          };

          const isNavigating = navigatingTo === dateStr || (isToday && navigatingTo === "today");
          const cellBg = isToday ? "#CAFF4D" : isFuture ? FUTURE_CELL_BG : PAST_CELL_BG;
          const textColor = isToday ? "#0D0D0F" : isFuture ? "#555558" : "#FFFFFF";
          const dotShadowColor = isToday ? "#CAFF4D" : isFuture ? "#2C2C2E" : PAST_CELL_BG;

          return (
            <button
              key={dateStr}
              onClick={handleClick}
              disabled={isFuture || isNavigating}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg transition-opacity active:opacity-70 disabled:cursor-default"
              style={{
                backgroundColor: cellBg,
                opacity: isNavigating ? 0.55 : 1,
                transition: "opacity 0.15s",
              }}
            >
              <span
                className="text-sm leading-none"
                style={{ color: textColor, fontWeight: isToday ? 700 : 600 }}
              >
                {day}
              </span>

              <div className="flex items-center justify-center h-1.5">
                {isRestDay ? (
                  <span
                    className="text-xs leading-none font-bold"
                    style={{ color: isToday ? "rgba(0,0,0,0.45)" : "#AEAEB2", fontSize: "10px", lineHeight: 1 }}
                  >
                    –
                  </span>
                ) : (
                  categories.map((cat, i) => (
                    <span
                      key={cat}
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: CATEGORY_COLORS[cat],
                        marginLeft: i === 0 ? 0 : categories.length <= 3 ? "1px" : "-2px",
                        boxShadow: `0 0 0 1px ${dotShadowColor}`,
                      }}
                    />
                  ))
                )}
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
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold" style={{ color: "#AEAEB2" }}>–</span>
          <span className="text-xs" style={{ color: "#8E8E93" }}>休息日</span>
        </div>
      </div>
    </div>
  );
}
