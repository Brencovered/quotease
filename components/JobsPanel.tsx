"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Hammer, Wallet, CheckCircle2, Paperclip, X, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PaymentTerm = { label: string; percent: number; trigger: string; days: number };

type Job = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  site_address: string | null;
  job_type: string | null;
  total_cost: number | null;
  amount_paid: number | null;
  payment_terms: PaymentTerm[] | null;
  invoice_number: string | null;
  xero_exported_at: string | null;
  completed_at: string | null;
  accepted_at: string | null;
};

type Attachment = {
  id: string;
  file_name: string;
  storage_path: string;
  file_type: string | null;
  signedUrl?: string;
};

export default function JobsPanel({ jobs: initialJobs }: { jobs: Job[] }) {
  const [jobs] = useState(initialJobs);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paymentInputId, setPaymentInputId] = useState<string | null>(null);
  const [paymentValue, setPaymentValue] = useState("");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const notExported = jobs.filter((j) => !j.xero_exported_at);

  useEffect(() => {
    if (jobs.length === 0) return;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from("job_attachments")
        .select("*")
        .in("quote_id", jobs.map((j) => j.id))
        .order("created_at", { ascending: false });
      if (error || !data) return;
      const grouped: Record<string, Attachment[]> = {};
      for (const row of data) {
        const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(row.storage_path, 3600);
        const entry: Attachment = { id: row.id, file_name: row.file_name, storage_path: row.storage_path, file_type: row.file_type, signedUrl: signed?.signedUrl };
        grouped[row.quote_id] = [...(grouped[row.quote_id] ?? []), entry];
      }
      setAttachments(grouped);
    })();
  }, [jobs]);

  async function loadAttachments() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("job_attachments")
      .select("*")
      .in("quote_id", jobs.map((j) => j.id))
      .order("created_at", { ascending: false });
    if (error || !data) return;

    const grouped: Record<string, Attachment[]> = {};
    for (const row of data) {
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(row.storage_path, 3600);
      const entry: Attachment = {
        id: row.id,
        file_name: row.file_name,
        storage_path: row.storage_path,
        file_type: row.file_type,
        signedUrl: signed?.signedUrl,
      };
      grouped[row.quote_id] = [...(grouped[row.quote_id] ?? []), entry];
    }
    setAttachments(grouped);
  }

  async function handleUpload(jobId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingJobId(jobId);
    setAttachmentError(null);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setAttachmentError("Not signed in");
      setUploadingJobId(null);
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${userData.user.id}/${jobId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
    if (uploadError) {
      setAttachmentError(`Upload failed: ${uploadError.message}`);
      setUploadingJobId(null);
      return;
    }

    const { error: insertError } = await supabase.from("job_attachments").insert({
      quote_id: jobId,
      profile_id: userData.user.id,
      file_name: file.name,
      storage_path: path,
      file_type: file.type,
      file_size: file.size,
    });
    if (insertError) {
      setAttachmentError(`Saved file but couldn't record it: ${insertError.message}`);
      setUploadingJobId(null);
      return;
    }

    setUploadingJobId(null);
    e.target.value = "";
    loadAttachments();
  }

  async function deleteAttachment(attachment: Attachment, jobId: string) {
    const supabase = createClient();
    await supabase.storage.from("job-files").remove([attachment.storage_path]);
    await supabase.from("job_attachments").delete().eq("id", attachment.id);
    setAttachments((prev) => ({
      ...prev,
      [jobId]: (prev[jobId] ?? []).filter((a) => a.id !== attachment.id),
    }));
  }

  async function callUpdate(body: Record<string, unknown>) {
    setBusyId(body.quoteId as string);
    const res = await fetch("/api/quotes/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) window.location.reload();
    setBusyId(null);
  }

  async function recordPayment(jobId: string, owing: number) {
    const amount = Number(paymentValue);
    if (!amount || amount <= 0) return;
    await callUpdate({ quoteId: jobId, paymentAmount: Math.min(amount, owing) });
    setPaymentInputId(null);
    setPaymentValue("");
  }

  async function exportToXero() {
    setExporting(true);
    setExportMessage(null);
    const res = await fetch("/api/quotes/export-xero-csv");
    if (res.status === 404) {
      setExportMessage("No jobs ready to export.");
      setExporting(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setExportMessage(body.error ?? "Export failed");
      setExporting(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xero-import-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMessage(`Exported ${notExported.length} invoice(s). Import this file in Xero under Business > Invoices > Import.`);
    setExporting(false);
  }

  const totalValue = jobs.reduce((sum, j) => sum + (j.total_cost ?? 0), 0);
  const totalOwing = jobs.reduce((sum, j) => sum + Math.max((j.total_cost ?? 0) - (j.amount_paid ?? 0), 0), 0);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-16">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-[var(--ink)]">Active jobs</h1>
        <Link href="/electrician" className="bg-[var(--amber)] text-[var(--navy)] text-sm font-bold px-4 py-2 rounded-lg">
          New quote
        </Link>
      </div>

      {jobs.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-[var(--navy)] rounded-xl p-4">
            <p className="text-[11px] tracking-[.1em] uppercase text-[var(--steel-3)] font-bold mb-1">Job value</p>
            <p className="font-display text-2xl text-white">${totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
            <p className="text-[11px] tracking-[.1em] uppercase text-[var(--ink-faint)] font-bold mb-1">Still owing</p>
            <p className={`font-display text-2xl ${totalOwing > 0 ? "text-red-600" : "text-green-700"}`}>
              ${totalOwing.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5 mb-5">
          <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Xero</p>
          <p className="font-semibold text-[var(--ink)] mb-1">Export to Xero</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-3">
            {notExported.length > 0 ? `${notExported.length} job(s) ready to export.` : "Everything's already been exported."}{" "}
            Downloads a CSV you import directly in Xero.
          </p>
          <button
            onClick={exportToXero}
            disabled={exporting || notExported.length === 0}
            className="bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            {exporting ? "Exporting..." : "Export to Xero CSV"}
          </button>
          {exportMessage && <p className="text-[13px] text-[var(--ink-soft)] mt-2">{exportMessage}</p>}
        </div>
      )}

      {attachmentError && <p className="text-[13px] text-red-600 mb-3">{attachmentError}</p>}

      <div className="flex flex-col gap-3">
        {jobs.length === 0 && (
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-8 text-center">
            <Briefcase size={26} className="mx-auto mb-3 text-[var(--ink-faint)]" />
            <p className="text-[var(--ink-faint)] text-sm">
              No active jobs right now — accepted quotes land here automatically.
            </p>
          </div>
        )}
        {jobs.map((j) => {
          const owing = (j.total_cost ?? 0) - (j.amount_paid ?? 0);
          const stage = !j.completed_at ? "In progress" : owing > 0 ? "Awaiting payment" : "Complete";
          const StageIcon = !j.completed_at ? Hammer : owing > 0 ? Wallet : CheckCircle2;
          const stageColor = !j.completed_at ? "#3b82f6" : owing > 0 ? "var(--amber-deep)" : "#16a34a";
          const jobAttachments = attachments[j.id] ?? [];

          return (
            <div key={j.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-[var(--ink)] text-[15px]">{j.client_name || "Unnamed client"}</p>
                  <p className="text-[13px] text-[var(--ink-faint)]">{j.site_address}</p>
                  {j.invoice_number && <p className="text-[11px] text-[var(--ink-faint)] font-mono mt-1">{j.invoice_number}</p>}
                </div>
                <div className="text-right">
                  <p className="font-display text-lg text-[var(--ink)]">${(j.total_cost ?? 0).toLocaleString()}</p>
                  {owing > 0 && j.amount_paid! > 0 && <p className="text-[12px] text-[var(--ink-faint)]">paid ${j.amount_paid?.toLocaleString()}</p>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                <StageIcon size={14} style={{ color: stageColor }} />
                <span className="text-[12.5px] font-semibold" style={{ color: stageColor }}>
                  {stage}
                  {stage === "Awaiting payment" && ` — $${owing.toLocaleString()} owing`}
                </span>
              </div>

              {/* DRAWINGS / ATTACHMENTS */}
              <div className="mt-3 pt-3 border-t border-[var(--line)]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Paperclip size={13} className="text-[var(--ink-faint)]" />
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                    Drawings & files {jobAttachments.length > 0 ? `(${jobAttachments.length})` : ""}
                  </span>
                </div>

                {jobAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {jobAttachments.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 bg-[var(--app-bg)] border border-[var(--line)] rounded-lg pl-2.5 pr-1.5 py-1.5 text-[12.5px]"
                      >
                        {a.signedUrl ? (
                          <a href={a.signedUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--navy)] font-medium underline">
                            {a.file_name}
                          </a>
                        ) : (
                          <span className="text-[var(--ink-soft)]">{a.file_name}</span>
                        )}
                        <button onClick={() => deleteAttachment(a, j.id)} className="text-[var(--ink-faint)] hover:text-red-600">
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <label className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1.5 cursor-pointer">
                  <Upload size={13} />
                  {uploadingJobId === j.id ? "Uploading..." : "Upload drawing"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    disabled={uploadingJobId === j.id}
                    onChange={(e) => handleUpload(j.id, e)}
                  />
                </label>
              </div>

              <div className="flex gap-2 mt-3 flex-wrap items-center">
                {!j.completed_at && (
                  <button
                    onClick={() => callUpdate({ quoteId: j.id, completeJob: true })}
                    disabled={busyId === j.id}
                    className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5 disabled:opacity-40"
                  >
                    Mark job complete
                  </button>
                )}
                {owing > 0 && (
                  <>
                    {paymentInputId === j.id ? (
                      <span className="flex items-center gap-1.5">
                        <input
                          type="number"
                          autoFocus
                          value={paymentValue}
                          onChange={(e) => setPaymentValue(e.target.value)}
                          placeholder={`up to ${owing}`}
                          className="app-field text-[13px] py-1.5 w-28"
                        />
                        <button
                          onClick={() => recordPayment(j.id, owing)}
                          disabled={busyId === j.id}
                          className="text-[13px] font-semibold bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
                        >
                          Save
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setPaymentInputId(j.id);
                          setPaymentValue(String(owing));
                        }}
                        className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5"
                      >
                        Record payment
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
