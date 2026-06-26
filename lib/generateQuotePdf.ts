import { PDFDocument, PDFName, PDFString, PDFArray, PDFNumber, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import QRCode from "qrcode";
import { termAmount, type PaymentTerm } from "./paymentTerms";
import { humanizeIntakePublic } from "./humanizeIntake";

// Alias so the rest of this file doesn't need renaming
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
  accepted_at?: string | null;
  completed_at?: string | null;
  public_token?: string | null;
}

// Brand palette - matches the navy/amber identity used everywhere else in
// the app. The earlier version of this file used bare Helvetica on white
// with grey hairlines, which is why it read as a generic Word document
// rather than something from the same product as the branded UI.
const NAVY = rgb(0.039, 0.090, 0.137); // #0A1722
const AMBER = rgb(1, 0.706, 0); // #FFB400
const AMBER_DEEP = rgb(0.91, 0.62, 0); // #E89E00
const INK = rgb(0.078, 0.125, 0.169);
const INK_SOFT = rgb(0.36, 0.40, 0.44);
const INK_FAINT = rgb(0.55, 0.59, 0.63);
const WHITE = rgb(1, 1, 1);
const LINE = rgb(0.89, 0.90, 0.92);



const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const HEADER_HEIGHT = 110;

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

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function newPageIfNeeded(minSpace = 60) {
    if (y < MARGIN + minSpace + 40) newPage();
  }

  function text(content: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number } = {}) {
    const size = opts.size ?? 11;
    const usedFont = opts.bold ? fontBold : font;
    const color = opts.color ?? INK;
    newPageIfNeeded(size + 8);
    page.drawText(content, { x: opts.x ?? MARGIN, y, size, font: usedFont, color });
    y -= size + 7;
  }

  function rule(color = LINE, thickness = 0.75) {
    newPageIfNeeded(16);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness, color });
    y -= 16;
  }

  function sectionLabel(label: string) {
    newPageIfNeeded(20);
    page.drawRectangle({ x: MARGIN, y: y - 2, width: 3, height: 12, color: AMBER });
    page.drawText(label.toUpperCase(), {
      x: MARGIN + 9,
      y,
      size: 10.5,
      font: fontBold,
      color: AMBER_DEEP,
    });
    y -= 22;
  }

  function drawRow(label: string, value: string, opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    const size = opts.size ?? (opts.bold ? 13 : 11.5);
    const usedFont = opts.bold ? fontBold : font;
    const color = opts.color ?? INK;
    newPageIfNeeded(size + 8);
    page.drawText(label, { x: MARGIN, y, size, font: usedFont, color });
    if (value) {
      const width = usedFont.widthOfTextAtSize(value, size);
      page.drawText(value, { x: PAGE_WIDTH - MARGIN - width, y, size, font: usedFont, color });
    }
    y -= size + 8;
  }

  // --- NAVY HEADER BAND ---
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - HEADER_HEIGHT, width: PAGE_WIDTH, height: HEADER_HEIGHT, color: NAVY });
  // Amber accent strip along the very top - a small echo of the docket
  // "stamp" motif used in the landing page and app header.
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 4, width: PAGE_WIDTH, height: 4, color: AMBER });

  let logoEmbedded = false;
  let logoDrawWidth = 0;
  if (logoBytes) {
    try {
      const pngBytes = await sharp(logoBytes).png().toBuffer();
      const image = await pdfDoc.embedPng(pngBytes);
      const maxH = 40;
      const scale = Math.min(maxH / image.height, 140 / image.width);
      logoDrawWidth = image.width * scale;
      const padX = 10;
      const cardY = PAGE_HEIGHT - 27 - maxH;
      // White backing card - most real-world logos have an opaque white
      // background (not transparency), so placing one directly on the navy
      // band would otherwise show a jarring white box with no clean edge.
      // A deliberate white card with a small margin looks intentional either
      // way, transparent logo or not.
      page.drawRectangle({ x: MARGIN - padX, y: cardY - 7, width: logoDrawWidth + padX * 2, height: maxH + 14, color: WHITE });
      page.drawImage(image, { x: MARGIN, y: cardY, width: logoDrawWidth, height: image.height * scale });
      logoEmbedded = true;
    } catch {
      // Skip the logo rather than failing the whole PDF over a cosmetic detail.
    }
  }

  const headerTextX = logoEmbedded ? MARGIN + logoDrawWidth + 28 : MARGIN;
  let headerY = PAGE_HEIGHT - 38;
  if (profile.business_name) {
    page.drawText(profile.business_name, { x: headerTextX, y: headerY, size: 16, font: fontBold, color: WHITE });
    headerY -= 20;
  }
  const businessDetailLine = [
    profile.business_address,
    profile.abn ? `ABN ${profile.abn}` : null,
    profile.license_number ? `Licence ${profile.license_number}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  if (businessDetailLine) {
    page.drawText(businessDetailLine, { x: headerTextX, y: headerY, size: 9, font, color: rgb(0.66, 0.73, 0.79) });
    headerY -= 14;
  }
  const contactLine = [profile.contact_phone, profile.contact_email].filter(Boolean).join("   ·   ");
  if (contactLine) {
    page.drawText(contactLine, { x: headerTextX, y: headerY, size: 9, font, color: rgb(0.66, 0.73, 0.79) });
  }

  y = PAGE_HEIGHT - HEADER_HEIGHT - 32;

  // --- QUOTE TITLE + TOTAL (amber highlight, mirrors the in-app docket total) ---
  page.drawText(`QUOTE${quote.invoice_number ? " " + quote.invoice_number : ""}`, { x: MARGIN, y, size: 20, font: fontBold, color: INK });
  const totalLabel = `$${(quote.total_cost ?? 0).toLocaleString()}`;
  const totalWidth = fontBold.widthOfTextAtSize(totalLabel, 22);
  page.drawRectangle({ x: PAGE_WIDTH - MARGIN - totalWidth - 16, y: y - 6, width: totalWidth + 16, height: 28, color: AMBER });
  page.drawText(totalLabel, { x: PAGE_WIDTH - MARGIN - totalWidth - 8, y: y, size: 22, font: fontBold, color: NAVY });
  y -= 32;

  if (quote.client_name) text(`Client: ${quote.client_name}`, { size: 11.5, color: INK_SOFT });
  if (quote.site_address) text(`Site: ${quote.site_address}`, { size: 11.5, color: INK_SOFT });
  text(`Date: ${new Date(quote.created_at ?? Date.now()).toLocaleDateString("en-AU")}`, { size: 11.5, color: INK_SOFT });
  if (quote.trade) {
    text(`Trade: ${quote.trade.charAt(0).toUpperCase() + quote.trade.slice(1)}${quote.job_type ? " — " + quote.job_type : ""}`, {
      size: 11.5,
      color: INK_SOFT,
    });
  }
  y -= 8;
  rule();

  // --- Scope of works ---
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
  y -= 8;
  rule();

  // --- Quote summary ---
  sectionLabel("Quote summary");
  const labourCost = (quote.total_cost ?? 0) - (quote.materials_cost ?? 0);
  drawRow(`Labour (${quote.labour_hours ?? 0} hrs)`, `$${labourCost.toLocaleString()}`);
  drawRow("Materials", `$${(quote.materials_cost ?? 0).toLocaleString()}`);
  newPageIfNeeded(24);
  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 6 }, thickness: 1.5, color: NAVY });
  y -= 4;
  drawRow("Total", `$${(quote.total_cost ?? 0).toLocaleString()}`, { bold: true, size: 14, color: NAVY });
  y -= 8;
  rule();

  // --- Payment terms ---
  sectionLabel("Payment terms");
  const terms: PaymentTerm[] = quote.payment_terms?.length
    ? quote.payment_terms
    : [{ label: "Payment due", percent: 100, trigger: "completion", days: 14 }];
  for (const t of terms) {
    drawRow(`${t.label} (${t.percent}%)`, `$${termAmount(t, quote.total_cost ?? 0).toLocaleString()}`);
  }
  y -= 8;

  // --- How to pay ---
  const hasBankDetails = !!(profile.bank_bsb && profile.bank_account_number);
  if (hasBankDetails || profile.accepts_cash) {
    rule();
    sectionLabel("How to pay");
    if (hasBankDetails) {
      text(`Bank transfer — ${profile.bank_account_name ?? profile.business_name ?? ""}`, { size: 10.5, bold: true });
      text(`BSB ${profile.bank_bsb}   ·   Account ${profile.bank_account_number}`, { size: 10.5, color: INK_SOFT });
      y -= 2;
    }
    if (profile.accepts_cash) {
      text("Cash accepted on completion of the job.", { size: 10.5, color: INK_SOFT });
    }
    y -= 4;
  }

  // --- Accept this quote callout + clickable button ---
  if (quote.public_token) {
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "https://quotease.vercel.app";
    const quoteUrl = `${appUrl}/q/${quote.public_token}`;
    rule();
    newPageIfNeeded(130);

    const qrSize    = 80;
    const btnWidth  = PAGE_WIDTH - MARGIN * 2 - qrSize - 20;
    const btnHeight = 38;
    const boxHeight = 116;
    const boxY      = y - boxHeight;
    const textX     = MARGIN + qrSize + 20;
    const btnX      = textX;
    const btnY      = boxY + 8;

    // Navy background box
    page.drawRectangle({ x: MARGIN, y: boxY, width: PAGE_WIDTH - MARGIN * 2, height: boxHeight, color: NAVY });
    // Amber left bar
    page.drawRectangle({ x: MARGIN, y: boxY, width: 4, height: boxHeight, color: AMBER });

    // QR code (scannable from printed copy)
    try {
      const qrDataUrl = await QRCode.toDataURL(quoteUrl, { width: 200, margin: 1, color: { dark: "#0a1722", light: "#ffffff" } });
      const qrBytes  = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
      const qrImage  = await pdfDoc.embedPng(qrBytes);
      page.drawImage(qrImage, { x: MARGIN + 10, y: boxY + (boxHeight - qrSize) / 2, width: qrSize, height: qrSize });
    } catch { /* skip QR on failure */ }

    // Label
    page.drawText("ACCEPT THIS QUOTE", { x: textX, y: boxY + 92, size: 11, font: fontBold, color: AMBER });
    page.drawText("Click the button below or scan the QR code on your phone.", { x: textX, y: boxY + 76, size: 8.5, font, color: rgb(0.75, 0.82, 0.87) });

    // Amber button rectangle
    page.drawRectangle({ x: btnX, y: btnY, width: btnWidth, height: btnHeight, color: AMBER });

    // Button label
    const btnText  = "Accept & choose payment \u2192";
    const btnTextW = fontBold.widthOfTextAtSize(btnText, 12);
    const btnTextX = btnX + (btnWidth - btnTextW) / 2;
    const btnTextY = btnY + (btnHeight - 12) / 2;
    page.drawText(btnText, { x: btnTextX, y: btnTextY, size: 12, font: fontBold, color: NAVY });

    // PDF link annotation — makes the button actually clickable in any PDF reader
    const context = pdfDoc.context;

    const uriActionRef = context.register(
      context.obj({
        Type: PDFName.of("Action"),
        S:    PDFName.of("URI"),
        URI:  PDFString.of(quoteUrl),
      })
    );

    const annotRef = context.register(
      context.obj({
        Type:    PDFName.of("Annot"),
        Subtype: PDFName.of("Link"),
        Rect:    context.obj([
          PDFNumber.of(btnX),
          PDFNumber.of(btnY),
          PDFNumber.of(btnX + btnWidth),
          PDFNumber.of(btnY + btnHeight),
        ]),
        Border:  context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]),
        A:       uriActionRef,
        F:       PDFNumber.of(4),
      })
    );

    // Attach annotation to the page
    const rawPage = pdfDoc.getPages().at(-1)!.node;
    const existing = rawPage.get(PDFName.of("Annots"));
    if (existing instanceof PDFArray) {
      existing.push(annotRef);
    } else {
      rawPage.set(PDFName.of("Annots"), context.obj([annotRef]));
    }

    y = boxY - 16;
  }

  // --- Terms and conditions ---
  if (profile.terms_and_conditions) {
    rule();
    sectionLabel("Terms and conditions");
    const words = profile.terms_and_conditions.split(/\s+/);
    let line = "";
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, 9.5) > maxWidth) {
        text(line, { size: 9.5, color: INK_FAINT });
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) text(line, { size: 9.5, color: INK_FAINT });
  }

  // --- Footer band on every page ---
  const pages = pdfDoc.getPages();
  for (const p of pages) {
    p.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 26, color: NAVY });
    p.drawText("Quoting by Quotease", { x: MARGIN, y: 9, size: 8, font, color: rgb(0.55, 0.62, 0.69) });
  }

  return pdfDoc.save();
}
