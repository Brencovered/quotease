"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Plus, Trash2 } from "lucide-react";

type Entry = {
  id: string;
  team_member_id: string | null;
  member_name: string;
  hours: number;
  hourly_rate_used: number;
  work_date: string;
  notes: string | null;
};

export default function TimesheetsPanel({
  jobId,
  entries: initialEntries,
  teamMembers,
  ownerName,
}: {
  jobId: string;
  entries: Entry[];
  teamMembers: Array<{ id: string; name: string | null; email: string }>;
  ownerName: string;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ memberId: "", hours: "", workDate: new Date().toISOString().slice(0, 10), notes: "" });

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalCost = entries.reduce((s, e) => s + e.hours * e.hourly_rate_used, 0);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hours) return;
    setSaving(true);
    const member = teamMembers.find((m) => m.id === form.memberId);
    const memberName = member ? (member.name || member.email) : ownerName;
    const res = await fetch("/api/timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        teamMemberId: form.memberId || null,
        memberName,
        hours: Number(form.hours),
        workDate: form.workDate,
        notes: form.notes || null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (res.ok) {
      setEntries((prev) => [body.entry, ...prev]);
      setForm({ memberId: "", hours: "", workDate: new Date().toISOString().slice(0, 10), notes: "" });
      setOpen(false);
      router.refresh();
    }
  }

  async function removeEntry(id: string) {
    await fetch(`/api/timesheets?id=${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="section-tag flex items-center gap-1.5"><Clock size={13} /> Timesheets</p>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-[12.5px] font-semibold text-[var(--navy)]">
          <Plus size={14} /> Log time
        </button>
      </div>

      {open && (
        <form onSubmit={addEntry} className="grid sm:grid-cols-2 gap-2 mb-4 bg-[var(--app-bg)] rounded-lg p-3">
          <select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className="app-field text-[13px] py-2">
            <option value="">{ownerName} (you)</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email}</option>
            ))}
          </select>
          <input type="date" value={form.workDate} onChange={(e) => setForm({ ...form, workDate: e.target.value })} className="app-field text-[13px] py-2" />
          <input type="number" step="0.25" placeholder="Hours" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} className="app-field text-[13px] py-2" required />
          <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="app-field text-[13px] py-2" />
          <button type="submit" disabled={saving} className="btn-primary sm:col-span-2 text-[13px] py-2">{saving ? "Saving..." : "Add entry"}</button>
        </form>
      )}

      {entries.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-faint)]">No time logged yet.</p>
      ) : (
        <>
          <div className="space-y-1.5 mb-3">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-[13px]">
                <div className="min-w-0">
                  <span className="font-semibold text-[var(--ink)]">{e.member_name}</span>
                  <span className="text-[var(--ink-faint)]"> - {new Date(e.work_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
                  {e.notes && <span className="text-[var(--ink-faint)]"> - {e.notes}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[var(--ink-soft)]">{e.hours}h @ ${e.hourly_rate_used}/hr</span>
                  <button onClick={() => removeEntry(e.id)}><Trash2 size={13} className="text-[var(--ink-faint)] hover:text-[var(--red)]" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--line)] pt-2 flex justify-between text-[13.5px] font-bold text-[var(--ink)]">
            <span>{totalHours}h total</span>
            <span>${totalCost.toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}
