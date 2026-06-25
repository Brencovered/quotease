"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AppHeader({ active }: { active?: "quotes" | "settings" }) {
  const router = useRouter();

  async function logOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-[var(--navy)] sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/electrician" className="font-display text-base tracking-wide text-white">
          QUOTEASE
        </Link>
        <nav className="flex items-center gap-5 text-sm font-semibold">
          <Link
            href="/electrician/quotes"
            className={active === "quotes" ? "text-[var(--amber)]" : "text-[var(--steel-1)]"}
          >
            Quotes
          </Link>
          <Link
            href="/settings"
            className={active === "settings" ? "text-[var(--amber)]" : "text-[var(--steel-1)]"}
          >
            Settings
          </Link>
          <button onClick={logOut} className="text-[var(--steel-3)] font-medium">
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
