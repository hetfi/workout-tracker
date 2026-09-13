import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

async function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#2C2C2E] border-t border-white/[0.08] pb-safe-bottom">
      <div className="flex justify-around items-center h-14">
        <NavItem href="/home" label="ホーム">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
            <path d="M9 21V12h6v9"/>
          </svg>
        </NavItem>
        <NavItem href="/history" label="実績">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="4" height="18" rx="1"/>
            <rect x="10" y="8" width="4" height="13" rx="1"/>
            <rect x="17" y="5" width="4" height="16" rx="1"/>
          </svg>
        </NavItem>
        <NavItem href="/exercises" label="種目">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 6.5h11M6.5 12h11M6.5 17.5h11"/>
            <circle cx="3.5" cy="6.5" r="1.2"/>
            <circle cx="3.5" cy="12" r="1.2"/>
            <circle cx="3.5" cy="17.5" r="1.2"/>
          </svg>
        </NavItem>
        <NavItem href="/settings" label="設定">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </NavItem>
      </div>
    </nav>
  );
}

function NavItem({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 py-1 px-4 text-[#8E8E93] hover:text-white transition-colors min-w-[64px]"
    >
      {children}
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
