import Image from "next/image";
import type { Screenshot } from "@/lib/marketing/screenshots";

/**
 * components/marketing/PhoneShot.tsx
 * ----------------------------------
 * One product screenshot in a phone bezel, with the caption underneath.
 *
 * Every shot renders at exactly the same size. That is the whole point of
 * this component and it is worth spelling out, because the obvious
 * implementation gets it wrong.
 *
 * The captures come off a phone at slightly different sizes: widths run
 * 592 to 720, heights 1330 to 1484, so aspect ratios range from 0.435 to
 * 0.503. Rendering each at its own true ratio inside a grid gives four
 * phones of four different heights, with four captions starting at four
 * different points down the page. It reads as broken rather than as
 * faithful to the source.
 *
 * So: a fixed-ratio box, `fill`, and a top-anchored cover crop. FRAME is
 * the *widest* ratio in the set, which guarantees every crop is vertical
 * rather than horizontal, so nothing is sliced off the sides. What comes
 * off the bottom is at most about 14%, and the bottom of these screens is
 * the app's own navigation bar: repeated furniture on every capture,
 * carrying no information.
 *
 * A future capture wider than FRAME would start cropping at the sides
 * instead, so widen FRAME rather than letting that happen quietly.
 *
 * Width is deliberately not set here. The parent grid decides how wide a
 * phone is, so the column edges line up with the heading and body copy
 * above them instead of each phone floating centred in its own column.
 *
 * Server component: no state, no handlers, so it stays out of the client
 * bundle.
 */

/** Widest source ratio in the set, rounded up. See note above. */
const FRAME = "101 / 200";

export default function PhoneShot({
  shot,
  tone = "dark",
  showCaption = true,
  priority = false,
  sizes = "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 300px",
}: {
  shot: Screenshot;
  /** Bezel and caption colour. Pick the one that contrasts the section. */
  tone?: "dark" | "light";
  showCaption?: boolean;
  priority?: boolean;
  sizes?: string;
}) {
  const bezel =
    tone === "dark"
      ? "bg-[#0a1722] ring-1 ring-white/10"
      : "bg-white ring-1 ring-[#e8ecef] shadow-[0_10px_30px_rgba(10,23,34,0.08)]";
  const captionColour = tone === "dark" ? "text-[#8aa4b4]" : "text-[#5a6a78]";

  return (
    <figure className="w-full">
      <div className={`rounded-[24px] p-1.5 sm:p-2 ${bezel}`}>
        <div
          className="relative w-full overflow-hidden rounded-[17px] bg-[#f8f9fa]"
          style={{ aspectRatio: FRAME }}
        >
          <Image
            src={shot.src}
            alt={shot.alt}
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover object-top"
          />
        </div>
      </div>
      {showCaption && (
        <figcaption className={`mt-3 text-[13px] leading-[1.5] ${captionColour}`}>
          {shot.caption}
        </figcaption>
      )}
    </figure>
  );
}
