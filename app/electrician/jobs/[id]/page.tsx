import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadJobDetailData } from "@/lib/jobDetail";
import AppHeader from "@/components/AppHeader";
import VariationsPanel from "@/components/VariationsPanel";
import JobCostingPanel from "@/components/JobCostingPanel";
import CompliancePanel from "@/components/CompliancePanel";
import JobFilesPanel from "@/components/JobFilesPanel";
import JobBriefPanel from "@/components/JobBriefPanel";
import MaterialsChecklistPanel from "@/components/MaterialsChecklistPanel";
import JobActionsBar from "@/components/JobActionsBar";
import { humanizeIntake } from "@/lib/scopeOfWorks";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) notFound();

  const data = await loadJobDetailData(supabase, id, userData.user.id);
  if (!data) notFound();
  const { quote, variations, actuals, certsWithUrls, attachmentsWithUrls, hourlyRate, marginPct } = data;

  // A quote that hasn't been won yet has no business living at a job URL -
  // send it back to where it actually belongs.
  if (quote.status !== "accepted" && quote.status !== "paid") {
    redirect(`/electrician/quotes/${id}`);
  }

  const scopeLines = humanizeIntake(quote.intake_data);
  const labourCost = (quote.total_cost ?? 0) - (quote.materials_cost ?? 0);

  return (
    <>
      <AppHeader />
      <main className="page-wrap-narrow">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[12px] text-[var(--ink-faint)] mb-1"><Link href="/electrician/jobs" className="hover:underline">Jobs</Link> / {quote.invoice_number ?? id.slice(0, 8)}</p>
            <h1 className="font-display text-2xl text-[var(--ink)]">{quote.client_name || "Unnamed client"}</h1>
            {quote.site_address && <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">{quote.site_address}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-2xl text-[var(--ink)]">${(quote.total_cost ?? 0).toLocaleString()}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold inline-block mt-1 ${quote.status === "paid" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
              {quote.status === "paid" ? "paid" : "active job"}
            </span>
            <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer" className="block text-[12.5px] font-semibold text-[var(--navy)] underline mt-2">
              Download PDF
            </a>
          </div>
        </div>

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
          <JobActionsBar
            quoteId={quote.id}
            status={quote.status}
            totalCost={quote.total_cost ?? 0}
            amountPaid={quote.amount_paid ?? 0}
            hasClientEmail={!!quote.client_email}
            completedAt={quote.completed_at}
          />

          <JobBriefPanel quoteId={quote.id} siteNotes={quote.site_notes} scheduledDate={quote.scheduled_date} assignedTo={quote.assigned_to} />
          <MaterialsChecklistPanel quoteId={quote.id} initialChecklist={quote.materials_checklist ?? []} scopeLines={scopeLines} />
          <JobFilesPanel quoteId={quote.id} attachments={attachmentsWithUrls} />
          <VariationsPanel quoteId={quote.id} hourlyRate={hourlyRate} margin={marginPct} variations={variations} quoteTotalCost={quote.total_cost ?? 0} />
          <JobCostingPanel
            quoteId={quote.id}
            quotedHours={quote.labour_hours ?? 0}
            quotedMaterials={quote.materials_cost ?? 0}
            quotedTotal={quote.total_cost ?? 0}
            hourlyRate={hourlyRate}
            actuals={actuals}
            intakeData={quote.intake_data}
          />
          <CompliancePanel quoteId={quote.id} certs={certsWithUrls as never} />
        </div>
      </main>
    </>
  );
}
