import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ExerciseCategoryGrid } from "./ExerciseCategoryGrid";

export const revalidate = 0; // always fresh after exercise edits

export default async function ExercisesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name, muscle_category, is_one_arm")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("name");

  const exerciseList = exercises ?? [];

  return (
    <div className="py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">種目</h1>
        <p className="text-xs text-[#8E8E93] mt-0.5">
          タップしてカテゴリ・片手設定を編集
        </p>
      </div>

      {exerciseList.length === 0 ? (
        <div className="text-center py-16 text-[#8E8E93]">
          <p className="mb-4">メニューを取り込むと種目が自動登録されます</p>
          <Link href="/import" className="text-[#CAFF4D] text-sm">
            メニューを取り込む →
          </Link>
        </div>
      ) : (
        <ExerciseCategoryGrid exercises={exerciseList} />
      )}
    </div>
  );
}
