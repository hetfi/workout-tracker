import { HistoryList } from "./HistoryList";
import { getHistorySessions } from "./actions";

export const revalidate = 0;

export default async function HistoryPage() {
  // Today (JST) as the exclusive upper bound
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // Use tomorrow as upper bound to include today's sessions
  const tomorrow = new Date(jst.getTime() + 24 * 60 * 60 * 1000);
  const todayStr = tomorrow.toISOString().slice(0, 10);

  const initialSessions = await getHistorySessions(todayStr, 14);

  // The oldest loaded date is the date of the last session, or 14 days ago
  const oldestDate =
    initialSessions.length > 0
      ? initialSessions[initialSessions.length - 1].date
      : new Date(jst.getTime() - 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

  return (
    <div className="py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">実績</h1>
        <p className="text-xs text-[#8E8E93] mt-0.5">過去のトレーニング記録</p>
      </div>

      <HistoryList
        initialSessions={initialSessions}
        oldestDate={oldestDate}
      />
    </div>
  );
}
