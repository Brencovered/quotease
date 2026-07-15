"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  MoreVertical,
  Box,
  Loader2,
  X,
  AlertCircle,
  ChevronRight,
  ShoppingCart,
  Package,
} from "lucide-react";
import type { MaterialBundle, BundleItem } from "./shared";
import { TRADE_COLORS, TRADES, formatCurrency } from "./shared";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EMPTY_ITEM: BundleItem = {
  id: "",
  bundle_id: "",
  label: "",
  qty: 1,
  unit: "each",
  unit_cost: 0,
  sort_order: 0,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function calcBundleTotal(items: BundleItem[]): number {
  return +items.reduce((sum, it) => sum + it.qty * it.unit_cost, 0).toFixed(2);
}

/* ================================================================== */
/*  VIEW                                                               */
/* ================================================================== */

interface MaterialBundlesViewProps {
  bundles: MaterialBundle[];
  loading: boolean;
  businessId: string | null;
  onBundlesChanged: () => void;
}

export default function MaterialBundlesView({
  bundles,
  loading,
  businessId,
  onBundlesChanged,
}: MaterialBundlesViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formTrade, setFormTrade] = useState("electrician");
  const [formDescription, setFormDescription] = useState("");
  const [formItems, setFormItems] = useState<BundleItem[]>([{ ...EMPTY_ITEM, sort_order: 0 }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function openCreateModal() {
    setEditingId(null);
    setFormTitle("");
    setFormTrade("electrician");
    setFormDescription("");
    setFormItems([{ ...EMPTY_ITEM, sort_order: 0 }]);
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(bundle: MaterialBundle) {
    setEditingId(bundle.id);
    setFormTitle(bundle.title);
    setFormTrade(bundle.trade);
    setFormDescription(bundle.description ?? "");
    setFormItems(
      bundle.items.length > 0
        ? bundle.items.map((it, i) => ({ ...it, sort_order: i }))
        : [{ ...EMPTY_ITEM, sort_order: 0 }]
    );
    setFormError("");
    setModalOpen(true);
    setOpenMenuId(null);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormError("");
  }

  function addItemRow() {
    setFormItems((prev) => [...prev, { ...EMPTY_ITEM, sort_order: prev.length }]);
  }

  function updateItemRow(index: number, updates: Partial<BundleItem>) {
    setFormItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  }

  function removeItemRow(index: number) {
    setFormItems((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      if (filtered.length === 0) return [{ ...EMPTY_ITEM, sort_order: 0 }];
      return filtered.map((item, i) => ({ ...item, sort_order: i }));
    });
  }

  async function handleSave() {
    if (!businessId) return;
    setFormError("");

    if (!formTitle.trim()) {
      setFormError("Please enter a bundle title.");
      return;
    }

    const validItems = formItems.filter((item) => item.label.trim() && item.qty > 0 && item.unit_cost >= 0);

    setSaving(true);

    try {
      if (editingId) {
        const res = await fetch("/api/material-bundles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            title: formTitle.trim(),
            trade: formTrade,
            description: formDescription.trim() || null,
            items: validItems.map((item) => ({
              label: item.label.trim(),
              qty: item.qty,
              unit: item.unit,
              unit_cost: item.unit_cost,
            })),
          }),
        });
        if (!res.ok) throw new Error("Failed to update bundle");
      } else {
        const res = await fetch("/api/material-bundles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            trade: formTrade,
            description: formDescription.trim() || null,
            items: validItems.map((item) => ({
              label: item.label.trim(),
              qty: item.qty,
              unit: item.unit,
              unit_cost: item.unit_cost,
            })),
          }),
        });
        if (!res.ok) throw new Error("Failed to create bundle");
      }

      await onBundlesChanged();
      closeModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setOpenMenuId(null);

    try {
      const res = await fetch(`/api/material-bundles?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete bundle");
      await onBundlesChanged();
    } catch (err: unknown) {
      console.error("Delete error:", err);
    } finally {
      setDeletingId(null);
    }
  }

  const formRunningTotal = calcBundleTotal(formItems);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Material Bundles</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
            Pre-built material lists for common jobs. Use them to quickly populate quotes.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary shrink-0"
          style={{ width: "auto", padding: "12px 20px", fontSize: "14px" }}
        >
          <Plus size={16} strokeWidth={2.5} />
          New bundle
        </button>
      </div>

      {/* Stats */}
      {bundles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--amber-light)] flex items-center justify-center shrink-0">
              <Package size={18} className="text-[var(--amber-deep)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{bundles.length}</div>
              <div className="text-[12px] text-[var(--ink-faint)]">Total bundles</div>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--blue-bg)] flex items-center justify-center shrink-0">
              <Box size={18} className="text-[var(--blue)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">
                {bundles.reduce((sum, b) => sum + b.items.length, 0)}
              </div>
              <div className="text-[12px] text-[var(--ink-faint)]">Total items</div>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--green-bg)] flex items-center justify-center shrink-0">
              <ShoppingCart size={18} className="text-[var(--green)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">
                {formatCurrency(bundles.reduce((sum, b) => sum + calcBundleTotal(b.items), 0))}
              </div>
              <div className="text-[12px] text-[var(--ink-faint)]">Combined value</div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[var(--amber)]" />
        </div>
      )}

      {/* Empty */}
      {!loading && bundles.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--line-subtle)] flex items-center justify-center mb-4">
            <Package size={28} className="text-[var(--ink-faint)]" />
          </div>
          <h3 className="font-display text-[20px] text-[var(--ink)] mb-1">No bundles yet</h3>
          <p className="text-[13px] text-[var(--ink-faint)] max-w-sm mb-6">
            Material bundles are pre-built lists of materials. Create one for common jobs, then use it to populate quotes instantly.
          </p>
          <button
            onClick={openCreateModal}
            className="btn-primary"
            style={{ width: "auto", padding: "12px 24px", fontSize: "14px" }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Create first bundle
          </button>
        </div>
      )}

      {/* Bundles grid */}
      {!loading && bundles.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bundles.map((bundle) => {
            const items = bundle.items;
            const itemCount = items.length;
            const estimatedTotal = calcBundleTotal(items);
            const tradeColor = TRADE_COLORS[bundle.trade] ?? TRADE_COLORS.handyman;

            return (
              <div
                key={bundle.id}
                className="card flex flex-col gap-3 reveal"
                style={{ animationDelay: `${Math.min(bundles.indexOf(bundle) * 0.05, 0.3)}s` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[15px] font-bold text-[var(--ink)] truncate">{bundle.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="pill"
                        style={{ backgroundColor: tradeColor + "18", color: tradeColor }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tradeColor }} />
                        {bundle.trade}
                      </span>
                      <span className="text-[11px] text-[var(--ink-faint)]">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === bundle.id ? null : bundle.id)}
                      className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors"
                      aria-label="More options"
                    >
                      <MoreVertical size={16} className="text-[var(--ink-faint)]" />
                    </button>
                    {openMenuId === bundle.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden w-40">
                          <button
                            onClick={() => openEditModal(bundle)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)] border-b border-[var(--line)] w-full text-left hover:bg-[var(--app-bg)] transition-colors"
                          >
                            <Pencil size={14} className="text-[var(--ink-faint)]" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(bundle.id)}
                            disabled={deletingId === bundle.id}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--red)] w-full text-left hover:bg-[var(--red-bg)] transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            {deletingId === bundle.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {bundle.description && (
                  <p className="text-[12px] text-[var(--ink-soft)] leading-relaxed line-clamp-2">{bundle.description}</p>
                )}

                {itemCount > 0 && (
                  <div className="bg-[var(--app-bg)] rounded-lg px-3 py-2.5 space-y-1">
                    {items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[12px]">
                        <span className="text-[var(--ink-soft)] truncate flex-1 mr-2">
                          {item.qty}x {item.label}
                        </span>
                        <span className="text-[var(--ink)] font-semibold tabular shrink-0">
                          {formatCurrency(+(item.qty * item.unit_cost).toFixed(2))}
                        </span>
                      </div>
                    ))}
                    {itemCount > 3 && (
                      <div className="text-[11px] text-[var(--ink-faint)] pt-0.5">+{itemCount - 3} more items</div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
                    <ShoppingCart size={12} />
                    Est. {formatCurrency(estimatedTotal)}
                  </div>
                  <a
                    href={`/quote?bundle_id=${bundle.id}`}
                    className="btn-secondary shrink-0"
                    style={{ padding: "8px 14px", fontSize: "12px" }}
                  >
                    Use in quote
                    <ChevronRight size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Bundle Modal ---- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 pt-8 sm:pt-16">
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl w-full max-w-2xl border border-[var(--line)] mb-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
              <h2 className="font-display text-[20px] text-[var(--ink)]">
                {editingId ? "Edit Bundle" : "New Bundle"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors"
                aria-label="Close"
              >
                <X size={18} className="text-[var(--ink-faint)]" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="flex items-start gap-2 bg-[var(--red-bg)] border border-[var(--red)]/20 rounded-lg px-3 py-2.5 text-[13px] text-[var(--red)]">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Title</label>
                <input
                  type="text"
                  className="app-field"
                  placeholder="e.g. Standard LED Downlight Kit"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Trade</label>
                  <select className="app-field" value={formTrade} onChange={(e) => setFormTrade(e.target.value)}>
                    {TRADES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Description</label>
                <textarea
                  className="app-field"
                  rows={2}
                  placeholder="Brief description of this bundle..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="section-tag">Items</label>
                  <button
                    onClick={addItemRow}
                    className="flex items-center gap-1 text-[12px] font-bold text-[var(--amber-deep)] hover:text-[var(--navy)] transition-colors"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    Add item
                  </button>
                </div>

                <div className="border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="hidden sm:grid sm:grid-cols-[1fr_80px_90px_100px_40px] gap-2 bg-[var(--app-bg)] px-3 py-2 text-[10px] font-bold text-[var(--ink-faint)] uppercase tracking-wider">
                    <span>Item</span>
                    <span className="text-center">Qty</span>
                    <span className="text-center">Unit</span>
                    <span className="text-right">Unit Cost</span>
                    <span />
                  </div>

                  {formItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_80px_90px_100px_40px] gap-2 px-3 py-2 border-t border-[var(--line-subtle)] items-center"
                    >
                      <input
                        type="text"
                        className="app-field"
                        placeholder="Item name"
                        value={item.label}
                        onChange={(e) => updateItemRow(idx, { label: e.target.value })}
                        style={{ padding: "8px 10px", fontSize: "13px" }}
                      />
                      <input
                        type="number"
                        className="app-field text-center"
                        placeholder="Qty"
                        min={0}
                        step={1}
                        value={item.qty || ""}
                        onChange={(e) => updateItemRow(idx, { qty: parseFloat(e.target.value) || 0 })}
                        style={{ padding: "8px 10px", fontSize: "13px" }}
                      />
                      <select
                        className="app-field text-center"
                        value={item.unit}
                        onChange={(e) => updateItemRow(idx, { unit: e.target.value })}
                        style={{ padding: "8px 10px", fontSize: "13px" }}
                      >
                        <option value="each">each</option>
                        <option value="m">m</option>
                        <option value="m2">m2</option>
                        <option value="m3">m3</option>
                        <option value="hr">hr</option>
                        <option value="kg">kg</option>
                        <option value="box">box</option>
                        <option value="roll">roll</option>
                        <option value="set">set</option>
                        <option value="lot">lot</option>
                      </select>
                      <input
                        type="number"
                        className="app-field text-right"
                        placeholder="$"
                        min={0}
                        step={0.01}
                        value={item.unit_cost || ""}
                        onChange={(e) => updateItemRow(idx, { unit_cost: parseFloat(e.target.value) || 0 })}
                        style={{ padding: "8px 10px", fontSize: "13px" }}
                      />
                      <button
                        onClick={() => removeItemRow(idx)}
                        className="flex items-center justify-center p-1.5 rounded-lg hover:bg-[var(--red-bg)] transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 size={14} className="text-[var(--ink-faint)] hover:text-[var(--red)]" />
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--amber-light)] border-t border-[var(--line-subtle)]">
                    <span className="text-[11px] font-bold text-[var(--ink-soft)]">Running Total</span>
                    <span className="text-[14px] font-extrabold text-[var(--ink)] tabular">
                      {formatCurrency(formRunningTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--line)]">
              <button onClick={closeModal} className="btn-secondary" style={{ width: "auto" }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
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
                    <Plus size={15} strokeWidth={2.5} />
                    {editingId ? "Save changes" : "Create bundle"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
