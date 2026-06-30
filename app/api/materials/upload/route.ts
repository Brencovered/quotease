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
        // Check for escaped quotes ("")
        if (line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function isHeaderRow(fields: string[]): boolean {
  const headerKeywords = [
    "description", "desc", "purchasesdescription",
    "cost_price", "cost", "price", "purchasesunitprice",
    "supplier", "vendor",
    "sku", "code", "itemcode", "itemnumber",
    "unit", "uom",
    "trade", "category",
    "item", "name", "itemname",
  ];
  const lowerFields = fields.map((f) => f.toLowerCase().replace(/[_\s]/g, ""));
  const matches = lowerFields.filter((f) =>
    headerKeywords.some((kw) => f.includes(kw.replace(/[_\s]/g, "")))
  );
  return matches.length >= 2;
}

/* ------------------------------------------------------------------ */
/*  POST - CSV bulk upload                                             */
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
  let defaultSupplier = "";
  let clientColumnMap: Record<string, string> = {};
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file. Please upload a CSV file." },
        { status: 400 }
      );
    }
    fileContent = await file.text();
    const ds = formData.get("defaultSupplier");
    if (ds && typeof ds === "string") defaultSupplier = ds.trim();
    const cm = formData.get("columnMap");
    if (cm && typeof cm === "string") {
      try { clientColumnMap = JSON.parse(cm); } catch { /* ignore */ }
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid form data. Expected multipart/form-data with a file field." },
      { status: 400 }
    );
  }

  /* ---- parse CSV ---- */
  const lines = fileContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return NextResponse.json(
      { error: "CSV file is empty" },
      { status: 400 }
    );
  }

  /* ---- detect headers ---- */
  let startIndex = 0;
  const firstRow = parseCSVLine(lines[0]);
  if (isHeaderRow(firstRow)) {
    startIndex = 1;
  }

  if (lines.length - startIndex > 500) {
    return NextResponse.json(
      { error: "Maximum 500 rows allowed per upload" },
      { status: 400 }
    );
  }

  /* ---- try to get user's trade from profile ---- */
  let defaultTrade = "electrician";
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("trade")
      .eq("id", userData.user.id)
      .single();
    if (profile?.trade) {
      defaultTrade = profile.trade;
    }
  } catch {
    // ignore profile lookup failure, use default
  }

  /* ---- build column index map (client map takes priority) ---- */
  const colIdx: Record<string, number> = {};
  if (startIndex === 1) {
    // Normalise header names for fuzzy matching
    const normHeaders = firstRow.map((h, i) => ({ raw: h, idx: i, norm: h.toLowerCase().trim().replace(/[_\s]/g, "") }));

    // First: use explicit client column map
    for (const [field, headerName] of Object.entries(clientColumnMap)) {
      if (!headerName) continue;
      const match = normHeaders.find((h) => h.raw === headerName);
      if (match) colIdx[field] = match.idx;
    }

    // Second: fuzzy fallback for common headers
    const find = (aliases: string[]) => {
      for (const a of aliases) {
        const aNorm = a.toLowerCase().replace(/[_\s]/g, "");
        const hit = normHeaders.find((h) => h.norm === aNorm || h.norm.includes(aNorm));
        if (hit) return hit.idx;
      }
      return -1;
    };

    if (colIdx.description === undefined) {
      colIdx.description = find(["description", "itemname", "purchasesdescription", "name", "item", "product"]);
    }
    if (colIdx.cost_price === undefined) {
      colIdx.cost_price = find(["purchasesunitprice", "costprice", "cost_price", "cost", "price", "unitcost", "rate", "value"]);
    }
    if (colIdx.supplier === undefined) {
      colIdx.supplier = find(["supplier", "vendor", "source", "manufacturer", "brand"]);
    }
    if (colIdx.sku === undefined) {
      colIdx.sku = find(["itemcode", "sku", "code", "itemnumber", "partnumber"]);
    }
    if (colIdx.unit === undefined) {
      colIdx.unit = find(["unit", "uom", "unitofmeasure"]);
    }
    if (colIdx.trade === undefined) {
      colIdx.trade = find(["trade", "category", "type"]);
    }
  }

  /* ---- process rows ---- */
  const errors: string[] = [];
  const toInsert: Array<{
    profile_id: string;
    supplier: string;
    sku: string | null;
    description: string;
    unit: string;
    cost_price: number;
    trade: string;
    imported_at: string;
  }> = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rowNum = i + 1;
    const fields = parseCSVLine(lines[i]);
    if (fields.length === 0) continue;
    if (fields.every((f) => f.trim() === "")) continue; // skip blank rows

    let description = "";
    let costPriceRaw = "";
    let supplier = "";
    let sku: string | null = null;
    let unit = "ea";
    let trade = defaultTrade;

    if (startIndex === 1 && Object.keys(colIdx).length > 0) {
      /* ---- header-based mapping ---- */
      if (colIdx.description >= 0) description = fields[colIdx.description] ?? "";
      if (colIdx.cost_price >= 0) costPriceRaw = fields[colIdx.cost_price] ?? "";
      if (colIdx.supplier >= 0) supplier = fields[colIdx.supplier] ?? "";
      if (colIdx.sku >= 0) sku = fields[colIdx.sku] ?? null;
      if (colIdx.unit >= 0) unit = fields[colIdx.unit] ?? "ea";
      if (colIdx.trade >= 0) trade = fields[colIdx.trade] ?? defaultTrade;

      // Fallback to first/second column if nothing mapped
      if (!description && fields.length >= 1) description = fields[0];
      if (!costPriceRaw && fields.length >= 2) costPriceRaw = fields[1];
      if (!supplier && fields.length >= 3) supplier = fields[2];
    } else {
      /* ---- positional mapping ---- */
      description = fields[0] ?? "";
      costPriceRaw = fields[1] ?? "";
      supplier = fields[2] ?? "";
      if (fields.length > 3) sku = fields[3];
      if (fields.length > 4) unit = fields[4];
      if (fields.length > 5) trade = fields[5];
    }

    /* ---- normalise ---- */
    description = description.trim();
    supplier = supplier.trim();
    if (!supplier && defaultSupplier) supplier = defaultSupplier;

    /* ---- validation: skip bad rows, don't fail the batch ---- */
    if (!description || description.length === 0) {
      errors.push(`Row ${rowNum}: missing description - skipped`);
      continue;
    }

    const costPrice = parseFloat(costPriceRaw.replace(/[$,\s]/g, ""));
    if (isNaN(costPrice) || costPrice < 0) {
      errors.push(`Row ${rowNum}: invalid cost "${costPriceRaw}" - skipped`);
      continue;
    }

    if (!supplier || supplier.length === 0) {
      errors.push(`Row ${rowNum}: missing supplier (map a supplier column or set a default) - skipped`);
      continue;
    }

    toInsert.push({
      profile_id: businessId,
      supplier,
      sku: sku ? sku.trim() : null,
      description,
      unit: (unit || "ea").trim(),
      cost_price: costPrice,
      trade: (trade || defaultTrade).trim(),
      imported_at: new Date().toISOString(),
    });
  }

  /* ---- insert valid rows one-by-one so one bad row doesn't kill the batch ---- */
  let imported = 0;
  const insertErrors: string[] = [];
  for (const row of toInsert) {
    const { error } = await supabase.from("price_book_items").insert(row);
    if (error) {
      insertErrors.push(`"${row.description.substring(0, 40)}" - ${error.message}`);
    } else {
      imported++;
    }
  }

  return NextResponse.json({ imported, errors: [...errors, ...insertErrors] });
}
