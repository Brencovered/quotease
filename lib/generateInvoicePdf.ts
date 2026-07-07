import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface InvoicePdfProfile {
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

export interface InvoicePdfLineItem {
  label: string;
  quantity: number;
  unit: string;
}

export interface InvoicePdfJob {
  job_number: number;
  client_name?: string | null;
  client_email?: string | null;
  site_address?: string | null;
  trade?: string | null;
  title?: string | null;
  labour_hours?: number | null;
  materials_cost?: number | null;
  total_cost?: number | null;
  amount_paid?: number | null;
  status?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  invoiced_at?: string | null;
}

const NAVY      = rgb(0.039, 0.090, 0.137);
const AMBER     = rgb(1, 0.706, 0);
const AMBER_DEEP = rgb(0.91, 0.62, 0);
const INK       = rgb(0.078, 0.125, 0.169);
const INK_SOFT  = rgb(0.36, 0.40, 0.44);
const INK_FAINT = rgb(0.55, 0.59, 0.63);
const WHITE     = rgb(1, 1, 1);
const LINE      = rgb(0.89, 0.90, 0.92);
const GREEN     = rgb(0.06, 0.45, 0.25);
const RED       = rgb(0.7, 0.15, 0.15);

const PAGE_WIDTH  = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN      = 48;
const HEADER_HEIGHT = 110;

/**
 * Generates an invoice PDF for a job (as distinct from the quote PDF -
 * /lib/generateQuotePdf.ts - which is sent before work is accepted).
 * This is what a tradie sends once a job is complete or in progress and
 * money is owed: it reflects the job's actual current totals and payment
 * status (amount_paid / balance owing), not just the original quoted
 * scope, and includes real bank/payment details since - unlike the quote,
 * which routes clients through the public accept-and-pay flow - the
 * invoice is a direct request for payment.
 */
export async function generateInvoicePdf(
  job: InvoicePdfJob,
  profile: InvoicePdfProfile,
  logoBytes: Uint8Array | null,
  lineItems: InvoicePdfLineItem[] = []
): Promise<Uint8Array> {
  const pdfDoc   = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y    = PAGE_HEIGHT - MARGIN;

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y    = PAGE_HEIGHT - MARGIN;
  }
  function newPageIfNeeded(min = 60) {
    if (y < MARGIN + min + 40) newPage();
  }
  function text(content: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number } = {}) {
    const sz = opts.size ?? 11;
    newPageIfNeeded(sz + 8);
    page.drawText(content, { x: opts.x ?? MARGIN, y, size: sz, font: opts.bold ? fontBold : font, color: opts.color ?? INK });
    y -= sz + 7;
  }
  function rule(color = LINE, thickness = 0.75) {
    newPageIfNeeded(16);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness, color });
    y -= 16;
  }
  function sectionLabel(label: string) {
    newPageIfNeeded(20);
    page.drawRectangle({ x: MARGIN, y: y - 2, width: 3, height: 12, color: AMBER });
    page.drawText(label.toUpperCase(), { x: MARGIN + 9, y, size: 10.5, font: fontBold, color: AMBER_DEEP });
    y -= 22;
  }
  function drawRow(label: string, value: string, opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    const sz   = opts.size ?? (opts.bold ? 13 : 11.5);
    const used = opts.bold ? fontBold : font;
    const col  = opts.color ?? INK;
    newPageIfNeeded(sz + 8);
    page.drawText(label, { x: MARGIN, y, size: sz, font: used, color: col });
    if (value) {
      const w = used.widthOfTextAtSize(value, sz);
      page.drawText(value, { x: PAGE_WIDTH - MARGIN - w, y, size: sz, font: used, color: col });
    }
    y -= sz + 8;
  }

  // ── HEADER ───────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - HEADER_HEIGHT, width: PAGE_WIDTH, height: HEADER_HEIGHT, color: NAVY });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 4, width: PAGE_WIDTH, height: 4, color: AMBER });

  let logoEmbedded = false;
  let logoDrawWidth = 0;
  if (logoBytes && logoBytes.length > 0) {
    try {
      let image;
      const header = logoBytes.slice(0, 4);
      const isPng  = header[0] === 0x89 && header[1] === 0x50;
      const isJpg  = header[0] === 0xFF && header[1] === 0xD8;
      if (isPng)       image = await pdfDoc.embedPng(logoBytes);
      else if (isJpg)  image = await pdfDoc.embedJpg(logoBytes);

      if (image) {
        const maxH  = 40;
        const scale = Math.min(maxH / image.height, 140 / image.width);
        logoDrawWidth = image.width * scale;
        const padX   = 10;
        const cardY  = PAGE_HEIGHT - 27 - maxH;
        page.drawRectangle({ x: MARGIN - padX, y: cardY - 7, width: logoDrawWidth + padX * 2, height: maxH + 14, color: WHITE });
        page.drawImage(image, { x: MARGIN, y: cardY, width: logoDrawWidth, height: image.height * scale });
        logoEmbedded = true;
      }
    } catch {
      // Logo fails silently - rest of PDF continues
    }
  }

  const headerTextX = logoEmbedded ? MARGIN + logoDrawWidth + 28 : MARGIN;
  let headerY = PAGE_HEIGHT - 38;
  if (profile.business_name) {
    page.drawText(profile.business_name, { x: headerTextX, y: headerY, size: 16, font: fontBold, color: WHITE });
    headerY -= 20;
  }
  const detailLine = [profile.business_address, profile.abn ? `ABN ${profile.abn}` : null, profile.license_number ? `Licence ${profile.license_number}` : null].filter(Boolean).join("   .   ");
  if (detailLine) { page.drawText(detailLine, { x: headerTextX, y: headerY, size: 9, font, color: rgb(0.66, 0.73, 0.79) }); headerY -= 14; }
  const contactLine = [profile.contact_phone, profile.contact_email].filter(Boolean).join("   .   ");
  if (contactLine)  page.drawText(contactLine, { x: headerTextX, y: headerY, size: 9, font, color: rgb(0.66, 0.73, 0.79) });

  y = PAGE_HEIGHT - HEADER_HEIGHT - 32;

  // ── INVOICE TITLE + TOTAL ────────────────────────────────────────
  const total    = job.total_cost ?? 0;
  const paid     = job.amount_paid ?? 0;
  const balance  = Math.max(total - paid, 0);

  page.drawText(`INVOICE #${job.job_number}`, { x: MARGIN, y, size: 20, font: fontBold, color: INK });
  const totalLabel = `$${total.toLocaleString()}`;
  const totalW     = fontBold.widthOfTextAtSize(totalLabel, 22);
  page.drawRectangle({ x: PAGE_WIDTH - MARGIN - totalW - 16, y: y - 6, width: totalW + 16, height: 28, color: AMBER });
  page.drawText(totalLabel, { x: PAGE_WIDTH - MARGIN - totalW - 8, y, size: 22, font: fontBold, color: NAVY });
  y -= 32;

  if (job.client_name)  text(`Client: ${job.client_name}`,  { size: 11.5, color: INK_SOFT });
  if (job.site_address) text(`Site: ${job.site_address}`,   { size: 11.5, color: INK_SOFT });
  text(`Invoice date: ${new Date().toLocaleDateString("en-AU")}`, { size: 11.5, color: INK_SOFT });
  if (job.trade) text(`Trade: ${job.trade.charAt(0).toUpperCase() + job.trade.slice(1)}${job.title ? " - " + job.title : ""}`, { size: 11.5, color: INK_SOFT });
  y -= 8; rule();

  // ── LINE ITEMS (materials, if any were tracked on the job) ───────
  if (lineItems.length > 0) {
    sectionLabel("Materials");
    for (const item of lineItems) {
      newPageIfNeeded();
      const qtyLabel = `${item.quantity} ${item.unit}`.trim();
      drawRow(item.label, qtyLabel, { size: 10.5 });
    }
    y -= 8; rule();
  }

  // ── SUMMARY ──────────────────────────────────────────────────────
  sectionLabel("Summary");
  drawRow("Labour", `${job.labour_hours ?? 0} hrs`, { size: 11.5, color: INK_SOFT });
  drawRow("Materials", `$${(job.materials_cost ?? 0).toLocaleString()}`, { size: 11.5, color: INK_SOFT });
  drawRow("Total", `$${total.toLocaleString()}`, { bold: true, size: 14, color: NAVY });
  drawRow("Paid to date", `$${paid.toLocaleString()}`, { size: 12, color: paid > 0 ? GREEN : INK_FAINT });
  drawRow("Balance due", `$${balance.toLocaleString()}`, { bold: true, size: 15, color: balance > 0 ? RED : GREEN });
  y -= 8;

  // ── PAYMENT DETAILS ──────────────────────────────────────────────
  if (balance > 0 && (profile.bank_account_number || profile.accepts_cash)) {
    rule();
    sectionLabel("Payment details");
    if (profile.bank_account_number) {
      drawRow("Account name", profile.bank_account_name ?? profile.business_name ?? "", { size: 11 });
      drawRow("BSB", profile.bank_bsb ?? "", { size: 11 });
      drawRow("Account number", profile.bank_account_number ?? "", { size: 11 });
    }
    if (profile.accepts_cash) {
      text("Cash payment accepted on completion.", { size: 10.5, color: INK_FAINT });
    }
    y -= 4;
  } else if (balance <= 0 && total > 0) {
    rule();
    text("Paid in full - thank you.", { size: 12, bold: true, color: GREEN });
    y -= 4;
  }

  // ── T&C ──────────────────────────────────────────────────────────
  if (profile.terms_and_conditions) {
    rule(); sectionLabel("Terms and conditions");
    const words  = profile.terms_and_conditions.split(/\s+/);
    let line = "";
    const maxW   = PAGE_WIDTH - MARGIN * 2;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, 9.5) > maxW) { text(line, { size: 9.5, color: INK_FAINT }); line = word; }
      else line = candidate;
    }
    if (line) text(line, { size: 9.5, color: INK_FAINT });
  }

  // ── FOOTER ───────────────────────────────────────────────────────
  for (const p of pdfDoc.getPages()) {
    p.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 26, color: NAVY });
    p.drawText("Quoting by Swiftscope", { x: MARGIN, y: 9, size: 8, font, color: rgb(0.55, 0.62, 0.69) });
  }

  return pdfDoc.save();
}
