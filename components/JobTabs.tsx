"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, FileText, CalendarDays, TrendingUp, Paperclip } from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "plans", label: "Plans", icon: FileText },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "profit", label: "Profit", icon: TrendingUp },
  { id: "files", label: "Files", icon: Paperclip },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Tabs are kept in the URL (?tab=profit) rather than plain component state,
 * so a link straight to "the profit tab" (e.g. texted from the office) and
 * the browser back button both do the right thing.
 *
 * Only the active tab's content is rendered - not all five kept mounted
 * and hidden via CSS. This page was the single worst route in production
 * Speed Insights (7.46s FCP) before this change; rendering and hydrating
 * every panel across all five tabs on every load, regardless of which one
 * is visible - including the canvas-based plan markup tool - is real,
 * avoidable work most visits never need. The tradeoff: switching tabs away
 * from a half-filled form (e.g. an in-progress "add variation" draft) and
 * back now resets it, since that tab's component actually unmounts. That's
 * a minor inconvenience worth trading for a measured multi-second FCP
 * improvement on the page's most common route.
 */
export default function JobTabs({
  overview, plans, schedule, profit, files,
}: Record<TabId, ReactNode>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requested = searchParams.get("tab");
  const active: TabId = (TABS.some((t) => t.id === requested) ? requested : "overview") as TabId;

  function setTab(id: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const content: Record<TabId, ReactNode> = { overview, plans, schedule, profit, files };

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 bg-[var(--app-bg)] rounded-xl p-1 overflow-x-auto hide-scrollbar">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 whitespace-nowrap text-[12.5px] font-bold rounded-lg py-2 px-2.5 transition-colors ${
              active === id ? "bg-[var(--surface)] text-[var(--navy)] shadow-sm" : "text-[var(--ink-faint)]"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">{content[active]}</div>
    </div>
  );
}
