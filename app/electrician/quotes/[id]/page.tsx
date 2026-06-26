import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import VariationsPanel from "@/components/VariationsPanel";
import JobCostingPanel from "@/components/JobCostingPanel";
import CompliancePanel from "@/components/CompliancePanel";
import FollowUpPanel from "@/components/FollowUpPanel";
import JobFilesPanel from "@/components/JobFilesPanel";
import JobBriefPanel from "@/components/JobBriefPanel";
import MaterialsChecklistPanel from "@/components/MaterialsChecklistPanel";
import JobActionsBar from "@/components/JobActionsBar";
import { humanizeIntake } from "@/lib/scopeOfWorks";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) notFound();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("profile_id", userData.user.id)
    .single();

  if (!quote) notFound();

  const [{ data: variations }, { data: actuals }, { data: certs }, { data: followUps }, { data: attachments }, { data: profile }] = await Promise.all([
    supabase.from("variations").select("*").eq("quote_id", id).order("created_at"),
    supabase.from("job_actuals").select("*").eq("quote_id", id).order("recorded_at"),
    supabase.from("compliance_certs").select("*").eq("quote_id", id).order("created_at"),
    supabase.from("follow_up_log").select("*").eq("quote_id", id).order("followed_up_at", { ascending: false }),
    supabase.from("job_attachments").select("*").eq("quote_id", id).order("created_at"),
    supabase.from("profiles").select("hourly_rate, materials_margin_pct").eq("id", userData.user.id).single(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachmentsWithUrls: any[] = await Promise.all(
    (attachments ?? []).map(async (a: Record<string, unknown>) => {
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(a.storage_path as string, 3600);
      return { ...a, signedUrl: signed?.signedUrl };
    })
  );

  const certsWithUrls = await Promise.all(
    (certs ?? []).map(async (c: Record<string, unknown>) => {
      if (!c.storage_path) return c;
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(c.storage_path as string, 3600 * 24 * 365);
      return { ...c, signedUrl: signed?.signedUrl };
    })
  );

  const hourlyRate = (profile as { hourly_rate: number } | null)?.hourly_rate ?? 95;
  const marginPct = (profile as { materials_margin_pct: number } | null)?.materials_margin_pct ?? 20;
  const isJob = quote.status === "accepted" || quote.status === "paid";
  const scopeLines = humanizeIntake(quote.intake_data);
  const labourCost = (quote.total_cost ?? 0) - (quote.materials_cost ?? 0);

  const statusColor: Record<string, string> = {
    draft: "bg-[var(--app-bg)] text-[var(--ink-soft)]",
    sent: "bg-blue-50 text-blue-700",
    accepted: "bg-amber-50 text-amber-800",
    paid: "bg-green-50 text-green-700",
    declined: "bg-red-50 text-red-700",
  };

  return (
    <>
      <AppHeader />
      <main className="page-wrap-narrow">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[12px] text-[var(--ink-faint)] mb-1"><Link href="/electrician/quotes" className="hover:underline">Quotes</Link> / {quote.invoice_number ?? id.slice(0, 8)}</p>
            <h1 className="font-display text-2xl text-[var(--ink)]">{quote.client_name || "Unnamed client"}</h1>
            {quote.site_address && <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">{quote.site_address}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-2xl text-[var(--ink)]">${(quote.total_cost ?? 0).toLocaleString()}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold inline-block mt-1 ${statusColor[quote.status] ?? ""}`}>{quote.status}</span>
            <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer" className="block text-[12.5px] font-semibold text-[var(--navy)] underline mt-2">
              Download PDF
            </a>
          </div>
        </div>

        {/* Job-won banner - the moment a quote is meant to feel like a job, not just a status label */}
        {isJob && (
          <div className="bg-[var(--navy)] rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[.1em] uppercase text-[var(--steel-3)] font-bold">
                {quote.status === "paid" ? "Job complete & paid" : quote.completed_at ? "Job complete — awaiting payment" : "Active job"}
              </p>
              {quote.scheduled_date && (
                <p className="text-[13px] text-[var(--steel-1)] mt-0.5">
                  Scheduled {new Date(quote.scheduled_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                  {quote.assigned_to ? ` — ${quote.assigned_to}` : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Scope and cost - the thing that was missing entirely from this page before */}
        <div className="card mb-4">
          <p className="section-tag mb-3">Scope and cost</p>
          {scopeLines.length > 0 ? (
            <ul className="grid sm:grid-cols-2 gap-y-1 gap-x-4 mb-4">
              {scopeLines.map((line) => (
                <li key={line} className="text-[13.5px] text-[var(--ink-soft)]">• {line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--ink-faint)] mb-4">No scope details recorded.</p>
          )}
          <div className="border-t border-[var(--line)] pt-3 space-y-1">
            <div className="flex justify-between text-[13.5px]">
              <span className="text-[var(--ink-soft)]">Labour ({quote.labour_hours ?? 0} hrs)</span>
              <span className="font-semibold text-[var(--ink)]">${labourCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[13.5px]">
              <span className="text-[var(--ink-soft)]">Materials</span>
              <span className="font-semibold text-[var(--ink)]">${(quote.materials_cost ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[14.5px] pt-1 border-t border-[var(--line)]">
              <span className="font-bold text-[var(--ink)]">Total</span>
              <span className="font-display text-lg text-[var(--ink)]">${(quote.total_cost ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Actions - the page now does the work, not just displays records */}
          <JobActionsBar
            quoteId={quote.id}
            status={quote.status}
            totalCost={quote.total_cost ?? 0}
            amountPaid={quote.amount_paid ?? 0}
            hasClientEmail={!!quote.client_email}
            completedAt={quote.completed_at}
          />

          {/* Follow-up only matters pre-acceptance, and only once it's actually been sent */}
          {quote.status === "sent" && (
            <FollowUpPanel quoteId={quote.id} followUps={followUps ?? []} followUpAt={quote.follow_up_at} expiresAt={quote.quote_expires_at} />
          )}

          {/* Everything below is job-execution - what to know, what to buy, what's happening on site */}
          {isJob && (
            <>
              <JobBriefPanel quoteId={quote.id} siteNotes={quote.site_notes} scheduledDate={quote.scheduled_date} assignedTo={quote.assigned_to} />
              <MaterialsChecklistPanel quoteId={quote.id} initialChecklist={quote.materials_checklist ?? []} scopeLines={scopeLines} />
            </>
          )}

          <JobFilesPanel quoteId={quote.id} attachments={attachmentsWithUrls} />

          {isJob && (
            <>
              <VariationsPanel quoteId={quote.id} hourlyRate={hourlyRate} margin={marginPct} variations={variations ?? []} quoteTotalCost={quote.total_cost ?? 0} />
              <JobCostingPanel
                quoteId={quote.id}
                quotedHours={quote.labour_hours ?? 0}
                quotedMaterials={quote.materials_cost ?? 0}
                quotedTotal={quote.total_cost ?? 0}
                hourlyRate={hourlyRate}
                actuals={actuals ?? []}
                intakeData={quote.intake_data}
              />
              <CompliancePanel quoteId={quote.id} certs={certsWithUrls as never} />
            </>
          )}
        </div>
      </main>
    </>
  );
}
