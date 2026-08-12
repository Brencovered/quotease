"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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

/** How long each mode stays active before autoplay moves on. */
const AUTOPLAY_MS = 4800;
/** How often the progress bar redraws. 20fps is smooth enough for a fill bar and cheap. */
const TICK_MS = 50;

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
 * as short bullets rather than a paragraph, and the screenshot carries a
 * floating notification card so it reads as the product doing something.
 *
 * Autoplay with a per-tab progress bar, the Stripe/Linear pattern: without
 * it, four buttons that already look clickable didn't read as "this
 * changes" to a first-time visitor, because nothing demonstrated it. The
 * bar filling and the mode swapping on its own is what makes "these are
 * switchable" obvious without anyone needing to read a hint. Manually
 * clicking a tab jumps there and restarts the cycle from that tab; hovering
 * or focusing the tab strip pauses it, so it never yanks content away
 * mid-read. Respects prefers-reduced-motion by not autoplaying at all --
 * clicking still works, nothing is lost, just nothing moves on its own.
 *
 * Only the active shot is mounted, not all four stacked with visibility
 * toggled, so switching modes triggers a real image request rather than
 * revealing something already downloaded.
 */
export default function FeatureSwitcher({ modes }: { modes: SwitcherMode[] }) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  // Typed as plain number rather than ReturnType<typeof window.setTimeout>:
  // this project's tsconfig pulls in @types/node, which overrides the
  // ambient setTimeout signature to return NodeJS.Timeout even when called
  // via window.setTimeout. The runtime value is a number regardless; only
  // the inferred type was wrong.
  const switchTimer = useRef<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAutoplayEnabled(false);
    }
  }, []);

  // The 140ms setTimeout inside select() clears itself on the next call, but
  // not if the component unmounts mid-transition -- clear it on teardown too.
  useEffect(() => {
    return () => {
      if (switchTimer.current) window.clearTimeout(switchTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!autoplayEnabled || paused) return;
    const id = window.setInterval(() => {
      // Clamped, not just incremented: once progress reaches 100 it stays
      // there until something resets it. Without the clamp, this interval
      // (which keeps running for the ~140ms fade between select() firing
      // and the actual setActive) would keep pushing progress past 100 on
      // every tick, and each of those changes re-fires the effect below,
      // repeatedly restarting the same 140ms transition and never letting
      // it complete -- the switcher would visibly stall rather than move
      // on to the next tab.
      setProgress((p) => Math.min(p + (TICK_MS / AUTOPLAY_MS) * 100, 100));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [autoplayEnabled, paused, active]);

  useEffect(() => {
    if (progress < 100) return;
    select((active + 1) % modes.length, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  function select(i: number, resetByUser = true) {
    if (switchTimer.current) window.clearTimeout(switchTimer.current);
    if (i === active) {
      if (resetByUser) setProgress(0);
      return;
    }
    setVisible(false);
    switchTimer.current = window.setTimeout(() => {
      setActive(i);
      setVisible(true);
      setProgress(0);
    }, 140);
  }

  const mode = modes[active];
  const Icon = ICONS[mode.icon];

  // Standard tabs keyboard contract: Left/Right move and activate (this
  // switcher already auto-activates on click, so arrow keys match that),
  // Home/End jump to the ends. Wraps at either edge.
  function onTabsKeyDown(e: KeyboardEvent) {
    const last = modes.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    else if (e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div
      className="grid lg:grid-cols-[minmax(0,1fr)_460px] gap-10 lg:gap-16 items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div>
        <div
          className="flex flex-wrap gap-2 mb-9"
          role="tablist"
          aria-label="Ways to quote on site"
          onKeyDown={onTabsKeyDown}
        >
          {modes.map((m, i) => {
            const TabIcon = ICONS[m.icon];
            const isActive = i === active;
            return (
              <button
                key={m.key}
                ref={(el) => { tabRefs.current[i] = el; }}
                id={`switcher-tab-${m.key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`switcher-panel-${m.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => select(i)}
                className={`relative overflow-hidden flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] font-bold transition-colors ${
                  isActive
                    ? "bg-[#0a1722] text-white"
                    : "bg-[#f8f9fa] text-[#5a6a78] border border-[#e8ecef] hover:bg-[#eef1f3]"
                }`}
              >
                {isActive && autoplayEnabled && (
                  <span
                    className="absolute left-0 bottom-0 h-[3px] bg-[#ffb400]"
                    style={{ width: `${progress}%` }}
                  />
                )}
                <TabIcon size={16} className={isActive ? "text-[#ffb400]" : "text-[#8a9ba8]"} />
                {m.title}
              </button>
            );
          })}
        </div>

        <div
          id={`switcher-panel-${mode.key}`}
          role="tabpanel"
          aria-labelledby={`switcher-tab-${mode.key}`}
          tabIndex={0}
          className={`transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}
        >
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
        {/* frame="tall": this column is a dedicated 360px-wide space, not a
            cramped grid card, so there is no reason to use the "window"
            crop meant for narrow cards. Without this it defaulted to
            "window" and cropped off the bottom toolbar and most of the
            in-app chrome, which is why the reference mockup (full screen,
            status bar to bottom nav) looked different from what actually
            shipped. */}
        <PhoneStage shot={mode.shot} toast={mode.toast} tone="light" frame="tall" />
      </div>
    </div>
  );
}
