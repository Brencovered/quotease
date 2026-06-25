"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ActivePage = "dashboard" | "quotes" | "jobs" | "clients" | "schedule" | "settings";

export default function AppHeader({ active }: { active?: ActivePage }) {
  const router = useRouter();

  async function logOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const link = (href: string, label: string, page: ActivePage) => (
    <Link href={href} className={active === page ? "text-[var(--amber)]" : "text-[var(--steel-1)]"}>
      {label}
    </Link>
  );

  return (
    <header className="bg-[var(--navy)] sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
        <Link href="/electrician/dashboard" className="font-display text-base tracking-wide text-white shrink-0">
          QUOTEASE
        </Link>
        <nav className="flex items-center gap-4 sm:gap-5 text-sm font-semibold overflow-x-auto hide-scrollbar">
          {link("/electrician/dashboard", "Dashboard", "dashboard")}
          <Link href="/electrician" className={active === undefined ? "text-[var(--amber)]" : "text-[var(--steel-1)]"}>New quote</Link>
          {link("/electrician/quotes", "Quotes", "quotes")}
          {link("/electrician/jobs", "Jobs", "jobs")}
          {link("/electrician/schedule", "Schedule", "schedule")}
          {link("/electrician/clients", "Clients", "clients")}
          {link("/settings", "Settings", "settings")}
          <button onClick={logOut} className="text-[var(--steel-3)] font-medium whitespace-nowrap">
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
