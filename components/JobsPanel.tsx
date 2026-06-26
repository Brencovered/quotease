"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Hammer, Wallet, CheckCircle2, X, Upload, Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PaymentTerm = { label: string; percent: number; trigger: string; days: number };
type Job = {
  id: string; client_name: string | null; client_email: string | null;
  site_address: string | null; job_type: string | null;
  total_cost: number | null; amount_paid: number | null;
  payment_terms: PaymentTerm[] | null; invoice_number: string | null;
  xero_exported_at: string | null; completed_at: string | null;
  accepted_at: string | null; scheduled_start: string | null;
};
type Attachment = { id: string; file_name: string; storage_path: string; file_type: string | null; signedUrl?: string };

export default function JobsPanel({ jobs: initialJobs }: { jobs: Job[] }) {
  const [jobs]         = useState(initialJobs);
  const [busyId,       setBusyId]       = useState<string | null>(null);
  const [payId,        setPayId]        = useState<string | null>(null);
  const [payVal,       setPayVal]       = useState("");
  const [exporting,    setExporting]    = useState(false);
  const [exportMsg,    setExportMsg]    = useState<string | null>(null);
  const [attachments,  setAttachments]  = useState<Record<string, Attachment[]>>({});
  const [uploadingId,  setUploadingId]  = useState<string | null>(null);
  const [attError,     setAttError]     = useState<string | null>(null);

  const notExported = jobs.filter((j) => !j.xero_exported_at);
  const totalValue  = jobs.reduce((s, j) => s + (j.total_cost ?? 0), 0);
  const totalOwing  = jobs.reduce((s, j) => s + Math.max((j.total_cost ?? 0) - (j.amount_paid ?? 0), 0), 0);

  useEffect(() => {
    if (!jobs.length) return;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase.from("job_attachments").select("*")
        .in("quote_id", jobs.map((j) => j.id)).order("created_at", { ascending: false });
      if (error || !data) return;
      const grouped: Record<string, Attachment[]> = {};
      for (const row of data) {
        const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(row.storage_path, 3600);
        grouped[row.quote_id] = [...(grouped[row.quote_id] ?? []), { id: row.id, file_name: row.file_name, storage_path: row.storage_path, file_type: row.file_type, signedUrl: signed?.signedUrl }];
      }
      setAttachments(grouped);
    })();
  }, [jobs]);

  async function handleUpload(jobId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingId(jobId); setAttError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAttError("Not signed in"); setUploadingId(null); return; }
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${user.id}/${jobId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("job-files").upload(path, file);
    if (upErr) { setAttError(`Upload failed: ${upErr.message}`); setUploadingId(null); return; }
    const { data: row } = await supabase.from("job_attachments").insert({ quote_id: jobId, profile_id: user.id, file_name: file.name, storage_path: path, file_type: file.type, file_size: file.size }).select().single();
    if (row) {
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(path, 3600);
      setAttachments((p) => ({ ...p, [jobId]: [...(p[jobId] ?? []), { ...row, signedUrl: signed?.signedUrl }] }));
    }
    setUploadingId(null); e.target.value = "";
  }

  async function deleteAttachment(a: Attachment, jobId: string) {
    const supabase = createClient();
    await supabase.storage.from("job-files").remove([a.storage_path]);
    await supabase.from("job_attachments").delete().eq("id", a.id);
    setAttachments((p) => ({ ...p, [jobId]: (p[jobId] ?? []).filter((x) => x.id !== a.id) }));
  }

  async function callUpdate(body: Record<string, unknown>) {
    setBusyId(body.quoteId as string);
    const res = await fetch("/api/quotes/update-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) window.location.reload();
    setBusyId(null);
  }

  async function exportXero() {
    setExporting(true); setExportMsg(null);
    const res = await fetch("/api/quotes/export-xero-csv");
    if (res.status === 404) { setExportMsg("Nothing to export."); setExporting(false); return; }
    if (!res.ok) { setExportMsg("Export failed"); setExporting(false); return; }
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `xero-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setExportMsg(`Exported ${notExported.length} invoice(s).`); setExporting(false);
  }

  return (
    <div className="page-wrap">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-[28px] text-[var(--ink)]">Active jobs</h1>
        <div className="flex items-center gap-2">
          <Link href="/electrician/map" className="text-[13px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-xl px-3 py-2.5">
            Map
          </Link>
          <Link href="/electrician" className="inline-flex items-center gap-1.5 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[13px] px-4 py-2.5 rounded-xl">
            <Plus size={15} /> New quote
          </Link>
        </div>
      </div>

      {/* Totals */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[var(--navy)] rounded-2xl p-4">
            <p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide mb-1">Job value</p>
            <p className="font-display text-[26px] text-white">${totalValue.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-[10px] text-[var(--ink-faint)] font-bold uppercase tracking-wide mb-1">Still owing</p>
            <p className={`font-display text-[26px] ${totalOwing > 0 ? "text-[var(--red)]" : "text-[var(--green)]"}`}>
              ${totalOwing.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Xero */}
      {notExported.length > 0 && (
        <div className="card mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-[var(--ink)]">{notExported.length} ready for Xero</p>
            {exportMsg && <p className="text-[12px] text-[var(--ink-faint)] mt-0.5">{exportMsg}</p>}
          </div>
          <button onClick={exportXero} disabled={exporting} className="btn-secondary text-[13px] py-2 whitespace-nowrap">
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      )}

      {attError && <p className="text-[13px] text-[var(--red)] mb-3">{attError}</p>}

      {/* Jobs */}
      <div className="space-y-3">
        {jobs.length === 0 && (
          <div className="card text-center py-12">
            <Briefcase size={28} className="mx-auto mb-3 text-[var(--ink-faint)]" />
            <p className="font-semibold text-[var(--ink)] mb-1">No active jobs</p>
            <p className="text-[13px] text-[var(--ink-faint)]">Accepted quotes land here automatically.</p>
          </div>
        )}
        {jobs.map((j) => {
          const owing = (j.total_cost ?? 0) - (j.amount_paid ?? 0);
          const stage = !j.completed_at ? "In progress" : owing > 0 ? "Awaiting payment" : "Complete";
          const StageIcon = !j.completed_at ? Hammer : owing > 0 ? Wallet : CheckCircle2;
          const stageColor = !j.completed_at ? "text-[var(--blue)]" : owing > 0 ? "text-amber-600" : "text-[var(--green)]";
          const jobFiles = attachments[j.id] ?? [];

          return (
            <div key={j.id} className="card">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[15px] text-[var(--ink)] truncate">{j.client_name || "Unnamed client"}</p>
                  {j.site_address && <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5 truncate">{j.site_address}</p>}
                  {j.invoice_number && <p className="text-[11px] font-mono text-[var(--ink-faint)] mt-0.5">{j.invoice_number}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-[22px] text-[var(--ink)] tabular">${(j.total_cost ?? 0).toLocaleString()}</p>
                  {owing > 0 && j.amount_paid! > 0 && <p className="text-[11.5px] text-[var(--ink-faint)]">paid ${j.amount_paid?.toLocaleString()}</p>}
                </div>
              </div>

              {/* Stage */}
              <div className={`flex items-center gap-1.5 mb-3 text-[13px] font-bold ${stageColor}`}>
                <StageIcon size={14} />
                {stage}
                {stage === "Awaiting payment" && <span className="text-[var(--red)] ml-1">${owing.toLocaleString()} owing</span>}
              </div>

              {/* Schedule nudge */}
              {j.scheduled_start && (
                <div className="flex items-center gap-2 bg-[var(--app-bg)] rounded-lg px-3 py-2 mb-3 text-[12.5px]">
                  <span className="text-[var(--ink-faint)]">Scheduled</span>
                  <span className="font-semibold text-[var(--ink)]">{new Date(j.scheduled_start).toLocaleDateString("en-AU", { weekday:"short", day:"numeric", month:"short" })}</span>
                  <Link href="/electrician/schedule" className="ml-auto text-[var(--navy)] font-semibold flex items-center gap-0.5">
                    Schedule <ChevronRight size={12} />
                  </Link>
                </div>
              )}

              {/* Files */}
              <div className="border-t border-[var(--line-subtle)] pt-3 mb-3">
                {jobFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {jobFiles.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 bg-[var(--app-bg)] border border-[var(--line)] rounded-lg pl-2.5 pr-1.5 py-1 text-[12px]">
                        {a.signedUrl ? (
                          <a href={a.signedUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--navy)] font-medium underline">{a.file_name}</a>
                        ) : <span className="text-[var(--ink-soft)]">{a.file_name}</span>}
                        <button onClick={() => deleteAttachment(a, j.id)} className="text-[var(--ink-faint)] hover:text-[var(--red)] ml-0.5"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1.5 cursor-pointer">
                  <Upload size={13} />
                  {uploadingId === j.id ? "Uploading..." : "Upload file"}
                  <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploadingId === j.id} onChange={(e) => handleUpload(j.id, e)} />
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Link href={`/electrician/jobs/${j.id}`} className="btn-secondary text-[12.5px] py-1.5 px-3">Open →</Link>
                {!j.completed_at && (
                  <button onClick={() => callUpdate({ quoteId: j.id, completeJob: true })} disabled={busyId === j.id} className="btn-secondary text-[12.5px] py-1.5 px-3">Mark complete</button>
                )}
                {owing > 0 && (
                  payId === j.id ? (
                    <span className="flex items-center gap-1.5">
                      <input type="number" autoFocus value={payVal} onChange={(e) => setPayVal(e.target.value)}
                        placeholder={`max $${owing}`} className="app-field text-[13px] py-1.5 w-28" />
                      <button onClick={async () => { await callUpdate({ quoteId: j.id, paymentAmount: Math.min(Number(payVal), owing) }); setPayId(null); setPayVal(""); }}
                        disabled={busyId === j.id} className="btn-secondary text-[12.5px] py-1.5 px-3">Save</button>
                    </span>
                  ) : (
                    <button onClick={() => { setPayId(j.id); setPayVal(String(owing)); }} className="btn-secondary text-[12.5px] py-1.5 px-3">Record payment</button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
