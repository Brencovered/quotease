"use client";

import { useState } from "react";
import { Copy, Check, Mail, Plus, X, Trash2, Send, Loader2 } from "lucide-react";

type CatalogEntry = { key: string; label: string; trades: string[] };
type BusinessSupplier = {
  id: string;
  catalog_key: string | null;
  name: string;
  contact_email: string | null;
  ingestion_email: string;
  status: string;
  outreach_sent_at: string | null;
  last_import_at: string | null;
};

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  pending_approval: { label: "Not sent yet", bg: "var(--app-bg)", text: "var(--ink-faint)" },
  outreach_sent: { label: "Request sent", bg: "var(--blue-bg)", text: "var(--blue)" },
  active: { label: "Receiving pricing", bg: "var(--green-bg)", text: "var(--green)" },
  declined: { label: "Declined", bg: "var(--red-bg)", text: "var(--red)" },
};

export default function SuppliersPanel({
  suppliers: initialSuppliers,
  catalog,
  myTrades,
}: {
  suppliers: BusinessSupplier[];
  catalog: CatalogEntry[];
  myTrades: string[];
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [customForm, setCustomForm] = useState({ name: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<{ subject: string; html: string } | null>(null);
  const [reviewTo, setReviewTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const addedKeys = new Set(suppliers.map((s) => s.catalog_key).filter(Boolean));
  const suggested = catalog.filter((c) => c.trades.some((t) => myTrades.includes(t)) && !addedKeys.has(c.key));
  const others = catalog.filter((c) => !c.trades.some((t) => myTrades.includes(t)) && !addedKeys.has(c.key));

  async function addSupplier(catalogKey: string | null, name: string, contactEmail: string) {
    setSaving(true);
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogKey, name, contactEmail: contactEmail || null }),
    });
    const body = await res.json();
    setSaving(false);
    if (res.ok) {
      setSuppliers((prev) => [body.supplier, ...prev]);
      setAddingKey(null);
      setEmailDraft("");
      setCustomOpen(false);
      setCustomForm({ name: "", email: "" });
    }
  }

  async function removeSupplier(id: string) {
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  }

  async function openReview(supplier: BusinessSupplier) {
    setReviewId(supplier.id);
    setReviewDraft(null);
    const res = await fetch(`/api/suppliers/${supplier.id}/outreach`);
    const body = await res.json();
    if (res.ok) {
      setReviewDraft(body.draft);
      setReviewTo(body.supplierEmail);
    }
  }

  async function confirmSend() {
    if (!reviewId) return;
    setSending(true);
    const res = await fetch(`/api/suppliers/${reviewId}/outreach`, { method: "POST" });
    setSending(false);
    if (res.ok) {
      setSuppliers((prev) => prev.map((s) => (s.id === reviewId ? { ...s, status: "outreach_sent", outreach_sent_at: new Date().toISOString() } : s)));
      setReviewId(null);
    }
  }

  function copyEmail(id: string, email: string) {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-6">
      {/* Your suppliers */}
      {suppliers.length > 0 && (
        <div>
          <p className="section-tag mb-3">Your suppliers</p>
          <div className="space-y-2">
            {suppliers.map((s) => {
              const status = STATUS_LABELS[s.status] ?? STATUS_LABELS.pending_approval;
              return (
                <div key={s.id} className="card">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-[14px] text-[var(--ink)]">{s.name}</p>
                      {s.contact_email && <p className="text-[12px] text-[var(--ink-faint)]">{s.contact_email}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: status.bg, color: status.text }}>
                        {status.label}
                      </span>
                      <button onClick={() => removeSupplier(s.id)}><Trash2 size={14} className="text-[var(--ink-faint)] hover:text-[var(--red)]" /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-[var(--app-bg)] rounded-lg px-3 py-2 mb-2">
                    <Mail size={13} className="text-[var(--ink-faint)] shrink-0" />
                    <span className="text-[12.5px] text-[var(--ink)] font-mono truncate flex-1">{s.ingestion_email}</span>
                    <button onClick={() => copyEmail(s.id, s.ingestion_email)} className="shrink-0 text-[var(--navy)]">
                      {copiedId === s.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  {s.last_import_at && (
                    <p className="text-[11.5px] text-[var(--green)] mb-2">Last price update: {new Date(s.last_import_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</p>
                  )}
                  {s.status === "pending_approval" && (
                    <button onClick={() => openReview(s)} disabled={!s.contact_email} className="btn-primary text-[12.5px] py-2 px-3 flex items-center gap-1.5 disabled:opacity-40">
                      <Send size={13} /> Review & send request
                    </button>
                  )}
                  {s.status === "pending_approval" && !s.contact_email && (
                    <p className="text-[11.5px] text-[var(--ink-faint)] mt-1">Add their email to send a request.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested by trade */}
      {suggested.length > 0 && (
        <div>
          <p className="section-tag mb-3">Suggested for your trade</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {suggested.map((c) => (
              <SupplierPickCard
                key={c.key}
                label={c.label}
                isAdding={addingKey === c.key}
                onStart={() => setAddingKey(c.key)}
                onCancel={() => setAddingKey(null)}
                email={emailDraft}
                onEmailChange={setEmailDraft}
                onConfirm={() => addSupplier(c.key, c.label, emailDraft)}
                saving={saving}
              />
            ))}
          </div>
        </div>
      )}

      {/* Everything else */}
      {others.length > 0 && (
        <div>
          <p className="section-tag mb-3">Other suppliers</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {others.map((c) => (
              <SupplierPickCard
                key={c.key}
                label={c.label}
                isAdding={addingKey === c.key}
                onStart={() => setAddingKey(c.key)}
                onCancel={() => setAddingKey(null)}
                email={emailDraft}
                onEmailChange={setEmailDraft}
                onConfirm={() => addSupplier(c.key, c.label, emailDraft)}
                saving={saving}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom supplier */}
      <div>
        {!customOpen ? (
          <button onClick={() => setCustomOpen(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--navy)]">
            <Plus size={14} /> Add a custom supplier
          </button>
        ) : (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <p className="section-tag">Custom supplier</p>
              <button onClick={() => setCustomOpen(false)}><X size={16} /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <input placeholder="Supplier name" value={customForm.name} onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })} className="app-field text-[13px]" />
              <input placeholder="Their email" value={customForm.email} onChange={(e) => setCustomForm({ ...customForm, email: e.target.value })} className="app-field text-[13px]" />
            </div>
            <button
              onClick={() => addSupplier(null, customForm.name, customForm.email)}
              disabled={!customForm.name || saving}
              className="btn-primary text-[13px] py-2 mt-2 disabled:opacity-40"
            >
              Add supplier
            </button>
          </div>
        )}
      </div>

      {/* Review & approve modal */}
      {reviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReviewId(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-[19px] text-[var(--ink)]">Review before sending</h2>
              <button onClick={() => setReviewId(null)}><X size={18} /></button>
            </div>
            {!reviewDraft ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[var(--ink-faint)]" /></div>
            ) : (
              <>
                <p className="text-[12px] text-[var(--ink-faint)] mb-1">To: {reviewTo}</p>
                <p className="text-[13px] font-semibold text-[var(--ink)] mb-2">Subject: {reviewDraft.subject}</p>
                <div className="border border-[var(--line)] rounded-lg overflow-hidden mb-4">
                  <iframe title="Email preview" srcDoc={reviewDraft.html} className="w-full h-64" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setReviewId(null)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={confirmSend} disabled={sending} className="btn-primary flex-1">{sending ? "Sending..." : "Approve & send"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierPickCard({
  label, isAdding, onStart, onCancel, email, onEmailChange, onConfirm, saving,
}: {
  label: string; isAdding: boolean; onStart: () => void; onCancel: () => void;
  email: string; onEmailChange: (v: string) => void; onConfirm: () => void; saving: boolean;
}) {
  if (isAdding) {
    return (
      <div className="card">
        <p className="font-semibold text-[13.5px] text-[var(--ink)] mb-2">{label}</p>
        <input
          placeholder="Their email (optional, needed to send a request)"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className="app-field text-[12.5px] py-1.5 mb-2"
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary text-[12px] py-1.5 px-3 flex-1">Cancel</button>
          <button onClick={onConfirm} disabled={saving} className="btn-primary text-[12px] py-1.5 px-3 flex-1">Add</button>
        </div>
      </div>
    );
  }
  return (
    <button onClick={onStart} className="card text-left hover:border-[var(--navy)] flex items-center justify-between">
      <span className="font-semibold text-[13.5px] text-[var(--ink)]">{label}</span>
      <Plus size={16} className="text-[var(--ink-faint)]" />
    </button>
  );
}
