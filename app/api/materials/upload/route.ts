import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') { currentField += '"'; i++; }
        else { inQuotes = false; }
      } else { currentField += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { currentRow.push(currentField.trim()); currentField = ""; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && next === '\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else { currentField += char; }
    }
  }
  currentRow.push(currentField.trim());
  if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
  return rows;
}

function detectColumnMap(headers: string[]): Record<string, number> {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim().replace(/['"]/g, ""));
  const map: Record<string, number> = {};

  const find = (aliases: string[]): number => {
    for (const a of aliases) {
      const idx = lowerHeaders.indexOf(a);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  map.description = find(["description", "desc", "item", "name", "product", "item_name", "product_name"]);
  map.sku = find(["sku", "code", "item_code", "itemcode", "product_code", "part_number"]);
  map.supplier = find(["supplier", "vendor", "source", "manufacturer", "brand"]);
  map.unit = find(["unit", "uom", "unit_of_measure", "measure"]);
  map.cost_price = find(["cost_price", "cost", "price", "unit_cost", "unitcost", "rate", "amount"]);
  map.trade = find(["trade", "category", "type", "department"]);

  return map;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  // Get user's trade from profile
  const { data: profile } = await supabase.from("profiles").select("trade").eq("id", businessId).single();
  const defaultTrade = profile?.trade || "electrician";

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty file" }, { status: 400 });

  const allRows = parseCSV(text);
  if (allRows.length === 0) return NextResponse.json({ error: "No rows found" }, { status: 400 });

  // Detect header row
  const headerRow = allRows[0];
  const map = detectColumnMap(headerRow);
  const hasHeaders = map.description >= 0 && map.cost_price >= 0;

  const startIdx = hasHeaders ? 1 : 0;
  const dataRows = allRows.slice(startIdx);

  // Fallback positional mapping if no headers detected
  if (!hasHeaders) {
    map.description = 0;
    map.cost_price = 1;
    map.supplier = 2;
    map.sku = 3;
    map.unit = 4;
    map.trade = 5;
  }

  const errors: string[] = [];
  const toInsert: Array<{
    profile_id: string;
    description: string;
    sku: string | null;
    supplier: string | null;
    unit: string;
    cost_price: number;
    trade: string;
    imported_at: string;
  }> = [];

  const maxRows = 500;
  for (let i = 0; i < Math.min(dataRows.length, maxRows); i++) {
    const row = dataRows[i];
    const desc = map.description >= 0 ? row[map.description] : "";
    const costStr = map.cost_price >= 0 ? row[map.cost_price] : "";
    const supplierVal = map.supplier >= 0 ? (row[map.supplier] || null) : null;
    const skuVal = map.sku >= 0 ? (row[map.sku] || null) : null;
    const unitVal = map.unit >= 0 ? (row[map.unit] || "ea") : "ea";
    const tradeVal = map.trade >= 0 ? (row[map.trade] || defaultTrade) : defaultTrade;

    const cost = parseFloat(costStr.replace(/[$,]/g, ""));

    if (!desc) { errors.push(`Row ${i + 1}: missing description`); continue; }
    if (isNaN(cost) || cost < 0) { errors.push(`Row ${i + 1}: invalid cost price '${costStr}'`); continue; }

    toInsert.push({
      profile_id: businessId,
      description: desc,
      sku: skuVal,
      supplier: supplierVal,
      unit: unitVal,
      cost_price: cost,
      trade: tradeVal,
      imported_at: new Date().toISOString(),
    });
  }

  if (dataRows.length > maxRows) {
    errors.push(`Limited to ${maxRows} rows. ${dataRows.length - maxRows} rows skipped.`);
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("price_book_items").insert(toInsert);
    if (error) {
      return NextResponse.json({ error: `Insert failed: ${error.message}`, imported: 0, errors: [...errors, error.message] }, { status: 500 });
    }
  }

  return NextResponse.json({ imported: toInsert.length, errors });
}
