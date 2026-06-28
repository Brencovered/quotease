"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  Users,
  Plus,
  Settings,
  Briefcase,
  MapPin,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  { href: "/electrician/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/electrician/jobs",      icon: Briefcase,        label: "Jobs" },
  { href: "/electrician",           icon: Plus,             label: "Quote",  fab: true },
  { href: "/electrician/quotes",    icon: FileText,         label: "Quotes" },
  { href: "/electrician/schedule",  icon: CalendarDays,     label: "Schedule" },
];

export default function AppHeader() {
  const pathname = usePathname();
  const router   = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  async function logOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/electrician") return pathname === "/electrician";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* ── Desktop top bar (hidden on mobile) ───────────────────── */}
      <header className="hidden sm:flex bg-[var(--navy)] sticky top-0 z-40 h-14 items-center">
        <div className="max-w-5xl mx-auto w-full px-6 flex items-center justify-between">
          <Link href="/electrician/dashboard" className="font-display text-[15px] tracking-widest text-white">
            SWIFTSCOPE
          </Link>
          <nav className="flex items-center gap-5 text-[13px] font-semibold">
            {NAV.filter((n) => !n.fab).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={isActive(n.href) ? "text-[var(--amber)]" : "text-[var(--steel-1)] hover:text-white transition-colors"}
              >
                {n.label}
              </Link>
            ))}
            <Link href="/electrician/clients" className={isActive("/electrician/clients") ? "text-[var(--amber)]" : "text-[var(--steel-1)] hover:text-white transition-colors"}>
              Clients
            </Link>
            <Link href="/electrician/map" className={isActive("/electrician/map") ? "text-[var(--amber)]" : "text-[var(--steel-1)] hover:text-white transition-colors"}>
              Map
            </Link>
            <Link href="/electrician" className="bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[12px] px-4 py-1.5 rounded-lg">
              + New quote
            </Link>
            <Link href="/settings" className={`${isActive("/settings") ? "text-[var(--amber)]" : "text-[var(--steel-1)] hover:text-white"} transition-colors`}>
              <Settings size={16} />
            </Link>
            <button onClick={logOut} className="text-[var(--steel-3)] font-medium text-[12px]">
              Log out
            </button>
          </nav>
        </div>
      </header>

      {/* ── Mobile top bar (logo + more menu) ────────────────────── */}
      <header className="sm:hidden bg-[var(--navy)] sticky top-0 z-40 h-12 flex items-center justify-between px-4 relative">
        <Link href="/electrician/dashboard" className="font-display text-[14px] tracking-widest text-white">
          SWIFTSCOPE
        </Link>
        <button onClick={() => setMoreOpen((v) => !v)} className="text-[var(--steel-2)] p-1" aria-label="More">
          {moreOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="absolute top-12 right-4 z-50 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden w-48">
              <Link href="/electrician/clients" onClick={() => setMoreOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]">
                <Users size={15} className="text-[var(--ink-faint)]" /> Clients
              </Link>
              <Link href="/electrician/map" onClick={() => setMoreOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]">
                <MapPin size={15} className="text-[var(--ink-faint)]" /> Map
              </Link>
              <Link href="/settings" onClick={() => setMoreOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]">
                <Settings size={15} className="text-[var(--ink-faint)]" /> Settings
              </Link>
              <button onClick={logOut} className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--red)] w-full text-left">
                Log out
              </button>
            </div>
          </>
        )}
      </header>

      {/* ── Mobile bottom nav ─────────────────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--line)] flex items-center safe-bottom"
           style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {NAV.map((n) => {
          const active = isActive(n.href);
          if (n.fab) {
            return (
              <Link key={n.href} href={n.href}
                className="flex-1 flex flex-col items-center justify-center py-1 relative"
              >
                <span className="bg-[var(--amber)] text-[var(--navy)] w-12 h-12 rounded-full flex items-center justify-center shadow-lg -mt-5">
                  <Plus size={22} strokeWidth={3} />
                </span>
                <span className="text-[10px] font-bold text-[var(--ink-faint)] mt-0.5">Quote</span>
              </Link>
            );
          }
          return (
            <Link key={n.href} href={n.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${active ? "text-[var(--amber-deep)]" : "text-[var(--ink-faint)]"}`}
            >
              <n.icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className={`text-[10px] font-bold`}>{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
