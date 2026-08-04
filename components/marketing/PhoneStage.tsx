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
 * Both the phone and the toast are sized as percentages of the stage,
 * not fixed pixels, so they scale together at any column width, and the
 * root has `w-full min-w-0` so it stretches correctly whether it's a
 * normal block child or a direct grid item (see the RSC-boundary and
 * min-width:auto write-ups in git history -- both were real bugs here).
 *
 * `compact` controls a third thing entirely: how much text the toast
 * tries to hold. The full toast -- brand row, icon, title, subtitle --
 * needs roughly 150px of real width to wrap its subtitle across two
 * lines without looking broken. That's fine in a wide single-image
 * context like FeatureSwitcher's 360px column, and it is not fine in a
 * card grid where PhoneStage renders at 150-180px total: at that size
 * the toast itself is under 90px, and the text column left over after
 * its own padding and icon box is roughly 35px -- not enough room for
 * "9 exported" to hold together as a word, let alone a full subtitle.
 * No amount of width-tuning fixes that; the honest fix is less text.
 * `compact` drops the brand row and the subtitle and shows only the
 * icon and title, which is already short by design ("$282", "Signed",
 * "9 exported") and holds up at any width this component is used at.
 * Every embedded per-card use on the trade pages should pass compact;
 * FeatureSwitcher's large single-image slot is the one place with
 * enough room for the full version.
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
    <div className={`relative w-full min-w-0 rounded-[28px] ${stageBg} pt-10 pb-6 px-6`}>
      <div className="mx-auto w-[82%] max-w-[250px]">
        <PhoneShot shot={shot} tone={tone} showCaption={false} sizes="(max-width: 1024px) 45vw, 250px" />
      </div>

      {activeToast && ToastIcon && (compact ? (
        <div className="absolute -left-1.5 top-6 sm:top-7 max-w-[85%] flex items-center gap-1.5 bg-white rounded-lg shadow-[0_10px_24px_rgba(10,23,34,0.16)] border border-[#e8ecef] py-1.5 pl-1.5 pr-2.5">
          <div className="w-5 h-5 rounded bg-[#0a1722] flex items-center justify-center shrink-0">
            <ToastIcon size={11} className="text-[#ffb400]" />
          </div>
          <p className="text-[11px] font-extrabold text-[#0a1722] leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {activeToast.title}
          </p>
        </div>
      ) : (
        <div className="absolute -left-1.5 top-6 sm:top-7 w-[58%] max-w-[175px] bg-white rounded-xl shadow-[0_14px_32px_rgba(10,23,34,0.16)] border border-[#e8ecef] p-2.5">
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
