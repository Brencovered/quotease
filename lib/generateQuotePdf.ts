import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import { termAmount, type PaymentTerm } from "./paymentTerms";

export interface QuotePdfProfile {
  business_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  abn?: string | null;
  license_number?: string | null;
  business_address?: string | null;
  terms_and_conditions?: string | null;
  logo_url?: string | null;
  bank_account_name?: string | null;
  bank_bsb?: string | null;
  bank_account_number?: string | null;
  accepts_cash?: boolean | null;
}

export interface QuotePdfQuote {
  client_name?: string | null;
  client_email?: string | null;
  site_address?: string | null;
  invoice_number?: string | null;
  job_type?: string | null;
  trade?: string | null;
  intake_data?: Record<string, unknown> | null;
  labour_hours?: number | null;
  materials_cost?: number | null;
  total_cost?: number | null;
  payment_terms?: PaymentTerm[] | null;
  status?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
}

// --- Electrician-specific labels, matching the exact option text used in
// the quote builder dropdowns, so the PDF reads in plain English rather
// than exposing internal field names or raw access-difficulty multipliers
// (e.g. "1.7" meaning nothing to a client - it's a wiring-time multiplier,
// not a thing that should ever reach a client-facing document).
const JOB_TYPE_LABELS: Record<string, string> = {
  reno: "Renovation / alteration",
  newbuild: "New build",
  fault: "Fault find / repair",
  compliance: "Compliance / inspection",
};
const CEILING_TYPE_LABELS: Record<string, string> = {
  unknown: "Unknown — check on site",
  standard_plasterboard: "Standard plasterboard",
  skillion: "Skillion / cathedral",
  concrete_slab: "Concrete slab",
  heritage_timber: "Heritage / period timber",
};
const DOWNLIGHT_GRADE_LABELS: Record<string, string> = {
  builder: "Builder grade",
  standard: "Standard grade",
  premium: "Premium / smart",
};
const ROOF_ACCESS_LABELS: Record<number, string> = {
  1.3: "Easy access",
  1.7: "Tight crawl",
  2.3: "Extreme — very difficult",
};
const SUBFLOOR_ACCESS_LABELS: Record<number, string> = {
  1.3: "Easy crawl",
  1.8: "Tight crawl",
  2.4: "Wet / very low clearance",
};
const SITE_ACCESS_LABELS: Record<string, string> = { easy: "Easy", moderate: "Moderate", difficult: "Difficult" };

function buildElectricianScope(intake: Record<string, unknown>): string[] {
  const i = intake as Record<string, string | number | boolean | undefined>;
  const lines: string[] = [];

  if (i.jobType) lines.push(`Job type: ${JOB_TYPE_LABELS[i.jobType as string] ?? i.jobType}`);
  if (i.ceilingType) lines.push(`Ceiling type: ${CEILING_TYPE_LABELS[i.ceilingType as string] ?? i.ceilingType}`);

  if (i.switchboardUpgrade) lines.push(i.switchboardRcbo ? "Switchboard upgrade — full RCBO" : "Switchboard upgrade");
  if (i.threePhase) lines.push("3-phase supply");

  if (Number(i.powerPoints) > 0) lines.push(`Power points: ${i.powerPoints}`);
  if (Number(i.lightPoints) > 0) lines.push(`Light points: ${i.lightPoints}`);
  if (Number(i.switches) > 0) lines.push(`Switches: ${i.switches}`);
  if (Number(i.downlights) > 0) {
    const grade = DOWNLIGHT_GRADE_LABELS[i.downlightGrade as string] ?? i.downlightGrade;
    lines.push(`Downlights: ${i.downlights} (${grade})`);
  }
  if (Number(i.exhaustFans) > 0) lines.push(`Exhaust fans: ${i.exhaustFans}`);

  if (Number(i.cableMetres) > 0) lines.push(`Cable run: ${i.cableMetres}m`);
  if (Number(i.trenchMetres) > 0) lines.push(`Trenching: ${i.trenchMetres}m`);
  if (i.roofAccess && Number(i.roofAccess) !== 1) {
    lines.push(`Roof access: ${ROOF_ACCESS_LABELS[Number(i.roofAccess)] ?? i.roofAccess}`);
  }
  if (i.subfloorAccess && Number(i.subfloorAccess) !== 1) {
    lines.push(`Subfloor access: ${SUBFLOOR_ACCESS_LABELS[Number(i.subfloorAccess)] ?? i.subfloorAccess}`);
  }
  if (i.siteAccess && i.siteAccess !== "easy") lines.push(`Site access: ${SITE_ACCESS_LABELS[i.siteAccess as string] ?? i.siteAccess}`);
  if (i.multistorey) lines.push("Multi-storey property");

  const appliances = [
    i.applianceOven && "Oven",
    i.applianceCooktop && "Cooktop",
    i.applianceHwc && "Hot water",
    i.applianceAircon && "Aircon",
    i.appliancePool && "Pool / spa",
  ].filter(Boolean);
  if (appliances.length) lines.push(`Appliance circuits: ${appliances.join(", ")}`);
  if (i.evCharger) lines.push("EV charger circuit");
  if (i.solarConnection) lines.push("Solar connection");
  if (Number(i.externalCircuits) > 0) lines.push(`External circuits: ${i.externalCircuits}`);

  if (Number(i.dataPoints) > 0) lines.push(`Data points: ${i.dataPoints}`);
  if (i.nbn) lines.push("NBN connection point");

  if (Number(i.smokeAlarms) > 0) lines.push(`Smoke alarms (interconnected): ${i.smokeAlarms}`);
  if (i.coes) lines.push("Certificate of Electrical Safety (COES)");
  if (i.ccew) lines.push("Certificate of Compliance for Electrical Work (CCEW)");
  if (i.callout) lines.push("Call-out fee included");

  return lines;
}

// Generic fallback for trades without a dedicated formatter yet (plumber,
// carpenter, roofer). Safer than the bare version: title-cases snake_case
// enum values too, instead of printing them raw (e.g. "concrete_slab").
function humanizeIntakeGeneric(intake: Record<string, unknown> | null | undefined): string[] {
  if (!intake) return [];
  const SKIP = new Set(["jobType", "notes"]);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(intake)) {
    if (SKIP.has(key)) continue;
    if (value === null || value === undefined || value === "" || value === false) continue;
    if (typeof value === "number" && value === 0) continue;
    if (Array.isArray(value) || typeof value === "object") continue;

    const label = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();

    if (typeof value === "boolean") {
      lines.push(label);
    } else if (typeof value === "string" && value.includes("_")) {
      const niceValue = value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`${label}: ${niceValue}`);
    } else {
      lines.push(`${label}: ${value}`);
    }
  }
  return lines;
}

// This isn't a stored line-item snapshot with per-item dollar amounts - the
// calculators apply access multipliers and margins across categories in a
// way that doesn't cleanly decompose back into one price per row - so this
// shows exactly what was specified for the job, and the cost summary below
// shows what that came to in total. That's honest to how the quote was
// actually built, rather than a guess at numbers that could drift from
// what the client was really charged.
function buildScopeLines(trade: string | null | undefined, intake: Record<string, unknown> | null | undefined): string[] {
  if (!intake) return [];
  if (trade === "electrician") return buildElectricianScope(intake);
  return humanizeIntakeGeneric(intake);
}

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

export async function generateQuotePdf(
  quote: QuotePdfQuote,
  profile: QuotePdfProfile,
  logoBytes: Uint8Array | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPageIfNeeded(minSpace = 60) {
    if (y < MARGIN + minSpace) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function text(content: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; x?: number } = {}) {
    const size = opts.size ?? 11;
    const usedFont = opts.bold ? fontBold : font;
    const color = opts.color ? rgb(...opts.color) : rgb(0.08, 0.09, 0.1);
    newPageIfNeeded(size + 8);
    page.drawText(content, { x: opts.x ?? MARGIN, y, size, font: usedFont, color });
    y -= size + 7;
  }

  function rule() {
    newPageIfNeeded(16);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.75,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 14;
  }

  // Draws a label/value row, with the value right-aligned. Returns nothing -
  // mutates the shared `y` cursor, same as the other draw helpers.
  function drawRow(label: string, value: string, bold = false) {
    const size = bold ? 12.5 : 11;
    const usedFont = bold ? fontBold : font;
    newPageIfNeeded(size + 8);
    page.drawText(label, { x: MARGIN, y, size, font: usedFont, color: rgb(0.08, 0.09, 0.1) });
    if (value) {
      const width = usedFont.widthOfTextAtSize(value, size);
      page.drawText(value, { x: PAGE_WIDTH - MARGIN - width, y, size, font: usedFont, color: rgb(0.08, 0.09, 0.1) });
    }
    y -= size + 7;
  }

  // A horizontal divider sitting clearly ABOVE the next row of text, with
  // real clearance - not at the same y as the text baseline. (Drawing the
  // rule too close to the following text is exactly what previously made
  // a "Total" line render with the rule cutting straight through the
  // letters like a strikethrough.)
  function ruleAboveNextRow() {
    newPageIfNeeded(24);
    page.drawLine({
      start: { x: MARGIN, y: y + 11 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 11 },
      thickness: 1,
      color: rgb(0.08, 0.09, 0.1),
    });
    y -= 4;
  }

  // --- Header: logo + business name ---
  if (logoBytes) {
    try {
      // pdf-lib can only embed PNG or JPEG directly. Logos get uploaded in
      // whatever format the tradie's phone/computer produced (WebP is the
      // common one from modern phone cameras/screenshots), so normalize to
      // PNG here rather than silently dropping the logo when the format
      // doesn't happen to match - that was the actual bug before this fix.
      const pngBytes = await sharp(logoBytes).png().toBuffer();
      const image = await pdfDoc.embedPng(pngBytes);
      const maxH = 50;
      const scale = Math.min(maxH / image.height, 140 / image.width);
      page.drawImage(image, {
        x: MARGIN,
        y: y - maxH,
        width: image.width * scale,
        height: image.height * scale,
      });
      y -= maxH + 10;
    } catch {
      // If the logo can't be processed for any reason, skip it rather than
      // failing the whole PDF over a cosmetic detail.
    }
  }

  text(profile.business_name ?? "Quote", { size: 18, bold: true });
  const businessDetailLine = [profile.business_address, profile.abn ? `ABN ${profile.abn}` : null, profile.license_number ? `Licence ${profile.license_number}` : null]
    .filter(Boolean)
    .join("   |   ");
  if (businessDetailLine) text(businessDetailLine, { size: 9.5, color: [0.4, 0.42, 0.45] });
  if (profile.contact_phone || profile.contact_email) {
    text([profile.contact_phone, profile.contact_email].filter(Boolean).join("   |   "), { size: 9.5, color: [0.4, 0.42, 0.45] });
  }
  y -= 6;
  rule();

  // --- Quote meta ---
  text(`QUOTE${quote.invoice_number ? " " + quote.invoice_number : ""}`, { size: 14, bold: true });
  if (quote.client_name) text(`Client: ${quote.client_name}`, { size: 11 });
  if (quote.site_address) text(`Site: ${quote.site_address}`, { size: 11 });
  text(`Date: ${new Date(quote.created_at ?? Date.now()).toLocaleDateString("en-AU")}`, { size: 11 });
  if (quote.trade) text(`Trade: ${quote.trade.charAt(0).toUpperCase() + quote.trade.slice(1)}${quote.job_type ? " — " + quote.job_type : ""}`, { size: 11 });
  y -= 6;
  rule();

  // --- Scope of works ---
  text("Scope of works", { size: 13, bold: true });
  const scopeLines = buildScopeLines(quote.trade, quote.intake_data);
  if (scopeLines.length === 0) {
    text("As discussed on site.", { size: 10.5, color: [0.4, 0.42, 0.45] });
  } else {
    for (const line of scopeLines) {
      newPageIfNeeded();
      text(`•  ${line}`, { size: 10.5 });
    }
  }
  y -= 6;
  rule();

  // --- Cost summary ---
  text("Quote summary", { size: 13, bold: true });
  const labourCost = (quote.total_cost ?? 0) - (quote.materials_cost ?? 0);
  drawRow(`Labour (${quote.labour_hours ?? 0} hrs)`, `$${labourCost.toLocaleString()}`);
  drawRow("Materials", `$${(quote.materials_cost ?? 0).toLocaleString()}`);
  ruleAboveNextRow();
  drawRow("Total", `$${(quote.total_cost ?? 0).toLocaleString()}`, true);
  y -= 6;
  rule();

  // --- Payment terms ---
  const terms: PaymentTerm[] = quote.payment_terms?.length
    ? quote.payment_terms
    : [{ label: "Payment due", percent: 100, trigger: "completion", days: 14 }];
  text("Payment terms", { size: 13, bold: true });
  for (const t of terms) {
    drawRow(`${t.label} (${t.percent}%)`, `$${termAmount(t, quote.total_cost ?? 0).toLocaleString()}`);
  }
  y -= 6;

  // --- How to pay ---
  const hasBankDetails = profile.bank_bsb && profile.bank_account_number;
  if (hasBankDetails || profile.accepts_cash) {
    rule();
    text("How to pay", { size: 13, bold: true });
    if (hasBankDetails) {
      text("Bank transfer:", { size: 10.5, bold: true });
      text(`Account name: ${profile.bank_account_name ?? profile.business_name ?? ""}`, { size: 10.5 });
      text(`BSB: ${profile.bank_bsb}    Account: ${profile.bank_account_number}`, { size: 10.5 });
      y -= 4;
    }
    if (profile.accepts_cash) {
      text("Cash accepted on completion of the job.", { size: 10.5 });
    }
    y -= 2;
  }

  // --- Terms and conditions ---
  if (profile.terms_and_conditions) {
    rule();
    text("Terms and conditions", { size: 12, bold: true });
    const words = profile.terms_and_conditions.split(/\s+/);
    let line = "";
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, 9.5) > maxWidth) {
        text(line, { size: 9.5, color: [0.4, 0.42, 0.45] });
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) text(line, { size: 9.5, color: [0.4, 0.42, 0.45] });
  }

  return pdfDoc.save();
}

// Re-exported for type clarity at call sites - keeps the route file from
// needing to import pdf-lib's internal types directly.
export type { PDFFont, PDFPage };
