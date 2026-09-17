"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setRestDay } from "@/app/(app)/day/rest-day-actions";
import { ImportIcon } from "@/components/icons/ImportIcon";

interface TodayRestDayCardProps {
  date: string;
}

export function TodayRestDayCard({ date }: TodayRestDayCardProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const unmark = async () => {
    if (isPending) return;
    setIsPending(true);
    await setRestDay(date, false);
    router.refresh();
    setIsPending(false);
  };

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="font-medium text-white">休息中に筋肉は育っています！</p>

      <div
        className="flex items-center justify-center gap-2 w-full text-sm py-3 rounded-xl font-medium"
        style={{ backgroundColor: "#3A3A3C", color: "#48484A" }}
      >
        <ImportIcon /> ChatGPTから取り込む
      </div>
      <div
        className="flex items-center justify-center gap-2 w-full text-sm py-3 rounded-xl font-medium"
        style={{ backgroundColor: "#3A3A3C", color: "#48484A" }}
      >
        ＋ 手動で種目を追加する
      </div>

      <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={unmark}
          disabled={isPending}
          className="flex items-center justify-between w-full"
          style={{ opacity: isPending ? 0.6 : 1 }}
        >
          <span className="flex items-center gap-2 text-sm" style={{ color: "#8E8E93" }}>
            <span>今日は休息日にする</span>
          </span>
          {/* Toggle ON */}
          <div
            className="relative shrink-0 w-12 h-7 rounded-full overflow-hidden"
            style={{ backgroundColor: "#ffffff" }}
          >
            <span
              className="absolute top-1 w-5 h-5 rounded-full shadow"
              style={{ backgroundColor: "#1C1C1E", left: "24px" }}
            />
          </div>
        </button>
      </div>
    </div>
  );
}
