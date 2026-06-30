import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

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

/** Fuzzy-match a header name against a list of aliases */
function findColumn(headers: string[], aliases: string[]): number {
  const norm = headers.map((h, i) => ({ raw: h, idx: i, n: h.toLowerCase().trim().replace(/[_\s]/g, "") }));
  for (const a of aliases) {
    const an = a.toLowerCase().replace(/[_\s]/g, "");
    const exact = norm.find((h) => h.n === an);
    if (exact !== undefined) return exact.idx;
    const contains = norm.find((h) => h.n.includes(an));
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
    const { data: profile } = await supabase.from("profiles").select("trade").eq("id", userData.user.id).single();
    if (profile?.trade) defaultTrade = profile.trade;
  } catch { /* ignore */ }

  /* ---- build column index map ---- */
  const ci: Record<string, number> = {};
  if (hasHeader) {
    ci.description = findColumn(firstRow, [
      "purchasesdescription","itemname","description","itemdesc","productname",
      "name","item","product","label","title"
    ]);
    ci.cost_price = findColumn(firstRow, [
      "purchasesunitprice","currentcost","standardcost","costprice","unitcost",
      "cost_price","cost","price","rate","value","amount","unitprice"
    ]);
    ci.supplier = findColumn(firstRow, [
      "supplier","vendor","manufacturer","brand","source","suppliername"
    ]);
    ci.sku = findColumn(firstRow, [
      "itemcode","itemnumber","sku","code","partnumber","productcode","ref"
    ]);
    ci.unit = findColumn(firstRow, [
      "unit","uom","unitofmeasure","measure","qtyunit"
    ]);
    ci.trade = findColumn(firstRow, [
      "trade","category","type","discipline","service"
    ]);
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

    if (hasHeader) {
      if (ci.description >= 0) description = fields[ci.description] ?? "";
      if (ci.cost_price >= 0) costPriceRaw = fields[ci.cost_price] ?? "";
      if (ci.supplier >= 0) supplier = fields[ci.supplier] ?? "";
      if (ci.sku >= 0) sku = fields[ci.sku] ?? null;
      if (ci.unit >= 0) unit = fields[ci.unit] ?? "ea";
      if (ci.trade >= 0) trade = fields[ci.trade] ?? defaultTrade;

      /* Fallback: first col = description, second with $/number = cost */
      if (!description && fields[0]) description = fields[0];
      if (!costPriceRaw) {
        // Find first field that looks like a price
        const priceField = fields.find((f) => /^\$?[\d,]+\.?\d*$/.test(f.trim()));
        if (priceField) costPriceRaw = priceField;
      }
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
      trade: (trade || defaultTrade).trim(),
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
