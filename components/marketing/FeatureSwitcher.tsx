"use client";

import { useState } from "react";
import { Crosshair, Mic, PenTool, FileSearch, type LucideIcon } from "lucide-react";
import PhoneStage, { type PhoneToast } from "./PhoneStage";
import type { Screenshot } from "@/lib/marketing/screenshots";

// Icons resolved from a string key inside this client component, never
// accepted as a component-reference prop -- see the commit that broke the
// build the one time that rule got skipped. A Server Component parent
// (app/page.tsx) cannot pass a live Lucide component across the
// server/client boundary; React Server Components only serialize data.
const ICONS: Record<string, LucideIcon> = {
  crosshair: Crosshair,
  mic: Mic,
  "pen-tool": PenTool,
  "file-search": FileSearch,
};

export interface SwitcherMode {
  key: string;
  icon: keyof typeof ICONS;
  kicker: string;
  title: string;
  bullets: string[];
  pullLine: string;
  footnote?: string;
  shot: Screenshot;
  toast?: PhoneToast;
}

/**
 * components/marketing/FeatureSwitcher.tsx
 * -----------------------------------------
 * Four static cards, each carrying its own small side-shot, read as a spec
 * sheet: same shape repeated four times, nothing pulling focus to any one
 * of them. This picks one thing to show properly instead of four things
 * shown briefly -- a tab strip drives which mode is active, its copy runs
 * as short bullets rather than a paragraph, and the screenshot on the
 * right carries a floating notification card so it reads as the product
 * doing something rather than a photo of a screen.
 *
 * Only the active shot is mounted, not all four stacked with visibility
 * toggled, so switching modes triggers a real image request rather than
 * revealing something already downloaded -- a few hundred milliseconds of
 * tab-switch latency traded for not loading three screenshots nobody may
 * ever look at on first paint.
 */
export default function FeatureSwitcher({ modes }: { modes: SwitcherMode[] }) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const mode = modes[active];
  const Icon = ICONS[mode.icon];

  function select(i: number) {
    if (i === active) return;
    setVisible(false);
    window.setTimeout(() => {
      setActive(i);
      setVisible(true);
    }, 140);
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10 lg:gap-16 items-center">
      <div>
        <div className="flex flex-wrap gap-2 mb-9" role="tablist" aria-label="Ways to quote on site">
          {modes.map((m, i) => {
            const TabIcon = ICONS[m.icon];
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => select(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] font-bold transition-colors ${
                  i === active
                    ? "bg-[#0a1722] text-white"
                    : "bg-[#f8f9fa] text-[#5a6a78] border border-[#e8ecef] hover:bg-[#eef1f3]"
                }`}
              >
                <TabIcon size={16} className={i === active ? "text-[#ffb400]" : "text-[#8a9ba8]"} />
                {m.title}
              </button>
            );
          })}
        </div>

        <div className={`transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}>
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-2">{mode.kicker}</p>
          <h3 className="font-display text-[1.9rem] text-[#0a1722] mb-5">{mode.title}</h3>

          <ul className="space-y-3 mb-6 max-w-[500px]">
            {mode.bullets.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] leading-[1.5] text-[#5a6a78]">
                <Icon size={16} className="text-[#ffb400] mt-[3px] shrink-0" />
                {line}
              </li>
            ))}
          </ul>

          <p className="text-[14.5px] font-bold text-[#0a1722] max-w-[480px]">{mode.pullLine}</p>
          {mode.footnote && (
            <p className="text-[12px] text-[#8a9ba8] italic mt-3">{mode.footnote}</p>
          )}
        </div>
      </div>

      <div className={`transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}>
        <PhoneStage shot={mode.shot} toast={mode.toast} tone="light" />
      </div>
    </div>
  );
}
