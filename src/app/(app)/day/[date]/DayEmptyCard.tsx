"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setRestDay } from "@/app/(app)/day/rest-day-actions";

interface DayEmptyCardProps {
  date: string;
  initialIsRest: boolean;
  /** セッションがある場合のリンク先（「実績を記録する」ボタン用） */
  sessionLink?: string;
  label?: string; // "この日は休息日にする"
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

export function DayEmptyCard({ date, initialIsRest, sessionLink, label }: DayEmptyCardProps) {
  const router = useRouter();
  const [isRest, setIsRest] = useState(initialIsRest);
  const [isPending, setIsPending] = useState(false);

  const toggleRest = async () => {
    if (isPending) return;
    const newVal = !isRest;
    setIsRest(newVal); // 楽観的更新：サーバー応答前に即座に反映
    setIsPending(true);
    const result = await setRestDay(date, newVal);
    if (result.error) {
      setIsRest(!newVal); // エラー時のみ元に戻す
    } else {
      router.refresh();
    }
    setIsPending(false);
  };

  const toggleLabel = label ?? "この日は休息日にする";

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {isRest ? (
        <>
          <p className="font-medium text-white">この日は休息日です</p>
          <p className="text-sm" style={{ color: "#8E8E93" }}>
            実績を記録する場合は休息日設定をOFFにしてください
          </p>
        </>
      ) : sessionLink ? (
        <>
          <p className="font-medium text-white">まだセットが記録されていません</p>
          <p className="text-sm" style={{ color: "#8E8E93" }}>
            この日の重量・回数を入力できます
          </p>
        </>
      ) : (
        <>
          <p className="text-sm" style={{ color: "#8E8E93" }}>
            この日のトレーニング記録はありません
          </p>
        </>
      )}

      {/* セッションリンク（実績を記録する） */}
      {sessionLink && (
        isRest ? (
          <div
            className="flex items-center justify-center gap-2 w-full text-sm py-3 rounded-xl font-medium"
            style={{ backgroundColor: "#3A3A3C", color: "#48484A" }}
          >
            実績を記録する
          </div>
        ) : (
          <Link
            href={sessionLink}
            className="flex items-center justify-center gap-2 w-full text-sm py-3 rounded-xl font-semibold"
            style={{ backgroundColor: "#CAFF4D", color: "#0D0D0F" }}
          >
            実績を記録する
          </Link>
        )
      )}

      {/* セッションなし → 手動追加リンク */}
      {!sessionLink && !isRest && (
        <Link
          href={`/day/${date}/add`}
          className="block text-center text-sm py-3 rounded-xl font-medium"
          style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF" }}
        >
          ＋ 手動で種目を追加する
        </Link>
      )}

      {/* 休息日トグル */}
      <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={toggleRest}
          disabled={isPending}
          className="flex items-center justify-between w-full"
          style={{ opacity: isPending ? 0.6 : 1 }}
        >
          <span className="flex items-center gap-2 text-sm" style={{ color: "#8E8E93" }}>
            <span>{toggleLabel}</span>
          </span>
          <ToggleSwitch isOn={isRest} />
        </button>
      </div>
    </div>
  );
}
