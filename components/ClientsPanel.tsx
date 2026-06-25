"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Phone, Mail, MapPin, Plus, ChevronDown, ChevronUp, Pencil, X } from "lucide-react";
import type { Client } from "@/lib/clients";

const EMPTY_FORM = { name: "", email: "", phone: "", billing_address: "", abn: "", notes: "" };

export default function ClientsPanel({ clients: initial }: { clients: Client[] }) {
  const [clients, setClients] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search)
  );

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
    setError(null);
  }

  function openEdit(c: Client) {
    setForm({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", billing_address: c.billing_address ?? "", abn: c.abn ?? "", notes: c.notes ?? "" });
    setEditId(c.id);
    setShowForm(true);
    setError(null);
  }

  async function saveClient() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setError("Not signed in"); setSaving(false); return; }

    if (editId) {
      const { data, error: err } = await supabase
        .from("clients")
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq("id", editId)
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setClients((prev) => prev.map((c) => (c.id === editId ? { ...c, ...data } : c)));
    } else {
      const { data, error: err } = await supabase
        .from("clients")
        .insert({ ...form, profile_id: userData.user.id })
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setClients((prev) => [data, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
    setEditId(null);
  }

  async function deleteClient(id: string) {
    if (!confirm("Delete this client? Their past quotes won't be deleted.")) return;
    const supabase = createClient();
    await supabase.from("clients").delete().eq("id", id);
    setClients((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-16">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-[var(--ink)]">Clients</h1>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 bg-[var(--amber)] text-[var(--navy)] text-sm font-bold px-4 py-2 rounded-lg">
          <Plus size={15} /> Add client
        </button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, email or phone..."
        className="app-field mb-4"
      />

      {/* New / edit form */}
      {showForm && (
        <div className="bg-[var(--surface)] border-2 border-[var(--navy)] rounded-xl p-4 sm:p-5 mb-5">
          <p className="font-semibold text-[var(--ink)] mb-3">{editId ? "Edit client" : "New client"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <FormField label="Name *">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="app-field" placeholder="Jane Smith" />
            </FormField>
            <FormField label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="app-field" placeholder="jane@example.com" />
            </FormField>
            <FormField label="Phone">
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="app-field" placeholder="04xx xxx xxx" />
            </FormField>
            <FormField label="ABN">
              <input value={form.abn} onChange={(e) => setForm((f) => ({ ...f, abn: e.target.value }))} className="app-field" placeholder="12 345 678 901" />
            </FormField>
            <FormField label="Billing address" className="sm:col-span-2">
              <input value={form.billing_address} onChange={(e) => setForm((f) => ({ ...f, billing_address: e.target.value }))} className="app-field" placeholder="123 Main St, Suburb VIC 3000" />
            </FormField>
            <FormField label="Notes" className="sm:col-span-2">
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="app-field" placeholder="e.g. heritage home, prefers SMS, always needs parking sorted" />
            </FormField>
          </div>
          {error && <p className="text-[13px] text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={saveClient} disabled={saving} className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {saving ? "Saving..." : editId ? "Save changes" : "Add client"}
            </button>
            <button onClick={() => setShowForm(false)} className="border-2 border-[var(--line)] rounded-lg px-4 py-2 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Client list */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-10 text-center">
            <User size={26} className="mx-auto mb-3 text-[var(--ink-faint)]" />
            <p className="text-[var(--ink-faint)] text-sm">
              {search ? "No clients match that search." : "No clients yet — add your first one above."}
            </p>
          </div>
        )}
        {filtered.map((c) => {
          const open = expanded === c.id;
          return (
            <div key={c.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-xl overflow-hidden">
              <button
                className="w-full flex items-start justify-between p-4 text-left gap-3"
                onClick={() => setExpanded(open ? null : c.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--ink)] text-[15px] truncate">{c.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {c.email && <span className="text-[12.5px] text-[var(--ink-faint)] flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                    {c.phone && <span className="text-[12.5px] text-[var(--ink-faint)] flex items-center gap-1"><Phone size={11} />{c.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {(c.job_count ?? 0) > 0 && (
                    <div className="text-right">
                      <p className="text-[11px] text-[var(--ink-faint)]">{c.job_count} job{c.job_count !== 1 ? "s" : ""}</p>
                      <p className="text-[13px] font-semibold text-[var(--ink)]">${(c.total_spent ?? 0).toLocaleString()}</p>
                    </div>
                  )}
                  {open ? <ChevronUp size={16} className="text-[var(--ink-faint)]" /> : <ChevronDown size={16} className="text-[var(--ink-faint)]" />}
                </div>
              </button>

              {open && (
                <div className="px-4 pb-4 border-t border-[var(--line)] pt-3 space-y-2">
                  {c.billing_address && (
                    <p className="text-[13px] text-[var(--ink-soft)] flex gap-1.5 items-start">
                      <MapPin size={13} className="mt-0.5 shrink-0 text-[var(--ink-faint)]" />{c.billing_address}
                    </p>
                  )}
                  {c.abn && <p className="text-[12.5px] text-[var(--ink-faint)]">ABN: {c.abn}</p>}
                  {c.notes && <p className="text-[13px] text-[var(--ink-soft)] bg-[var(--app-bg)] rounded-lg px-3 py-2">{c.notes}</p>}
                  {c.last_job_at && <p className="text-[12px] text-[var(--ink-faint)]">Last job: {new Date(c.last_job_at).toLocaleDateString("en-AU")}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => openEdit(c)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1.5">
                      <Pencil size={12} /> Edit
                    </button>
                    <a href={`/electrician?client=${c.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold bg-[var(--amber)] text-[var(--navy)] rounded-lg px-3 py-1.5">
                      New quote
                    </a>
                    <button onClick={() => deleteClient(c.id)} className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-red-600 border-2 border-[var(--line)] rounded-lg px-3 py-1.5">
                      <X size={12} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">{label}</span>
      {children}
    </label>
  );
}
