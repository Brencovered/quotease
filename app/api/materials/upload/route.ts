import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { normalizeTradeValue } from "@/lib/genericTrades";

/* ------------------------------------------------------------------ */
/*  Simple CSV helpers                                                 */
/* ------------------------------------------------------------------ */

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else { current += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { fields.push(current.trim()); current = ""; }
      else { current += char; }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Fuzzy-match a header name against a list of aliases.
 *
 *  Fixes for real-world exports (esp. Xero):
 *  - `sampleRows`: a matched column that is empty in (almost) all data rows is
 *    rejected and the next alias is tried. Xero exports include a
 *    PurchasesDescription header that is blank on every row while the real
 *    names live in ItemName -- matching on header alone silently imported
 *    SKU codes as descriptions.
 *  - `claimed`: a column already assigned to another field can't be matched
 *    again. Without this, the alias "unit" substring-matched
 *    "PurchasesUnitPrice" and the price was written into the unit column.
 *  - Exact-normalized matches for ALL aliases are tried before any
 *    substring match, and substring matches require the alias to be at
 *    least 4 chars to avoid generic collisions.
 */
function findColumn(
  headers: string[],
  aliases: string[],
  sampleRows: string[][] = [],
  claimed: Set<number> = new Set()
): number {
  const norm = headers.map((h, i) => ({ idx: i, n: h.toLowerCase().trim().replace(/[_\s]/g, "") }));

  const columnHasData = (idx: number): boolean => {
    if (sampleRows.length === 0) return true;
    const nonEmpty = sampleRows.filter((r) => (r[idx] ?? "").trim() !== "").length;
    return nonEmpty / sampleRows.length > 0.2; // >20% of sampled rows have a value
  };

  const usable = (idx: number) => !claimed.has(idx) && columnHasData(idx);

  // Pass 1: exact normalized match, in alias priority order
  for (const a of aliases) {
    const an = a.toLowerCase().replace(/[_\s]/g, "");
    const exact = norm.find((h) => h.n === an && usable(h.idx));
    if (exact !== undefined) return exact.idx;
  }
  // Pass 2: substring match, only for reasonably specific aliases
  for (const a of aliases) {
    const an = a.toLowerCase().replace(/[_\s]/g, "");
    if (an.length < 4) continue;
    const contains = norm.find((h) => h.n.includes(an) && usable(h.idx));
    if (contains !== undefined) return contains.idx;
  }
  return -1;
}

function isHeaderRow(fields: string[]): boolean {
  const kws = ["description","item","name","product","cost","price","unit","supplier","sku","code","qty","quantity"];
  const matches = fields.filter((f) =>
    kws.some((kw) => f.toLowerCase().includes(kw))
  );
  return matches.length >= 2;
}

/* ------------------------------------------------------------------ */
/*  POST - CSV bulk upload (bulletproof)                               */
/* ------------------------------------------------------------------ */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  /* ---- read multipart form data ---- */
  let fileContent: string;
  let fallbackSupplier = "CSV Import";
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    fileContent = await file.text();
    const ds = formData.get("defaultSupplier");
    if (ds && typeof ds === "string" && ds.trim()) fallbackSupplier = ds.trim();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  /* ---- parse CSV ---- */
  const lines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
  }

  /* ---- detect headers ---- */
  let startIndex = 0;
  const firstRow = parseCSVLine(lines[0]);
  const hasHeader = isHeaderRow(firstRow);
  if (hasHeader) startIndex = 1;

  /* ---- get user's trade ---- */
  let defaultTrade = "electrician";
  try {
    const { data: profile } = await supabase.from("profiles").select("trade").eq("id", businessId).single();
    if (profile?.trade) defaultTrade = normalizeTradeValue(profile.trade) ?? defaultTrade;
  } catch { /* ignore */ }

  /* ---- build column index map ---- */
  const ci: Record<string, number> = {};
  if (hasHeader) {
    // Sample up to 25 data rows so column matching can reject headers whose
    // column is empty in the actual data (e.g. Xero's PurchasesDescription).
    const sampleRows: string[][] = [];
    for (let i = startIndex; i < Math.min(startIndex + 25, lines.length); i++) {
      sampleRows.push(parseCSVLine(lines[i]));
    }
    const claimed = new Set<number>();
    const claim = (idx: number) => { if (idx >= 0) claimed.add(idx); return idx; };

    // Resolve in order of importance so the most critical fields get first
    // pick of columns, and later fields can't steal or double-claim them.
    ci.description = claim(findColumn(firstRow, [
      "itemname","description","purchasesdescription","salesdescription",
      "itemdesc","productname","name","item","product","label","title"
    ], sampleRows, claimed));
    ci.cost_price = claim(findColumn(firstRow, [
      "purchasesunitprice","currentcost","standardcost","costprice","unitcost",
      "cost_price","cost","price","rate","value","amount","unitprice"
    ], sampleRows, claimed));
    ci.sku = claim(findColumn(firstRow, [
      "itemcode","itemnumber","sku","code","partnumber","productcode","ref"
    ], sampleRows, claimed));
    ci.supplier = claim(findColumn(firstRow, [
      "supplier","vendor","manufacturer","brand","source","suppliername"
    ], sampleRows, claimed));
    ci.unit = claim(findColumn(firstRow, [
      "unitofmeasure","uom","qtyunit","measure","unit"
    ], sampleRows, claimed));
    ci.trade = claim(findColumn(firstRow, [
      "trade","category","type","discipline","service"
    ], sampleRows, claimed));
  }

  /* ---- process rows: skip only truly broken rows ---- */
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const rowNum = i + 1;
    const fields = parseCSVLine(lines[i]);
    if (fields.length === 0) continue;
    if (fields.every((f) => f.trim() === "")) continue;

    /* Extract fields */
    let description = "";
    let costPriceRaw = "";
    let supplier = "";
    let sku: string | null = null;
    let unit = "ea";
    let trade = defaultTrade;
    let category: string | null = null;

    if (hasHeader) {
      if (ci.description >= 0) description = fields[ci.description] ?? "";
      if (ci.cost_price >= 0) costPriceRaw = fields[ci.cost_price] ?? "";
      if (ci.supplier >= 0) supplier = fields[ci.supplier] ?? "";
      if (ci.sku >= 0) sku = fields[ci.sku] ?? null;
      if (ci.unit >= 0) unit = fields[ci.unit] ?? "ea";
      if (ci.trade >= 0) {
        const rawTradeValue = fields[ci.trade] ?? "";
        const normalized = normalizeTradeValue(rawTradeValue);
        if (normalized) {
          // Genuinely a recognised trade (e.g. the column really did say
          // "carpenter", or a synonym like "electrical") -- safe to use
          // as the hard trade filter.
          trade = normalized;
        } else if (rawTradeValue.trim()) {
          // Not a real trade -- this is the supplier's own product
          // category (e.g. Bunnings' "Timber - Posts", "Decking").
          // Keep it for reference/search, but never let it silently
          // become the trade filter -- that's exactly the bug where a
          // real "Treated Pine Post" became unfindable in every trade's
          // quote builder because nothing was ever tagged "carpenter".
          category = rawTradeValue.trim();
        }
      }

      /* Fallback: first unclaimed col = description, second with $/number = cost.
         Never fall back to the SKU column -- importing codes as descriptions
         makes the whole price book unsearchable. */
      if (!description && fields[0] && ci.sku !== 0) description = fields[0];
      if (!costPriceRaw) {
        // Find first field that looks like a price
        const priceField = fields.find((f) => /^\$?[\d,]+\.?\d*$/.test(f.trim()));
        if (priceField) costPriceRaw = priceField;
      }
      /* A unit should be a word ("each", "m", "roll"), never a number.
         If a numeric value slipped through, discard it. */
      if (/^[\d\.,\$\s]+$/.test(unit.trim())) unit = "ea";
    } else {
      /* No header: position 0 = description, position 1 = cost */
      description = fields[0] ?? "";
      costPriceRaw = fields[1] ?? "";
      supplier = fields[2] ?? "";
      if (fields.length > 3) sku = fields[3];
      if (fields.length > 4) unit = fields[4];
    }

    description = description.trim();
    supplier = (supplier.trim() || fallbackSupplier).trim();

    /* Skip if no description */
    if (!description) { skipped++; continue; }

    /* Parse cost: strip $ and commas, accept 0 */
    const costPrice = parseFloat(costPriceRaw.replace(/[$,\s]/g, ""));
    if (isNaN(costPrice) || costPrice < 0) {
      errors.push(`Row ${rowNum}: "${costPriceRaw}" is not a valid price - skipped`);
      skipped++;
      continue;
    }

    /* Insert row (one-by-one so one bad row doesn't kill the batch) */
    const { error } = await supabase.from("price_book_items").insert({
      profile_id: businessId,
      supplier,
      sku: sku ? sku.trim() : null,
      description,
      unit: (unit || "ea").trim(),
      cost_price: costPrice,
      trade,
      category,
      imported_at: new Date().toISOString(),
    });

    if (error) {
      errors.push(`Row ${rowNum}: "${description.slice(0, 40)}" - ${error.message}`);
      skipped++;
    } else {
      imported++;
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    total: lines.length - startIndex,
    errors: errors.slice(0, 10),
    moreErrors: errors.length > 10 ? errors.length - 10 : 0,
  });
}
