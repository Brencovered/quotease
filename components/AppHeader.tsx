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
  FolderOpen,
  TrendingUp,
  Download,
  Zap,
  Package,
} from "lucide-react";

const NAV = [
  { href: "/electrician/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/electrician/jobs",      icon: Briefcase,        label: "Jobs" },
  { href: "/electrician",           icon: Plus,             label: "Quote",   fab: true },
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
      {/* ── Desktop sidebar (hidden on mobile) ───────────────────── */}
      <aside
        className="hidden sm:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-[var(--navy)] border-r border-white/[0.06]"
        style={{ width: "var(--sidebar-width)" }}
      >
        <Link href="/electrician/dashboard" className="font-display text-[15px] tracking-widest text-white px-6 pt-6 pb-5">
          SWIFTSCOPE
        </Link>

        <div className="px-4 pb-4">
          <Link
            href="/electrician"
            className="flex items-center justify-center gap-1.5 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[13px] py-2.5 rounded-xl hover:bg-[var(--amber-deep)] transition-colors"
          >
            <Plus size={15} strokeWidth={3} /> New quote
          </Link>
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 px-3 overflow-y-auto">
          <Link
            href="/electrician/dashboard"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
              isActive("/electrician/dashboard") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <LayoutDashboard size={17} strokeWidth={isActive("/electrician/dashboard") ? 2.2 : 1.8} />
            Dashboard
          </Link>

          <Link
            href="/electrician/materials"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
              isActive("/electrician/materials") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <Package size={17} strokeWidth={isActive("/electrician/materials") ? 2.2 : 1.8} />
            Materials &amp; Pricing
          </Link>

          <Link
            href="/electrician/quotes"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
              isActive("/electrician/quotes") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <FileText size={17} strokeWidth={isActive("/electrician/quotes") ? 2.2 : 1.8} />
            Quotes
          </Link>

          <Link
            href="/electrician/jobs"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
              isActive("/electrician/jobs") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <Briefcase size={17} strokeWidth={isActive("/electrician/jobs") ? 2.2 : 1.8} />
            Jobs
          </Link>
          <Link
            href="/electrician/margins"
            className={`flex items-center gap-2 pl-9 pr-3 py-2 rounded-lg text-[12.5px] font-semibold transition-colors -mt-0.5 ${
              isActive("/electrician/margins") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-3)] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <TrendingUp size={14} strokeWidth={isActive("/electrician/margins") ? 2.2 : 1.8} />
            Margins &amp; performance
          </Link>

          <Link
            href="/electrician/plans"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
              isActive("/electrician/plans") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <FolderOpen size={17} strokeWidth={isActive("/electrician/plans") ? 2.2 : 1.8} />
            Plans
          </Link>

          <Link
            href="/electrician/schedule"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
              isActive("/electrician/schedule") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <CalendarDays size={17} strokeWidth={isActive("/electrician/schedule") ? 2.2 : 1.8} />
            Schedule
          </Link>

          <Link
            href="/electrician/leads"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
              isActive("/electrician/leads") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <Zap size={17} strokeWidth={isActive("/electrician/leads") ? 2.2 : 1.8} />
            Leads
          </Link>

          <Link
            href="/electrician/clients"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
              isActive("/electrician/clients") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <Users size={17} strokeWidth={isActive("/electrician/clients") ? 2.2 : 1.8} />
            Clients
          </Link>

          {/* Secondary / less-frequent tools */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-col gap-0.5">
            <Link
              href="/electrician/map"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[12.5px] font-semibold transition-colors ${
                isActive("/electrician/map") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-3)] hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <MapPin size={15} strokeWidth={isActive("/electrician/map") ? 2.2 : 1.8} />
              Map
            </Link>
            <Link
              href="/electrician/export"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[12.5px] font-semibold transition-colors ${
                isActive("/electrician/export") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-3)] hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Download size={15} strokeWidth={isActive("/electrician/export") ? 2.2 : 1.8} />
              Export
            </Link>
          </div>
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-white/[0.06] flex flex-col gap-0.5">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
              isActive("/settings") ? "bg-white/10 text-[var(--amber)]" : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <Settings size={17} strokeWidth={isActive("/settings") ? 2.2 : 1.8} />
            Settings
          </Link>
          <button
            onClick={logOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold text-[var(--steel-3)] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
          >
            Log out
          </button>
        </div>
      </aside>

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
              <Link href="/electrician/materials" onClick={() => setMoreOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]">
                <Package size={15} className="text-[var(--ink-faint)]" /> Materials &amp; Pricing
              </Link>
              <Link href="/electrician/clients" onClick={() => setMoreOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]">
                <Users size={15} className="text-[var(--ink-faint)]" /> Clients
              </Link>
              <Link href="/electrician/plans" onClick={() => setMoreOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]">
                <FolderOpen size={15} className="text-[var(--ink-faint)]" /> Plans
              </Link>
              <Link href="/electrician/leads" onClick={() => setMoreOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]">
                <Zap size={15} className="text-[var(--ink-faint)]" /> Leads
              </Link>
              <Link href="/electrician/margins" onClick={() => setMoreOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]">
                <TrendingUp size={15} className="text-[var(--ink-faint)]" /> Margins
              </Link>
              <Link href="/electrician/export" onClick={() => setMoreOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]">
                <Download size={15} className="text-[var(--ink-faint)]" /> Export to Xero / MYOB
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
