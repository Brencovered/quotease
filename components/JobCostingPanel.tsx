"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrendingUp, TrendingDown, Minus, Lightbulb } from "lucide-react";
import { generateCostingInsight } from "@/lib/jobInsights";

type Actuals = {
  id: string;
  actual_hours: number;
  actual_materials_cost: number;
  notes: string | null;
  recorded_at: string;
};

export default function JobCostingPanel({ quoteId, quotedHours, quotedMaterials, quotedTotal, hourlyRate, actuals: initial, intakeData }: {
  quoteId: string;
  quotedHours: number;
  quotedMaterials: number;
  quotedTotal: number;
  hourlyRate: number;
  actuals: Actuals[];
  intakeData?: Record<string, unknown> | null;
}) {
  const [actuals, setActuals] = useState(initial);
  const [showForm, setShowForm] = useState(actuals.length === 0);
  const [form, setForm] = useState({ hours: "", materials: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sum all actuals entries
  const totalActualHours = actuals.reduce((s, a) => s + a.actual_hours, 0);
  const totalActualMaterials = actuals.reduce((s, a) => s + a.actual_materials_cost, 0);
  const totalActualCost = totalActualHours * hourlyRate + totalActualMaterials;
  const margin = quotedTotal - totalActualCost;
  const marginPct = quotedTotal > 0 ? Math.round((margin / quotedTotal) * 100) : 0;

  const hoursVar = totalActualHours - quotedHours;
  const matVar = totalActualMaterials - quotedMaterials;
  const insight = actuals.length > 0 ? generateCostingInsight(hoursVar, quotedHours, intakeData) : null;

  async function saveActuals() {
    if (!form.hours && !form.materials) { setError("Enter at least hours or materials"); return; }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setError("Not signed in"); setSaving(false); return; }
    const { data, error: err } = await supabase
      .from("job_actuals")
      .insert({ quote_id: quoteId, profile_id: userData.user.id, actual_hours: Number(form.hours) || 0, actual_materials_cost: Number(form.materials) || 0, notes: form.notes || null })
      .select().single();
    if (err) { setError(err.message); setSaving(false); return; }
    setActuals((prev) => [...prev, data]);
    setShowForm(false);
    setForm({ hours: "", materials: "", notes: "" });
    setSaving(false);
  }

  function Var({ value, unit = "" }: { value: number; unit?: string }) {
    if (Math.abs(value) < 0.1) return <span className="text-[var(--ink-faint)] flex items-center gap-0.5"><Minus size={12} /> on target</span>;
    const over = value > 0;
    return (
      <span className={`flex items-center gap-0.5 font-semibold ${over ? "text-red-600" : "text-green-600"}`}>
        {over ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {over ? "+" : ""}{unit}{typeof value === "number" ? (unit === "$" ? Math.abs(value).toLocaleString() : Math.abs(value).toFixed(1)) : value} {over ? "over" : "under"}
      </span>
    );
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
      <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Job costing</p>
      <p className="font-semibold text-[var(--ink)] mb-3">Actual vs quoted</p>

      {actuals.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[var(--app-bg)] rounded-lg p-3">
              <p className="text-[11px] text-[var(--ink-faint)] font-semibold mb-1">Labour hours</p>
              <p className="font-display text-xl text-[var(--ink)]">{totalActualHours.toFixed(1)}h</p>
              <p className="text-[11px] mt-0.5 text-[var(--ink-faint)]">quoted {quotedHours}h</p>
              <div className="text-[12px] mt-1"><Var value={hoursVar} unit="" /></div>
            </div>
            <div className="bg-[var(--app-bg)] rounded-lg p-3">
              <p className="text-[11px] text-[var(--ink-faint)] font-semibold mb-1">Materials</p>
              <p className="font-display text-xl text-[var(--ink)]">${totalActualMaterials.toLocaleString()}</p>
              <p className="text-[11px] mt-0.5 text-[var(--ink-faint)]">quoted ${quotedMaterials.toLocaleString()}</p>
              <div className="text-[12px] mt-1"><Var value={matVar} unit="$" /></div>
            </div>
            <div className={`rounded-lg p-3 ${margin >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              <p className="text-[11px] text-[var(--ink-faint)] font-semibold mb-1">Margin</p>
              <p className={`font-display text-xl ${margin >= 0 ? "text-green-700" : "text-red-600"}`}>{marginPct}%</p>
              <p className={`text-[12px] font-semibold mt-0.5 ${margin >= 0 ? "text-green-700" : "text-red-600"}`}>{margin >= 0 ? "+" : ""}${margin.toLocaleString()}</p>
            </div>
          </div>

          {insight && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-[13px] text-amber-900">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <p>{insight}</p>
            </div>
          )}

          {/* Actuals history */}
          {actuals.length > 1 && (
            <div className="space-y-2 mb-3">
              {actuals.map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-[12.5px] text-[var(--ink-soft)] border-b border-[var(--line)] pb-2">
                  <span className="text-[var(--ink-faint)]">{new Date(a.recorded_at).toLocaleDateString("en-AU")}</span>
                  <span>{a.actual_hours}h</span>
                  <span>${a.actual_materials_cost.toLocaleString()}</span>
                  {a.notes && <span className="text-[var(--ink-faint)] truncate">{a.notes}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showForm ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Actual hours</span>
              <input type="number" min={0} step={0.5} value={form.hours} onChange={(e) => setForm(f => ({ ...f, hours: e.target.value }))} className="app-field" placeholder="0" />
            </label>
            <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Actual materials ($)</span>
              <input type="number" min={0} value={form.materials} onChange={(e) => setForm(f => ({ ...f, materials: e.target.value }))} className="app-field" placeholder="0" />
            </label>
          </div>
          <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Notes</span>
            <input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="app-field" placeholder="e.g. extra hour finding the fault, cable cost more than quoted" />
          </label>
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={saveActuals} disabled={saving} className="bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save actuals"}</button>
            {actuals.length > 0 && <button onClick={() => setShowForm(false)} className="border-2 border-[var(--line)] rounded-lg px-3 py-1.5 text-[13px] font-semibold">Cancel</button>}
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5 mt-1">
          + Log actual time and materials
        </button>
      )}
    </div>
  );
}
