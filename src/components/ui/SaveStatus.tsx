"use client";

import { cn } from "@/lib/cn";
import type { SaveStatus } from "@/domain/types";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  className?: string;
}

export function SaveStatusIndicator({
  status,
  className,
}: SaveStatusIndicatorProps) {
  if (status === "idle") return null;

  const configs: Record<Exclude<SaveStatus, "idle">, { text: string; color: string }> = {
    saving: { text: "保存中...", color: "text-gray-500" },
    saved: { text: "保存済み", color: "text-green-600 dark:text-green-400" },
    error: { text: "保存失敗", color: "text-red-600 dark:text-red-400" },
  };

  const config = configs[status as Exclude<SaveStatus, "idle">];
  if (!config) return null;

  return (
    <span
      className={cn(
        "text-xs font-medium flex items-center gap-1",
        config.color,
        className
      )}
      role="status"
      aria-live="polite"
    >
      {status === "saving" && (
        <svg
          className="h-3 w-3 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {config.text}
    </span>
  );
}
