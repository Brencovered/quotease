"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  AlertCircle,
  Loader2,
  Tag,
  Percent,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { PricingTier } from "./shared";
import { formatCurrency, calcSellPrice } from "./shared";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PricingTiersViewProps {
  tiers: PricingTier[];
  loading: boolean;
  onTiersChanged: () => void;
}

const EXAMPLE_COST = 12;

/* ================================================================== */
/*  VIEW                                                               */
/* ================================================================== */

export default function PricingTiersView({ tiers, loading, onTiersChanged }: PricingTiersViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formMarkup, setFormMarkup] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function openCreateModal() {
    setEditingId(null);
    setFormName("");
    setFormMarkup(40);
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(tier: PricingTier) {
    setEditingId(tier.id);
    setFormName(tier.name);
    setFormMarkup(tier.markup_pct);
    setFormError("");
    setModalOpen(true);
    setOpenMenuId(null);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormError("");
  }

  async function handleSave() {
    setFormError("");

    if (!formName.trim()) {
      setFormError("Please enter a tier name.");
      return;
    }

    if (formMarkup < -20 || formMarkup > 100) {
      setFormError("Markup must be between -20% and +100%.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const res = await fetch("/api/pricing-tiers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            name: formName.trim(),
            markup_pct: formMarkup,
          }),
        });
        if (!res.ok) throw new Error("Failed to update tier");
      } else {
        const res = await fetch("/api/pricing-tiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            markup_pct: formMarkup,
            sort_order: tiers.length,
          }),
        });
        if (!res.ok) throw new Error("Failed to create tier");
      }

      await onTiersChanged();
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
      const res = await fetch(`/api/pricing-tiers?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tier");
      await onTiersChanged();
    } catch (err: unknown) {
      console.error("Delete error:", err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Customer Pricing Tiers</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
            Set markup percentages by customer type. Applied to material costs when quoting.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary shrink-0"
          style={{ width: "auto", padding: "12px 20px", fontSize: "14px" }}
        >
          <Plus size={16} strokeWidth={2.5} />
          New tier
        </button>
      </div>

      {/* Stats */}
      {tiers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--amber-light)] flex items-center justify-center shrink-0">
              <Tag size={18} className="text-[var(--amber-deep)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{tiers.length}</div>
              <div className="text-[12px] text-[var(--ink-faint)]">Pricing tiers</div>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--green-bg)] flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-[var(--green)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">
                {formatCurrency(calcSellPrice(EXAMPLE_COST, tiers[0]?.markup_pct ?? 0))}
              </div>
              <div className="text-[12px] text-[var(--ink-faint)]">
                Example: ${EXAMPLE_COST} at {tiers[0]?.name ?? "default"}
              </div>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--blue-bg)] flex items-center justify-center shrink-0">
              <Percent size={18} className="text-[var(--blue)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">
                {tiers.reduce((sum, t) => sum + t.markup_pct, 0) / (tiers.length || 1)}%
              </div>
              <div className="text-[12px] text-[var(--ink-faint)]">Average markup</div>
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
      {!loading && tiers.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--line-subtle)] flex items-center justify-center mb-4">
            <Tag size={28} className="text-[var(--ink-faint)]" />
          </div>
          <h3 className="font-display text-[20px] text-[var(--ink)] mb-1">No pricing tiers yet</h3>
          <p className="text-[13px] text-[var(--ink-faint)] max-w-sm mb-6">
            Create tiers like &quot;Residential&quot;, &quot;Contracting&quot;, or &quot;Commercial&quot; with different markup percentages.
          </p>
          <button
            onClick={openCreateModal}
            className="btn-primary"
            style={{ width: "auto", padding: "12px 24px", fontSize: "14px" }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Create first tier
          </button>
        </div>
      )}

      {/* Tier cards grid */}
      {!loading && tiers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiers.map((tier, i) => {
            const isPositive = tier.markup_pct > 0;
            const badgeColor = isPositive ? "var(--green)" : "var(--red)";
            const badgeBg = isPositive ? "var(--green-bg)" : "var(--red-bg)";
            const exampleSell = calcSellPrice(EXAMPLE_COST, tier.markup_pct);

            return (
              <div
                key={tier.id}
                className="card reveal"
                style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold text-[var(--ink)] truncate">{tier.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="pill"
                        style={{ backgroundColor: badgeBg, color: badgeColor }}
                      >
                        {isPositive ? (
                          <TrendingUp size={11} strokeWidth={2.5} />
                        ) : (
                          <TrendingDown size={11} strokeWidth={2.5} />
                        )}
                        {tier.markup_pct > 0 ? "+" : ""}
                        {tier.markup_pct}% markup
                      </span>
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === tier.id ? null : tier.id)}
                      className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors"
                      aria-label="More options"
                    >
                      <Pencil size={14} className="text-[var(--ink-faint)]" />
                    </button>
                    {openMenuId === tier.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden w-40">
                          <button
                            onClick={() => openEditModal(tier)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)] border-b border-[var(--line)] w-full text-left hover:bg-[var(--app-bg)] transition-colors"
                          >
                            <Pencil size={14} className="text-[var(--ink-faint)]" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(tier.id)}
                            disabled={deletingId === tier.id}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--red)] w-full text-left hover:bg-[var(--red-bg)] transition-colors"
                          >
                            {deletingId === tier.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[var(--line-subtle)]">
                  <p className="text-[11px] text-[var(--ink-faint)] mb-1">Example sell price</p>
                  <p className="text-[18px] font-bold text-[var(--green)] tabular">
                    {formatCurrency(exampleSell)}
                  </p>
                  <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">
                    ${EXAMPLE_COST} cost + {tier.markup_pct}% markup
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 pt-8 sm:pt-24">
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl w-full max-w-lg border border-[var(--line)] mb-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
              <h2 className="font-display text-[20px] text-[var(--ink)]">
                {editingId ? "Edit Pricing Tier" : "New Pricing Tier"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors"
                aria-label="Close"
              >
                <X size={18} className="text-[var(--ink-faint)]" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {formError && (
                <div className="flex items-start gap-2 bg-[var(--red-bg)] border border-[var(--red)]/20 rounded-lg px-3 py-2.5 text-[13px] text-[var(--red)]">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">
                  Tier name <span className="text-[var(--red)]">*</span>
                </label>
                <input
                  type="text"
                  className="app-field"
                  placeholder="e.g. Residential"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">
                  Markup percentage <span className="text-[var(--red)]">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={-20}
                    max={100}
                    value={formMarkup}
                    onChange={(e) => setFormMarkup(Number(e.target.value))}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1">
                    <Percent size={14} className="text-[var(--ink-faint)]" />
                    <span
                      className={`text-[18px] font-bold tabular w-12 text-right ${
                        formMarkup >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                      }`}
                    >
                      {formMarkup > 0 ? "+" : ""}
                      {formMarkup}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--ink-faint)] mt-1">
                  Range: -20% to +100%. A {formMarkup}% markup turns ${EXAMPLE_COST} into{" "}
                  {formatCurrency(calcSellPrice(EXAMPLE_COST, formMarkup))}.
                </p>
              </div>

              {/* Quick presets */}
              <div>
                <p className="text-[11px] font-bold text-[var(--ink-soft)] mb-2">Quick presets</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Wholesale", value: 10 },
                    { label: "Residential", value: 40 },
                    { label: "Commercial", value: 25 },
                    { label: "Premium", value: 60 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setFormMarkup(preset.value)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
                        formMarkup === preset.value
                          ? "border-[var(--amber)] bg-[var(--amber-light)] text-[var(--amber-deep)]"
                          : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink-faint)]"
                      }`}
                    >
                      {preset.label} ({preset.value}%)
                    </button>
                  ))}
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
                    {editingId ? "Save changes" : "Create tier"}
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
