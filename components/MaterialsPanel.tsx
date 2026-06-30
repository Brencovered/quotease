"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  MoreVertical,
  Box,
  Upload,
  X,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Package,
  DollarSign,
  Building2,
  FileUp,
  Check,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface PriceBookItem {
  id: string;
  profile_id: string;
  supplier: string | null;
  sku: string | null;
  description: string;
  unit: string;
  cost_price: number;
  trade: string | null;
  imported_at: string | null;
}

interface PackageRow {
  id: string;
  profile_id: string;
  title: string;
  trade: string;
  description: string | null;
  labour_hours: number | null;
  status: string;
  created_at: string;
}

interface PackageItemRow {
  id: string;
  package_id: string;
  label: string;
  qty: number;
  unit: string | null;
  unit_cost: number;
  item_key: string | null;
  sort_order: number | null;
}

interface SupplierAgg {
  name: string;
  count: number;
  totalCost: number;
}

/* ------------------------------------------------------------------ */
/*  Tab labels                                                         */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: "materials", icon: Box, label: "Materials" },
  { key: "suppliers", icon: Building2, label: "Suppliers" },
  { key: "packages", icon: Package, label: "Packages" },
];

export default function MaterialsPanel() {
  const [activeTab, setActiveTab] = useState("materials");

  return (
    <div className="page-wrap">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-[28px] text-[var(--ink)]">Materials &amp; Pricing</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
            Manage your supplier catalog, pricing, and reusable quote packages.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto hide-scrollbar pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap border-2 transition-colors ${
                activeTab === t.key
                  ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                  : "border-[var(--line)] text-[var(--ink-soft)] bg-[var(--surface)]"
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === "materials" && <MaterialsTab />}
      {activeTab === "suppliers" && <SuppliersTab onViewMaterials={() => setActiveTab("materials")} />}
      {activeTab === "packages" && <PackagesTab />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TAB 1 — MATERIALS                                                  */
/* ════════════════════════════════════════════════════════════════════ */

function MaterialsTab() {
  const router = useRouter();
  const [items, setItems] = useState<PriceBookItem[]>([]);
  const [total, setTotal] = useState(0);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [trades, setTrades] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PriceBookItem | null>(null);
  const [form, setForm] = useState({
    description: "",
    sku: "",
    supplier: "",
    unit: "ea",
    cost_price: "",
    trade: "electrician",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [csvModal, setCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvColMap, setCsvColMap] = useState<Record<string, number>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (search) params.set("q", search);
    if (supplierFilter) params.set("supplier", supplierFilter);
    if (tradeFilter) params.set("trade", tradeFilter);

    const res = await fetch(`/api/materials?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setSuppliers(data.suppliers ?? []);
      setTrades(data.trades ?? []);
    }
    setLoading(false);
  }, [offset, search, supplierFilter, tradeFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function openAdd() {
    setEditing(null);
    setForm({ description: "", sku: "", supplier: "", unit: "ea", cost_price: "", trade: "electrician" });
    setFormError("");
    setShowAdd(true);
  }

  function openEdit(item: PriceBookItem) {
    setEditing(item);
    setForm({
      description: item.description,
      sku: item.sku ?? "",
      supplier: item.supplier ?? "",
      unit: item.unit ?? "ea",
      cost_price: String(item.cost_price),
      trade: item.trade ?? "electrician",
    });
    setFormError("");
    setShowAdd(true);
  }

  async function saveMaterial() {
    if (!form.description.trim() || !form.supplier.trim() || !form.cost_price) {
      setFormError("Description, supplier and cost price are required.");
      return;
    }
    setSaving(true);
    setFormError("");

    const body = {
      description: form.description.trim(),
      sku: form.sku.trim() || null,
      supplier: form.supplier.trim(),
      unit: form.unit.trim() || "ea",
      cost_price: parseFloat(form.cost_price),
      trade: form.trade.trim(),
    };

    const url = editing ? `/api/materials?id=${editing.id}` : "/api/materials";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowAdd(false);
      fetchItems();
    } else {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error || "Failed to save.");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/materials?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteId(null);
      fetchItems();
    }
    setDeleting(false);
  }

  function parseCSVText(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (ch === '"') {
          if (next === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else { field += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { row.push(field.trim()); field = ""; }
        else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && next === '\n') i++;
          row.push(field.trim());
          if (row.some((f) => f.length > 0)) rows.push(row);
          row = []; field = "";
        } else { field += ch; }
      }
    }
    row.push(field.trim());
    if (row.some((f) => f.length > 0)) rows.push(row);
    return rows;
  }

  function detectColumnMap(headers: string[]): Record<string, number> {
    const lh = headers.map((h) => h.toLowerCase().trim().replace(/['"]/g, ""));
    const find = (aliases: string[]) => { for (const a of aliases) { const i = lh.indexOf(a); if (i >= 0) return i; } return -1; };
    return {
      description: find(["description", "desc", "item", "name", "product"]),
      sku: find(["sku", "code", "item_code", "part_number"]),
      supplier: find(["supplier", "vendor", "source", "manufacturer", "brand"]),
      unit: find(["unit", "uom"]),
      cost_price: find(["cost_price", "cost", "price", "unit_cost", "rate"]),
      trade: find(["trade", "category", "type"]),
    };
  }

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportResult(null);

    const text = await file.text();
    const rows = parseCSVText(text);
    if (rows.length === 0) return;

    const map = detectColumnMap(rows[0]);
    const hasHeaders = map.description >= 0;
    const headers = hasHeaders ? rows[0] : ["description", "cost_price", "supplier", "sku", "unit", "trade"];
    const dataStart = hasHeaders ? 1 : 0;

    setCsvHeaders(headers);
    setCsvColMap(map);
    setCsvPreview(rows.slice(dataStart, dataStart + 5));
    setCsvModal(true);
  }

  async function importCSV() {
    if (!csvFile) return;
    setImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", csvFile);

    const res = await fetch("/api/materials/upload", { method: "POST", body: formData });
    if (res.ok) {
      const result = await res.json();
      setImportResult(result);
      if (result.imported > 0) {
        fetchItems();
      }
    } else {
      const err = await res.json().catch(() => ({}));
      setImportResult({ imported: 0, errors: [err.error || "Upload failed"] });
    }
    setImporting(false);
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--amber-light)] flex items-center justify-center shrink-0">
            <Box size={18} className="text-[var(--amber-deep)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{total}</div>
            <div className="text-[12px] text-[var(--ink-faint)]">Materials</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-[var(--blue)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{suppliers.length}</div>
            <div className="text-[12px] text-[var(--ink-faint)]">Suppliers</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--green-bg)] flex items-center justify-center shrink-0">
            <DollarSign size={18} className="text-[var(--green)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">
              ${Math.round(items.reduce((s, i) => s + (i.cost_price ?? 0), 0)).toLocaleString()}
            </div>
            <div className="text-[12px] text-[var(--ink-faint)]">Catalog value</div>
          </div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="card flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
          <input
            type="text"
            placeholder="Search materials..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            className="app-field pl-8 text-[13px] w-full"
          />
        </div>
        <select value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setOffset(0); }} className="app-field text-[13px] w-auto">
          <option value="">All suppliers</option>
          {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tradeFilter} onChange={(e) => { setTradeFilter(e.target.value); setOffset(0); }} className="app-field text-[13px] w-auto">
          <option value="">All trades</option>
          {trades.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={openAdd} className="btn-primary text-[12px] py-2" style={{ width: "auto", padding: "8px 14px" }}>
          <Plus size={13} /> Add
        </button>
        <label className="btn-secondary text-[12px] py-2 cursor-pointer" style={{ width: "auto", padding: "8px 14px" }}>
          <Upload size={13} /> CSV
          <input type="file" accept=".csv" className="hidden" ref={fileRef} onChange={onFileSelect} />
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-[var(--ink-faint)]" /></div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12">
          <Box size={28} className="mx-auto mb-3 text-[var(--ink-faint)]" />
          <p className="font-semibold text-[var(--ink)] mb-1">No materials yet</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4">Upload a CSV from your supplier or add your first material.</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={openAdd} className="btn-primary text-[12px] py-2" style={{ width: "auto", padding: "8px 14px" }}>
              <Plus size={13} /> Add material
            </button>
            <label className="btn-secondary text-[12px] py-2 cursor-pointer" style={{ width: "auto", padding: "8px 14px" }}>
              <Upload size={13} /> Upload CSV
              <input type="file" accept=".csv" className="hidden" onChange={onFileSelect} />
            </label>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block card overflow-hidden p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--app-bg)]">
                  <th className="text-left px-4 py-2.5 font-bold text-[var(--ink-soft)]">Description</th>
                  <th className="text-left px-4 py-2.5 font-bold text-[var(--ink-soft)]">SKU</th>
                  <th className="text-left px-4 py-2.5 font-bold text-[var(ink-soft)]">Supplier</th>
                  <th className="text-left px-4 py-2.5 font-bold text-[var(--ink-soft)]">Trade</th>
                  <th className="text-left px-4 py-2.5 font-bold text-[var(--ink-soft)]">Unit</th>
                  <th className="text-right px-4 py-2.5 font-bold text-[var(--ink-soft)]">Cost</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--app-bg)] transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-[var(--ink)]">{item.description}</td>
                    <td className="px-4 py-2.5 text-[var(--ink-faint)] font-mono text-[12px]">{item.sku || "-"}</td>
                    <td className="px-4 py-2.5">
                      <span className="pill bg-[var(--app-bg)] text-[var(--ink-soft)]">{item.supplier || "-"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="pill bg-[var(--app-bg)] text-[var(--ink-soft)] capitalize">{item.trade || "-"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--ink-faint)]">{item.unit || "ea"}</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular">${item.cost_price.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)]"><Pencil size={13} className="text-[var(--ink-faint)]" /></button>
                        <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-lg hover:bg-[var(--red-bg)]"><Trash2 size={13} className="text-[var(--ink-faint)]" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {items.map((item) => (
              <div key={item.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[14px] text-[var(--ink)]">{item.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.sku && <span className="pill bg-[var(--app-bg)] text-[var(--ink-faint)] text-[11px]">{item.sku}</span>}
                    <span className="pill bg-[var(--app-bg)] text-[var(--ink-soft)] text-[11px]">{item.supplier || "-"}</span>
                    <span className="pill bg-[var(--app-bg)] text-[var(--ink-soft)] text-[11px] capitalize">{item.trade || "-"}</span>
                  </div>
                  <p className="text-[12px] text-[var(--ink-faint)] mt-1">{item.unit || "ea"} - <span className="font-bold text-[var(--ink)]">${item.cost_price.toLocaleString()}</span></p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)]"><Pencil size={13} className="text-[var(--ink-faint)]" /></button>
                  <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-lg hover:bg-[var(--red-bg)]"><Trash2 size={13} className="text-[var(--ink-faint)]" /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button onClick={() => setOffset((p) => Math.max(0, p - limit))} disabled={offset === 0} className="btn-secondary text-[12px] py-1.5 px-3">
                <ChevronLeft size={13} /> Prev
              </button>
              <span className="text-[12px] text-[var(--ink-faint)]">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setOffset((p) => Math.min((totalPages - 1) * limit, p + limit))} disabled={offset + limit >= total} className="btn-secondary text-[12px] py-1.5 px-3">
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-[var(--ink)] text-[17px] mb-4">{editing ? "Edit material" : "Add material"}</p>
            <div className="space-y-3">
              <label className="block">
                <span className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Description *</span>
                <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="app-field" placeholder="e.g. LED Downlight 90mm" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">SKU</span>
                  <input type="text" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="app-field" placeholder="Optional" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Unit</span>
                  <input type="text" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className="app-field" placeholder="ea" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Supplier *</span>
                  <input type="text" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} className="app-field" placeholder="e.g. Rexel" list="supplier-suggestions" />
                  <datalist id="supplier-suggestions">
                    {suppliers.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </label>
                <label className="block">
                  <span className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Cost price *</span>
                  <input type="number" min={0} step={0.01} value={form.cost_price} onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))} className="app-field" placeholder="0.00" />
                </label>
              </div>
              <label className="block">
                <span className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Trade</span>
                <input type="text" value={form.trade} onChange={(e) => setForm((f) => ({ ...f, trade: e.target.value }))} className="app-field" placeholder="electrician" list="trade-suggestions" />
                <datalist id="trade-suggestions">
                  {trades.map((t) => <option key={t} value={t} />)}
                </datalist>
              </label>
              {formError && <p className="text-[12px] text-[var(--red)] font-semibold flex items-center gap-1"><AlertCircle size={12} /> {formError}</p>}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveMaterial} disabled={saving} className="btn-primary flex-1">{saving ? "Saving..." : "Save"}</button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {csvModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => { setCsvModal(false); setImportResult(null); }}>
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-[var(ink)] text-[17px] mb-1 flex items-center gap-2"><FileUp size={16} /> Upload CSV</p>
            <p className="text-[12px] text-[var(--ink-faint)] mb-4">Columns: description, supplier, cost_price (required). Optional: sku, unit, trade.</p>

            {!importResult ? (
              <>
                {csvPreview.length > 0 && (
                  <div className="mb-4">
                    <p className="section-tag mb-2">Preview ({csvPreview.length} rows)</p>
                    <div className="border border-[var(--line)] rounded-xl overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-[var(--app-bg)]">
                            {csvHeaders.map((h, i) => (
                              <th key={i} className={`px-2 py-1.5 text-left font-bold ${csvColMap.description === i || csvColMap.cost_price === i || csvColMap.supplier === i ? "text-[var(--amber-deep)]" : "text-[var(--ink-faint)]"}`}>
                                {h} {csvColMap.description === i ? "(desc)" : csvColMap.cost_price === i ? "(cost)" : csvColMap.supplier === i ? "(supplier)" : ""}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((row, ri) => (
                            <tr key={ri} className="border-t border-[var(--line-subtle)]">
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-2 py-1.5 text-[var(--ink-soft)] truncate max-w-[120px]">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={importCSV} disabled={importing} className="btn-primary flex-1">
                    {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {importing ? " Importing..." : " Import"}
                  </button>
                  <button onClick={() => { setCsvModal(false); setImportResult(null); }} className="btn-secondary flex-1 justify-center">Cancel</button>
                </div>
              </>
            ) : (
              <div>
                <div className={`rounded-xl p-4 mb-4 ${importResult.errors.length === 0 ? "bg-[var(--green-bg)]" : importResult.imported > 0 ? "bg-amber-50" : "bg-[var(--red-bg)]"}`}>
                  <p className={`font-bold text-[14px] ${importResult.errors.length === 0 ? "text-[var(--green)]" : importResult.imported > 0 ? "text-amber-700" : "text-[var(--red)]"}`}>
                    {importResult.imported > 0 && <Check size={14} className="inline mr-1" />}
                    {importResult.imported} material{importResult.imported !== 1 ? "s" : ""} imported
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-[11px] text-[var(--red)]">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => { setCsvModal(false); setCsvFile(null); setCsvPreview([]); setImportResult(null); }} className="btn-secondary w-full justify-center">Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-[var(--ink)] mb-1">Delete material?</p>
            <p className="text-[13px] text-[var(--ink-faint)] mb-4">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} disabled={deleting} className="btn-primary flex-1 bg-[var(--red)]">{deleting ? "Deleting..." : "Delete"}</button>
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TAB 2 — SUPPLIERS                                                  */
/* ════════════════════════════════════════════════════════════════════ */

function SuppliersTab({ onViewMaterials }: { onViewMaterials: () => void }) {
  const [suppliers, setSuppliers] = useState<SupplierAgg[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchSuppliers() {
      setLoading(true);
      const res = await fetch("/api/materials/suppliers");
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers ?? []);
      }
      setLoading(false);
    }
    fetchSuppliers();
  }, []);

  const totalMaterials = suppliers.reduce((s, sup) => s + sup.count, 0);
  const totalValue = Math.round(suppliers.reduce((s, sup) => s + sup.totalCost, 0));

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-[var(--blue)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{suppliers.length}</div>
            <div className="text-[12px] text-[var(--ink-faint)]">Suppliers</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--amber-light)] flex items-center justify-center shrink-0">
            <Box size={18} className="text-[var(--amber-deep)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{totalMaterials}</div>
            <div className="text-[12px] text-[var(--ink-faint)]">Materials</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--green-bg)] flex items-center justify-center shrink-0">
            <DollarSign size={18} className="text-[var(--green)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">${totalValue.toLocaleString()}</div>
            <div className="text-[12px] text-[var(--ink-faint)]">Total value</div>
          </div>
        </div>
      </div>

      {/* Supplier cards */}
      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-[var(--ink-faint)]" /></div>
      ) : suppliers.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 size={28} className="mx-auto mb-3 text-[var(ink-faint)]" />
          <p className="font-semibold text-[var(--ink)] mb-1">No suppliers yet</p>
          <p className="text-[13px] text-[var(--ink-faint)]">Add materials with supplier names to see them grouped here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map((sup) => (
            <div key={sup.name} className="card hover:border-[var(--amber)] transition-colors">
              <div className="flex items-start justify-between mb-2">
                <p className="font-bold text-[15px] text-[var(--ink)] truncate">{sup.name}</p>
                <span className="pill bg-[var(--amber-light)] text-[var(--amber-deep)] text-[11px]">{sup.count} items</span>
              </div>
              <p className="text-[13px] text-[var(--ink-faint)] mb-3">Inventory value: <span className="font-bold text-[var(--ink)]">${sup.totalCost.toLocaleString()}</span></p>
              <button onClick={onViewMaterials} className="text-[12px] font-bold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1.5 hover:border-[var(--amber)] transition-colors w-full">
                View materials
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TAB 3 — PACKAGES                                                   */
/* ════════════════════════════════════════════════════════════════════ */

function PackagesTab() {
  const router = useRouter();
  const supabase = createClient();
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [packageItems, setPackageItems] = useState<Record<string, PackageItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [tradeFilter, setTradeFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalPkg, setModalPkg] = useState<PackageRow | null>(null);
  const [modalForm, setModalForm] = useState({ title: "", trade: "electrician", description: "", labour_hours: "" });
  const [modalItems, setModalItems] = useState<Array<{ label: string; qty: number; unit: string; unit_cost: number }>>([]);
  const [saving, setSaving] = useState(false);

  async function loadPackages() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("packages").select("*").eq("profile_id", user.id).neq("status", "archived").order("created_at", { ascending: false });
    const pkgs = (data ?? []) as PackageRow[];
    setPackages(pkgs);

    if (pkgs.length > 0) {
      const { data: items } = await supabase.from("package_items").select("*").in("package_id", pkgs.map((p) => p.id)).order("sort_order", { ascending: true });
      const grouped: Record<string, PackageItemRow[]> = {};
      for (const it of (items ?? [])) {
        grouped[it.package_id] = [...(grouped[it.package_id] ?? []), it];
      }
      setPackageItems(grouped);
    }
    setLoading(false);
  }

  useEffect(() => { loadPackages(); }, [supabase]);

  function openCreate() {
    setModalPkg(null);
    setModalForm({ title: "", trade: "electrician", description: "", labour_hours: "" });
    setModalItems([]);
    setShowModal(true);
  }

  function openEdit(pkg: PackageRow) {
    setModalPkg(pkg);
    setModalForm({
      title: pkg.title,
      trade: pkg.trade,
      description: pkg.description ?? "",
      labour_hours: pkg.labour_hours ? String(pkg.labour_hours) : "",
    });
    const items = packageItems[pkg.id] ?? [];
    setModalItems(items.map((it) => ({ label: it.label, qty: it.qty, unit: it.unit ?? "ea", unit_cost: it.unit_cost })));
    setShowModal(true);
  }

  async function savePackage() {
    if (!modalForm.title.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    let pkgId = modalPkg?.id;
    if (modalPkg) {
      await supabase.from("packages").update({
        title: modalForm.title.trim(),
        trade: modalForm.trade,
        description: modalForm.description.trim(),
        labour_hours: modalForm.labour_hours ? parseFloat(modalForm.labour_hours) : null,
      }).eq("id", modalPkg.id);
      await supabase.from("package_items").delete().eq("package_id", modalPkg.id);
    } else {
      const { data } = await supabase.from("packages").insert({
        profile_id: user.id,
        title: modalForm.title.trim(),
        trade: modalForm.trade,
        description: modalForm.description.trim(),
        labour_hours: modalForm.labour_hours ? parseFloat(modalForm.labour_hours) : null,
        status: "active",
      }).select().single();
      pkgId = data?.id;
    }

    if (pkgId && modalItems.length > 0) {
      await supabase.from("package_items").insert(
        modalItems.filter((it) => it.label.trim()).map((it, i) => ({
          package_id: pkgId,
          label: it.label.trim(),
          qty: it.qty,
          unit: it.unit || "ea",
          unit_cost: it.unit_cost,
          sort_order: i,
        }))
      );
    }

    setShowModal(false);
    loadPackages();
    setSaving(false);
  }

  async function deletePackage(id: string) {
    if (!confirm("Archive this package?")) return;
    await supabase.from("packages").update({ status: "archived" }).eq("id", id);
    setPackages((prev) => prev.filter((p) => p.id !== id));
  }

  const trades = [...new Set(packages.map((p) => p.trade).filter(Boolean))].sort();
  const filteredPackages = tradeFilter ? packages.filter((p) => p.trade === tradeFilter) : packages;

  const materialsTotal = modalItems.reduce((s, it) => s + it.qty * it.unit_cost, 0);
  const labourTotal = modalForm.labour_hours ? parseFloat(modalForm.labour_hours) * 95 : 0;

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} className="app-field text-[13px] w-auto">
          <option value="">All trades</option>
          {trades.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={openCreate} className="btn-primary text-[12px] py-2" style={{ width: "auto", padding: "8px 14px" }}>
          <Plus size={13} /> New package
        </button>
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-[var(--ink-faint)]" /></div>
      ) : filteredPackages.length === 0 ? (
        <div className="card text-center py-12">
          <Package size={28} className="mx-auto mb-3 text-[var(--ink-faint)]" />
          <p className="font-semibold text-[var(--ink)] mb-1">No packages yet</p>
          <p className="text-[13px] text-[var(ink-faint)] mb-3">Create reusable material sets for common jobs.</p>
          <button onClick={openCreate} className="btn-primary text-[12px] py-2" style={{ width: "auto", padding: "8px 14px" }}>
            <Plus size={13} /> Create your first package
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPackages.map((pkg) => {
            const items = packageItems[pkg.id] ?? [];
            const estMaterialCost = items.reduce((s, it) => s + it.qty * it.unit_cost, 0);
            return (
              <div key={pkg.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-[15px] text-[var(ink)] truncate">{pkg.title}</p>
                      <span className="pill bg-[var(--app-bg)] text-[var(--ink-soft)] text-[11px] capitalize">{pkg.trade}</span>
                    </div>
                    {pkg.description && <p className="text-[12px] text-[var(ink-faint)]">{pkg.description}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(pkg)} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)]"><Pencil size={13} className="text-[var(ink-faint)]" /></button>
                    <button onClick={() => deletePackage(pkg.id)} className="p-1.5 rounded-lg hover:bg-[var(--red-bg)]"><Trash2 size={13} className="text-[var(ink-faint)]" /></button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1.5">
                      {items.slice(0, 4).map((it) => (
                        <span key={it.id} className="pill bg-[var(--app-bg)] text-[var(--ink-soft)] text-[11px]">
                          {it.qty}x {it.label}
                        </span>
                      ))}
                      {items.length > 4 && <span className="pill bg-[var(--app-bg)] text-[var(ink-faint)] text-[11px]">+{items.length - 4} more</span>}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {pkg.labour_hours && <span className="text-[12px] text-[var(--ink-faint)]">{pkg.labour_hours}h labour</span>}
                    <span className="text-[12px] text-[var(--ink-faint)]">~${Math.round(estMaterialCost).toLocaleString()} materials</span>
                  </div>
                  <Link href={`/electrician?package_id=${pkg.id}`} className="text-[12px] font-bold bg-[var(--amber)] text-[var(--navy)] rounded-lg px-3 py-1.5 hover:bg-[var(--amber-deep)] transition-colors">
                    Use this package
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Package Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-[var(ink)] text-[17px] mb-4">{modalPkg ? "Edit package" : "New package"}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Title *</span>
                  <input type="text" value={modalForm.title} onChange={(e) => setModalForm((f) => ({ ...f, title: e.target.value }))} className="app-field" placeholder="e.g. Standard switch upgrade" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-bold text-[var(ink-soft)] mb-1.5">Trade</span>
                  <input type="text" value={modalForm.trade} onChange={(e) => setModalForm((f) => ({ ...f, trade: e.target.value }))} className="app-field" placeholder="electrician" />
                </label>
              </div>
              <label className="block">
                <span className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Description</span>
                <textarea value={modalForm.description} onChange={(e) => setModalForm((f) => ({ ...f, description: e.target.value }))} className="app-field" rows={2} placeholder="Optional notes" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Labour hours</span>
                <input type="number" min={0} step={0.5} value={modalForm.labour_hours} onChange={(e) => setModalForm((f) => ({ ...f, labour_hours: e.target.value }))} className="app-field w-32" placeholder="e.g. 2" />
              </label>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-bold text-[var(ink-soft)]">Items</p>
                  <button onClick={() => setModalItems((prev) => [...prev, { label: "", qty: 1, unit: "ea", unit_cost: 0 }])} className="text-[11px] font-bold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-2 py-1">+ Add item</button>
                </div>
                <div className="space-y-1.5">
                  {modalItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="text" value={it.label} onChange={(e) => setModalItems((prev) => prev.map((p, pi) => pi === i ? { ...p, label: e.target.value } : p))} className="app-field text-[12px] flex-1" placeholder="Item name" />
                      <input type="number" min={1} value={it.qty} onChange={(e) => setModalItems((prev) => prev.map((p, pi) => pi === i ? { ...p, qty: parseInt(e.target.value) || 1 } : p))} className="app-field text-[12px] w-16" placeholder="Qty" />
                      <input type="text" value={it.unit} onChange={(e) => setModalItems((prev) => prev.map((p, pi) => pi === i ? { ...p, unit: e.target.value } : p))} className="app-field text-[12px] w-16" placeholder="Unit" />
                      <input type="number" min={0} step={0.01} value={it.unit_cost} onChange={(e) => setModalItems((prev) => prev.map((p, pi) => pi === i ? { ...p, unit_cost: parseFloat(e.target.value) || 0 } : p))} className="app-field text-[12px] w-24" placeholder="Cost" />
                      <button onClick={() => setModalItems((prev) => prev.filter((_, pi) => pi !== i))} className="p-1 rounded hover:bg-[var(--red-bg)]"><X size={12} className="text-[var(--ink-faint)]" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Running total */}
              <div className="bg-[var(--app-bg)] rounded-xl p-3 flex items-center justify-between">
                <span className="text-[12px] text-[var(--ink-faint)]">Est. total</span>
                <span className="font-display text-[16px] text-[var(ink)]">${Math.round(materialsTotal + labourTotal).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={savePackage} disabled={saving || !modalForm.title.trim()} className="btn-primary flex-1">{saving ? "Saving..." : "Save"}</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
