"use client";

import { Ruler, CheckCircle2, MapPin, FileCheck, type LucideIcon } from "lucide-react";
import PhoneShot from "./PhoneShot";
import type { Screenshot } from "@/lib/marketing/screenshots";

// Same reasoning as FeatureSwitcher's icon map: a toast icon resolved from a
// string key inside this client component, never accepted as a component
// reference prop. A Server Component parent can't pass a live function
// across the server/client boundary -- see FeatureSwitcher.tsx for the
// build failure this caused the one time it was tried here.
const TOAST_ICONS: Record<string, LucideIcon> = {
  ruler: Ruler,
  check: CheckCircle2,
  pin: MapPin,
  file: FileCheck,
};

export interface PhoneToast {
  icon: keyof typeof TOAST_ICONS;
  title: string;
  subtitle: string;
}

/**
 * components/marketing/PhoneStage.tsx
 * ------------------------------------
 * A screenshot on its own, however well-framed, reads as a photo of the
 * product. What makes it read as the product *doing something* is a small
 * floating card overlaid on top of it -- a live measurement, a quote total,
 * a confirmation -- the way a phone notification sits on top of whatever
 * app is underneath it. This wraps PhoneShot with exactly that: a soft
 * background stage, the phone, and an optional toast pinned over its top
 * corner.
 *
 * The toast content is deliberately tied to the real numbers already
 * visible in the screenshot it sits on -- 0.62m on the live camera markup,
 * $282 on the plan markup total -- rather than invented figures. A toast
 * that contradicts the screen behind it reads as fake; one that echoes it
 * reads as the product highlighting its own result.
 *
 * The pulsing dot is the only actual motion on an otherwise static image,
 * and it's cheap: no animation library, just Tailwind's built-in ping.
 */
export default function PhoneStage({
  shot,
  toast,
  tone = "light",
  phoneWidth = "max-w-[230px]",
}: {
  shot: Screenshot;
  toast?: PhoneToast;
  tone?: "light" | "dark";
  phoneWidth?: string;
}) {
  const ToastIcon = toast ? TOAST_ICONS[toast.icon] : null;
  const stageBg = tone === "dark" ? "bg-white/[0.04] border border-white/10" : "bg-[#f3f5f6]";

  return (
    <div className={`relative rounded-[32px] ${stageBg} pt-12 pb-8 px-8`}>
      <div className={`mx-auto ${phoneWidth}`}>
        <PhoneShot shot={shot} tone={tone} showCaption={false} sizes="(max-width: 1024px) 55vw, 260px" />
      </div>

      {toast && ToastIcon && (
        <div className="absolute -left-3 top-8 sm:-left-6 sm:top-10 w-[195px] sm:w-[210px] bg-white rounded-2xl shadow-[0_16px_36px_rgba(10,23,34,0.18)] border border-[#e8ecef] p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffb400] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ffb400]" />
            </span>
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#8a9ba8]">Swiftscope</span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0a1722] flex items-center justify-center shrink-0">
              <ToastIcon size={14} className="text-[#ffb400]" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-[#0a1722] leading-tight">{toast.title}</p>
              <p className="text-[11px] text-[#5a6a78] leading-snug mt-0.5">{toast.subtitle}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
