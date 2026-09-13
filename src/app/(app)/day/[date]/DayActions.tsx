"use client";

import { useRouter } from "next/navigation";

interface DayActionsProps {
  date: string;
}

export function DayActions({ date }: DayActionsProps) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <button
        onClick={() => router.push(`/import?date=${date}`)}
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[0.99] transition-transform text-left"
      >
        <span className="text-2xl">📋</span>
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">GPTメニューを貼り付け</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            ChatGPTで作成したメニューを取り込む
          </p>
        </div>
      </button>

      <button
        onClick={() => router.push(`/day/${date}/add`)}
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[0.99] transition-transform text-left"
      >
        <span className="text-2xl">✏️</span>
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">手動で種目を追加</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            過去の種目から選んで手動で記録する
          </p>
        </div>
      </button>
    </div>
  );
}
