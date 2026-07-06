"use client";

import { useState } from "react";
import { Plus, Repeat, X } from "lucide-react";
import { useRouter } from "next/navigation";

type QuickJob = {
  id: string;
  job_number: number;
  client_name: string | null;
  site_address: string | null;
  status: string;
  total_cost: number | null;
  amount_paid: number | null;
  scheduled_date: string | null;
  source: string;
  is_recurring_template: boolean;
  recurrence_rule: { freq?: string; interval?: number } | null;
};

export default function QuickJobsPanel({ jobs: initialJobs, teamMembers }: {
  jobs: QuickJob[];
  teamMembers: Array<{ id: string; name: string | null; email: string }>;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientName: "", clientPhone: "", siteAddress: "", description: "",
    hours: "", materialsCost: "", scheduledDate: "", isRecurring: false, freq: "monthly",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientName.trim() || !form.hours) { setError("Client name and hours are required"); return; }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/jobs/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone || null,
        siteAddress: form.siteAddress || null,
        description: form.description || null,
        labourHours: Number(form.hours) || 0,
        materialsCost: Number(form.materialsCost) || 0,
        scheduledDate: form.scheduledDate || null,
        isRecurring: form.isRecurring,
        recurrenceFreq: form.freq,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) { setError(body.error ?? "Failed to create job"); return; }
    setJobs((prev) => [body.job, ...prev]);
    setOpen(false);
    setForm({ clientName: "", clientPhone: "", siteAddress: "", description: "", hours: "", materialsCost: "", scheduledDate: "", isRecurring: false, freq: "monthly" });
    router.refresh();
  }

  async function generateNext(templateId: string) {
    setSaving(true);
    const res = await fetch("/api/jobs/generate-occurrence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    setSaving(false);
    if (res.ok) router.refresh();
  }

  const templates = jobs.filter((j) => j.is_recurring_template);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[18px] text-[var(--ink)]">Quick jobs</h2>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[13px] px-4 py-2.5 rounded-xl">
          <Plus size={15} /> Quick job
        </button>
      </div>

      {open && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="section-tag">New quick job</p>
            <button onClick={() => setOpen(false)}><X size={16} /></button>
          </div>
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Client name" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="app-field" required />
            <input placeholder="Client phone (optional)" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} className="app-field" />
            <input placeholder="Site address (optional)" value={form.siteAddress} onChange={(e) => setForm({ ...form, siteAddress: e.target.value })} className="app-field sm:col-span-2" />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="app-field sm:col-span-2" />
            <input type="number" step="0.5" placeholder="Hours" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} className="app-field" required />
            <input type="number" placeholder="Materials cost ($)" value={form.materialsCost} onChange={(e) => setForm({ ...form, materialsCost: e.target.value })} className="app-field" />
            <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="app-field" />
            <label className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
              <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} />
              Repeats
            </label>
            {form.isRecurring && (
              <select value={form.freq} onChange={(e) => setForm({ ...form, freq: e.target.value })} className="app-field">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
            {error && <p className="text-[12.5px] text-[var(--red)] sm:col-span-2">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary sm:col-span-2">{saving ? "Creating..." : "Create job"}</button>
          </form>
        </div>
      )}

      {templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="card flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Repeat size={14} className="text-[var(--navy)] shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-[13.5px] text-[var(--ink)] truncate">{t.client_name} - repeats {t.recurrence_rule?.freq ?? "monthly"}</p>
                  <p className="text-[11.5px] text-[var(--ink-faint)]">Template - Job #{t.job_number}</p>
                </div>
              </div>
              <button onClick={() => generateNext(t.id)} disabled={saving} className="btn-secondary text-[12.5px] py-1.5 px-3 whitespace-nowrap">Generate next</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
