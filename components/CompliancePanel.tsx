"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { ShieldCheck, Plus, AlertTriangle, Upload } from "lucide-react";

type Cert = {
  id: string;
  cert_type: string;
  cert_number: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  storage_path: string | null;
  notes: string | null;
  signedUrl?: string;
};

const CERT_TYPES = ["CCEW", "COC", "ESC", "Energy Safe Victoria", "Other"];

const EMPTY_FORM = { cert_type: "CCEW", cert_number: "", issued_date: "", expiry_date: "", notes: "" };

// `now` is passed in from the server rather than calling Date.now()
// independently here - server render and client hydration happen at
// genuinely different moments, and if an expiry date sits right on a
// day boundary, computing it separately in each pass can flip which
// certs show the "expiring soon" warning between the two passes. A
// frozen server-computed timestamp eliminates that mismatch (this
// exact bug caused a real production crash on the Quotes list).
function daysUntil(dateStr: string | null, now: number): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - now) / 86400000);
}

export default function CompliancePanel({ quoteId, jobId, certs: initial, now }: { quoteId: string | null; jobId?: string | null; certs: Cert[]; now: number }) {
  const [certs, setCerts] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveCert() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setError("Not signed in"); setSaving(false); return; }
    const businessId = await getActiveBusinessId(supabase, userData.user.id);

    let storagePath: string | null = null;
    let signedUrl: string | undefined;
    if (certFile) {
      const safeName = certFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${userData.user.id}/${jobId ?? quoteId}/cert-${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("job-files").upload(path, certFile);
      if (!uploadErr) {
        storagePath = path;
        const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(path, 3600 * 24 * 365);
        signedUrl = signed?.signedUrl;
      }
    }

    const { data, error: err } = await supabase
      .from("compliance_certs")
      .insert({ quote_id: quoteId || null, job_id: jobId ?? null, profile_id: businessId, cert_type: form.cert_type, cert_number: form.cert_number || null, issued_date: form.issued_date || null, expiry_date: form.expiry_date || null, notes: form.notes || null, storage_path: storagePath })
      .select().single();

    if (err) { setError(err.message); setSaving(false); return; }
    setCerts((prev) => [...prev, { ...data, signedUrl }]);
    setShowForm(false);
    setForm(EMPTY_FORM);
    setCertFile(null);
    setSaving(false);
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold">Compliance</p>
        <button onClick={() => { setShowForm(true); setError(null); }} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-2.5 py-1">
          <Plus size={12} /> Add cert
        </button>
      </div>
      <p className="font-semibold text-[var(--ink)] mb-3">Certificates and compliance</p>

      {showForm && (
        <div className="bg-[var(--app-bg)] rounded-xl p-3 mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Certificate type</span>
              <select value={form.cert_type} onChange={(e) => setForm(f => ({ ...f, cert_type: e.target.value }))} className="app-field">
                {CERT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Certificate number</span>
              <input value={form.cert_number} onChange={(e) => setForm(f => ({ ...f, cert_number: e.target.value }))} className="app-field" placeholder="e.g. CCEW-12345" />
            </label>
            <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Issue date</span>
              <input type="date" value={form.issued_date} onChange={(e) => setForm(f => ({ ...f, issued_date: e.target.value }))} className="app-field" />
            </label>
            <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Expiry date</span>
              <input type="date" value={form.expiry_date} onChange={(e) => setForm(f => ({ ...f, expiry_date: e.target.value }))} className="app-field" />
            </label>
          </div>
          <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Notes</span>
            <input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="app-field" placeholder="Optional notes" />
          </label>
          <label className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1.5 cursor-pointer">
            <Upload size={13} />{certFile ? certFile.name : "Attach certificate PDF"}
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} />
          </label>
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={saveCert} disabled={saving} className="bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save certificate"}</button>
            <button onClick={() => setShowForm(false)} className="border-2 border-[var(--line)] rounded-lg px-3 py-1.5 text-[13px] font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {certs.length === 0 && !showForm && (
        <p className="text-[13px] text-[var(--ink-faint)]">No certificates recorded for this job yet.</p>
      )}

      <div className="space-y-2">
        {certs.map((c) => {
          const days = daysUntil(c.expiry_date, now);
          const expiring = days !== null && days >= 0 && days <= 30;
          const expired = days !== null && days < 0;
          return (
            <div key={c.id} className={`border rounded-lg p-3 ${expired ? "border-red-300 bg-red-50" : expiring ? "border-amber-300 bg-amber-50" : "border-[var(--line)]"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold text-[var(--ink)] flex items-center gap-1.5">
                    <ShieldCheck size={14} className={expired ? "text-red-600" : expiring ? "text-amber-600" : "text-green-600"} />
                    {c.cert_type}
                    {c.cert_number && <span className="font-mono text-[12px] text-[var(--ink-faint)] ml-1">{c.cert_number}</span>}
                  </p>
                  {c.issued_date && <p className="text-[12px] text-[var(--ink-faint)] mt-0.5">Issued: {new Date(c.issued_date).toLocaleDateString("en-AU")}</p>}
                  {c.expiry_date && (
                    <p className={`text-[12px] mt-0.5 font-semibold ${expired ? "text-red-600" : expiring ? "text-amber-700" : "text-[var(--ink-faint)]"}`}>
                      {expired ? <><AlertTriangle size={11} className="inline mr-0.5" />Expired</> : `Expires: ${new Date(c.expiry_date).toLocaleDateString("en-AU")}`}
                      {expiring && !expired && ` (${days}d)`}
                    </p>
                  )}
                  {c.notes && <p className="text-[12px] text-[var(--ink-faint)] mt-0.5">{c.notes}</p>}
                </div>
                {c.signedUrl && (
                  <a href={c.signedUrl} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold text-[var(--navy)] underline whitespace-nowrap">View PDF</a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
