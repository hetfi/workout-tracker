"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// 10分以上バックグラウンドにいた後、フォアグラウンドに戻ったらデータを再取得する
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

export function VisibilityRefresh() {
  const router = useRouter();
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current !== null) {
        if (Date.now() - hiddenAt.current > REFRESH_THRESHOLD_MS) {
          router.refresh();
        }
        hiddenAt.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [router]);

  return null;
}
