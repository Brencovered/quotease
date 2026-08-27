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
 * Rebuilt to match a specific reference mockup directly, after two earlier
 * versions were built from a description of the mockup rather than the
 * mockup itself and both missed it. The two things the reference actually
 * shows, read straight off it:
 *
 *   1. A real phone silhouette: black rounded body, a notch cut into the
 *      top of the screen, a side button on the edge. Not a plain rounded
 *      rectangle with an image inside it.
 *   2. The toast is a separate card floating beside the phone, offset to
 *      the upper-left and overlapping only the phone's edge/bezel -- it
 *      never sits on top of the screenshot itself, so nothing in the
 *      captured screen is ever covered.
 *
 * The previous version's toast was absolutely positioned across nearly the
 * full width of the stage, on top of the phone. That was solving a
 * different problem (text wrapping inside the toast) and never checked
 * against this mockup's actual placement.
 *
 * The container needs overflow-visible and left/top space reserved so the
 * toast can hang outside the phone's top-left corner into the surrounding
 * whitespace, the way it does in the reference, rather than being clipped
 * or forced to stay inside the stage's own box.
 */
export default function PhoneStage({
  shot,
  toast,
  tone = "light",
  frame = "tall",
}: {
  shot: Screenshot;
  toast?: ScreenshotToast;
  tone?: "light" | "dark";
  /** "window" crops to the top of the screen for cramped grid cards; "tall" (the default) shows the whole phone, which is every current use of this component. */
  frame?: "tall" | "window";
}) {
  const activeToast = toast ?? shot.toast;
  const ToastIcon = activeToast ? TOAST_ICONS[activeToast.icon] : null;
  const stageBg = tone === "dark" ? "bg-white/[0.04] border border-white/10" : "bg-[#f3f5f6]";

  return (
    // The previous pl-[190px]/max-w-[260px] pairing was tuned in isolation
    // against a 260px phone and never checked against the stage width this
    // component actually gets from its one call site (FeatureSwitcher's
    // 360px column). 190px of left padding out of 360px total left only
    // ~154px for the phone itself -- rendered and measured directly, not
    // estimated -- well under the "roughly 290px" this same codebase's own
    // trade-page comment says a PhoneStage capture needs to stay legible.
    // Fix has two parts: FeatureSwitcher's column widened to 460px, and the
    // padding reserved here cut to pl-[130px], so the phone actually gets
    // to use the room. 170px offset - 130px padding = 40px of the toast
    // bleeding past this stage's own left edge into the grid's gap-16
    // (64px) rather than the phone's box -- rendered and measured again to
    // confirm it lands inside that gap, not on the text column beside it.
    <div className={`relative w-full min-w-0 rounded-[28px] ${stageBg} pt-8 pb-6 pl-[130px] pr-4 overflow-visible`}>
      <div className="relative mx-auto w-full max-w-[300px]">
        {/* The phone silhouette. A plain rounded box read as "a div with an
            image in it" in the earlier version; a notch and a side button
            are what make it read as a phone, which is what the reference
            actually draws. */}
        <div className="relative rounded-[34px] bg-[#0a0e12] p-[7px] shadow-[0_20px_50px_rgba(10,23,34,0.28)]">
          {/* Side button, right edge, roughly where a power button sits. */}
          <div className="absolute -right-[2px] top-[86px] w-[3px] h-11 rounded-r-sm bg-[#0a0e12]" />
          {/* Volume buttons, left edge. */}
          <div className="absolute -left-[2px] top-[64px] w-[3px] h-6 rounded-l-sm bg-[#0a0e12]" />
          <div className="absolute -left-[2px] top-[96px] w-[3px] h-10 rounded-l-sm bg-[#0a0e12]" />

          <div
            className="relative w-full overflow-hidden rounded-[27px] bg-[#f8f9fa]"
            style={{ aspectRatio: frame === "window" ? "101 / 116" : "101 / 200" }}
          >
            <PhoneShot shot={shot} tone={tone} frame={frame} showCaption={false} sizes="(max-width: 1024px) 55vw, 260px" />

            {/* Notch, cut into the top of the screen. Sits above the
                screenshot (z-10) so it reads as part of the device, not a
                shape floating on the content. */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[38%] h-[22px] bg-[#0a0e12] rounded-b-2xl z-10" />
          </div>
        </div>

        {activeToast && ToastIcon && (
          /* Floats outside the phone's top-left corner, overlapping only
             the bezel -- never the screen content beneath it. Negative
             inset rather than a percentage-of-stage width, since this is
             now sized against the phone itself, not the stage box.

             -top-3 rather than -top-5: tightens the gap between the toast's
             bottom edge and the phone's notch slightly, since the previous
             value left visible daylight between them in the deployed
             preview. Flagged honestly: I cannot render the real page from
             here, so this is a best-effort nudge based on a screenshot, not
             a verified fix. If it is still off, the fast path is inspecting
             the live preview directly. */
          <div className="absolute -left-[170px] -top-3 w-[210px] bg-white rounded-xl shadow-[0_14px_32px_rgba(10,23,34,0.18)] border border-[#e8ecef] px-3 py-2.5 z-20">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#0a1722] flex items-center justify-center shrink-0">
                <ToastIcon size={14} className="text-[#ffb400]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffb400] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ffb400]" />
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-[.14em] text-[#5a6a78]">Swiftscope</span>
                </div>
                <p className="text-[12.5px] font-extrabold text-[#0a1722] leading-[1.25] mt-0.5">{activeToast.title}</p>
                <p className="text-[10.5px] text-[#5a6a78] leading-[1.35] mt-0.5">{activeToast.subtitle}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
