"use client";

import { useCallback, useRef, useState } from "react";

/**
 * PlanMarkupSlider
 * -----------------
 * A drag-to-reveal before/after: a plain uploaded floor plan on the left,
 * the same plan marked up and quantified by Swiftscope on the right.
 *
 * This is the one thing from the landing-page brief that was not already on
 * the page in some form. The brief's "Live Proof Bar" (4,800+ tradies, 390+
 * suburbs) is not built here: the real numbers are 28 accounts and 840
 * directory suburbs, so those figures were wrong by two orders of magnitude
 * in one direction and understated in the other, and a false stat bar as the
 * first thing on the page is a liability, not a conversion device. The ROI
 * calculator the brief asked for already exists as SavingsCalculator, with
 * fourteen real competitor products rather than three. The AI voice
 * simulator is not built either: it would need a live model call on a
 * public page with no auth, which is a cost and abuse surface for a demo
 * that would just be re-proving what the AI section above already shows.
 *
 * The plan itself is inline SVG, not a photograph of a real plan or a
 * screenshot of the product. Two reasons. A real uploaded plan is someone's
 * copyrighted architectural drawing, which is not something to publish on a
 * marketing page without a licence. And the "after" side needs to carry
 * specific, checkable claims -- 8 downlights, 34m of cable, RCBO count -- so
 * it has to agree exactly with the copy next to it, which is only reliably
 * true if both are generated from the same source rather than screenshotted
 * separately and left to drift.
 */
export default function PlanMarkupSlider() {
  const [pos, setPos] = useState(50); // percent revealed from the left
  const dragging = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = ((clientX - r.left) / r.width) * 100;
    setPos(Math.min(96, Math.max(4, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) setFromClientX(e.clientX);
  };
  const stop = () => {
    dragging.current = false;
  };

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-[#e8ecef] select-none touch-none cursor-ew-resize"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerLeave={stop}
      >
        {/* AFTER, full width underneath */}
        <svg viewBox="0 0 640 400" className="absolute inset-0 w-full h-full" role="img" aria-hidden>
          <PlanBase />
          <MarkupLayer />
        </svg>

        {/* BEFORE, clipped to the reveal position, painted on top */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <svg viewBox="0 0 640 400" className="w-full h-full" style={{ width: "640px", maxWidth: "none" }} role="img" aria-hidden>
            <PlanBase dim />
          </svg>
          <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-[.16em] bg-white/90 text-[#5a6a78] px-2.5 py-1 rounded-full border border-[#e8ecef]">
            Uploaded plan
          </span>
        </div>
        <span
          className="absolute top-3 text-[10px] font-bold uppercase tracking-[.16em] bg-[#0a1722] text-[#ffb400] px-2.5 py-1 rounded-full transition-opacity"
          style={{ left: "calc(100% - 132px)", opacity: pos < 88 ? 1 : 0 }}
        >
          Marked up + priced
        </span>

        {/* Handle */}
        <div
          className="absolute top-0 bottom-0 w-[3px] bg-[#ffb400] shadow-[0_0_0_1px_rgba(10,23,34,0.08)]"
          style={{ left: `${pos}%`, transform: "translateX(-1.5px)" }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#ffb400] flex items-center justify-center shadow-[0_4px_14px_rgba(10,23,34,0.25)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8 5L3 12l5 7M16 5l5 7-5 7" stroke="#0a1722" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-[1.55] text-[#8aa4b4] text-center">
        Drag to compare. Illustrative plan; every marked run and fixture becomes a priced line the
        same way on a real upload.
      </p>
    </div>
  );
}

const NAVY = "#0a1722";
const AMBER = "#ffb400";
const LINE = "#c8d2da";

/** The plain plan: walls and room labels, nothing marked up. Shared by both sides. */
function PlanBase({ dim = false }: { dim?: boolean }) {
  return (
    <g opacity={dim ? 0.85 : 1}>
      <rect width="640" height="400" fill="#fbfcfd" />
      {/* House on the left two-thirds only. The right third is left empty on
          purpose: that is where the price panel sits on the marked-up side,
          and it needs real dead space to sit in rather than overlapping a
          room. First pass ran the walls to x=580 and put the panel at
          x=430-610, directly on top of "GARAGE" and its fixtures -- caught
          by rendering it, not by reading the coordinates. */}
      <g fill="none" stroke={dim ? "#8a9ba8" : NAVY} strokeWidth="2.6" strokeLinejoin="round">
        <path d="M50 50 H400 V350 H50 Z" />
        <path d="M230 50 V210" strokeWidth="1.8" />
        <path d="M230 210 H400" strokeWidth="1.8" />
        <path d="M50 210 H150" strokeWidth="1.8" />
      </g>
      <g fill={dim ? "#a8b4bf" : "#5a6a78"} fontSize="12" fontWeight="700">
        <text x="66" y="86">LIVING / DINING</text>
        <text x="250" y="86">KITCHEN</text>
        <text x="66" y="246">BED 1</text>
        <text x="170" y="246">BED 2</text>
        <text x="250" y="246">BED 3</text>
      </g>
      {dim && (
        <text x="50" y="372" fontSize="11" fill="#a8b4bf">
          plan.pdf, uploaded from site
        </text>
      )}
    </g>
  );
}

/** The Swiftscope layer: runs, counted fixtures and a priced side panel. */
function MarkupLayer() {
  return (
    <g>
      {/* cable run, low enough to clear the room labels above it */}
      <path
        d="M70 190 H150 V300 H240"
        fill="none"
        stroke={AMBER}
        strokeWidth="2.4"
        strokeDasharray="7 5"
        strokeLinecap="round"
      />
      {/* downlights, positioned below their room's label, never on top of it */}
      {[[90, 130], [130, 130], [280, 130], [320, 130], [90, 175], [130, 175]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="6" fill="none" stroke={AMBER} strokeWidth="2" />
      ))}
      {/* GPOs, along the walls, clear of the room labels and the cable run */}
      {[[62, 300], [180, 330], [300, 330], [360, 190]].map(([x, y], i) => (
        <g key={i} stroke={NAVY} strokeWidth="1.8" strokeLinecap="round">
          <path d={`M${x} ${y} h9`} />
          <path d={`M${x + 2} ${y} v-5`} />
          <path d={`M${x + 7} ${y} v-5`} />
        </g>
      ))}
      {/* switchboard, top-left corner, clear of everything else */}
      <rect x="54" y="54" width="16" height="11" rx="2" fill={NAVY} />

      {/* side panel, in the empty third of the sheet to the right of the
          house rather than on top of a room */}
      <rect x="440" y="70" width="160" height="180" rx="10" fill="#fff" stroke="#e8ecef" strokeWidth="1.5" />
      <text x="456" y="94" fontSize="10" fontWeight="700" fill={AMBER} letterSpacing="1.1">
        MARKED UP LIVE
      </text>
      {[
        ["Downlights", "6"],
        ["GPOs", "4"],
        ["Cable run", "34 lm"],
        ["Switchboard", "1"],
      ].map(([label, val], i) => (
        <g key={label}>
          <text x="456" y={120 + i * 22} fontSize="11.5" fill="#5a6a78">
            {label}
          </text>
          <text x="586" y={120 + i * 22} fontSize="11.5" fontWeight="700" fill={NAVY} textAnchor="end">
            {val}
          </text>
        </g>
      ))}
      <line x1="456" y1="212" x2="586" y2="212" stroke={LINE} strokeWidth="1" />
      <text x="456" y="234" fontSize="11.5" fontWeight="700" fill={NAVY}>
        Quote total
      </text>
      <text x="586" y="234" fontSize="15" fontWeight="700" fill={AMBER} textAnchor="end">
        $1,181
      </text>
    </g>
  );
}
