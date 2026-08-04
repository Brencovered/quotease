import { Camera } from "lucide-react";

/**
 * components/marketing/ComingSoonStage.tsx
 * ------------------------------------------
 * A screenshot-shaped gap, used where a real one doesn't exist yet rather
 * than reusing a screenshot from a different trade's builder.
 *
 * Roughly half of lib/marketing/screenshots.ts is captured from the
 * electrician quote builder specifically -- downlights in the pricebook,
 * CCEW on the job step, level 2 connection fees on the scope step. Those
 * are honest on the electrician page. Showing them on the plumber or
 * roofer page while the surrounding copy claims a builder that "knows
 * your trade" would show one trade's fields while claiming another's,
 * which is the exact kind of pixel-vs-caption mismatch the toast cards
 * elsewhere on this site are built to avoid, not create.
 *
 * Dashed border and muted icon rather than any attempt to look like a
 * phone screenshot: it should read at a glance as "not yet", not as a
 * broken or placeholder-forgotten image.
 */
export default function ComingSoonStage({ label }: { label: string }) {
  return (
    <div className="relative rounded-[32px] bg-[#f8f9fa] border-2 border-dashed border-[#d5dbe0] flex flex-col items-center justify-center text-center px-6 py-12 min-h-[300px]">
      <div className="w-11 h-11 rounded-xl bg-white border border-[#d5dbe0] flex items-center justify-center mb-4">
        <Camera size={18} className="text-[#8a9ba8]" />
      </div>
      <p className="text-[13px] font-bold text-[#5a6a78] leading-snug max-w-[160px]">{label}</p>
    </div>
  );
}
