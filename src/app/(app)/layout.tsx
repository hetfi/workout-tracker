import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

async function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe-bottom">
      <div className="flex justify-around items-center h-14">
        <NavItem href="/home" icon="🏠" label="ホーム" />
        <NavItem href="/history" icon="📋" label="履歴" />
        <NavItem href="/exercises" icon="💪" label="種目" />
        <NavItem href="/settings" icon="⚙️" label="設定" />
      </div>
    </nav>
  );
}

function NavItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-w-[60px]"
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen pb-20">
      <main className="max-w-lg mx-auto px-4 pt-safe-top">{children}</main>
      <NavBar />
    </div>
  );
}
