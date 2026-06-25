"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { Variation } from "@/lib/variations";

const STATUS_STYLE = {
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-green-50 text-green-700",
  declined: "bg-red-50 text-red-700",
};
const STATUS_ICON = { pending: Clock, approved: CheckCircle2, declined: XCircle };

const EMPTY_FORM = { title: "", description: "", labour_hours: "", materials_cost: "" };

export default function VariationsPanel({ quoteId, hourlyRate, margin, variations: initial, quoteTotalCost }: {
  quoteId: string;
  hourlyRate: number;
  margin: number;
  variations: Variation[];
  quoteTotalCost: number;
}) {
  const [variations, setVariations] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labourHours = Number(form.labour_hours) || 0;
  const materialsRaw = Number(form.materials_cost) || 0;
  const materialsWithMargin = materialsRaw * (1 + margin / 100);
  const totalCost = labourHours * hourlyRate + materialsWithMargin;

  const approvedTotal = variations.filter((v) => v.status === "approved").reduce((sum, v) => sum + v.total_cost, 0);

  async function addVariation() {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setError("Not signed in"); setSaving(false); return; }
    const { data, error: err } = await supabase
      .from("variations")
      .insert({ quote_id: quoteId, profile_id: userData.user.id, title: form.title, description: form.description, labour_hours: labourHours, materials_cost: materialsWithMargin, total_cost: totalCost, status: "pending" })
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
          Approved variations add ${approvedTotal.toLocaleString()} — revised job total: ${(quoteTotalCost + approvedTotal).toLocaleString()}
        </div>
      )}

      {showForm && (
        <div className="bg-[var(--app-bg)] rounded-xl p-3 mb-4 space-y-2">
          <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Title *</span>
            <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="app-field" placeholder="e.g. Additional power point in kitchen" />
          </label>
          <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Description</span>
            <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="app-field text-[13px]" placeholder="Details of the additional work..." />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Labour hours</span>
              <input type="number" min={0} step={0.5} value={form.labour_hours} onChange={(e) => setForm(f => ({ ...f, labour_hours: e.target.value }))} className="app-field" placeholder="0" />
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
