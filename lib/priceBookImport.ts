/**
 * lib/priceBookImport.ts
 * -----------------------
 * Shared between the manual CSV import UI (components/PriceBookPanel.tsx)
 * and the automatic supplier-email ingestion pipeline
 * (app/api/webhooks/resend-inbound/route.ts), so both paths parse and
 * map supplier price lists identically.
 */

export type SupplierPreset = {
  label: string;
  descCol: string;
  skuCol: string;
  priceCol: string;
  unitCol?: string;
};

// Known supplier CSV formats -- maps their column headers to our fields.
// Suppliers without a known format (null columns) fall back to heuristic
// header matching in guessMapping() below.
export const SUPPLIER_PRESETS: Record<string, SupplierPreset> = {
  reece: { label: "Reece", descCol: "Description", skuCol: "Part Number", priceCol: "Trade Price", unitCol: "UOM" },
  tradelink: { label: "Tradelink", descCol: "Product Description", skuCol: "Product Code", priceCol: "Net Price", unitCol: "Unit" },
  middys: { label: "Middy's", descCol: "Description", skuCol: "Stock Code", priceCol: "Price", unitCol: "" },
  rexel: { label: "Rexel", descCol: "Product Name", skuCol: "Material", priceCol: "Net Price", unitCol: "Base Unit" },
  neca: { label: "NECA / Supply", descCol: "Description", skuCol: "Code", priceCol: "Price", unitCol: "" },
  custom: { label: "Custom / Other", descCol: "", skuCol: "", priceCol: "", unitCol: "" },
};

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuote = !inQuote;
      } else if ((c === "," || c === "\t") && !inQuote) {
        result.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    result.push(current.trim());
    return result;
  }
  const headers = splitLine(lines[0]);
  return lines
    .slice(1)
    .map((line) => {
      const values = splitLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h.trim()] = values[i] ?? ""; });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => v));
}

/** Given headers and an optional known preset, guess the best column mapping. */
export function guessMapping(headers: string[], presetKey?: string | null) {
  const preset = presetKey ? SUPPLIER_PRESETS[presetKey] : undefined;
  const findCol = (name: string) => headers.find((h) => h.toLowerCase().includes(name.toLowerCase())) ?? "";

  if (preset && preset.descCol) {
    return {
      descCol: headers.find((h) => h === preset.descCol) ?? findCol("desc") ?? headers[0] ?? "",
      skuCol: headers.find((h) => h === preset.skuCol) ?? findCol("code") ?? "",
      priceCol: headers.find((h) => h === preset.priceCol) ?? findCol("price") ?? "",
      unitCol: preset.unitCol ? headers.find((h) => h === preset.unitCol) ?? "" : "",
    };
  }
  return {
    descCol: headers.find((h) => /desc/i.test(h)) ?? headers[0] ?? "",
    skuCol: headers.find((h) => /sku|code|part/i.test(h)) ?? "",
    priceCol: headers.find((h) => /price|cost|rate/i.test(h)) ?? "",
    unitCol: headers.find((h) => /unit|uom/i.test(h)) ?? "",
  };
}

export function rowsToPriceBookRecords(
  rows: Record<string, string>[],
  mapping: { descCol: string; skuCol: string; priceCol: string; unitCol: string },
  meta: { profileId: string; supplierKey: string; trade: string | null }
) {
  return rows
    .map((row) => ({
      profile_id: meta.profileId,
      supplier: meta.supplierKey,
      sku: mapping.skuCol ? row[mapping.skuCol] || null : null,
      description: row[mapping.descCol]?.trim() ?? "",
      unit: mapping.unitCol ? row[mapping.unitCol] || "ea" : "ea",
      cost_price: parseFloat(row[mapping.priceCol]?.replace(/[^0-9.]/g, "")) || 0,
      trade: meta.trade,
    }))
    .filter((r) => r.description && r.cost_price > 0);
}
