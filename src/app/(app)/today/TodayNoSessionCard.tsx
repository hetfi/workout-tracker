"use client";

import { useState } from "react";
import Link from "next/link";
import { setRestDay } from "@/app/(app)/day/rest-day-actions";
import { ImportIcon } from "@/components/icons/ImportIcon";

interface TodayNoSessionCardProps {
  date: string;
  initialIsRest: boolean;
  backTo?: string;
}

function ToggleSwitch({ isOn }: { isOn: boolean }) {
  return (
    <div
      className="relative shrink-0 w-12 h-7 rounded-full overflow-hidden"
      style={{ backgroundColor: isOn ? "#ffffff" : "#3A3A3C", transition: "background-color 0.15s" }}
    >
      <span
        className="absolute top-1 w-5 h-5 rounded-full shadow"
        style={{
          backgroundColor: isOn ? "#1C1C1E" : "#8E8E93",
          left: isOn ? "24px" : "4px",
          transition: "left 0.15s ease-in-out, background-color 0.15s",
        }}
      />
    </div>
  );
}

export function TodayNoSessionCard({ date, initialIsRest, backTo = "/today" }: TodayNoSessionCardProps) {
  const [isRest, setIsRest] = useState(initialIsRest);
  const [isPending, setIsPending] = useState(false);

  const toggleRest = async () => {
    if (isPending) return;
    const newVal = !isRest;
    setIsRest(newVal); // 楽観的更新：サーバー応答前に即座に反映
    setIsPending(true);
    const result = await setRestDay(date, newVal);
    if (result.error) setIsRest(!newVal); // エラー時のみ元に戻す
    setIsPending(false);
  };

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {isRest ? (
        <>
          <p className="font-medium text-white">筋肉は休息中に育つ</p>
          <p className="text-sm" style={{ color: "#8E8E93" }}>
            記録する場合は休息日設定をOFFにしてください
          </p>
        </>
      ) : (
        <>
          <p className="font-medium text-white">今日のトレーニングは未登録です</p>
          <p className="text-sm" style={{ color: "#8E8E93" }}>
            メニューを取り込むか、手動で追加できます
          </p>
        </>
      )}

      {/* ChatGPT import */}
      {isRest ? (
        <div
          className="flex items-center justify-center gap-2 w-full text-sm py-3 rounded-xl font-medium"
          style={{ backgroundColor: "#3A3A3C", color: "#48484A" }}
        >
          <ImportIcon /> ChatGPTから取り込む
        </div>
      ) : (
        <Link
          href={`/import?date=${date}`}
          className="flex items-center justify-center gap-2 w-full text-sm py-3 rounded-xl font-semibold"
          style={{ backgroundColor: "#CAFF4D", color: "#0D0D0F" }}
        >
          <ImportIcon /> ChatGPTから取り込む
        </Link>
      )}

      {/* Manual add */}
      {isRest ? (
        <div
          className="flex items-center justify-center gap-2 w-full text-sm py-3 rounded-xl font-medium"
          style={{ backgroundColor: "#3A3A3C", color: "#48484A" }}
        >
          ＋ 手動で種目を追加する
        </div>
      ) : (
        <Link
          href={`/day/${date}/add?backTo=${backTo}`}
          className="flex items-center justify-center gap-2 w-full text-sm py-3 rounded-xl font-medium"
          style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF" }}
        >
          ＋ 手動で種目を追加する
        </Link>
      )}

      {/* Rest day toggle */}
      <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={toggleRest}
          disabled={isPending}
          className="flex items-center justify-between w-full"
          style={{ opacity: isPending ? 0.6 : 1 }}
        >
          <span className="flex items-center gap-2 text-sm" style={{ color: "#8E8E93" }}>
            <span>今日は休息日にする</span>
          </span>
          <ToggleSwitch isOn={isRest} />
        </button>
      </div>
    </div>
  );
}
