"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Pencil,
  MoreVertical,
  Box,
  Loader2,
  X,
  AlertCircle,
  Package,
  Clock,
  DollarSign,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Pkg, PackageItem, PackageRow } from "./shared";
import { TRADE_COLORS, TRADES, formatCurrency, calcItemTotal, calcPackageTotal } from "./shared";
import AIPackageAssistant from "./AIPackageAssistant";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EMPTY_ITEM: PackageItem = {
  label: "",
  qty: 1,
  unit: "each",
  unit_cost: 0,
  sort_order: 0,
};

/* ================================================================== */
/*  TAB 3: PACKAGES                                                    */
/* ================================================================== */

interface PackagesTabProps {
  packages: Pkg[];
  loading: boolean;
  businessId: string | null;
  hourlyRate: number;
  supabase: ReturnType<typeof createClient>;
  onPackagesChanged: (bid: string) => void;
}

export default function PackagesView({
  packages,
  loading,
  businessId,
  hourlyRate,
  supabase,
  onPackagesChanged,
}: PackagesTabProps) {
  const [priceBook, setPriceBook] = useState<{ item_key: string; label: string; unit_cost: number }[]>([]);

  // Load price book on mount
  useEffect(() => {
    if (!businessId) return;
    supabase
      .from("price_book_items")
      .select("sku, description, cost_price")
      .eq("profile_id", businessId)
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load price book:", error);
          return;
        }
        if (data && data.length > 0) {
          setPriceBook(
            data.map((row) => ({
              item_key: row.sku ?? row.description,
              label: row.description,
              unit_cost: row.cost_price ?? 0,
            }))
          );
        }
      });
  }, [businessId, supabase]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formTrade, setFormTrade] = useState("electrician");
  const [formDescription, setFormDescription] = useState("");
  const [formLabourHours, setFormLabourHours] = useState(0);
  const [formItems, setFormItems] = useState<PackageItem[]>([{ ...EMPTY_ITEM, sort_order: 0 }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const mostUsedPackage =
    packages.length > 0
      ? packages.reduce((prev, curr) => ((curr.use_count ?? 0) > (prev.use_count ?? 0) ? curr : prev))
      : null;

  function openCreateModal() {
    setEditingId(null);
    setFormTitle("");
    setFormTrade("electrician");
    setFormDescription("");
    setFormLabourHours(0);
    setFormItems([{ ...EMPTY_ITEM, sort_order: 0 }]);
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(pkg: Pkg) {
    setEditingId(pkg.id);
    setFormTitle(pkg.title);
    setFormTrade(pkg.trade);
    setFormDescription(pkg.description ?? "");
    setFormLabourHours(pkg.labour_hours ?? 0);
    setFormItems(
      (pkg.package_items ?? []).length > 0
        ? pkg.package_items!.map((it, i) => ({ ...it, sort_order: i }))
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

  function updateItemRow(index: number, updates: Partial<PackageItem>) {
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
      setFormError("Please enter a package title.");
      return;
    }

    const validItems = formItems.filter((item) => item.label.trim() && item.qty > 0 && item.unit_cost >= 0);

    setSaving(true);

    try {
      if (editingId) {
        const { error: pkgError } = await supabase
          .from("packages")
          .update({
            title: formTitle.trim(),
            trade: formTrade,
            description: formDescription.trim() || null,
            labour_hours: formLabourHours || null,
          })
          .eq("id", editingId)
          .eq("profile_id", businessId);

        if (pkgError) throw pkgError;

        await supabase.from("package_items").delete().eq("package_id", editingId);

        if (validItems.length > 0) {
          const { error: itemsError } = await supabase.from("package_items").insert(
            validItems.map((item, i) => ({
              package_id: editingId,
              label: item.label.trim(),
              qty: item.qty,
              unit: item.unit,
              unit_cost: item.unit_cost,
              sort_order: i,
            }))
          );
          if (itemsError) throw itemsError;
        }
      } else {
        const { data: pkg, error: pkgError } = await supabase
          .from("packages")
          .insert({
            profile_id: businessId,
            title: formTitle.trim(),
            trade: formTrade,
            description: formDescription.trim() || null,
            labour_hours: formLabourHours || null,
            status: "active",
          })
          .select()
          .single();

        if (pkgError || !pkg) throw pkgError ?? new Error("Failed to create package");

        if (validItems.length > 0) {
          const { error: itemsError } = await supabase.from("package_items").insert(
            validItems.map((item, i) => ({
              package_id: pkg.id,
              label: item.label.trim(),
              qty: item.qty,
              unit: item.unit,
              unit_cost: item.unit_cost,
              sort_order: i,
            }))
          );
          if (itemsError) throw itemsError;
        }
      }

      await onPackagesChanged(businessId);
      closeModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pkgId: string) {
    if (!businessId) return;
    setDeletingId(pkgId);
    setOpenMenuId(null);

    const { error } = await supabase
      .from("packages")
      .update({ status: "deleted" })
      .eq("id", pkgId)
      .eq("profile_id", businessId);

    if (error) {
      console.error("Error deleting package:", error);
    }

    setDeletingId(null);
    await onPackagesChanged(businessId);
  }

  const formRunningTotal = calcPackageTotal(formItems, formLabourHours, hourlyRate);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Packages</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
            Create reusable quote templates. Use them to start quotes faster.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary shrink-0" style={{ width: "auto", padding: "12px 20px", fontSize: "14px" }}>
          <Plus size={16} strokeWidth={2.5} />
          New package
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <AIPackageAssistant
          trade={formTrade}
          hourlyRate={hourlyRate}
          priceBook={priceBook}
          onCreatePackage={async (suggested) => {
            if (!businessId) return;
            // Save suggested package to Supabase
            const { data: pkg, error: pkgErr } = await supabase.from("packages").insert({
              profile_id:   businessId,
              title:        suggested.title,
              trade:        suggested.trade,
              description:  suggested.description,
              labour_hours: suggested.labour_hrs,
              status:       "active",
            }).select().single();
            if (pkgErr) { console.error("Package save error:", pkgErr); return; }
            if (pkg) {
              // Add items
              await supabase.from("package_items").insert(
                suggested.items.map((item, i) => ({
                  package_id: pkg.id,
                  label:      item.label,
                  qty:        item.qty,
                  unit:       item.unit,
                  unit_cost:  item.unit_cost,
                  sort_order: i,
                }))
              );
              onPackagesChanged(businessId);
            }
          }}
        />
      </div>

      {packages.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--amber-light)] flex items-center justify-center shrink-0">
              <Box size={18} className="text-[var(--amber-deep)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{packages.length}</div>
              <div className="text-[12px] text-[var(--ink-faint)]">Total packages</div>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--blue-bg)] flex items-center justify-center shrink-0">
              <Package size={18} className="text-[var(--blue)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-[var(--ink)] leading-tight truncate">
                {mostUsedPackage?.title ?? "-"}
              </div>
              <div className="text-[12px] text-[var(--ink-faint)]">Most used package</div>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--green-bg)] flex items-center justify-center shrink-0">
              <Lightbulb size={18} className="text-[var(--green)]" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-[var(--ink)] leading-tight">Save 5-10 min</div>
              <div className="text-[12px] text-[var(--ink-faint)]">per quote with packages</div>
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
      {!loading && packages.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--line-subtle)] flex items-center justify-center mb-4">
            <Package size={28} className="text-[var(--ink-faint)]" />
          </div>
          <h3 className="font-display text-[20px] text-[var(--ink)] mb-1">No packages yet</h3>
          <p className="text-[13px] text-[var(--ink-faint)] max-w-sm mb-6">
            Packages are reusable quote templates. Create one with your typical materials and labour, then use it to start quotes in seconds.
          </p>
          <button onClick={openCreateModal} className="btn-primary mb-4" style={{ width: "auto", padding: "12px 24px", fontSize: "14px" }}>
            <Plus size={16} strokeWidth={2.5} />
            Create your first package
          </button>
          <div className="bg-[var(--amber-light)] rounded-lg px-4 py-3 max-w-sm">
            <p className="text-[12px] text-[var(--ink-soft)] leading-relaxed">
              <span className="font-bold">Tip:</span> Try creating a &quot;Standard Bathroom Reno&quot; package with typical items like LED downlights, power points, and exhaust fan circuit.
            </p>
          </div>
        </div>
      )}

      {/* Packages grid */}
      {!loading && packages.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {packages.map((pkg) => {
            const items = pkg.package_items ?? [];
            const itemCount = items.length;
            const labourHours = pkg.labour_hours ?? 0;
            const estimatedTotal = calcPackageTotal(items, labourHours, hourlyRate);
            const tradeColor = TRADE_COLORS[pkg.trade] ?? TRADE_COLORS.handyman;

            return (
              <div
                key={pkg.id}
                className="card flex flex-col gap-3 reveal"
                style={{ animationDelay: `${Math.min(packages.indexOf(pkg) * 0.05, 0.3)}s` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[15px] font-bold text-[var(--ink)] truncate">{pkg.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="pill"
                        style={{ backgroundColor: tradeColor + "18", color: tradeColor }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tradeColor }} />
                        {pkg.trade}
                      </span>
                      <span className="text-[11px] text-[var(--ink-faint)]">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === pkg.id ? null : pkg.id)}
                      className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors"
                      aria-label="More options"
                    >
                      <MoreVertical size={16} className="text-[var(--ink-faint)]" />
                    </button>
                    {openMenuId === pkg.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden w-40">
                          <button
                            onClick={() => openEditModal(pkg)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)] border-b border-[var(--line)] w-full text-left hover:bg-[var(--app-bg)] transition-colors"
                          >
                            <Pencil size={14} className="text-[var(--ink-faint)]" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(pkg.id)}
                            disabled={deletingId === pkg.id}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--red)] w-full text-left hover:bg-[var(--red-bg)] transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            {deletingId === pkg.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {pkg.description && (
                  <p className="text-[12px] text-[var(--ink-soft)] leading-relaxed line-clamp-2">{pkg.description}</p>
                )}

                {itemCount > 0 && (
                  <div className="bg-[var(--app-bg)] rounded-lg px-3 py-2.5 space-y-1">
                    {items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[12px]">
                        <span className="text-[var(--ink-soft)] truncate flex-1 mr-2">
                          {item.qty}x {item.label}
                        </span>
                        <span className="text-[var(--ink)] font-semibold tabular shrink-0">
                          {formatCurrency(calcItemTotal(item))}
                        </span>
                      </div>
                    ))}
                    {itemCount > 3 && (
                      <div className="text-[11px] text-[var(--ink-faint)] pt-0.5">+{itemCount - 3} more items</div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    {labourHours > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
                        <Clock size={12} />
                        {labourHours} hr{labourHours !== 1 ? "s" : ""}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
                      <DollarSign size={12} />
                      Est. {formatCurrency(estimatedTotal)}
                    </div>
                  </div>
                  <Link
                    href={`/electrician?package_id=${pkg.id}`}
                    className="btn-secondary shrink-0"
                    style={{ padding: "8px 14px", fontSize: "12px" }}
                  >
                    Use this package
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Package Modal ---- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 pt-8 sm:pt-16">
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl w-full max-w-2xl border border-[var(--line)] mb-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
              <h2 className="font-display text-[20px] text-[var(--ink)]">
                {editingId ? "Edit Package" : "New Package"}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors" aria-label="Close">
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
                  placeholder="e.g. Standard Kitchen Reno"
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
                <div>
                  <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Labour Hours</label>
                  <input
                    type="number"
                    className="app-field"
                    placeholder="e.g. 8"
                    min={0}
                    step={0.5}
                    value={formLabourHours || ""}
                    onChange={(e) => setFormLabourHours(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Description</label>
                <textarea
                  className="app-field"
                  rows={2}
                  placeholder="Brief description of this package..."
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
                        step={item.unit === "m" || item.unit === "hr" ? 0.5 : 1}
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
                        <option value="hr">hr</option>
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
                    {editingId ? "Save changes" : "Create package"}
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
