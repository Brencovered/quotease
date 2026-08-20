"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Play, FileText, Paperclip, Wallet } from "lucide-react";

const TABS = [
  { id: "run", label: "Run", icon: Play },
  { id: "plans", label: "Plans", icon: FileText },
  { id: "files", label: "Files", icon: Paperclip },
  { id: "money", label: "Money", icon: Wallet },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Old tab ids from the five-tab layout — map so shared links still work. */
const LEGACY: Record<string, TabId> = {
  overview: "run",
  schedule: "run",
  profit: "money",
};

/**
 * Tabs live in the URL (?tab=money) so deep links and back work.
 * Only the active tab mounts — this page was a Speed Insights hotspot
 * when every panel (including plan canvas) hydrated on every visit.
 */
export default function JobTabs({
  run, plans, files, money, hiddenTabs = [],
}: Record<TabId, ReactNode> & { hiddenTabs?: TabId[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const visibleTabs = TABS.filter((t) => !hiddenTabs.includes(t.id));
  const raw = searchParams.get("tab") ?? "run";
  const requested = (LEGACY[raw] ?? raw) as string;
  const active: TabId = (visibleTabs.some((t) => t.id === requested) ? requested : "run") as TabId;

  function setTab(id: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const content: Record<TabId, ReactNode> = { run, plans, files, money };

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 bg-[var(--app-bg)] rounded-xl p-1 overflow-x-auto hide-scrollbar">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 whitespace-nowrap text-[12.5px] font-bold rounded-lg py-2.5 px-2.5 transition-colors ${
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
