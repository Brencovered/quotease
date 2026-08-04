"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import PhoneShot from "./PhoneShot";
import type { Screenshot } from "@/lib/marketing/screenshots";

export interface SwitcherMode {
  key: string;
  icon: LucideIcon;
  title: string;
  body: string;
  pullLine: string;
  footnote?: string;
  shot: Screenshot;
}

/**
 * components/marketing/FeatureSwitcher.tsx
 * -----------------------------------------
 * Four static cards, each with its own small screenshot, read as a spec
 * sheet: same shape repeated four times, no reason to look at any one of
 * them longer than the others. This picks one thing to show properly
 * instead of four things shown briefly -- a tab strip on the left drives a
 * single large screenshot on the right, so only one image loads until the
 * visitor asks for another.
 *
 * Content-wise this is the same four ways in as before. Structurally it is
 * the difference between a photo gallery and someone actually walking you
 * through it.
 *
 * Only the active shot is mounted, not all four stacked with visibility
 * toggled, so switching modes triggers a real image request rather than
 * revealing something already downloaded. That trades a few hundred
 * milliseconds of tab-switch latency for not loading three screenshots
 * nobody may ever look at on first paint -- worth it low on a marketing
 * page where LCP matters more than switcher snappiness.
 */
export default function FeatureSwitcher({ modes }: { modes: SwitcherMode[] }) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const mode = modes[active];

  function select(i: number) {
    if (i === active) return;
    setVisible(false);
    window.setTimeout(() => {
      setActive(i);
      setVisible(true);
    }, 140);
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-10 lg:gap-16 items-start">
      <div>
        <div className="flex flex-wrap gap-2 mb-9" role="tablist" aria-label="Ways to quote on site">
          {modes.map((m, i) => (
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
              <m.icon size={16} className={i === active ? "text-[#ffb400]" : "text-[#8a9ba8]"} />
              {m.title}
            </button>
          ))}
        </div>

        <div className={`transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}>
          <h3 className="font-display text-[1.7rem] text-[#0a1722] mb-3">{mode.title}</h3>
          <p className="text-[15px] leading-[1.7] text-[#5a6a78] mb-4 max-w-[540px]">{mode.body}</p>
          <p className="text-[14px] font-bold text-[#0a1722]">{mode.pullLine}</p>
          {mode.footnote && (
            <p className="text-[12px] text-[#8a9ba8] italic mt-3">{mode.footnote}</p>
          )}
        </div>
      </div>

      <div
        className={`mx-auto w-full max-w-[260px] transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <PhoneShot shot={mode.shot} tone="light" showCaption={false} sizes="(max-width: 1024px) 55vw, 260px" />
      </div>
    </div>
  );
}
