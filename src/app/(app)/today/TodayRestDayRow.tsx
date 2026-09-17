"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setRestDay } from "@/app/(app)/day/rest-day-actions";

export function TodayRestDayRow({ date }: { date: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const mark = async () => {
    if (isPending) return;
    setIsPending(true);
    await setRestDay(date, true);
    router.refresh();
    setIsPending(false);
  };

  return (
    <button
      onClick={mark}
      disabled={isPending}
      className="flex items-center justify-between w-full py-3 px-1"
      style={{ opacity: isPending ? 0.6 : 1 }}
    >
      <span className="flex items-center gap-2 text-sm" style={{ color: "#8E8E93" }}>
        <span>🌙</span>
        <span>今日は休息日にする</span>
      </span>
      <div
        className="relative shrink-0 w-12 h-7 rounded-full overflow-hidden"
        style={{ backgroundColor: "#3A3A3C" }}
      >
        <span
          className="absolute top-1 w-5 h-5 rounded-full shadow"
          style={{ backgroundColor: "#8E8E93", left: "4px" }}
        />
      </div>
    </button>
  );
}
