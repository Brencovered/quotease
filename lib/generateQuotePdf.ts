import { PDFDocument, PDFName, PDFString, PDFArray, PDFNumber, StandardFonts, rgb } from "pdf-lib";
import { termAmount, type PaymentTerm } from "./paymentTerms";
import { humanizeIntakePublic } from "./humanizeIntake";

const humanizeIntake = humanizeIntakePublic;

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
  public_token?: string | null;
}

const NAVY     = rgb(0.039, 0.090, 0.137);
const AMBER    = rgb(1, 0.706, 0);
const AMBER_DEEP = rgb(0.91, 0.62, 0);
const INK      = rgb(0.078, 0.125, 0.169);
const INK_SOFT = rgb(0.36, 0.40, 0.44);
const INK_FAINT = rgb(0.55, 0.59, 0.63);
const WHITE    = rgb(1, 1, 1);
const LINE     = rgb(0.89, 0.90, 0.92);
const LINK_BLUE = rgb(0.12, 0.35, 0.70);

const PAGE_WIDTH  = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN      = 48;
const HEADER_HEIGHT = 110;

export async function generateQuotePdf(
  quote: QuotePdfQuote,
  profile: QuotePdfProfile,
  logoBytes: Uint8Array | null
): Promise<Uint8Array> {
  const pdfDoc  = await PDFDocument.create();
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

  // Logo - try to embed but skip cleanly if anything fails
  let logoEmbedded = false;
  let logoDrawWidth = 0;
  if (logoBytes && logoBytes.length > 0) {
    try {
      // Try PNG first, then JPEG - skip WebP/HEIC gracefully
      let image;
      const header = logoBytes.slice(0, 4);
      const isPng  = header[0] === 0x89 && header[1] === 0x50;
      const isJpg  = header[0] === 0xFF && header[1] === 0xD8;
      if (isPng)       image = await pdfDoc.embedPng(logoBytes);
      else if (isJpg)  image = await pdfDoc.embedJpg(logoBytes);
      // Anything else (WebP, HEIC, etc.) is skipped

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

  // ── QUOTE TITLE + TOTAL ──────────────────────────────────────────
  page.drawText(`QUOTE${quote.invoice_number ? " " + quote.invoice_number : ""}`, { x: MARGIN, y, size: 20, font: fontBold, color: INK });
  const totalLabel = `$${(quote.total_cost ?? 0).toLocaleString()}`;
  const totalW     = fontBold.widthOfTextAtSize(totalLabel, 22);
  page.drawRectangle({ x: PAGE_WIDTH - MARGIN - totalW - 16, y: y - 6, width: totalW + 16, height: 28, color: AMBER });
  page.drawText(totalLabel, { x: PAGE_WIDTH - MARGIN - totalW - 8, y, size: 22, font: fontBold, color: NAVY });
  y -= 32;

  if (quote.client_name)  text(`Client: ${quote.client_name}`,  { size: 11.5, color: INK_SOFT });
  if (quote.site_address) text(`Site: ${quote.site_address}`,   { size: 11.5, color: INK_SOFT });
  text(`Date: ${new Date(quote.created_at ?? Date.now()).toLocaleDateString("en-AU")}`, { size: 11.5, color: INK_SOFT });
  if (quote.trade) text(`Trade: ${quote.trade.charAt(0).toUpperCase() + quote.trade.slice(1)}${quote.job_type ? " - " + quote.job_type : ""}`, { size: 11.5, color: INK_SOFT });
  y -= 8; rule();

  // ── SCOPE ────────────────────────────────────────────────────────
  sectionLabel("Scope of works");
  const scopeLines = humanizeIntake(quote.intake_data);
  if (scopeLines.length === 0) {
    text("As discussed on site.", { size: 10.5, color: INK_FAINT });
  } else {
    for (const line of scopeLines) {
      newPageIfNeeded();
      page.drawCircle({ x: MARGIN + 2, y: y + 4, size: 1.6, color: AMBER_DEEP });
      page.drawText(line, { x: MARGIN + 10, y, size: 10.5, font, color: INK });
      y -= 17;
    }
  }
  y -= 8; rule();

  // ── SUMMARY ──────────────────────────────────────────────────────
  sectionLabel("Quote summary");
  drawRow(`Labour (${quote.labour_hours ?? 0} hrs)`, `$${((quote.total_cost ?? 0) - (quote.materials_cost ?? 0)).toLocaleString()}`);
  drawRow("Materials", `$${(quote.materials_cost ?? 0).toLocaleString()}`);
  newPageIfNeeded(24);
  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 6 }, thickness: 1.5, color: NAVY });
  y -= 4;
  drawRow("Total", `$${(quote.total_cost ?? 0).toLocaleString()}`, { bold: true, size: 14, color: NAVY });
  y -= 8; rule();

  // ── PAYMENT TERMS ────────────────────────────────────────────────
  sectionLabel("Payment terms");
  const terms: PaymentTerm[] = quote.payment_terms?.length ? quote.payment_terms : [{ label: "Payment due", percent: 100, trigger: "completion", days: 14 }];
  for (const t of terms) drawRow(`${t.label} (${t.percent}%)`, `$${termAmount(t, quote.total_cost ?? 0).toLocaleString()}`);
  y -= 8;

  // ── ACCEPT CALLOUT ────────────────────────────────────────────────
  // Bank details removed from PDF - client chooses payment method
  // (bank, cash or card) on the accept page after clicking the button.
  if (quote.public_token) {
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "https://swiftscope.vercel.app";
    const quoteUrl = `${appUrl}/q/${quote.public_token}`;
    rule();
    newPageIfNeeded(72);

    const boxH = 68;
    const boxY = y - boxH;
    const btnH = 30;
    const btnW = PAGE_WIDTH - MARGIN * 2 - 24;
    const btnX = MARGIN + 12;
    const btnY = boxY + 9;

    // Navy background
    page.drawRectangle({ x: MARGIN, y: boxY, width: PAGE_WIDTH - MARGIN * 2, height: boxH, color: NAVY });
    // Amber left accent
    page.drawRectangle({ x: MARGIN, y: boxY, width: 4, height: boxH, color: AMBER });

    // Heading + subtext
    page.drawText("ACCEPT THIS QUOTE", { x: MARGIN + 14, y: boxY + 47, size: 10.5, font: fontBold, color: AMBER });
    page.drawText("Click the button to review, accept and choose how you would like to pay.", {
      x: MARGIN + 14, y: boxY + 32, size: 8, font, color: rgb(0.75, 0.82, 0.87),
    });

    // Amber clickable button
    page.drawRectangle({ x: btnX, y: btnY, width: btnW, height: btnH, color: AMBER });
    const btnLabel  = "Accept & choose payment  >>";
    const btnLabelW = fontBold.widthOfTextAtSize(btnLabel, 11);
    page.drawText(btnLabel, {
      x: btnX + (btnW - btnLabelW) / 2,
      y: btnY + (btnH - 11) / 2 + 1,
      size: 11, font: fontBold, color: NAVY,
    });

    // Clickable link annotation
    try {
      const { context } = pdfDoc;
      const uriActionRef = context.register(context.obj({
        Type: PDFName.of("Action"), S: PDFName.of("URI"), URI: PDFString.of(quoteUrl),
      }));
      const annotRef = context.register(context.obj({
        Type: PDFName.of("Annot"), Subtype: PDFName.of("Link"),
        Rect: context.obj([PDFNumber.of(btnX), PDFNumber.of(btnY), PDFNumber.of(btnX + btnW), PDFNumber.of(btnY + btnH)]),
        Border: context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]),
        A: uriActionRef, F: PDFNumber.of(4),
      }));
      const currentPage = pdfDoc.getPages().at(-1)!;
      const existing = currentPage.node.get(PDFName.of("Annots"));
      if (existing instanceof PDFArray) { existing.push(annotRef); }
      else { currentPage.node.set(PDFName.of("Annots"), context.obj([annotRef])); }
    } catch { /* silent */ }

    y = boxY - 12;
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
