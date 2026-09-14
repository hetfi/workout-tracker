import Link from "next/link";
import { AddExercisesForm } from "./AddExercisesForm";

interface PageProps {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ sessionId?: string; backTo?: string }>;
}

export default async function AddExercisesPage({ params, searchParams }: PageProps) {
  const { date } = await params;
  const { sessionId, backTo } = await searchParams;

  // backTo がある場合はそこに戻る、なければ従来のリンク
  const backHref = backTo ?? (sessionId ? `/session/${sessionId}` : `/day/${date}`);

  return (
    <div className="py-6 space-y-5">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="text-[#CAFF4D] text-sm font-medium"
        >
          ← 戻る
        </Link>
      </div>

      {/* Heading */}
      <div>
        <h1 className="text-xl font-bold text-white">
          {sessionId ? "種目を追加" : "トレーニングを追加"}
        </h1>
        <p className="text-sm text-[#8E8E93] mt-1">
          種目を選んで{sessionId ? "追加" : "トレーニングを作成"}します
        </p>
      </div>

      <AddExercisesForm
        date={date}
        sessionId={sessionId}
        backTo={backTo}
        saveTo={backTo ?? (sessionId ? `/session/${sessionId}` : "/today")}
      />
    </div>
  );
}
