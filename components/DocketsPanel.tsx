"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { Plus, CheckCircle2, Send, FileClock, Copy, Check } from "lucide-react";
import type { Docket, DocketStatus } from "@/lib/dockets";

const STATUS_STYLE: Record<DocketStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-amber-50 text-amber-800",
  signed: "bg-green-50 text-green-700",
  invoiced: "bg-blue-50 text-blue-700",
};
const STATUS_ICON: Record<DocketStatus, typeof FileClock> = {
  draft: FileClock,
  sent: Send,
  signed: CheckCircle2,
  invoiced: CheckCircle2,
};

const today = () => new Date().toISOString().slice(0, 10);

function emptyForm(defaultRate: number) {
  return { work_date: today(), description: "", labour_hours: "", hourly_rate: String(defaultRate || ""), minimum_hours: "4", materials_cost: "" };
}

export default function DocketsPanel({ jobId, defaultHourlyRate, dockets: initial }: {
  jobId: string;
  defaultHourlyRate: number;
  dockets: Docket[];
}) {
  const [dockets, setDockets] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm(defaultHourlyRate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const labourHours = Number(form.labour_hours) || 0;
  const hourlyRate = Number(form.hourly_rate) || 0;
  const minimumHours = Number(form.minimum_hours) || 0;
  const materialsCost = Number(form.materials_cost) || 0;
  const billedHours = Math.max(labourHours, minimumHours);
  const previewTotal = billedHours * hourlyRate + materialsCost;

  const unbilledTotal = dockets.filter((d) => d.status !== "invoiced").reduce((sum, d) => sum + d.total_cost, 0);

  async function addDocket() {
    if (!form.work_date) { setError("Date of work is required"); return; }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setError("Not signed in"); setSaving(false); return; }
    const businessId = await getActiveBusinessId(supabase, userData.user.id);
    const { data, error: err } = await supabase
      .from("dockets")
      .insert({
        job_id: jobId,
        profile_id: businessId,
        work_date: form.work_date,
        description: form.description,
        labour_hours: labourHours,
        hourly_rate: hourlyRate,
        minimum_hours: minimumHours,
        materials_cost: materialsCost,
        status: "draft",
      })
      .select()
      .single();
    if (err) { setError(err.message); setSaving(false); return; }
    setDockets((prev) => [data, ...prev]);
    setShowForm(false);
    setForm(emptyForm(defaultHourlyRate));
    setSaving(false);
  }

  async function markSent(id: string) {
    const supabase = createClient();
    await supabase.from("dockets").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", id);
    setDockets((prev) => prev.map((d) => (d.id === id ? { ...d, status: "sent" } : d)));
  }

  function copyLink(docket: Docket) {
    const url = `${window.location.origin}/docket/${docket.public_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(docket.id);
    if (docket.status === "draft") markSent(docket.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold">Dayworks dockets</p>
        <button onClick={() => { setShowForm(true); setError(null); }} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-2.5 py-1">
          <Plus size={12} /> Log a docket
        </button>
      </div>
      <p className="font-semibold text-[var(--ink)] mb-1">Signed, per-day work records</p>

      {unbilledTotal > 0 && (
        <div className="bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-[13px] font-semibold mb-3">
          ${unbilledTotal.toLocaleString()} across {dockets.filter((d) => d.status !== "invoiced").length} unbilled docket{dockets.filter((d) => d.status !== "invoiced").length === 1 ? "" : "s"} - bundle into an invoice at end of month
        </div>
      )}

      {showForm && (
        <div className="bg-[var(--app-bg)] rounded-xl p-3 mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Date of work *</span>
              <input type="date" value={form.work_date} onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))} className="app-field" />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Hourly rate</span>
              <input type="number" min={0} value={form.hourly_rate} onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value }))} className="app-field" placeholder="0" />
            </label>
          </div>
          <label className="block">
            <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Work done</span>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="app-field text-[13px]" placeholder="What was done on site today..." />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Hours worked</span>
              <input type="number" min={0} step={0.25} value={form.labour_hours} onChange={(e) => setForm((f) => ({ ...f, labour_hours: e.target.value }))} className="app-field" placeholder="0" />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Min. callout (h)</span>
              <input type="number" min={0} step={0.5} value={form.minimum_hours} onChange={(e) => setForm((f) => ({ ...f, minimum_hours: e.target.value }))} className="app-field" />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Materials</span>
              <input type="number" min={0} value={form.materials_cost} onChange={(e) => setForm((f) => ({ ...f, materials_cost: e.target.value }))} className="app-field" placeholder="0" />
            </label>
          </div>
          {(labourHours > 0 || materialsCost > 0) && (
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              Billed {billedHours}h{billedHours > labourHours ? ` (${labourHours}h worked, ${minimumHours}h minimum applies)` : ""} - docket total: ${Math.round(previewTotal).toLocaleString()}
            </p>
          )}
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={addDocket} disabled={saving} className="bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save docket"}</button>
            <button onClick={() => setShowForm(false)} className="border-2 border-[var(--line)] rounded-lg px-3 py-1.5 text-[13px] font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {dockets.length === 0 && !showForm && (
        <p className="text-[13px] text-[var(--ink-faint)] mt-2">No dockets yet. Log one at the end of each day on site.</p>
      )}

      <div className="space-y-2 mt-2">
        {dockets.map((d) => {
          const Icon = STATUS_ICON[d.status];
          return (
            <div key={d.id} className="border border-[var(--line)] rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold text-[var(--ink)]">{new Date(d.work_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}</p>
                  {d.description && <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5 line-clamp-2">{d.description}</p>}
                  <p className="text-[13px] font-semibold text-[var(--ink)] mt-1">
                    {d.billed_hours}h @ ${d.hourly_rate}/h{d.materials_cost > 0 ? ` + $${d.materials_cost} materials` : ""} = ${d.total_cost.toLocaleString()}
                  </p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 whitespace-nowrap ${STATUS_STYLE[d.status]}`}>
                  <Icon size={11} />{d.status}
                </span>
              </div>
              {d.status === "signed" && d.signed_by_name && (
                <p className="text-[11px] text-green-700 mt-1">Signed by {d.signed_by_name}{d.signed_at ? ` on ${new Date(d.signed_at).toLocaleDateString("en-AU")}` : ""}</p>
              )}
              {(d.status === "draft" || d.status === "sent") && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => copyLink(d)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1">
                    {copiedId === d.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy signing link</>}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
