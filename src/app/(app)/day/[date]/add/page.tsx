import Link from "next/link";
import { AddExercisesForm } from "./AddExercisesForm";

interface PageProps {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ sessionId?: string; backTo?: string }>;
}

function getTodayJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export default async function AddExercisesPage({ params, searchParams }: PageProps) {
  const { date } = await params;
  const { sessionId, backTo } = await searchParams;

  const isPast = date < getTodayJST();

  // backTo がある場合はそこに戻る、なければ従来のリンク
  const backHref = backTo ?? (sessionId ? `/session/${sessionId}` : isPast ? `/day/${date}` : "/today");

  // 過去日: 種目追加後はセッション録画ページへ（実際にセット記録できるように）
  // 当日: backTo または既存の遷移先
  const saveTo = isPast
    ? undefined                // server action が /session/${id} にリダイレクト
    : backTo ?? (sessionId ? `/session/${sessionId}` : "/today");

  const title = isPast ? "実績を登録" : sessionId ? "種目を追加" : "トレーニングを追加";
  const description = isPast
    ? "種目を選んで実績を登録します"
    : `種目を選んで${sessionId ? "追加" : "トレーニングを作成"}します`;
  const submitLabel = isPast
    ? "実績を登録する"
    : sessionId ? "種目を追加する" : "トレーニングを開始";

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
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <p className="text-sm text-[#8E8E93] mt-1">{description}</p>
      </div>

      <AddExercisesForm
        date={date}
        sessionId={sessionId}
        backTo={backTo}
        saveTo={saveTo}
        submitLabel={submitLabel}
      />
    </div>
  );
}
