"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CATEGORY_COLORS } from "@/lib/muscleCategory";
import { getHistoryDays, type HistoryDay } from "./actions";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  const dow = DOW[date.getDay()];
  return `${parseInt(m)}/${parseInt(d)}（${dow}）`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed")
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#CAFF4D]/20 text-[#CAFF4D]">
        完了
      </span>
    );
  if (status === "in_progress")
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
        実施中
      </span>
    );
  return null;
}

interface Props {
  initialDays: HistoryDay[];
  oldestDate: string;
}

export function HistoryList({ initialDays, oldestDate }: Props) {
  const [days, setDays] = useState<HistoryDay[]>(initialDays);
  const [nextEndDate, setNextEndDate] = useState(oldestDate);
  const [hasMore, setHasMore] = useState(initialDays.length >= 14);
  const [isPending, startTransition] = useTransition();

  const loadMore = () => {
    startTransition(async () => {
      const more = await getHistoryDays(nextEndDate, 14);
      if (more.length === 0) {
        setHasMore(false);
        return;
      }
      setDays((prev) => [...prev, ...more]);
      setNextEndDate(more[more.length - 1].date);
      if (more.length < 3) setHasMore(false); // 日ベースなので少なめの閾値
    });
  };

  if (days.length === 0) {
    return (
      <div className="text-center py-16 text-[#8E8E93]">
        <p>まだトレーニング記録がありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {days.map((day) => (
        <div
          key={day.date}
          className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4 space-y-3"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-[#8E8E93] mb-0.5">{formatDate(day.date)}</p>
              <p className="font-semibold text-white">{day.title}</p>
            </div>
            <StatusBadge status={day.status} />
          </div>

          {/* Exercise list */}
          {day.exercises.length > 0 && (
            <ul className="space-y-1.5">
              {day.exercises.map((ex, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[ex.category] }}
                  />
                  <span className="text-white flex-1 truncate">{ex.name}</span>
                  {ex.completedSets > 0 && (
                    <span className="text-[#8E8E93] text-xs shrink-0">
                      {ex.completedSets}セット
                      {ex.totalVolume > 0 && (
                        <> ({ex.totalVolume.toLocaleString()}kg)</>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Detail link → day view */}
          <Link
            href={`/day/${day.date}`}
            className="block text-xs text-[#CAFF4D] text-right"
          >
            詳細を見る →
          </Link>
        </div>
      ))}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isPending}
          className="w-full py-3 text-sm text-[#8E8E93] hover:text-white border border-white/[0.08] rounded-xl transition-colors disabled:opacity-50"
        >
          {isPending ? "読み込み中..." : "さらに表示（2週間前）"}
        </button>
      )}
    </div>
  );
}
