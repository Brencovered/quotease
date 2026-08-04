import Image from "next/image";
import type { Screenshot } from "@/lib/marketing/screenshots";

/**
 * components/marketing/PhoneShot.tsx
 * ----------------------------------
 * Renders one product screenshot at its true aspect ratio inside a phone
 * bezel, with the caption underneath.
 *
 * Two decisions worth keeping:
 *
 *  - No `fill` and no `object-cover`. Every screenshot in the set is
 *    portrait at roughly 1:2.2. Forcing those into a landscape or 4:5 box
 *    with object-cover silently deletes the bottom of the screen, which is
 *    where the totals, the signatures and the buttons are. Intrinsic
 *    width/height plus `h-auto` shows the whole screen and still reserves
 *    the correct space, so there is no layout shift.
 *
 *  - Width is capped, not stretched. A 1:2.2 image given a full desktop
 *    column would be 800px tall and push everything else off the screen.
 *    The `size` prop caps it so a row of three fits in a normal section.
 *
 * Server component: no state, no handlers, so it stays out of the client
 * bundle.
 */

const SIZE = {
  sm: "max-w-[190px]",
  md: "max-w-[250px]",
  lg: "max-w-[310px]",
} as const;

/** Rough CSS width at each size, so the browser picks a sane candidate. */
const SIZES_ATTR = {
  sm: "190px",
  md: "(max-width: 640px) 60vw, 250px",
  lg: "(max-width: 640px) 75vw, 310px",
} as const;

export default function PhoneShot({
  shot,
  size = "md",
  tone = "dark",
  showCaption = true,
  priority = false,
}: {
  shot: Screenshot;
  size?: keyof typeof SIZE;
  /** Bezel and caption colour. Pick the one that contrasts the section. */
  tone?: "dark" | "light";
  showCaption?: boolean;
  priority?: boolean;
}) {
  const bezel =
    tone === "dark"
      ? "bg-[#0a1722] ring-1 ring-white/10"
      : "bg-white ring-1 ring-[#e8ecef] shadow-[0_10px_30px_rgba(10,23,34,0.08)]";
  const captionColour = tone === "dark" ? "text-[#8aa4b4]" : "text-[#5a6a78]";

  return (
    <figure className={`w-full ${SIZE[size]} mx-auto`}>
      <div className={`rounded-[26px] p-2 ${bezel}`}>
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          sizes={SIZES_ATTR[size]}
          priority={priority}
          className="w-full h-auto block rounded-[18px]"
        />
      </div>
      {showCaption && (
        <figcaption className={`mt-3.5 text-[13.5px] leading-[1.55] ${captionColour}`}>
          {shot.caption}
        </figcaption>
      )}
    </figure>
  );
}
