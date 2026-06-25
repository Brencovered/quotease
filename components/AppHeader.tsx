"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AppHeader({ active }: { active?: "dashboard" | "quotes" | "jobs" | "settings" }) {
  const router = useRouter();

  async function logOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-[var(--navy)] sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/electrician/dashboard" className="font-display text-base tracking-wide text-white">
          QUOTEASE
        </Link>
        <nav className="flex items-center gap-4 sm:gap-5 text-sm font-semibold overflow-x-auto">
          <Link
            href="/electrician/dashboard"
            className={active === "dashboard" ? "text-[var(--amber)]" : "text-[var(--steel-1)]"}
          >
            Dashboard
          </Link>
          <Link
            href="/electrician"
            className={active === undefined ? "text-[var(--amber)]" : "text-[var(--steel-1)]"}
          >
            New quote
          </Link>
          <Link
            href="/electrician/jobs"
            className={active === "jobs" ? "text-[var(--amber)]" : "text-[var(--steel-1)]"}
          >
            Jobs
          </Link>
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
          <button onClick={logOut} className="text-[var(--steel-3)] font-medium whitespace-nowrap">
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
