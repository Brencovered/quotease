"use client";

import { useState, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, Trash2, Search, Check, AlertCircle, ChevronDown } from "lucide-react";

type PriceBookItem = {
  id: string; supplier: string; sku: string | null;
  description: string; unit: string; cost_price: number;
  trade: string | null; imported_at: string;
};

// Known supplier CSV formats -- maps their column headers to our fields
const SUPPLIER_PRESETS: Record<string, {
  label: string;
  descCol: string;
  skuCol: string;
  priceCol: string;
  unitCol?: string;
}> = {
  reece: {
    label: "Reece",
    descCol: "Description",
    skuCol: "Part Number",
    priceCol: "Trade Price",
    unitCol: "UOM",
  },
  tradelink: {
    label: "Tradelink",
    descCol: "Product Description",
    skuCol: "Product Code",
    priceCol: "Net Price",
    unitCol: "Unit",
  },
  middys: {
    label: "Middy's",
    descCol: "Description",
    skuCol: "Stock Code",
    priceCol: "Price",
  },
  rexel: {
    label: "Rexel",
    descCol: "Product Name",
    skuCol: "Material",
    priceCol: "Net Price",
    unitCol: "Base Unit",
  },
  neca: {
    label: "NECA / Supply",
    descCol: "Description",
    skuCol: "Code",
    priceCol: "Price",
  },
  custom: {
    label: "Custom / Other",
    descCol: "",
    skuCol: "",
    priceCol: "",
  },
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  // Handle quoted fields
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
  return lines.slice(1).map(line => {
    const values = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = values[i] ?? ""; });
    return row;
  }).filter(row => Object.values(row).some(v => v));
}

export default function PriceBookPanel({
  items: initial, supplierCounts: initialCounts,
}: {
  items: PriceBookItem[];
  supplierCounts: Record<string, number>;
}) {
  const [items,    setItems]    = useState<PriceBookItem[]>(initial);
  const [counts,   setCounts]   = useState(initialCounts);
  const [search,   setSearch]   = useState("");
  const [supplier, setSupplier] = useState("all");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg]  = useState<{type:"ok"|"err"; text:string}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Import flow state
  const [showImport,    setShowImport]    = useState(false);
  const [csvSupplier,   setCsvSupplier]   = useState("reece");
  const [csvRows,       setCsvRows]       = useState<Record<string, string>[]>([]);
  const [csvHeaders,    setCsvHeaders]    = useState<string[]>([]);
  const [mapDesc,       setMapDesc]       = useState("");
  const [mapSku,        setMapSku]        = useState("");
  const [mapPrice,      setMapPrice]      = useState("");
  const [mapUnit,       setMapUnit]       = useState("");
  const [csvTrade,      setCsvTrade]      = useState("");
  const [csvFileName,   setCsvFileName]   = useState("");

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (!rows.length) { setImportMsg({type:"err", text:"Could not parse CSV. Check the file format."}); return; }
      setCsvRows(rows);
      const headers = Object.keys(rows[0]);
      setCsvHeaders(headers);
      // Auto-fill column mapping from preset
      const preset = SUPPLIER_PRESETS[csvSupplier];
      if (preset && preset.descCol) {
        const findCol = (name: string) => headers.find(h => h.toLowerCase().includes(name.toLowerCase())) ?? "";
        setMapDesc(headers.find(h => h === preset.descCol) ?? findCol("desc") ?? headers[0] ?? "");
        setMapSku(headers.find(h => h === preset.skuCol) ?? findCol("code") ?? "");
        setMapPrice(headers.find(h => h === preset.priceCol) ?? findCol("price") ?? "");
        setMapUnit(preset.unitCol ? (headers.find(h => h === preset.unitCol) ?? "") : "");
      } else {
        // Auto-guess for custom
        setMapDesc(headers.find(h => /desc/i.test(h)) ?? headers[0] ?? "");
        setMapSku(headers.find(h => /sku|code|part/i.test(h)) ?? "");
        setMapPrice(headers.find(h => /price|cost|rate/i.test(h)) ?? "");
        setMapUnit(headers.find(h => /unit|uom/i.test(h)) ?? "");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function doImport() {
    if (!csvRows.length || !mapDesc || !mapPrice) return;
    setImporting(true); setImportMsg(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }

    const records = csvRows
      .map(row => ({
        profile_id:  user.id,
        supplier:    csvSupplier,
        sku:         mapSku ? (row[mapSku] || null) : null,
        description: row[mapDesc]?.trim() ?? "",
        unit:        mapUnit ? (row[mapUnit] || "ea") : "ea",
        cost_price:  parseFloat(row[mapPrice]?.replace(/[^0-9.]/g, "")) || 0,
        trade:       csvTrade || null,
      }))
      .filter(r => r.description && r.cost_price > 0);

    if (!records.length) {
      setImportMsg({type:"err", text:"No valid rows found. Check your column mapping."});
      setImporting(false); return;
    }

    // Delete existing items for this supplier first
    await supabase.from("price_book_items").delete()
      .eq("profile_id", user.id).eq("supplier", csvSupplier);

    // Insert in batches of 500
    for (let i = 0; i < records.length; i += 500) {
      const { error } = await supabase.from("price_book_items").insert(records.slice(i, i + 500));
      if (error) { setImportMsg({type:"err", text:error.message}); setImporting(false); return; }
    }

    // Refresh items
    const { data: fresh } = await supabase.from("price_book_items")
      .select("id, supplier, sku, description, unit, cost_price, trade, imported_at")
      .eq("profile_id", user.id).order("supplier").order("description");
    setItems(fresh ?? []);

    const newCounts = { ...counts, [csvSupplier]: records.length };
    setCounts(newCounts);
    setImportMsg({type:"ok", text:`Imported ${records.length.toLocaleString()} items from ${SUPPLIER_PRESETS[csvSupplier]?.label ?? csvSupplier}`});
    setImporting(false); setShowImport(false); setCsvRows([]); setCsvHeaders([]);
  }

  async function deleteSupplier(sup: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("price_book_items").delete().eq("profile_id", user.id).eq("supplier", sup);
    setItems(prev => prev.filter(i => i.supplier !== sup));
    setCounts(prev => { const n = {...prev}; delete n[sup]; return n; });
  }

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (supplier !== "all" && i.supplier !== supplier) return false;
      if (search) {
        const q = search.toLowerCase();
        return i.description.toLowerCase().includes(q) || (i.sku?.toLowerCase().includes(q) ?? false);
      }
      return true;
    });
  }, [items, supplier, search]);

  const suppliers = Object.keys(counts);
  const previewRows = csvRows.slice(0, 3);

  return (
    <div className="space-y-4">

      {/* Supplier summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {suppliers.map(sup => (
          <div key={sup} className="card flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-[14px] text-[var(--ink)]">{SUPPLIER_PRESETS[sup]?.label ?? sup}</p>
              <p className="text-[12px] text-[var(--ink-faint)]">{counts[sup].toLocaleString()} items</p>
            </div>
            <button onClick={() => deleteSupplier(sup)} className="text-[var(--red)] p-1 hover:opacity-70 shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button onClick={() => setShowImport(true)}
          className="card flex items-center justify-center gap-2 border-dashed border-2 border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--navy)] hover:text-[var(--navy)] transition-colors min-h-[72px]">
          <Upload size={16} /> Import supplier CSV
        </button>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="card border-2 border-[var(--amber)]/40 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-[15px] text-[var(--ink)]">Import price list</p>
            <button onClick={() => { setShowImport(false); setCsvRows([]); }} className="text-[var(--ink-faint)]">✕</button>
          </div>

          {/* Step 1: supplier + file */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1.5">Supplier</label>
              <select value={csvSupplier} onChange={e => { setCsvSupplier(e.target.value); setCsvRows([]); }}
                className="app-field text-[13px]">
                {Object.entries(SUPPLIER_PRESETS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1.5">Trade (optional)</label>
              <select value={csvTrade} onChange={e => setCsvTrade(e.target.value)} className="app-field text-[13px]">
                <option value="">All trades</option>
                {["electrician","plumber","carpenter","roofer","painter","tiler","landscaper","arborist","concreter","fencer","aircon","surveyor"].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1.5">
              CSV file from {SUPPLIER_PRESETS[csvSupplier]?.label ?? "your supplier"}
            </label>
            <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-5 cursor-pointer transition-colors ${csvFileName ? "border-[var(--green)] bg-[var(--green-bg)]" : "border-[var(--line)] hover:border-[var(--navy)]"}`}>
              <Upload size={16} className={csvFileName ? "text-[var(--green)]" : "text-[var(--ink-faint)]"} />
              <span className="text-[13px] font-semibold text-[var(--ink-soft)]">
                {csvFileName || "Choose CSV file"}
              </span>
              <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileSelect} />
            </label>
            <p className="text-[11.5px] text-[var(--ink-faint)] mt-1">
              Export from {SUPPLIER_PRESETS[csvSupplier]?.label ?? "your supplier"}&apos;s online account or ask your rep for a price list CSV.
            </p>
          </div>

          {/* Step 2: column mapping */}
          {csvRows.length > 0 && (
            <>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">
                  Map columns ({csvRows.length.toLocaleString()} rows detected)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Description *", val: mapDesc, set: setMapDesc },
                    { label: "Price (ex GST) *", val: mapPrice, set: setMapPrice },
                    { label: "SKU / Part number", val: mapSku, set: setMapSku },
                    { label: "Unit (ea, m, etc)", val: mapUnit, set: setMapUnit },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">{f.label}</label>
                      <select value={f.val} onChange={e => f.set(e.target.value)} className="app-field text-[12.5px]">
                        <option value="">-- skip --</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">Preview (first 3 rows)</p>
                <div className="border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-4 bg-[var(--app-bg)] px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-faint)] border-b border-[var(--line)]">
                    <span>Description</span><span>Price</span><span>SKU</span><span>Unit</span>
                  </div>
                  {previewRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-4 px-3 py-2 text-[12.5px] border-b border-[var(--line-subtle)] last:border-0">
                      <span className="truncate text-[var(--ink)]">{mapDesc ? row[mapDesc] : "-"}</span>
                      <span className="text-[var(--ink)]">{mapPrice ? `$${parseFloat(row[mapPrice]?.replace(/[^0-9.]/g,"") || "0").toFixed(2)}` : "-"}</span>
                      <span className="text-[var(--ink-faint)] truncate">{mapSku ? row[mapSku] : "-"}</span>
                      <span className="text-[var(--ink-faint)]">{mapUnit ? row[mapUnit] : "ea"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {importMsg && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold ${importMsg.type === "ok" ? "bg-[var(--green-bg)] text-[var(--green)]" : "bg-[var(--red-bg)] text-[var(--red)]"}`}>
              {importMsg.type === "ok" ? <Check size={14} /> : <AlertCircle size={14} />}
              {importMsg.text}
            </div>
          )}

          <button
            onClick={doImport}
            disabled={!csvRows.length || !mapDesc || !mapPrice || importing}
            className="btn-primary w-full justify-center disabled:opacity-40">
            {importing ? "Importing..." : `Import ${csvRows.length ? csvRows.length.toLocaleString() + " items" : "items"}`}
          </button>
          <p className="text-[11.5px] text-[var(--ink-faint)] text-center">
            Existing items from {SUPPLIER_PRESETS[csvSupplier]?.label ?? "this supplier"} will be replaced.
          </p>
        </div>
      )}

      {importMsg && !showImport && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold ${importMsg.type === "ok" ? "bg-[var(--green-bg)] text-[var(--green)]" : "bg-[var(--red-bg)] text-[var(--red)]"}`}>
          {importMsg.type === "ok" ? <Check size={14} /> : <AlertCircle size={14} />}
          {importMsg.text}
        </div>
      )}

      {/* Search and filter */}
      {items.length > 0 && (
        <div className="card">
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="app-field pl-8 text-[13px]" placeholder="Search items..." />
            </div>
            <select value={supplier} onChange={e => setSupplier(e.target.value)} className="app-field text-[13px] w-auto">
              <option value="all">All suppliers</option>
              {suppliers.map(s => <option key={s} value={s}>{SUPPLIER_PRESETS[s]?.label ?? s} ({counts[s]})</option>)}
            </select>
          </div>

          <p className="text-[12px] text-[var(--ink-faint)] mb-2">
            {filtered.length.toLocaleString()} item{filtered.length !== 1 ? "s" : ""}
            {search && ` matching "${search}"`}
          </p>

          <div className="border border-[var(--line)] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_80px] bg-[var(--app-bg)] border-b border-[var(--line)] px-3 py-2">
              {["Description","Supplier","SKU","Price"].map(h => (
                <span key={h} className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-[var(--line-subtle)] max-h-96 overflow-y-auto">
              {filtered.slice(0, 200).map(item => (
                <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_80px] items-center px-3 py-2.5 hover:bg-[var(--app-bg)]">
                  <p className="text-[13px] text-[var(--ink)] truncate pr-2">{item.description}</p>
                  <p className="text-[12px] text-[var(--ink-faint)]">{SUPPLIER_PRESETS[item.supplier]?.label ?? item.supplier}</p>
                  <p className="text-[12px] text-[var(--ink-faint)] truncate">{item.sku ?? "-"}</p>
                  <p className="text-[13px] font-semibold text-[var(--ink)] text-right">${item.cost_price.toFixed(2)}<span className="text-[10px] text-[var(--ink-faint)] ml-0.5">/{item.unit}</span></p>
                </div>
              ))}
              {filtered.length > 200 && (
                <div className="px-3 py-2.5 text-[12px] text-[var(--ink-faint)] text-center">
                  Showing first 200 of {filtered.length.toLocaleString()} — refine your search
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && !showImport && (
        <div className="card text-center py-10">
          <p className="text-[14px] font-semibold text-[var(--ink)] mb-2">No price books imported yet</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4">Import a CSV from Reece, Tradelink, Middy&apos;s or any supplier to auto-fill material prices when quoting.</p>
          <button onClick={() => setShowImport(true)} className="btn-primary mx-auto">
            <Upload size={15} /> Import your first price list
          </button>
        </div>
      )}
    </div>
  );
}
