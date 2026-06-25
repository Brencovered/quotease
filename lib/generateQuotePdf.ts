import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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

// Turns the raw intake form state into a readable "scope of works" list.
// This isn't a stored line-item snapshot with per-item dollar amounts -
// the calculators apply access multipliers and margins across categories
// in a way that doesn't cleanly decompose back into one price per row -
// so this shows exactly what was specified for the job, and the cost
// summary below it shows what that came to in total. That's an honest
// representation of how the quote was actually built, not a guess at
// numbers that could drift from what the client was really charged.
function humanizeIntake(intake: Record<string, unknown> | null | undefined): string[] {
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
    } else {
      lines.push(`${label}: ${value}`);
    }
  }
  return lines;
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

  // --- Header: logo + business name ---
  if (logoBytes) {
    try {
      let image;
      try {
        image = await pdfDoc.embedPng(logoBytes);
      } catch {
        image = await pdfDoc.embedJpg(logoBytes);
      }
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
      // If the logo can't be embedded (unsupported format etc.), just skip it
      // rather than failing the whole PDF over a cosmetic detail.
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

  // --- Scope of works (itemized from the intake) ---
  text("Scope of works", { size: 13, bold: true });
  const scopeLines = humanizeIntake(quote.intake_data);
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
  newPageIfNeeded(20);
  page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 4 }, thickness: 1, color: rgb(0.08, 0.09, 0.1) });
  drawRow("Total", `$${(quote.total_cost ?? 0).toLocaleString()}`, true);
  y -= 6;
  rule();

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

  // --- Payment terms ---
  const terms: PaymentTerm[] = quote.payment_terms?.length
    ? quote.payment_terms
    : [{ label: "Payment due", percent: 100, trigger: "completion", days: 14 }];
  text("Payment terms", { size: 13, bold: true });
  for (const t of terms) {
    drawRow(`${t.label} (${t.percent}%)`, `$${termAmount(t, quote.total_cost ?? 0).toLocaleString()}`);
  }
  y -= 6;

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
