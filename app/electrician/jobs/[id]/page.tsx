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
import JobTimeline from "@/components/JobTimeline";
import JobPlansPanel from "@/components/JobPlansPanel";
import JobActionsBar from "@/components/JobActionsBar";
import { humanizeIntake } from "@/lib/scopeOfWorks";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) notFound();

  const data = await loadJobDetailData(supabase, id, userData.user.id);
  if (!data) notFound();
  const { quote, variations, actuals, certsWithUrls, attachmentsWithUrls, payments, hourlyRate, marginPct } = data;

  // A quote that hasn't been won yet has no business living at a job URL -
  // send it back to where it actually belongs.
  if (quote.status !== "accepted" && quote.status !== "paid") {
    redirect(`/electrician/quotes/${id}`);
  }

  const scopeLines = humanizeIntake(quote.intake_data);
  const labourCost = (quote.total_cost ?? 0) - (quote.materials_cost ?? 0);

  // Load trade materials for markup panel
  let tradeMaterials: Array<{ item_key: string; label: string; unit_cost: number }> = [];
  const { data: matRows } = await supabase
    .from("material_items")
    .select("item_key, label, unit_cost")
    .eq("profile_id", userData.user.id)
    .eq("trade", quote.trade ?? "electrician")
    .order("label");
  if (matRows?.length) tradeMaterials = matRows;

  let jobPlans: Array<{ id: string; file_name: string; shapes: unknown[]; calibration: unknown; signedUrl?: string }> = [];
  if (quote.client_id) {
    const { data: plans } = await supabase
      .from("client_plans")
      .select("*")
      .eq("client_id", quote.client_id)
      .order("created_at", { ascending: false });
    jobPlans = await Promise.all(
      (plans ?? []).map(async (p) => {
        const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(p.storage_path, 3600 * 24);
        return { ...p, signedUrl: signed?.signedUrl };
      })
    );
  }

  // Approved variations are extra work the client agreed to, but until now
  // nothing actually added them to what's owed - Record Payment, the PDF,
  // and the Xero invoice all silently used only the original quoted total.
  // Materials added via plan markup carry a real cost and add to what's
  // owed, same as approved variations - markup_materials is an array of
  // costed items, not a bare number.
  const markupMaterials = ((quote.markup_materials as Array<{ totalCost: number }>) ?? []).reduce((sum, m) => sum + (m.totalCost ?? 0), 0);
  const approvedVariationsTotal = variations
    .filter((v: { status: string; total_cost: number }) => v.status === "approved")
    .reduce((sum: number, v: { total_cost: number }) => sum + (v.total_cost ?? 0), 0);
  const effectiveTotal = (quote.total_cost ?? 0) + approvedVariationsTotal + markupMaterials;

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
            <p className="font-display text-2xl text-[var(--ink)]">${effectiveTotal.toLocaleString()}</p>
            <p className="text-[11px] text-[var(--ink-faint)]">Original: ${(quote.total_cost ?? 0).toLocaleString()}</p>
            {approvedVariationsTotal > 0 && <p className="text-[11px] text-[var(--green)]">+${approvedVariationsTotal.toLocaleString()} variations</p>}
            {markupMaterials > 0 && <p className="text-[11px] text-[var(--amber-deep)]">+${markupMaterials.toLocaleString()} from drawings</p>}
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
              {quote.status === "paid" ? "Job complete & paid" : quote.completed_at ? "Job complete - awaiting payment" : "Active job"}
            </p>
            {quote.scheduled_start && (
              <p className="text-[13px] text-[var(--steel-1)] mt-0.5">
                Scheduled {new Date(quote.scheduled_start).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                {quote.estimated_days > 1 ? ` (${quote.estimated_days} days)` : ""}
                {quote.assigned_to ? ` - ${quote.assigned_to}` : ""}
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
              <span className="font-display text-lg text-[var(--ink)]">${effectiveTotal.toLocaleString()}</span>
            </div>
            {approvedVariationsTotal > 0 && (
              <p className="text-[11.5px] text-[var(--ink-faint)] text-right">
                ${(quote.total_cost ?? 0).toLocaleString()} quoted + ${approvedVariationsTotal.toLocaleString()} approved variations
              </p>
            )}
          </div>
          {((quote.markup_materials as Array<{ label: string; quantity: number; unit: string; totalCost: number }>) ?? []).length > 0 && (
            <div className="border-t border-[var(--line)] pt-3 mt-3">
              <p className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mb-2">From site plans</p>
              <div className="space-y-1.5">
                {(quote.markup_materials as Array<{ label: string; quantity: number; unit: string; totalCost: number }>).map((m, i) => (
                  <div key={i} className="flex justify-between text-[13px]">
                    <span className="text-[var(--ink-soft)]">{m.label} <span className="text-[var(--ink-faint)]">({m.quantity}{m.unit})</span></span>
                    <span className="font-semibold text-[var(--ink)]">${m.totalCost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <JobActionsBar
            quoteId={quote.id}
            status={quote.status}
            totalCost={effectiveTotal}
            amountPaid={quote.amount_paid ?? 0}
            hasClientEmail={!!quote.client_email}
            completedAt={quote.completed_at}
          />

          <JobBriefPanel
            quoteId={quote.id}
            siteNotes={quote.site_notes}
            scheduledStart={quote.scheduled_start}
            estimatedDays={quote.estimated_days}
            assignedTo={quote.assigned_to}
          />

          <JobPlansPanel quoteId={quote.id} clientId={quote.client_id} plans={jobPlans as never} materials={tradeMaterials} marginPct={marginPct} trade={quote.trade ?? "electrician"} />

          <JobTimeline
            acceptedAt={quote.accepted_at}
            completedAt={quote.completed_at}
            paidAt={quote.paid_at}
            variations={variations}
            actuals={actuals}
            attachments={attachmentsWithUrls}
            certs={certsWithUrls as never}
            payments={payments}
          />

          <MaterialsChecklistPanel quoteId={quote.id} initialChecklist={quote.materials_checklist ?? []} scopeLines={scopeLines} clientName={quote.client_name} />
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
