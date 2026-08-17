"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Plus, Save, Trash2 } from "lucide-react";

type SupplierContact = {
  id: string;
  supplier_name: string;
  email: string;
  phone: string | null;
  account_number: string | null;
  notes: string | null;
};

const emptyForm = {
  supplier_name: "",
  email: "",
  phone: "",
  account_number: "",
  notes: "",
};

export default function SupplierContactsSettingsPanel() {
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/supplier-contacts");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(c: SupplierContact) {
    setEditingId(c.id);
    setForm({
      supplier_name: c.supplier_name,
      email: c.email,
      phone: c.phone ?? "",
      account_number: c.account_number ?? "",
      notes: c.notes ?? "",
    });
    setMessage(null);
    setError(null);
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/supplier-contacts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          supplierName: form.supplier_name,
          email: form.email,
          phone: form.phone || null,
          accountNumber: form.account_number || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage(editingId ? "Contact updated" : "Supplier saved");
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this supplier contact?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/supplier-contacts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (editingId === id) startNew();
      await load();
      setMessage("Contact removed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mb-4">
      <p className="section-tag mb-1">Supplier accounts</p>
      <p className="font-semibold text-[var(--ink)] mb-1">Who you order from</p>
      <p className="text-[13px] text-[var(--ink-faint)] mb-4">
        Customer / account numbers and emails used when sending material orders from a job.
      </p>

      {loading ? (
        <p className="text-[13px] text-[var(--ink-faint)]">Loading…</p>
      ) : contacts.length === 0 && !editingId && !form.supplier_name ? (
        <p className="text-[13px] text-[var(--ink-faint)] mb-3">No suppliers saved yet.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 border border-[var(--line)] rounded-xl px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} className="text-[var(--amber-deep)] shrink-0" />
                  <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{c.supplier_name}</p>
                </div>
                <p className="text-[12.5px] text-[var(--ink-faint)] truncate">{c.email}</p>
                {c.account_number && (
                  <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">
                    Account #: <span className="font-semibold text-[var(--ink)]">{c.account_number}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => startEdit(c)} className="btn-secondary text-[12px] py-1.5 px-2.5">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="text-[var(--ink-faint)] p-1.5"
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-[var(--line)] rounded-xl p-3 space-y-2.5 bg-[var(--app-bg)]">
        <p className="text-[12.5px] font-semibold text-[var(--ink-soft)]">
          {editingId ? "Edit supplier" : "Add supplier"}
        </p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <label className="block sm:col-span-2">
            <span className="block text-[11.5px] text-[var(--ink-faint)] mb-1">Supplier name</span>
            <input
              value={form.supplier_name}
              onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="Reece, Tradelink…"
            />
          </label>
          <label className="block">
            <span className="block text-[11.5px] text-[var(--ink-faint)] mb-1">Your customer / account #</span>
            <input
              value={form.account_number}
              onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="e.g. 4521890"
            />
          </label>
          <label className="block">
            <span className="block text-[11.5px] text-[var(--ink-faint)] mb-1">Order email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="orders@supplier.com.au"
            />
          </label>
          <label className="block">
            <span className="block text-[11.5px] text-[var(--ink-faint)] mb-1">Phone (optional)</span>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="Branch phone"
            />
          </label>
          <label className="block">
            <span className="block text-[11.5px] text-[var(--ink-faint)] mb-1">Notes (optional)</span>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="Preferred branch, charge account…"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={busy || !form.supplier_name.trim() || !form.email.trim()}
            className="btn-primary text-[12.5px] py-2 px-3 disabled:opacity-50"
          >
            {busy ? "Saving…" : editingId ? <><Save size={13} /> Update</> : <><Plus size={13} /> Save supplier</>}
          </button>
          {editingId && (
            <button type="button" onClick={startNew} className="btn-secondary text-[12.5px] py-2 px-3">
              Cancel
            </button>
          )}
          {message && (
            <span className="text-[12.5px] text-[var(--green)] font-semibold flex items-center gap-1">
              <Check size={13} /> {message}
            </span>
          )}
        </div>
        {error && (
          <p className="text-[12.5px] text-[var(--red)] font-semibold">{error}</p>
        )}
      </div>
    </div>
  );
}
