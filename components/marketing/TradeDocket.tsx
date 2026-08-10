import type { DocketLine } from "@/lib/marketing/tradePages";

/**
 * TradeDocket
 * -----------
 * The visual on the trade pages, replacing the phone screenshots.
 *
 * Why not screenshots. Three reasons, in order of how much they mattered:
 *
 *  1. A capture of the materials list looks the same for a plumber as it does
 *     for a roofer. The single job of these pages is to convince one trade
 *     that the product understands their work, and a generic app screen
 *     cannot do that no matter how well it is cropped.
 *  2. On mobile each phone capture is a ~650px tall block. Three of them turn
 *     one section into a scroll. This renders as one card of about 380px and
 *     needs no image request at all.
 *  3. Text stays legible at every width. That is the entire problem that
 *     twenty commits of frame ratios, width caps and toast overlays were
 *     trying to solve.
 *
 * What it is instead: the artefact the software produces, not the software.
 * Every tradie in Australia knows the carbon-copy docket book filled in on
 * the bonnet of the ute, and Swiftscope's own Dayworks Dockets feature is
 * named for it. Showing the quote a client receives is both more familiar
 * and more persuasive than showing the builder that made it.
 *
 * The design tension is deliberate and is the one risk here: docket-book
 * conventions (hairline rules, tabular figures, a ruled quantity column,
 * uppercase stamp) set against the product's rounded cards and Anton
 * display face. It should read as a trade document rendered by software,
 * because that is exactly what it is.
 *
 * Every line comes from the trade's own intake fields, so the plumber page
 * says "shower mixer" and the roofer page says "valley, linear metre".
 * Figures are illustrative and the card says so, in the header, once.
 */
export default function TradeDocket({
  trade,
  lines,
  labourHours,
  variation,
}: {
  /** Title-case plural, eg "Electricians". Used in the stamp. */
  trade: string;
  lines: DocketLine[];
  labourHours: number;
  /** The variation this trade most often hits. Shown as an accepted extra. */
  variation: string;
}) {
  const materials = lines.reduce((sum, l) => sum + l.amount, 0);
  const labour = labourHours * 95;
  const total = materials + labour;

  const money = (n: number) =>
    n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

  return (
    <figure className="w-full max-w-[560px]">
      <div className="rounded-2xl overflow-hidden border border-[#e8ecef] bg-white shadow-[0_18px_44px_rgba(10,23,34,0.10)]">
        {/* Header: the stamp. Uppercase, letterspaced, like a docket book. */}
        <div className="bg-[#0a1722] px-5 py-4 flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[.22em] text-[#ffb400]">
              Example quote
            </p>
            <p className="font-display uppercase text-[1.15rem] text-white leading-tight mt-0.5">
              {trade}
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-[.14em] text-[#8aa4b4] tabular-nums shrink-0">
            Sent from site
          </p>
        </div>

        {/* Lines. The quantity column is the point: it is where the trade's
            own units live, and it is what a generic quote tool flattens. */}
        <ul className="divide-y divide-[#eef1f3]">
          {lines.map((l) => (
            <li key={l.label} className="flex items-baseline gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#0a1722] leading-snug">{l.label}</p>
                <p className="text-[11.5px] text-[#8a9ba8] tabular-nums mt-0.5">
                  {l.qty} {l.unit}
                </p>
              </div>
              <p className="text-[13.5px] font-semibold text-[#0a1722] tabular-nums shrink-0">
                {money(l.amount)}
              </p>
            </li>
          ))}

          {/* Labour as its own line, because materials and labour staying
              split is a real product behaviour and the copy claims it. */}
          <li className="flex items-baseline gap-3 px-5 py-3 bg-[#fafbfc]">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[#0a1722]">Labour</p>
              <p className="text-[11.5px] text-[#8a9ba8] tabular-nums mt-0.5">
                {labourHours} hrs at $95
              </p>
            </div>
            <p className="text-[13.5px] font-semibold text-[#0a1722] tabular-nums shrink-0">
              {money(labour)}
            </p>
          </li>

          {/* The variation, marked accepted. This is the margin-saving
              behaviour the page argues for, shown rather than described. */}
          <li className="flex items-baseline gap-3 px-5 py-3 bg-[#fffaf0]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ffb400] shrink-0" />
                <span className="text-[9.5px] font-bold uppercase tracking-[.16em] text-[#b07a00]">
                  Variation, accepted on site
                </span>
              </div>
              <p className="text-[13px] text-[#5a6a78] leading-snug">{variation}</p>
            </div>
          </li>
        </ul>

        {/* Total. The one loud element on the card. */}
        <div className="px-5 py-4 bg-[#0a1722] flex items-end justify-between gap-4">
          <div className="text-[11px] text-[#8aa4b4] tabular-nums leading-relaxed">
            <p>Materials {money(materials)}</p>
            <p>Labour {money(labour)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9.5px] font-bold uppercase tracking-[.22em] text-[#8aa4b4]">Total</p>
            <p className="font-display text-[2.1rem] leading-none text-[#ffb400] tabular-nums">
              {money(total)}
            </p>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-[12.5px] leading-[1.5] text-[#8a9ba8]">
        Illustrative figures. The line items and units are the real ones this builder asks for.
      </figcaption>
    </figure>
  );
}
