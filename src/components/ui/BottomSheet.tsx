"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Allow closing by tapping the overlay */
  closeOnOverlay?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  closeOnOverlay = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Prevent scroll of body when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={cn(
        "fixed inset-0 z-50 flex flex-col justify-end",
        "transition-opacity duration-300",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50",
          "transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "relative z-10",
          "rounded-t-3xl",
          "pb-safe-bottom",
          "transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
          "max-h-[90vh] flex flex-col"
        )}
        style={{ backgroundColor: "#2C2C2E" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: "#48484A" }} />
        </div>

        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-5 pb-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <h2 className="text-lg font-semibold text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-[#8E8E93] hover:text-white transition-colors"
              aria-label="閉じる"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
