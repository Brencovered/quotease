"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { Plus, CheckCircle2, XCircle, Clock, Search, Minus } from "lucide-react";
import type { Variation } from "@/lib/variations";

const STATUS_STYLE = {
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-green-50 text-green-700",
  declined: "bg-red-50 text-red-700",
};
const STATUS_ICON = { pending: Clock, approved: CheckCircle2, declined: XCircle };

const EMPTY_FORM = { title: "", description: "", labour_hours: "", materials_cost: "" };

type CatalogItem = { item_key: string; label: string; unit_cost: number };

export default function VariationsPanel({ quoteId, jobId, hourlyRate, margin, variations: initial, quoteTotalCost, lib = [] }: {
  quoteId: string | null;
  jobId?: string | null;
  hourlyRate: number;
  margin: number;
  variations: Variation[];
  quoteTotalCost: number;
  /** The business's price book / materials - same array the quote builder
   *  and plan markup already use (price_book_items first, legacy
   *  material_items as fallback). Optional so older callers don't break;
   *  the catalog search just doesn't show anything without it. */
  lib?: CatalogItem[];
}) {
  const [variations, setVariations] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);

  const labourHours = Number(form.labour_hours) || 0;
  const materialsRaw = Number(form.materials_cost) || 0;
  const materialsWithMargin = materialsRaw * (1 + margin / 100);
  const totalCost = labourHours * hourlyRate + materialsWithMargin;

  const approvedTotal = variations.filter((v) => v.status === "approved").reduce((sum, v) => sum + v.total_cost, 0);

  // Debounced-in-effect isn't needed here - filtering an already-loaded
  // in-memory array is instant either way, no network round trip per
  // keystroke like a real catalog API would need.
  const catalogResults = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return lib.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 8);
  }, [catalogQuery, lib]);

  function pickCatalogItem(item: CatalogItem) {
    setForm((f) => ({
      ...f,
      title: f.title.trim() ? f.title : item.label,
      materials_cost: String(Math.round((materialsRaw + item.unit_cost) * 100) / 100),
    }));
    setCatalogQuery("");
    setCatalogOpen(false);
  }

  function stepLabourHours(delta: number) {
    setForm((f) => {
      const next = Math.max(0, (Number(f.labour_hours) || 0) + delta);
      return { ...f, labour_hours: String(Math.round(next * 100) / 100) };
    });
  }

  async function addVariation() {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setError("Not signed in"); setSaving(false); return; }
    const businessId = await getActiveBusinessId(supabase, userData.user.id);
    const { data, error: err } = await supabase
      .from("variations")
      .insert({ quote_id: quoteId || null, job_id: jobId ?? null, profile_id: businessId, title: form.title, description: form.description, labour_hours: labourHours, materials_cost: materialsWithMargin, total_cost: totalCost, status: "pending" })
      .select().single();
    if (err) { setError(err.message); setSaving(false); return; }
    setVariations((prev) => [...prev, data]);
    setShowForm(false);
    setForm(EMPTY_FORM);
    setSaving(false);
  }

  async function updateStatus(id: string, status: "approved" | "declined") {
    const supabase = createClient();
    const patch: Record<string, unknown> = { status };
    if (status === "approved") patch.client_approved_at = new Date().toISOString();
    await supabase.from("variations").update(patch).eq("id", id);
    setVariations((prev) => prev.map((v) => v.id === id ? { ...v, ...patch } : v));
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold">Variations</p>
        <button onClick={() => { setShowForm(true); setError(null); }} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-2.5 py-1">
          <Plus size={12} /> Add variation
        </button>
      </div>
      <p className="font-semibold text-[var(--ink)] mb-1">Scope changes</p>

      {approvedTotal > 0 && (
        <div className="bg-green-50 text-green-800 rounded-lg px-3 py-2 text-[13px] font-semibold mb-3">
          Approved variations add ${approvedTotal.toLocaleString()} - revised job total: ${(quoteTotalCost + approvedTotal).toLocaleString()}
        </div>
      )}

      {showForm && (
        <div className="bg-[var(--app-bg)] rounded-xl p-3 mb-4 space-y-2">
          {lib.length > 0 && (
            <div className="relative">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Search price book</span>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
                <input
                  value={catalogQuery}
                  onChange={(e) => { setCatalogQuery(e.target.value); setCatalogOpen(true); }}
                  onFocus={() => setCatalogOpen(true)}
                  placeholder="Type to find a material or item..."
                  className="app-field pl-8 text-[13px]"
                />
              </div>
              {catalogOpen && catalogQuery.trim().length >= 2 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  {catalogResults.length === 0 ? (
                    <p className="text-[12px] text-[var(--ink-faint)] px-3 py-2.5">No matches in your price book.</p>
                  ) : (
                    catalogResults.map((m) => (
                      <button
                        key={m.item_key}
                        type="button"
                        onClick={() => pickCatalogItem(m)}
                        className="w-full flex items-center justify-between text-left px-3 py-2 hover:bg-[var(--app-bg)] border-b border-[var(--line)] last:border-0"
                      >
                        <span className="text-[12.5px] text-[var(--ink)] truncate pr-2">{m.label}</span>
                        <span className="text-[12px] font-semibold text-[var(--ink-faint)] whitespace-nowrap">${m.unit_cost.toLocaleString()}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Title *</span>
            <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="app-field" placeholder="e.g. Additional power point in kitchen" />
          </label>
          <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Description</span>
            <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="app-field text-[13px]" placeholder="Details of the additional work..." />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Labour hours</span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => stepLabourHours(-0.25)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--navy)] hover:text-[var(--navy)]" aria-label="Decrease 15 minutes">
                  <Minus size={13} />
                </button>
                <input
                  type="number" min={0} step={0.25} value={form.labour_hours}
                  onChange={(e) => setForm(f => ({ ...f, labour_hours: e.target.value }))}
                  className="app-field text-center flex-1 min-w-0" placeholder="0"
                />
                <button type="button" onClick={() => stepLabourHours(0.25)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--navy)] hover:text-[var(--navy)]" aria-label="Increase 15 minutes">
                  <Plus size={13} />
                </button>
              </div>
            </label>
            <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Materials (ex margin)</span>
              <input type="number" min={0} value={form.materials_cost} onChange={(e) => setForm(f => ({ ...f, materials_cost: e.target.value }))} className="app-field" placeholder="0" />
            </label>
          </div>
          {(labourHours > 0 || materialsRaw > 0) && (
            <p className="text-[13px] font-semibold text-[var(--ink)]">Variation total: ${Math.round(totalCost).toLocaleString()}</p>
          )}
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={addVariation} disabled={saving} className="bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">{saving ? "Saving..." : "Add variation"}</button>
            <button onClick={() => setShowForm(false)} className="border-2 border-[var(--line)] rounded-lg px-3 py-1.5 text-[13px] font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {variations.length === 0 && !showForm && (
        <p className="text-[13px] text-[var(--ink-faint)] mt-2">No variations yet. Add one when scope changes on site.</p>
      )}

      <div className="space-y-2 mt-2">
        {variations.map((v) => {
          const Icon = STATUS_ICON[v.status];
          return (
            <div key={v.id} className="border border-[var(--line)] rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold text-[var(--ink)]">{v.title}</p>
                  {v.description && <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">{v.description}</p>}
                  <p className="text-[13px] font-semibold text-[var(--ink)] mt-1">${v.total_cost.toLocaleString()}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 whitespace-nowrap ${STATUS_STYLE[v.status]}`}>
                  <Icon size={11} />{v.status}
                </span>
              </div>
              {v.status === "pending" && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => updateStatus(v.id, "approved")} className="text-[12.5px] font-semibold bg-green-600 text-white rounded-lg px-3 py-1">Client approved</button>
                  <button onClick={() => updateStatus(v.id, "declined")} className="text-[12.5px] font-semibold text-red-600 border-2 border-[var(--line)] rounded-lg px-3 py-1">Declined</button>
                </div>
              )}
              {v.client_approved_at && <p className="text-[11px] text-[var(--ink-faint)] mt-1">Approved {new Date(v.client_approved_at).toLocaleDateString("en-AU")}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

