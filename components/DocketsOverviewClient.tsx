"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, FileClock, Receipt, ArrowRight, Loader2 } from "lucide-react";

export interface DocketRow {
  id: string;
  job_id: string;
  work_date: string;
  status: string;
  total_cost: number;
  client_name: string | null;
  signed_by_name: string | null;
  jobs: { job_number: number; title: string | null; client_name: string | null } | { job_number: number; title: string | null; client_name: string | null }[] | null;
  docket_invoices: { invoice_number: string; status: string; xero_exported_at: string | null } | { invoice_number: string; status: string; xero_exported_at: string | null }[] | null;
}

function jobOf(row: DocketRow) {
  return Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
}
function invoiceOf(row: DocketRow) {
  return Array.isArray(row.docket_invoices) ? row.docket_invoices[0] : row.docket_invoices;
}

function jobLabel(row: DocketRow) {
  const job = jobOf(row);
  return `${row.client_name || job?.client_name || "Job"} - Job #${job?.job_number}${job?.title ? ` - ${job.title}` : ""}`;
}

export default function DocketsOverviewClient({
  signed,
  awaiting,
  recentlyInvoiced,
}: {
  signed: DocketRow[];
  awaiting: DocketRow[];
  recentlyInvoiced: DocketRow[];
}) {
  const [bundlingJobId, setBundlingJobId] = useState<string | null>(null);
  const [bundleError, setBundleError] = useState<Record<string, string>>({});
  const [bundledJobIds, setBundledJobIds] = useState<Set<string>>(new Set());

  // Group signed dockets by job - bundling is a per-job action, and one job
  // can have several signed dockets waiting at once.
  const signedByJob = useMemo(() => {
    const groups = new Map<string, DocketRow[]>();
    for (const r of signed) {
      if (bundledJobIds.has(r.job_id)) continue;
      if (!groups.has(r.job_id)) groups.set(r.job_id, []);
      groups.get(r.job_id)!.push(r);
    }
    return groups;
  }, [signed, bundledJobIds]);

  const signedTotal = signed.filter((r) => !bundledJobIds.has(r.job_id)).reduce((sum, r) => sum + r.total_cost, 0);
  const signedCount = signed.filter((r) => !bundledJobIds.has(r.job_id)).length;

  async function bundleJob(jobId: string) {
    setBundlingJobId(jobId);
    setBundleError((prev) => ({ ...prev, [jobId]: "" }));
    try {
      const res = await fetch("/api/dockets/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not create invoice");
      if (body.xero && !body.xero.ok) {
        setBundleError((prev) => ({ ...prev, [jobId]: `Bundled, but not sent to Xero: ${body.xero.error || "Xero isn't connected"}` }));
      }
      setBundledJobIds((prev) => new Set(prev).add(jobId));
    } catch (err) {
      setBundleError((prev) => ({ ...prev, [jobId]: err instanceof Error ? err.message : "Could not create invoice" }));
    } finally {
      setBundlingJobId(null);
    }
  }

  return (
    <>
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={16} className="text-green-700" />
          <p className="font-bold text-[var(--ink)]">Signed - ready to invoice</p>
          {signedCount > 0 && <span className="text-[13px] text-[var(--ink-faint)]">${signedTotal.toLocaleString()} across {signedCount}</span>}
        </div>
        {signedByJob.size === 0 ? (
          <p className="text-[13px] text-[var(--ink-faint)]">Nothing signed and waiting right now.</p>
        ) : (
          <div className="space-y-3">
            {Array.from(signedByJob.entries()).map(([jobId, rows]) => {
              const jobTotal = rows.reduce((sum, r) => sum + r.total_cost, 0);
              return (
                <div key={jobId} className="border border-[var(--line)] rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--ink)]">{jobLabel(rows[0])}</p>
                      <p className="text-[12.5px] text-[var(--ink-faint)]">${jobTotal.toLocaleString()} across {rows.length} docket{rows.length === 1 ? "" : "s"}</p>
                    </div>
                    <button
                      onClick={() => bundleJob(jobId)}
                      disabled={bundlingJobId === jobId}
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-bold bg-green-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50 shrink-0"
                    >
                      {bundlingJobId === jobId ? <><Loader2 size={12} className="animate-spin" /> Bundling...</> : <><Receipt size={12} /> Bundle into invoice</>}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {rows.map((r) => {
                      const workDate = new Date(r.work_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
                      return (
                        <div key={r.id} className="flex items-center justify-between text-[12.5px] text-[var(--ink-soft)] pl-1">
                          <span>{workDate}{r.signed_by_name ? ` - signed by ${r.signed_by_name}` : ""}</span>
                          <span className="font-semibold text-[var(--ink)]">${r.total_cost.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                  {bundleError[jobId] && <p className="text-[12px] text-amber-700 mt-2">{bundleError[jobId]}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-amber-700" />
          <p className="font-bold text-[var(--ink)]">Awaiting signature</p>
          {awaiting.length > 0 && <span className="text-[13px] text-[var(--ink-faint)]">{awaiting.length}</span>}
        </div>
        {awaiting.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-faint)]">Nothing out for signature right now.</p>
        ) : (
          <div className="space-y-2">
            {awaiting.map((r) => {
              const workDate = new Date(r.work_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
              return (
                <Link key={r.id} href={`/jobs/${r.job_id}`} className="flex items-center justify-between border border-[var(--line)] rounded-xl px-4 py-3 hover:border-[var(--ink-faint)] transition-colors">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--ink)]">{jobLabel(r)}</p>
                    <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">{workDate}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[14px] font-bold text-[var(--ink)]">${r.total_cost.toLocaleString()}</span>
                    <ArrowRight size={14} className="text-[var(--ink-faint)]" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {recentlyInvoiced.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Receipt size={16} className="text-blue-700" />
            <p className="font-bold text-[var(--ink)]">Recently invoiced</p>
          </div>
          <div className="space-y-2">
            {recentlyInvoiced.map((r) => {
              const invoice = invoiceOf(r);
              const workDate = new Date(r.work_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
              // Only claim it reached Xero if it actually did - a bundle
              // can exist without a successful push (Xero not connected,
              // token expired, etc), and saying "sent" when it wasn't
              // would send the tradie looking for an invoice that isn't there.
              const statusLine = invoice?.xero_exported_at
                ? `Sent to Xero for invoicing${invoice.invoice_number ? ` (${invoice.invoice_number})` : ""}`
                : invoice
                  ? `Bundled (${invoice.invoice_number}) - not yet sent to Xero`
                  : "Invoiced";
              return (
                <Link key={r.id} href={`/jobs/${r.job_id}`} className="flex items-center justify-between border border-[var(--line)] rounded-xl px-4 py-3 hover:border-[var(--ink-faint)] transition-colors">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--ink)]">{jobLabel(r)}</p>
                    <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">{workDate} - {statusLine}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[14px] font-bold text-[var(--ink)]">${r.total_cost.toLocaleString()}</span>
                    <ArrowRight size={14} className="text-[var(--ink-faint)]" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {signedByJob.size === 0 && awaiting.length === 0 && recentlyInvoiced.length === 0 && (
        <div className="text-center py-16">
          <FileClock size={28} className="text-[var(--ink-faint)] mx-auto mb-3" />
          <p className="text-[14px] text-[var(--ink-faint)]">No dockets yet. Log one from a job&apos;s Overview tab.</p>
        </div>
      )}
    </>
  );
}
