import { HistoryList } from "./HistoryList";
import { getHistoryDays } from "./actions";

export const revalidate = 0;

export default async function HistoryPage() {
  // JST で明日の日付を上限にすることで今日のセッションも含める
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const tomorrow = new Date(jst.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const initialDays = await getHistoryDays(tomorrowStr, 14);

  const oldestDate =
    initialDays.length > 0
      ? initialDays[initialDays.length - 1].date
      : new Date(jst.getTime() - 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

  return (
    <div className="py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">実績</h1>
        <p className="text-xs text-[#8E8E93] mt-0.5">過去のトレーニング記録</p>
      </div>

      <HistoryList initialDays={initialDays} oldestDate={oldestDate} />
    </div>
  );
}
