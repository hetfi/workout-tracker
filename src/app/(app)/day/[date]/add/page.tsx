import Link from "next/link";
import { AddExercisesForm } from "./AddExercisesForm";

interface PageProps {
  params: Promise<{ date: string }>;
}

export default async function AddExercisesPage({ params }: PageProps) {
  const { date } = await params;

  return (
    <div className="py-6 space-y-5">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Link
          href={`/day/${date}`}
          className="text-blue-600 dark:text-blue-400 text-sm font-medium"
        >
          ← 戻る
        </Link>
      </div>

      {/* Heading */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {date} のトレーニングを追加
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          種目を選んでトレーニングを作成します
        </p>
      </div>

      <AddExercisesForm date={date} />
    </div>
  );
}
