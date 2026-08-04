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
 * not fixed pixels, so they scale together at any column width. That
 * fixed the disproportion bug from the previous version. A second,
 * separate bug surfaced after that: PhoneStage's own root div had no
 * explicit width, which is fine as a normal block child (it fills
 * whatever its parent gives it) but breaks the moment PhoneStage is used
 * as a *direct grid item* -- CSS Grid items default to `min-width: auto`,
 * which for an item containing image content can resist shrinking below
 * the content's own preferred size, overriding the grid's `stretch`
 * behaviour and letting the item overflow its column instead of filling
 * it. That's exactly what happened where two PhoneStage instances sat
 * directly inside a `grid-cols-2` -- each rendered near its own max-width
 * cap regardless of how narrow the actual column was, spilling out of
 * the card. `w-full min-w-0` on the root makes PhoneStage behave
 * correctly in both contexts: it fills a block parent as before, and it
 * now actually stretches to its grid track instead of resisting it.
 *
 * The pulsing dot is the only actual motion on an otherwise static image,
 * and it's cheap: no animation library, just Tailwind's built-in ping.
 */
export default function PhoneStage({
  shot,
  toast,
  tone = "light",
}: {
  shot: Screenshot;
  toast?: ScreenshotToast;
  tone?: "light" | "dark";
}) {
  const activeToast = toast ?? shot.toast;
  const ToastIcon = activeToast ? TOAST_ICONS[activeToast.icon] : null;
  const stageBg = tone === "dark" ? "bg-white/[0.04] border border-white/10" : "bg-[#f3f5f6]";

  return (
    <div className={`relative w-full min-w-0 rounded-[28px] ${stageBg} pt-10 pb-6 px-6`}>
      <div className="mx-auto w-[82%] max-w-[250px]">
        <PhoneShot shot={shot} tone={tone} showCaption={false} sizes="(max-width: 1024px) 45vw, 250px" />
      </div>

      {activeToast && ToastIcon && (
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
      )}
    </div>
  );
}
