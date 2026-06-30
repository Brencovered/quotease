"use client";

import { useState, useRef } from "react";
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
  Building2,
  Check,
  FileUp,
} from "lucide-react";
import type { Material, Supplier } from "./shared";
import { TRADE_COLORS, TRADES, UNITS, PAGE_SIZE, formatCurrency } from "./shared";

/* ================================================================== */
/*  TAB 1: MATERIALS                                                   */
/* ================================================================== */

interface MaterialsTabProps {
  materials: Material[];
  loading: boolean;
  error: string;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  supplierFilter: string;
  setSupplierFilter: (v: string) => void;
  tradeFilter: string;
  setTradeFilter: (v: string) => void;
  suppliers: Supplier[];
  currentPage: number;
  setCurrentPage: (v: number) => void;
  totalPages: number;
  totalMaterials: number;
  openMenuId: string | null;
  setOpenMenuId: (v: string | null) => void;
  onAddMaterial: () => void;
  onEditMaterial: (m: Material) => void;
  onDeleteMaterial: (id: string) => void;
  onOpenCsvUpload: () => void;
}

export default function MaterialsCatalog({
  materials,
  loading,
  error,
  searchQuery,
  setSearchQuery,
  supplierFilter,
  setSupplierFilter,
  tradeFilter,
  setTradeFilter,
  suppliers,
  currentPage,
  setCurrentPage,
  totalPages,
  totalMaterials,
  openMenuId,
  setOpenMenuId,
  onAddMaterial,
  onEditMaterial,
  onDeleteMaterial,
  onOpenCsvUpload,
}: MaterialsTabProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Materials</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">Your pricing catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenCsvUpload} className="btn-secondary shrink-0" style={{ width: "auto", padding: "10px 16px", fontSize: "13px" }}>
            <Upload size={15} strokeWidth={2.5} />
            Upload CSV
          </button>
          <button onClick={onAddMaterial} className="btn-primary shrink-0" style={{ width: "auto", padding: "12px 20px", fontSize: "14px" }}>
            <Plus size={16} strokeWidth={2.5} />
            Add material
          </button>
        </div>
      </div>

      {/* Stats */}
      {totalMaterials > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--amber-light)] flex items-center justify-center shrink-0">
              <Box size={18} className="text-[var(--amber-deep)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{totalMaterials}</div>
              <div className="text-[12px] text-[var(--ink-faint)]">Total materials</div>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--blue-bg)] flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-[var(--blue)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{suppliers.length}</div>
              <div className="text-[12px] text-[var(--ink-faint)]">Suppliers</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input
              type="text"
              className="app-field"
              placeholder="Search description or SKU..."
              style={{ paddingLeft: "38px" }}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <select
            className="app-field sm:w-44"
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="app-field sm:w-40"
            value={tradeFilter}
            onChange={(e) => {
              setTradeFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All trades</option>
            {TRADES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-[var(--red-bg)] border border-[var(--red)]/20 rounded-lg px-3 py-2.5 text-[13px] text-[var(--red)] mb-4">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[var(--amber)]" />
        </div>
      )}

      {/* Empty state */}
      {!loading && materials.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--line-subtle)] flex items-center justify-center mb-4">
            <Box size={28} className="text-[var(--ink-faint)]" />
          </div>
          <h3 className="font-display text-[20px] text-[var(--ink)] mb-1">No materials yet</h3>
          <p className="text-[13px] text-[var(--ink-faint)] max-w-sm mb-6">
            Upload a CSV or add your first material.
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onOpenCsvUpload} className="btn-secondary" style={{ width: "auto", padding: "10px 20px", fontSize: "13px" }}>
              <Upload size={15} />
              Upload CSV
            </button>
            <button onClick={onAddMaterial} className="btn-primary" style={{ width: "auto", padding: "12px 24px", fontSize: "14px" }}>
              <Plus size={16} strokeWidth={2.5} />
              Add material
            </button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      {!loading && materials.length > 0 && (
        <>
          <div className="hidden sm:block card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--app-bg)] text-[10px] font-bold text-[var(--ink-faint)] uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Description</th>
                  <th className="text-left px-4 py-2.5 w-28">SKU</th>
                  <th className="text-left px-4 py-2.5 w-36">Supplier</th>
                  <th className="text-left px-4 py-2.5 w-28">Trade</th>
                  <th className="text-center px-4 py-2.5 w-20">Unit</th>
                  <th className="text-right px-4 py-2.5 w-28">Cost</th>
                  <th className="text-right px-4 py-2.5 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m, i) => {
                  const tradeColor = TRADE_COLORS[m.trade] ?? TRADE_COLORS.handyman;
                  return (
                    <tr
                      key={m.id}
                      className="border-t border-[var(--line-subtle)] hover:bg-[var(--app-bg)]/50 transition-colors reveal"
                      style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
                    >
                      <td className="px-4 py-2.5 text-[13px] text-[var(--ink)] font-semibold">{m.description}</td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--ink-soft)] font-mono">{m.sku || "-"}</td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--ink-soft)]">{m.supplier}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className="pill"
                          style={{ backgroundColor: tradeColor + "18", color: tradeColor }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tradeColor }} />
                          {m.trade}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-[12px] text-[var(--ink-soft)]">{m.unit}</td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-bold text-[var(--ink)] tabular">
                        {formatCurrency(m.cost_price)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                            className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors"
                            aria-label="More options"
                          >
                            <MoreVertical size={15} className="text-[var(--ink-faint)]" />
                          </button>
                          {openMenuId === m.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden w-36">
                                <button
                                  onClick={() => {
                                    onEditMaterial(m);
                                    setOpenMenuId(null);
                                  }}
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)] border-b border-[var(--line)] w-full text-left hover:bg-[var(--app-bg)] transition-colors"
                                >
                                  <Pencil size={14} className="text-[var(--ink-faint)]" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => onDeleteMaterial(m.id)}
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--red)] w-full text-left hover:bg-[var(--red-bg)] transition-colors"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="sm:hidden space-y-3">
            {materials.map((m, i) => {
              const tradeColor = TRADE_COLORS[m.trade] ?? TRADE_COLORS.handyman;
              return (
                <div
                  key={m.id}
                  className="card reveal"
                  style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-bold text-[var(--ink)] truncate">{m.description}</h3>
                      {m.sku && <p className="text-[11px] text-[var(--ink-faint)] font-mono mt-0.5">{m.sku}</p>}
                    </div>
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                        className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors"
                      >
                        <MoreVertical size={15} className="text-[var(--ink-faint)]" />
                      </button>
                      {openMenuId === m.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden w-36">
                            <button
                              onClick={() => {
                                onEditMaterial(m);
                                setOpenMenuId(null);
                              }}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)] border-b border-[var(--line)] w-full text-left hover:bg-[var(--app-bg)]"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button
                              onClick={() => onDeleteMaterial(m.id)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--red)] w-full text-left hover:bg-[var(--red-bg)]"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className="pill"
                      style={{ backgroundColor: tradeColor + "18", color: tradeColor }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tradeColor }} />
                      {m.trade}
                    </span>
                    <span className="text-[11px] text-[var(--ink-faint)]">{m.supplier}</span>
                    <span className="text-[11px] text-[var(--ink-faint)]">|</span>
                    <span className="text-[11px] text-[var(--ink-faint)]">{m.unit}</span>
                  </div>
                  <div className="mt-2 text-[14px] font-bold text-[var(--ink)] tabular">{formatCurrency(m.cost_price)}</div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-[12px] text-[var(--ink-faint)]">
                Showing {materials.length} of {totalMaterials} materials
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="btn-secondary p-2"
                  style={{ width: "auto" }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[13px] font-semibold text-[var(--ink-soft)] px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="btn-secondary p-2"
                  style={{ width: "auto" }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  ADD/EDIT MATERIAL MODAL                                            */
/* ================================================================== */

export function MaterialModal({
  material,
  onClose,
  onSaved,
}: {
  material: Material | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(material?.description ?? "");
  const [sku, setSku] = useState(material?.sku ?? "");
  const [supplier, setSupplier] = useState(material?.supplier ?? "");
  const [unit, setUnit] = useState(material?.unit ?? "ea");
  const [costPrice, setCostPrice] = useState(material?.cost_price ?? 0);
  const [trade, setTrade] = useState(material?.trade ?? "electrician");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");

    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!supplier.trim()) {
      setError("Supplier is required.");
      return;
    }
    if (costPrice < 0) {
      setError("Cost price must be 0 or greater.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        description: description.trim(),
        sku: sku.trim() || null,
        supplier: supplier.trim(),
        unit: unit || "ea",
        cost_price: costPrice,
        trade: trade || "electrician",
      };

      let res;
      if (material) {
        res = await fetch(`/api/materials?id=${material.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save material");
      }

      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 pt-8 sm:pt-24">
      <div className="bg-[var(--surface)] rounded-2xl shadow-xl w-full max-w-lg border border-[var(--line)] mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <h2 className="font-display text-[20px] text-[var(--ink)]">
            {material ? "Edit Material" : "Add Material"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors" aria-label="Close">
            <X size={18} className="text-[var(--ink-faint)]" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-[var(--red-bg)] border border-[var(--red)]/20 rounded-lg px-3 py-2.5 text-[13px] text-[var(--red)]">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">
              Description <span className="text-[var(--red)]">*</span>
            </label>
            <input
              type="text"
              className="app-field"
              placeholder="e.g. LED Downlight 10W Dimmable"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">SKU</label>
              <input
                type="text"
                className="app-field"
                placeholder="e.g. DL-10W-DIM"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">
                Supplier <span className="text-[var(--red)]">*</span>
              </label>
              <input
                type="text"
                className="app-field"
                placeholder="e.g. Rexel"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Unit</label>
              <select className="app-field" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">
                Cost Price <span className="text-[var(--red)]">*</span>
              </label>
              <input
                type="number"
                className="app-field"
                placeholder="0.00"
                min={0}
                step={0.01}
                value={costPrice || ""}
                onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Trade</label>
            <select className="app-field" value={trade} onChange={(e) => setTrade(e.target.value)}>
              {TRADES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--line)]">
          <button onClick={onClose} className="btn-secondary" style={{ width: "auto" }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary"
            style={{ width: "auto", padding: "12px 24px", fontSize: "14px" }}
          >
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={15} strokeWidth={2.5} />
                {material ? "Save changes" : "Add material"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  CSV UPLOAD MODAL                                                   */
/* ================================================================== */

export function CsvUploadModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [defaultSupplier, setDefaultSupplier] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Auto-detect column mappings from headers */
  const HEADER_ALIASES: Record<string, string[]> = {
    description: [
      "description", "desc", "item", "name", "item name", "itemname",
      "product", "product name", "item description", "purchasesdescription",
    ],
    sku: [
      "sku", "code", "item_code", "item code", "itemcode", "product code",
      "part number", "part_no", "itemnumber",
    ],
    supplier: [
      "supplier", "vendor", "manufacturer", "brand", "source", "suppliername",
    ],
    unit: ["unit", "uom", "units", "measure", "um", "unitofmeasure"],
    cost_price: [
      "price", "cost", "cost_price", "cost price", "unit cost", "unitcost",
      "rate", "value", "purchasesunitprice", "standardcost", "currentcost",
    ],
    trade: ["trade", "category", "type", "discipline"],
  };

  function detectColumns(hdrs: string[]) {
    const detected: Record<string, string> = {};
    const lowerHdrs = hdrs.map((h) => h.toLowerCase().trim());

    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      for (const alias of aliases) {
        const idx = lowerHdrs.indexOf(alias);
        if (idx !== -1) {
          detected[field] = hdrs[idx];
          break;
        }
      }
    }
    return detected;
  }

  function parseCSV(text: string): string[][] {
    const lines: string[][] = [];
    const rows = text.split(/\r?\n/);
    for (const row of rows) {
      if (!row.trim()) continue;
      const cols: string[] = [];
      let inQuotes = false;
      let current = "";
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '"') {
          if (inQuotes && row[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          cols.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      cols.push(current.trim());
      lines.push(cols);
    }
    return lines;
  }

  function processFile(f: File) {
    if (!f.name.endsWith(".csv") && !f.name.endsWith(".txt")) {
      setResult({ imported: 0, errors: ["Please upload a CSV file (.csv or .txt)"] });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        setResult({ imported: 0, errors: ["CSV must have at least a header row and one data row"] });
        return;
      }
      const hdrs = rows[0];
      setHeaders(hdrs);
      setPreview(rows.slice(1, 6));
      setColumnMap(detectColumns(hdrs));
      setFile(f);
      setResult(null);
    };
    reader.readAsText(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("columnMap", JSON.stringify(columnMap));
      if (defaultSupplier.trim()) {
        formData.append("defaultSupplier", defaultSupplier.trim());
      }

      const res = await fetch("/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setResult({
        imported: data.imported ?? 0,
        errors: data.errors ?? [],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Import failed";
      setResult({ imported: 0, errors: [message] });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 pt-8 sm:pt-16">
      <div className="bg-[var(--surface)] rounded-2xl shadow-xl w-full max-w-2xl border border-[var(--line)] mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <h2 className="font-display text-[20px] text-[var(--ink)]">Upload Materials CSV</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors" aria-label="Close">
            <X size={18} className="text-[var(--ink-faint)]" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Drop zone */}
          {!file && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                dragOver ? "border-[var(--amber)] bg-[var(--amber-light)]" : "border-[var(--line)] hover:border-[var(--ink-faint)]"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--amber-light)] flex items-center justify-center mx-auto mb-4">
                <FileUp size={24} className="text-[var(--amber-deep)]" />
              </div>
              <p className="text-[14px] font-bold text-[var(--ink)] mb-1">
                Drop your CSV file here, or click to select
              </p>
              <p className="text-[12px] text-[var(--ink-faint)]">Supports .csv and .txt files</p>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {/* Preview + column mapping */}
          {file && headers.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileUp size={16} className="text-[var(--amber-deep)]" />
                  <span className="text-[13px] font-bold text-[var(--ink)]">{file.name}</span>
                  <span className="text-[11px] text-[var(--ink-faint)]">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview([]);
                    setHeaders([]);
                    setColumnMap({});
                    setDefaultSupplier("");
                    setResult(null);
                  }}
                  className="text-[12px] font-bold text-[var(--red)] hover:underline"
                >
                  Remove
                </button>
              </div>

              {/* Default supplier (when CSV has no supplier column) */}
              {(!columnMap.supplier || columnMap.supplier === "") && (
                <div>
                  <p className="section-tag mb-2">Default Supplier</p>
                  <input
                    type="text"
                    className="app-field"
                    placeholder="e.g. Xero Import - enter supplier name since CSV has no supplier column"
                    value={defaultSupplier}
                    onChange={(e) => setDefaultSupplier(e.target.value)}
                    style={{ padding: "8px 10px", fontSize: "13px" }}
                  />
                </div>
              )}

              {/* Column mapping */}
              <div>
                <p className="section-tag mb-2">Column Mapping</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {["description", "sku", "supplier", "unit", "cost_price", "trade"].map((field) => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-[var(--ink-soft)] w-24 shrink-0 capitalize">
                        {field.replace("_", " ")}
                      </span>
                      <select
                        className="app-field"
                        value={columnMap[field] ?? ""}
                        onChange={(e) => setColumnMap((prev) => ({ ...prev, [field]: e.target.value }))}
                        style={{ padding: "6px 10px", fontSize: "12px" }}
                      >
                        <option value="">-- ignore --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <p className="section-tag mb-2">Preview (first {preview.length} rows)</p>
                <div className="border border-[var(--line)] rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-[var(--app-bg)] text-[10px] font-bold text-[var(--ink-faint)] uppercase">
                        {headers.map((h) => (
                          <th key={h} className="text-left px-3 py-2 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, ri) => (
                        <tr key={ri} className="border-t border-[var(--line-subtle)]">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-2 text-[var(--ink-soft)] whitespace-nowrap max-w-[200px] truncate">
                              {cell}
                            </td>
                          ))}
                          {row.length < headers.length &&
                            Array.from({ length: headers.length - row.length }).map((_, ci) => (
                              <td key={`empty-${ci}`} className="px-3 py-2 text-[var(--ink-faint)]">
                                -
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Result */}
              {result && (
                <div
                  className={`rounded-lg px-4 py-3 ${
                    result.errors.length === 0
                      ? "bg-[var(--green-bg)] border border-[var(--green)]/20 text-[var(--green)]"
                      : result.imported > 0
                      ? "bg-[var(--amber-light)] border border-[var(--amber)]/20 text-[var(--amber-deep)]"
                      : "bg-[var(--red-bg)] border border-[var(--red)]/20 text-[var(--red)]"
                  }`}
                >
                  <p className="text-[13px] font-bold">
                    {result.imported > 0
                      ? `Successfully imported ${result.imported} materials`
                      : result.errors.length > 0
                      ? "Import failed"
                      : "Nothing to import"}
                    .
                  </p>
                  {result.errors.length > 0 && (
                    <ul className="text-[12px] mt-1 space-y-0.5">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>...and {result.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--line)]">
          {result && result.imported > 0 ? (
            <button onClick={onImported} className="btn-primary" style={{ width: "auto", padding: "12px 24px", fontSize: "14px" }}>
              <Check size={15} strokeWidth={2.5} />
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} className="btn-secondary" style={{ width: "auto" }}>
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="btn-primary"
                style={{ width: "auto", padding: "12px 24px", fontSize: "14px" }}
              >
                {importing ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={15} strokeWidth={2.5} />
                    Import materials
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
