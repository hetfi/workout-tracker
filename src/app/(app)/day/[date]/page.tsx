import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  classifyExercise,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type MuscleCategory,
} from "@/lib/muscleCategory";

interface PageProps {
  params: Promise<{ date: string }>;
}

function formatJapaneseDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];
  const date = new Date(`${dateStr}T12:00:00+09:00`);
  const dow = daysOfWeek[date.getDay()];
  return `${y}年${parseInt(m)}月${parseInt(d)}日（${dow}）`;
}

export default async function DayPage({ params }: PageProps) {
  const { date } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. その日のセッション
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, title, status, created_at")
    .eq("user_id", user.id)
    .eq("date", date)
    .neq("status", "abandoned")
    .order("created_at", { ascending: true });

  const sessionList = sessions ?? [];

  if (sessionList.length === 0) {
    return (
      <div className="py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/home" className="text-[#CAFF4D] text-sm font-medium">
            ← ホーム
          </Link>
        </div>
        <h1 className="text-xl font-bold text-white">{formatJapaneseDate(date)}</h1>
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-sm" style={{ color: "#8E8E93" }}>
            この日のトレーニング記録はありません
          </p>
          <Link
            href={`/day/${date}/add`}
            className="block text-center text-sm py-3 rounded-xl font-medium"
            style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF" }}
          >
            ＋ 手動で種目を追加する
          </Link>
        </div>
      </div>
    );
  }

  const sessionIds = sessionList.map((s) => s.id);

  // 2+3. セッション種目と完了セットを並列取得
  const [{ data: sessionExercises }, { data: completedSets }] = await Promise.all([
    supabase
      .from("workout_session_exercises")
      .select("id, session_id, exercise_name, sort_order")
      .in("session_id", sessionIds)
      .order("sort_order"),
    supabase
      .from("workout_sets")
      .select("session_exercise_id, session_id, set_number, weight, reps, side")
      .in("session_id", sessionIds)
      .eq("status", "completed")
      .order("set_number"),
  ]);

  // completedSets から sessionsWithSets を派生（専用クエリ不要）
  const sessionsWithSets = new Set((completedSets ?? []).map((r) => r.session_id));

  // 編集リストに表示するセッション：完了セットがある or アクティブ
  const editableSessions = sessionList.filter(
    (s) =>
      s.status === "in_progress" ||
      s.status === "not_started" ||
      sessionsWithSets.has(s.id)
  );

  // 4. exercises master でカテゴリ取得
  const allExerciseNames = [
    ...new Set((sessionExercises ?? []).map((e) => e.exercise_name)),
  ];
  const { data: masterExercises } =
    allExerciseNames.length > 0
      ? await supabase
          .from("exercises")
          .select("name, muscle_category, is_duration")
          .eq("user_id", user.id)
          .in("name", allExerciseNames)
      : { data: [] };

  const categoryMap: Record<string, MuscleCategory> = {};
  const durationMap: Record<string, boolean> = {};
  for (const ex of masterExercises ?? []) {
    if (ex.muscle_category)
      categoryMap[ex.name] = ex.muscle_category as MuscleCategory;
    durationMap[ex.name] = Boolean(ex.is_duration);
  }
  const getCategory = (name: string): MuscleCategory =>
    categoryMap[name] ?? classifyExercise(name);

  // 5. 種目ごとの完了セット数・総量を集計
  interface SetRecord { setNumber: number; weight: number; reps: number; side: string | null }
  const setsByExId: Record<string, SetRecord[]> = {};
  for (const s of completedSets ?? []) {
    if (!setsByExId[s.session_exercise_id])
      setsByExId[s.session_exercise_id] = [];
    setsByExId[s.session_exercise_id].push({
      setNumber: Number(s.set_number),
      weight: Number(s.weight),
      reps: Number(s.reps),
      side: (s.side as string | null) ?? null,
    });
  }

  // 6. 全種目をマージ（0セットは除外）
  interface MergedExercise {
    name: string;
    category: MuscleCategory;
    completedSets: number;
    totalVolume: number;
    sets: SetRecord[];
    isDuration: boolean;
  }
  const mergedExercises: MergedExercise[] = [];
  const seenNames = new Set<string>();

  for (const ex of sessionExercises ?? []) {
    const exSets = setsByExId[ex.id] ?? [];
    if (exSets.length === 0) continue; // 0セット除外
    if (seenNames.has(ex.exercise_name)) {
      // 同名種目は集計をマージ
      const existing = mergedExercises.find(
        (m) => m.name === ex.exercise_name
      );
      if (existing) {
        existing.completedSets += exSets.length;
        existing.totalVolume += Math.round(
          exSets.reduce((acc, s) => acc + s.weight * s.reps, 0)
        );
        existing.sets.push(...exSets);
      }
    } else {
      seenNames.add(ex.exercise_name);
      mergedExercises.push({
        name: ex.exercise_name,
        category: getCategory(ex.exercise_name),
        completedSets: exSets.length,
        totalVolume: Math.round(
          exSets.reduce((acc, s) => acc + s.weight * s.reps, 0)
        ),
        sets: [...exSets],
        isDuration: durationMap[ex.exercise_name] ?? false,
      });
    }
  }

  // 7. タイトル・ステータス算出
  const presentCats = [
    ...new Set(mergedExercises.map((e) => e.category)),
  ];
  const title =
    CATEGORY_ORDER.filter((c) => presentCats.includes(c))
      .map((c) => CATEGORY_LABELS[c])
      .join("・") || "トレーニング";

  const hasInProgress = sessionList.some((s) => s.status === "in_progress");
  const hasNotStarted = sessionList.some((s) => s.status === "not_started");
  const allCompleted = sessionList.every((s) => s.status === "completed");
  const overallStatus = hasInProgress
    ? "in_progress"
    : hasNotStarted
    ? "not_started"
    : allCompleted
    ? "completed"
    : "not_started";

  return (
    <div className="py-6 space-y-5">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/home" className="text-[#CAFF4D] text-sm font-medium">
          ← ホーム
        </Link>
      </div>

      <h1 className="text-xl font-bold text-white">{formatJapaneseDate(date)}</h1>

      {/* セッションはあるが完了セットがゼロ → セッションへの入口を表示 */}
      {mergedExercises.length === 0 && (() => {
        // editableSessions（in_progress / not_started / 完了セットあり）から優先して選ぶ
        const primary =
          editableSessions.find((s) => s.status === "in_progress") ??
          editableSessions.find((s) => s.status === "not_started") ??
          editableSessions[0] ??
          sessionList[sessionList.length - 1]; // 万一 editableSessions が空でも最後のセッションを使う

        if (primary) {
          return (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="text-sm" style={{ color: "#8E8E93" }}>
                まだセットが記録されていません
              </p>
              <Link
                href={`/session/${primary.id}`}
                className="block text-center text-sm py-3 rounded-xl font-medium"
                style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF" }}
              >
                実績を記録する →
              </Link>
            </div>
          );
        }
        // セッションが全て abandoned などでリンク先なし → 手動追加へ
        return (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ backgroundColor: "#2C2C2E", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-sm" style={{ color: "#8E8E93" }}>
              この日のトレーニング記録はありません
            </p>
            <Link
              href={`/day/${date}/add`}
              className="block text-center text-sm py-3 rounded-xl font-medium"
              style={{ backgroundColor: "#3A3A3C", color: "#FFFFFF" }}
            >
              ＋ 手動で種目を追加する
            </Link>
          </div>
        );
      })()}

      {/* 実績サマリ（部位カテゴリ別） */}
      {mergedExercises.length > 0 && (() => {
        // カテゴリ別にグループ化
        const byCategory: Record<string, typeof mergedExercises> = {};
        for (const ex of mergedExercises) {
          if (!byCategory[ex.category]) byCategory[ex.category] = [];
          byCategory[ex.category].push(ex);
        }
        const cats = CATEGORY_ORDER.filter((c) => byCategory[c]?.length > 0);

        // コピー用テキスト（各セットの詳細を含む）
        const copyText = [
          `📋 トレーニング記録｜${formatJapaneseDate(date)}`,
          title,
          "",
          ...cats.flatMap((cat) => [
            `【${CATEGORY_LABELS[cat]}】`,
            ...byCategory[cat].flatMap((ex) => [
              `・${ex.name}: ${ex.completedSets}セット${
                ex.totalVolume > 0 ? ` / ${ex.totalVolume.toLocaleString()}kg` : ""
              }`,
              ...ex.sets.map((s) => {
                const sideLabel = s.side ? `(${s.side}) ` : "";
                const valueStr = ex.isDuration && s.weight === 0 && s.reps > 0
                  ? `${s.reps}分`
                  : `${s.weight}kg × ${s.reps}回`;
                return `  ${s.setNumber}${sideLabel}: ${valueStr}`;
              }),
            ]),
          ]),
        ].join("\n");

        return (
          <div className="rounded-xl bg-[#2C2C2E] border border-white/[0.08] p-4 space-y-4">
            {/* タイトル＋ステータス */}
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-white">{title}</p>
              {overallStatus === "completed" && (
                <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-[#CAFF4D]/20 text-[#CAFF4D]">
                  完了
                </span>
              )}
              {overallStatus === "in_progress" && (
                <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                  実施中
                </span>
              )}
            </div>

            {/* 部位カテゴリ別リスト */}
            <div className="space-y-3">
              {cats.map((cat) => {
                const exList = byCategory[cat];
                const catSets = exList.reduce((acc, ex) => acc + ex.completedSets, 0);
                const catVol = exList.reduce((acc, ex) => acc + ex.totalVolume, 0);
                return (
                  <div key={cat}>
                    {/* カテゴリヘッダー */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                      />
                      <span className="text-xs font-semibold" style={{ color: CATEGORY_COLORS[cat] }}>
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <span className="text-xs text-[#8E8E93]">
                        {catSets}セット{catVol > 0 ? ` / ${catVol.toLocaleString()}kg` : ""}
                      </span>
                    </div>
                    {/* 種目リスト */}
                    <ul className="space-y-1 pl-4">
                      {exList.map((ex, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-white flex-1 truncate">{ex.name}</span>
                          <span className="text-[#8E8E93] text-xs shrink-0">
                            {ex.completedSets}セット
                            {ex.totalVolume > 0 && ` / ${ex.totalVolume.toLocaleString()}kg`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* 詳細リンク + コピーボタン */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <CopyButton
                text={copyText}
                label="記録をコピー"
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors"
              />
              {editableSessions.length > 0 && (() => {
                const primary =
                  editableSessions.find((s) => s.status === "in_progress") ??
                  editableSessions.find((s) => s.status === "not_started") ??
                  editableSessions[editableSessions.length - 1];
                return (
                  <Link
                    href={`/session/${primary.id}`}
                    className="shrink-0 text-xs text-[#CAFF4D] font-medium"
                  >
                    詳細 →
                  </Link>
                );
              })()}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
