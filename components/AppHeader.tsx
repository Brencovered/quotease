"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  clearCachedIsFieldWorker,
  getCachedIsFieldWorker,
  setCachedIsFieldWorker,
} from "@/lib/navRoleCache";
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
  TrendingUp,
  Download,
  Zap,
  Package,
  UsersRound,
  ChevronDown,
  Sun,
} from "lucide-react";

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  fab?: boolean;
};

const OWNER_DESKTOP_NAV: NavItem[] = [
  { href: "/today", icon: Sun, label: "My day" },
  { href: "/crew", icon: UsersRound, label: "Crew" },
  { href: "/leads", icon: Zap, label: "Leads" },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/materials", icon: Package, label: "Materials" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/quotes", icon: FileText, label: "Quotes" },
  { href: "/schedule", icon: CalendarDays, label: "Schedule" },
  { href: "/margins", icon: TrendingUp, label: "Profit" },
];

const FIELD_DESKTOP_NAV: NavItem[] = [
  { href: "/today", icon: Sun, label: "My day" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/schedule", icon: CalendarDays, label: "Schedule" },
];

const OWNER_MOBILE_NAV: NavItem[] = [
  { href: "/today", icon: Sun, label: "My day" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/quote", icon: Plus, label: "Quote", fab: true },
  { href: "/crew", icon: UsersRound, label: "Crew" },
  { href: "/schedule", icon: CalendarDays, label: "Schedule" },
];

const FIELD_MOBILE_NAV: NavItem[] = [
  { href: "/today", icon: Sun, label: "My day" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/schedule", icon: CalendarDays, label: "Schedule" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [quoteCount, setQuoteCount] = useState(0);
  // Start unknown - never paint owner tools until role is confirmed.
  // Cache restores instantly on remount (nav clicks remount this component).
  const [isFieldWorker, setIsFieldWorker] = useState(false);
  const [roleReady, setRoleReady] = useState(false);

  useLayoutEffect(() => {
    const cached = getCachedIsFieldWorker();
    if (cached !== null) {
      setIsFieldWorker(cached);
      setRoleReady(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      try {
        const res = await fetch("/api/team/context");
        if (!res.ok) throw new Error("context failed");
        const data = await res.json();
        const field = Boolean(data.isFieldWorker);
        if (cancelled) return;
        setCachedIsFieldWorker(field);
        setIsFieldWorker(field);
        setRoleReady(true);
      } catch {
        // If we have a cache, keep it. Otherwise don't unlock owner tools
        // by mistake - stay field-safe until we know.
        if (!cancelled && getCachedIsFieldWorker() === null) {
          setIsFieldWorker(true);
          setRoleReady(true);
        }
      }
    }
    loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!roleReady || isFieldWorker) return;
    async function fetchQuoteCount() {
      try {
        const res = await fetch("/api/quotes/count");
        if (res.ok) {
          const data = await res.json();
          setQuoteCount(data.count ?? 0);
        }
      } catch {
        // Silently fail - badge will show 0
      }
    }
    fetchQuoteCount();
  }, [isFieldWorker, roleReady]);

  async function logOut() {
    clearCachedIsFieldWorker();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/quote") return pathname === "/quote";
    if (href === "/today") return pathname === "/today" || pathname.startsWith("/today/");
    return pathname.startsWith(href);
  }

  function navLinkClasses(href: string) {
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
      isActive(href)
        ? "bg-white/10 text-[var(--amber)]"
        : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
    }`;
  }

  // Until role is known, show field nav only - never flash owner tools.
  const showFieldNav = !roleReady || isFieldWorker;
  const homeHref = showFieldNav ? "/today" : "/dashboard";
  const desktopNav = showFieldNav ? FIELD_DESKTOP_NAV : OWNER_DESKTOP_NAV;
  const mobileNav = showFieldNav ? FIELD_MOBILE_NAV : OWNER_MOBILE_NAV;

  return (
    <>
      <aside
        className="hidden sm:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-[var(--navy)] border-r border-white/[0.06]"
        style={{ width: "var(--sidebar-width)" }}
      >
        <Link
          prefetch={false}
          href={homeHref}
          className="font-display text-[15px] tracking-widest text-white px-6 pt-6 pb-5"
        >
          SWIFTSCOPE
        </Link>

        {!showFieldNav && (
          <div className="px-4 pb-4">
            <Link
              prefetch={false}
              href="/quote"
              className="flex items-center justify-center gap-1.5 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[13px] py-2.5 rounded-xl hover:bg-[var(--amber-deep)] transition-colors"
            >
              <Plus size={15} strokeWidth={3} /> New quote
            </Link>
          </div>
        )}

        <nav className="flex-1 flex flex-col gap-0.5 px-3 overflow-y-auto">
          {desktopNav.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                prefetch={false}
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition-colors ${
                  active
                    ? "bg-white/10 text-[var(--amber)]"
                    : "text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <n.icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                {n.label}
                {!showFieldNav && n.label === "Quotes" && quoteCount > 0 && (
                  <span className="ml-auto bg-[var(--amber)] text-[var(--navy)] text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {quoteCount}
                  </span>
                )}
              </Link>
            );
          })}

          {!showFieldNav && (
            <>
              <Link prefetch={false} href="/clients" className={navLinkClasses("/clients")}>
                <Users size={17} /> Clients
              </Link>

              <Link prefetch={false} href="/team" className={navLinkClasses("/team")}>
                <UsersRound size={17} /> Team
              </Link>

              <button
                type="button"
                onClick={() => setMoreExpanded((v) => !v)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold text-[var(--steel-1)] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <ChevronDown
                  size={17}
                  className={moreExpanded ? "rotate-180 transition-transform" : "transition-transform"}
                />
                More
              </button>
              {moreExpanded && (
                <>
                  <Link prefetch={false} href="/export" className={navLinkClasses("/export")}>
                    <Download size={17} /> Export
                  </Link>
                  <Link prefetch={false} href="/map" className={navLinkClasses("/map")}>
                    <MapPin size={17} /> Map
                  </Link>
                </>
              )}
            </>
          )}
        </nav>

        <div className="px-3 pb-4 space-y-0.5">
          <Link prefetch={false} href="/settings" className={navLinkClasses("/settings")}>
            <Settings size={17} /> Settings
          </Link>
          <button
            onClick={logOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold text-[var(--steel-3)] hover:bg-white/[0.06] hover:text-white transition-colors text-left w-full"
          >
            Log out
          </button>
        </div>
      </aside>

      <header className="sm:hidden bg-[var(--navy)] sticky top-0 z-40 h-12 flex items-center justify-between px-4 relative">
        <Link
          prefetch={false}
          href={homeHref}
          className="font-display text-[14px] tracking-widest text-white"
        >
          SWIFTSCOPE
        </Link>
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className="text-[var(--steel-2)] p-1"
          aria-label="More"
        >
          {moreOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="absolute top-12 right-4 z-50 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden w-52">
              {showFieldNav ? (
                <>
                  <Link
                    prefetch={false}
                    href="/today"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <Sun size={15} className="text-[var(--ink-faint)]" /> My day
                  </Link>
                  <Link
                    prefetch={false}
                    href="/jobs"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <Briefcase size={15} className="text-[var(--ink-faint)]" /> Jobs
                  </Link>
                  <Link
                    prefetch={false}
                    href="/schedule"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <CalendarDays size={15} className="text-[var(--ink-faint)]" /> Schedule
                  </Link>
                  <Link
                    prefetch={false}
                    href="/settings"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <Settings size={15} className="text-[var(--ink-faint)]" /> Settings
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    prefetch={false}
                    href="/quotes"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <FileText size={15} className="text-[var(--ink-faint)]" /> Quotes
                  </Link>
                  <Link
                    prefetch={false}
                    href="/crew"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <UsersRound size={15} className="text-[var(--ink-faint)]" /> Crew
                  </Link>
                  <Link
                    prefetch={false}
                    href="/materials"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <Package size={15} className="text-[var(--ink-faint)]" /> Materials
                  </Link>
                  <Link
                    prefetch={false}
                    href="/margins"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <TrendingUp size={15} className="text-[var(--ink-faint)]" /> Profit
                  </Link>
                  <Link
                    prefetch={false}
                    href="/clients"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <Users size={15} className="text-[var(--ink-faint)]" /> Clients
                  </Link>
                  <Link
                    prefetch={false}
                    href="/team"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <UsersRound size={15} className="text-[var(--ink-faint)]" /> Team
                  </Link>
                  <Link
                    prefetch={false}
                    href="/leads"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <Zap size={15} className="text-[var(--ink-faint)]" /> Leads
                  </Link>
                  <Link
                    prefetch={false}
                    href="/export"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <Download size={15} className="text-[var(--ink-faint)]" /> Export to Xero / MYOB
                  </Link>
                  <Link
                    prefetch={false}
                    href="/map"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <MapPin size={15} className="text-[var(--ink-faint)]" /> Map
                  </Link>
                  <Link
                    prefetch={false}
                    href="/settings"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--ink)] border-b border-[var(--line)]"
                  >
                    <Settings size={15} className="text-[var(--ink-faint)]" /> Settings
                  </Link>
                </>
              )}
              <button
                onClick={logOut}
                className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] font-semibold text-[var(--red)] w-full text-left"
              >
                Log out
              </button>
            </div>
          </>
        )}
      </header>

      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--line)] flex items-center safe-bottom"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {mobileNav.map((n) => {
          const active = isActive(n.href);
          if (n.fab) {
            return (
              <Link
                prefetch={false}
                key={n.href}
                href={n.href}
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
            <Link
              prefetch={false}
              key={n.href}
              href={n.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active ? "text-[var(--amber-deep)]" : "text-[var(--ink-faint)]"
              }`}
            >
              <n.icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-bold">{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
