"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  AlertCircle,
  Loader2,
  CalendarDays,
  Clock,
  Layers,
} from "lucide-react";
import type { JobSizeTier } from "./shared";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface JobSizeTiersViewProps {
  tiers: JobSizeTier[];
  loading: boolean;
  onTiersChanged: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getDayRangeLabel(tier: JobSizeTier, allTiers: JobSizeTier[]): string {
  if (tier.max_days === null) return "Over " + getPrevMaxDays(tier, allTiers) + " days";
  if (getPrevMaxDays(tier, allTiers) === 0) return `Up to ${tier.max_days} day${tier.max_days !== 1 ? "s" : ""}`;
  return `${getPrevMaxDays(tier, allTiers) + 1} - ${tier.max_days} day${tier.max_days !== 1 ? "s" : ""}`;
}

function getPrevMaxDays(tier: JobSizeTier, allTiers: JobSizeTier[]): number {
  const sorted = [...allTiers].sort((a, b) => (a.max_days ?? Infinity) - (b.max_days ?? Infinity));
  const idx = sorted.findIndex((t) => t.id === tier.id);
  if (idx <= 0) return 0;
  return sorted[idx - 1].max_days ?? 0;
}

/* ================================================================== */
/*  VIEW                                                               */
/* ================================================================== */

export default function JobSizeTiersView({ tiers, loading, onTiersChanged }: JobSizeTiersViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formMaxDays, setFormMaxDays] = useState<string>("");
  const [formMarkup, setFormMarkup] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function openCreateModal() {
    setEditingId(null);
    setFormName("");
    setFormMaxDays("");
    setFormMarkup(0);
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(tier: JobSizeTier) {
    setEditingId(tier.id);
    setFormName(tier.name);
    setFormMaxDays(tier.max_days === null ? "" : String(tier.max_days));
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
      const payload = {
        name: formName.trim(),
        markup_pct: formMarkup,
        max_days: formMaxDays === "" ? null : parseFloat(formMaxDays),
      };

      if (editingId) {
        const res = await fetch("/api/job-size-tiers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: editingId }),
        });
        if (!res.ok) throw new Error("Failed to update tier");
      } else {
        const res = await fetch("/api/job-size-tiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, sort_order: tiers.length }),
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
      const res = await fetch(`/api/job-size-tiers?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tier");
      await onTiersChanged();
    } catch (err: unknown) {
      console.error("Delete error:", err);
    } finally {
      setDeletingId(null);
    }
  }

  /* --- Visual bar: sort by max_days (null = last) --- */
  const sortedForBar = [...tiers].sort(
    (a, b) => (a.max_days ?? Infinity) - (b.max_days ?? Infinity)
  );
  const maxMaxDays = Math.max(...tiers.map((t) => t.max_days ?? 0), 1);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Job Size Tiers</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
            Adjust markup by job size. Smaller jobs can carry a premium, larger jobs a discount.
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
              <Layers size={18} className="text-[var(--amber-deep)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{tiers.length}</div>
              <div className="text-[12px] text-[var(--ink-faint)]">Job size tiers</div>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--blue-bg)] flex items-center justify-center shrink-0">
              <CalendarDays size={18} className="text-[var(--blue)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">
                {tiers.filter((t) => t.max_days !== null).length}
              </div>
              <div className="text-[12px] text-[var(--ink-faint)]">With day limit</div>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--green-bg)] flex items-center justify-center shrink-0">
              <Clock size={18} className="text-[var(--green)]" />
            </div>
            <div>
              <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">
                {tiers.filter((t) => t.max_days === null).length}
              </div>
              <div className="text-[12px] text-[var(--ink-faint)]">Open-ended tiers</div>
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
            <Layers size={28} className="text-[var(--ink-faint)]" />
          </div>
          <h3 className="font-display text-[20px] text-[var(--ink)] mb-1">No job size tiers yet</h3>
          <p className="text-[13px] text-[var(--ink-faint)] max-w-sm mb-6">
            Create tiers like &quot;Small Job&quot; (up to 1 day) or &quot;Large Job&quot; (over 3 days) to adjust pricing by scope.
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

      {/* Visual bar */}
      {!loading && sortedForBar.length > 0 && (
        <div className="card mb-6">
          <p className="section-tag mb-3">Size Brackets</p>
          <div className="flex h-10 rounded-xl overflow-hidden">
            {sortedForBar.map((tier, i) => {
              const widthPct = tier.max_days === null
                ? Math.max(100 / sortedForBar.length, 20)
                : Math.max(((tier.max_days ?? 0) / maxMaxDays) * 100, 15);
              const isPositive = tier.markup_pct >= 0;
              return (
                <div
                  key={tier.id}
                  className="flex items-center justify-center text-[11px] font-bold text-white relative group cursor-default transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: isPositive
                      ? `hsl(${140 + i * 10}, 60%, ${45 - i * 5}%)`
                      : `hsl(${0 + i * 10}, 70%, ${55 + i * 5}%)`,
                    minWidth: "60px",
                  }}
                  title={`${tier.name}: ${tier.markup_pct > 0 ? "+" : ""}${tier.markup_pct}%`}
                >
                  <span className="truncate px-1">{tier.name}</span>
                  <span className="ml-1 opacity-75">({tier.markup_pct > 0 ? "+" : ""}{tier.markup_pct}%)</span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--ink-faint)] mt-2">
            Visual representation of job size brackets and their markups.
          </p>
        </div>
      )}

      {/* Tier cards */}
      {!loading && tiers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiers.map((tier, i) => {
            const isPositive = tier.markup_pct > 0;
            const badgeColor = isPositive ? "var(--green)" : "var(--red)";
            const badgeBg = isPositive ? "var(--green-bg)" : "var(--red-bg)";
            const dayLabel = getDayRangeLabel(tier, tiers);

            return (
              <div
                key={tier.id}
                className="card reveal"
                style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold text-[var(--ink)] truncate">{tier.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span
                        className="pill"
                        style={{ backgroundColor: badgeBg, color: badgeColor }}
                      >
                        {isPositive ? "+" : ""}
                        {tier.markup_pct}% markup
                      </span>
                      <span className="pill bg-[var(--blue-bg)] text-[var(--blue)]">
                        <CalendarDays size={11} strokeWidth={2.5} />
                        {dayLabel}
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
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[var(--ink-faint)]" />
                    <span className="text-[13px] text-[var(--ink-soft)]">{dayLabel}</span>
                  </div>
                  {tier.max_days !== null && (
                    <p className="text-[11px] text-[var(--ink-faint)] mt-1">
                      Jobs up to {tier.max_days} day{tier.max_days !== 1 ? "s" : ""} get a {isPositive ? "+" : ""}
                      {tier.markup_pct}% markup.
                    </p>
                  )}
                  {tier.max_days === null && (
                    <p className="text-[11px] text-[var(--ink-faint)] mt-1">
                      Open-ended tier for the largest jobs.
                    </p>
                  )}
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
                {editingId ? "Edit Job Size Tier" : "New Job Size Tier"}
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
                  placeholder="e.g. Small Job"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">
                  Max days (optional)
                </label>
                <input
                  type="number"
                  className="app-field"
                  placeholder="Leave empty for open-ended"
                  min={0}
                  value={formMaxDays}
                  onChange={(e) => setFormMaxDays(e.target.value)}
                />
                <p className="text-[11px] text-[var(--ink-faint)] mt-1">
                  Leave empty for the largest tier (open-ended). Jobs exceeding this duration fall into the next tier.
                </p>
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
                  <span
                    className={`text-[18px] font-bold tabular w-12 text-right ${
                      formMarkup >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                    }`}
                  >
                    {formMarkup > 0 ? "+" : ""}
                    {formMarkup}%
                  </span>
                </div>
              </div>

              {/* Quick presets */}
              <div>
                <p className="text-[11px] font-bold text-[var(--ink-soft)] mb-2">Quick presets</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Small job", value: 15 },
                    { label: "Medium job", value: 5 },
                    { label: "Large job", value: -5 },
                    { label: "XL job", value: -10 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setFormMarkup(preset.value);
                        if (preset.label === "Small job") setFormMaxDays("1");
                        if (preset.label === "Medium job") setFormMaxDays("3");
                        if (preset.label === "Large job") setFormMaxDays("7");
                        if (preset.label === "XL job") setFormMaxDays("");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
                        formMarkup === preset.value
                          ? "border-[var(--amber)] bg-[var(--amber-light)] text-[var(--amber-deep)]"
                          : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink-faint)]"
                      }`}
                    >
                      {preset.label}
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
