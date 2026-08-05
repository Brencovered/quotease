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
 * exactly that: a soft background stage, the phone, and a toast pinned
 * over its top-left corner, carrying the number or status that makes the
 * screenshot worth a second look.
 *
 * A previous version tried a `compact` mode -- icon and title only, no
 * subtitle -- to fix wrapping in narrow per-card contexts. That was
 * backwards: the subtitle is the actual content ("$8,179 received on
 * this job", not just "Paid in full"), and cutting it didn't even fix
 * the underlying problem -- the title alone kept truncating too, because
 * the real fault was `whitespace-nowrap` plus `text-ellipsis` on
 * something without a reliably large enough box, not the presence of a
 * second line of text. Deleted entirely. Text here wraps normally --
 * never nowrap, never ellipsis -- so the worst case is a slightly taller
 * card, never a mid-word cut. That's a strictly safer failure mode than
 * chasing exact pixel widths across every context this renders in.
 *
 * Root has no horizontal padding, and the phone is inset via `mx-auto`
 * margin rather than root padding, so the phone and the toast measure
 * their percentage widths against the same box. (An absolutely
 * positioned element's percentage resolves against the padding box; a
 * normal-flow child's resolves against the content box -- two different
 * numbers if the root has its own horizontal padding, which is what
 * previously let the toast render wider than the phone it was supposed
 * to be an accent on.)
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
    <div className={`relative w-full min-w-0 rounded-[28px] ${stageBg} pt-9 pb-5`}>
      <div className="mx-auto w-[70%] max-w-[220px]">
        <PhoneShot shot={shot} tone={tone} showCaption={false} sizes="(max-width: 1024px) 45vw, 220px" />
      </div>

      {activeToast && ToastIcon && (
        <div className="absolute -left-1 top-5 w-[68%] max-w-[190px] bg-white rounded-xl shadow-[0_14px_32px_rgba(10,23,34,0.16)] border border-[#e8ecef] p-2.5">
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
