"use client";

import {
  Ruler, CheckCircle2, MapPin, FileCheck, Layers, Percent,
  DollarSign, RefreshCw, TrendingUp, Users, Package, type LucideIcon,
} from "lucide-react";
import PhoneShot from "./PhoneShot";
import type { Screenshot, ScreenshotToast } from "@/lib/marketing/screenshots";

export type { ScreenshotToast as PhoneToast } from "@/lib/marketing/screenshots";

const TOAST_ICONS: Record<string, LucideIcon> = {
  ruler: Ruler,
  check: CheckCircle2,
  pin: MapPin,
  file: FileCheck,
  layers: Layers,
  percent: Percent,
  dollar: DollarSign,
  refresh: RefreshCw,
  trending: TrendingUp,
  users: Users,
  package: Package,
};

/**
 * components/marketing/PhoneStage.tsx
 * ------------------------------------
 * A screenshot on its own, however well-framed, reads as a photo of the
 * product. What makes it read as the product *doing something* is a small
 * floating card overlaid on top of it -- the way a phone notification sits
 * on top of whatever app is underneath it. This wraps PhoneShot with
 * exactly that: a soft background stage, the phone, and a small toast
 * pinned over its top-left corner.
 *
 * Root has NO horizontal padding, which looks like an odd choice until
 * you know why: the toast (position: absolute) and the phone (a normal
 * block child) resolve percentage widths against two *different* boxes.
 * An absolutely positioned element's percentage resolves against the
 * padding box of its containing block; a normal-flow child's resolves
 * against the content box, i.e. padding already subtracted. With
 * horizontal padding on the root, those are different numbers, and the
 * gap between them is a fixed 48px regardless of the root's own width --
 * trivial at a 360px stage, a third of the total at a 150px one. That
 * mismatch is what put the toast (58% of 150px = 87px) wider than the
 * phone (82% of a padding-shrunk 102px = 84px): the toast visually
 * dominated a screenshot it was supposed to be a small accent on, at
 * exactly the sizes this component is used at most (every per-card
 * embed on the trade pages). Moving the visual inset to margin on the
 * phone wrapper (`mx-auto` at a percentage below 100%) instead of
 * padding on the root means both elements measure against the identical
 * box, so the ratio between them holds at any size, not just the wide
 * single-image context this was built and eyeballed in.
 *
 * `compact` controls how much text the toast tries to hold: icon and
 * title only, no brand row, no subtitle. Every embedded per-card use on
 * the trade pages should pass it; FeatureSwitcher's large single-image
 * slot is the one place with enough room for the full version with a
 * subtitle.
 *
 * The pulsing dot on the full toast is the only actual motion on an
 * otherwise static image, and it's cheap: no animation library, just
 * Tailwind's built-in ping.
 */
export default function PhoneStage({
  shot,
  toast,
  tone = "light",
  compact = false,
}: {
  shot: Screenshot;
  toast?: ScreenshotToast;
  tone?: "light" | "dark";
  /** Icon + title only, no brand row or subtitle. Use in any narrow/card-grid placement. */
  compact?: boolean;
}) {
  const activeToast = toast ?? shot.toast;
  const ToastIcon = activeToast ? TOAST_ICONS[activeToast.icon] : null;
  const stageBg = tone === "dark" ? "bg-white/[0.04] border border-white/10" : "bg-[#f3f5f6]";

  return (
    <div className={`relative w-full min-w-0 rounded-[28px] ${stageBg} pt-9 pb-5`}>
      <div className="mx-auto w-[70%] max-w-[220px]">
        <PhoneShot shot={shot} tone={tone} showCaption={false} sizes="(max-width: 1024px) 40vw, 220px" />
      </div>

      {activeToast && ToastIcon && (compact ? (
        <div className="absolute -left-1 top-5 max-w-[58%] flex items-center gap-1.5 bg-white rounded-lg shadow-[0_10px_24px_rgba(10,23,34,0.16)] border border-[#e8ecef] py-1.5 pl-1.5 pr-2.5">
          <div className="w-5 h-5 rounded bg-[#0a1722] flex items-center justify-center shrink-0">
            <ToastIcon size={11} className="text-[#ffb400]" />
          </div>
          <p className="text-[11px] font-extrabold text-[#0a1722] leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {activeToast.title}
          </p>
        </div>
      ) : (
        <div className="absolute -left-1 top-5 w-[50%] max-w-[175px] bg-white rounded-xl shadow-[0_14px_32px_rgba(10,23,34,0.16)] border border-[#e8ecef] p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffb400] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ffb400]" />
            </span>
            <span className="text-[8.5px] font-bold uppercase tracking-wider text-[#8a9ba8] truncate">Swiftscope</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-md bg-[#0a1722] flex items-center justify-center shrink-0">
              <ToastIcon size={12} className="text-[#ffb400]" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-extrabold text-[#0a1722] leading-tight">{activeToast.title}</p>
              <p className="text-[10px] text-[#5a6a78] leading-snug mt-0.5">{activeToast.subtitle}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
