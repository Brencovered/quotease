import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadJobDetailData } from "@/lib/jobDetail";
import { getTeamContext } from "@/lib/team";
import { getOrSeedBoardColumns } from "@/lib/jobBoard";
import AppHeader from "@/components/AppHeader";
import VariationsPanel from "@/components/VariationsPanel";
import DocketsPanel from "@/components/DocketsPanel";
import JobCostingPanel from "@/components/JobCostingPanel";
import CompliancePanel from "@/components/CompliancePanel";
import JobFilesPanel from "@/components/JobFilesPanel";
import JobCrewPanel from "@/components/JobCrewPanel";
import JobBriefPanel from "@/components/JobBriefPanel";
import JobTasksPanel from "@/components/JobTasksPanel";
import MaterialsChecklistPanel from "@/components/MaterialsChecklistPanel";
import JobTimeline from "@/components/JobTimeline";
import JobPlansPanel from "@/components/JobPlansPanel";
import SiteAnnotationReport from "@/components/SiteAnnotationReport";
import { resolveAnnotationFrameUrls, type AnnotationMetaPersisted } from "@/lib/siteAnnotations";
import JobActionsBar from "@/components/JobActionsBar";
import QuickJobActionsBar from "@/components/QuickJobActionsBar";
import JobProgressStepper from "@/components/JobProgressStepper";
import TimesheetsPanel from "@/components/TimesheetsPanel";
import JobTabs from "@/components/JobTabs";
import { humanizeIntake, summarizeConditions } from "@/lib/scopeOfWorks";
import { getCachedPriceBook, getCachedLegacyMaterials } from "@/lib/cache";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  on_hold: "On hold",
  awaiting_sign_off: "Awaiting sign-off",
  complete: "Complete",
  invoiced: "Invoiced",
  partially_paid: "Partially paid",
  archived: "Archived",
  cancelled: "Cancelled",
};

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) notFound();

  const ctx = await getTeamContext(supabase, userData.user.id);
  const businessId = ctx.businessId;
  const isAdmin = ctx.isOwner || ctx.role === "admin";

  const data = await loadJobDetailData(supabase, id, businessId);
  if (!data) notFound();
  const { job, quote, variations, dockets, docketInvoices, docketRates, actuals, certsWithUrls, attachmentsWithUrls, payments, hourlyRate, marginPct } = data;

  const scopeLines = quote ? humanizeIntake(quote.intake_data) : [];
  const conditionLines = quote ? summarizeConditions(quote.intake_data) : [];
  const savedAnnotations = quote ? (quote.intake_data as { annotation_meta?: AnnotationMetaPersisted[] } | null)?.annotation_meta : undefined;
  const labourCost = (job.labour_hours ?? 0) * hourlyRate;

  // Materials for the plan markup panel - price book first (real supplier
  // pricing), legacy material_items as fallback, same chain the new-quote
  // page uses, so plan markup on an in-progress job prices identically to
  // a brand new quote rather than falling back to stale legacy defaults.
  //
  // Annotation resolution and plan-signing used to be two separate awaited
  // stages, one before this Promise.all and one after - each a full extra
  // round-trip on the waterfall with no data dependency on the others.
  // Folded in here so every independent fetch for this page happens in one
  // concurrent batch instead of four-plus sequential stages.
  const jobTrade = job.trade ?? "electrician";
  const [
    tradeMaterials,
    { data: teamRows },
    { data: taskRows },
    boardColumns,
    timesheetEntries,
    { data: crewRows },
    resolvedAnnotations,
    jobPlans,
  ] = await Promise.all([
    (async (): Promise<Array<{ item_key: string; label: string; unit_cost: number }>> => {
      const pbItems = await getCachedPriceBook(businessId, jobTrade);
      if (pbItems.length > 0) {
        return pbItems.map((m) => ({ item_key: m.id, label: m.description, unit_cost: m.cost_price ?? 0 }));
      }
      const legacyItems = await getCachedLegacyMaterials(businessId, jobTrade);
      return legacyItems.length > 0 ? legacyItems : [];
    })(),
    supabase.from("team_members").select("id, name, email").eq("owner_profile_id", businessId).eq("status", "active").order("name"),
    supabase.from("job_tasks").select("*").or(`job_id.eq.${job.id}${quote ? `,quote_id.eq.${quote.id}` : ""}`).order("created_at"),
    getOrSeedBoardColumns(supabase, businessId),
    isAdmin
      ? supabase.from("timesheets").select("*").eq("job_id", job.id).order("work_date", { ascending: false }).then((r) => r.data ?? [])
      : Promise.resolve([]),
    supabase.from("job_crew").select("id, team_member_id").eq("job_id", job.id),
    resolveAnnotationFrameUrls(supabase, savedAnnotations),
    (async (): Promise<Array<{ id: string; file_name: string; shapes: unknown[]; calibration: unknown; signedUrl?: string }>> => {
      if (!quote) return [];
      const { data: plans } = await supabase
        .from("client_plans")
        .select("*")
        .eq("quote_id", quote.id)
        .order("created_at", { ascending: false });
      if (!plans || plans.length === 0) return [];
      const { data: signedBatch } = await supabase.storage
        .from("job-files")
        .createSignedUrls(plans.map((p) => p.storage_path), 3600 * 24);
      const urlByPath = new Map((signedBatch ?? []).map((s) => [s.path, s.signedUrl]));
      return plans.map((p) => ({ ...p, signedUrl: urlByPath.get(p.storage_path) }));
    })(),
  ]);
  const teamMembers: Array<{ id: string; name: string | null; email: string }> = teamRows ?? [];
  const jobCrew: Array<{ id: string; team_member_id: string }> = crewRows ?? [];
  const assignedMember = teamMembers.find((m) => m.id === job.assigned_to_member_id);

  // Approved variations and drawing-markup materials add to what's owed on
  // top of the original quoted/quick-job total.
  const markupMaterials = quote ? ((quote.markup_materials as Array<{ totalCost: number }>) ?? []).reduce((sum, m) => sum + (m.totalCost ?? 0), 0) : 0;
  const approvedVariationsTotal = variations
    .filter((v: { status: string; total_cost: number }) => v.status === "approved")
    .reduce((sum: number, v: { total_cost: number }) => sum + (v.total_cost ?? 0), 0);
  const effectiveTotal = (job.total_cost ?? 0) + approvedVariationsTotal + markupMaterials;
  const amountPaid = quote ? (quote.amount_paid ?? 0) : (job.amount_paid ?? 0);

  const ARCHIVE_STATUSES = ["archived", "cancelled"];
  const stepperColumns = (boardColumns ?? []).filter((c) => !c.statuses.every((s: string) => ARCHIVE_STATUSES.includes(s)));

  // Live margin for the Profit tab - same actuals aggregation JobCostingPanel
  // does internally, but weighed against effectiveTotal (quoted + approved
  // variations + drawing markup materials), not just the original quoted
  // total, since variations and markup materials are real revenue too.
  // Pre-actuals there's no honest "real" margin to show yet - cost isn't
  // tracked until a tradie logs it - so that state gets a plain "job value"
  // line instead of a fabricated percentage.
  const hasActuals = actuals.length > 0;
  const totalActualHours = actuals.reduce((s: number, a: { actual_hours: number }) => s + (a.actual_hours ?? 0), 0);
  const totalActualMaterials = actuals.reduce((s: number, a: { actual_materials_cost: number }) => s + (a.actual_materials_cost ?? 0), 0);
  const totalUnexpected = actuals.reduce((s: number, a: { unexpected_costs?: number }) => s + (a.unexpected_costs ?? 0), 0);
  const totalActualCost = totalActualHours * hourlyRate + totalActualMaterials + totalUnexpected;
  const liveMargin = effectiveTotal - totalActualCost;
  const liveMarginPct = effectiveTotal > 0 ? Math.round((liveMargin / effectiveTotal) * 100) : 0;
  const marginTone = liveMarginPct >= 15 ? "green" : liveMarginPct >= 0 ? "amber" : "red";

  return (
    <>
      <AppHeader />
      <main className="page-wrap-narrow">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[12px] text-[var(--ink-faint)] mb-1"><Link href="/jobs" className="hover:underline">Jobs</Link> / Job #{job.job_number}</p>
            <h1 className="font-display text-2xl text-[var(--ink)]">{job.client_name || "Unnamed client"}</h1>
            {job.site_address && <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">{job.site_address}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-2xl text-[var(--ink)]">${effectiveTotal.toLocaleString()}</p>
            <p className="text-[11px] text-[var(--ink-faint)]">Original: ${(job.total_cost ?? 0).toLocaleString()}</p>
            {approvedVariationsTotal > 0 && <p className="text-[11px] text-[var(--green)]">+${approvedVariationsTotal.toLocaleString()} variations</p>}
            {markupMaterials > 0 && <p className="text-[11px] text-[var(--amber-deep)]">+${markupMaterials.toLocaleString()} from drawings</p>}
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold inline-block mt-1 bg-amber-50 text-amber-800">
              {STATUS_LABELS[job.status] ?? job.status}
            </span>
            {quote && (
              <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer" className="block text-[12.5px] font-semibold text-[var(--navy)] underline mt-2">
                Download quote PDF
              </a>
            )}
            <a href={`/api/jobs/${job.id}/invoice-pdf`} target="_blank" rel="noopener noreferrer" className="block text-[12.5px] font-semibold text-[var(--navy)] underline mt-1">
              Download invoice
            </a>
          </div>
        </div>

        <div className="bg-[var(--navy)] rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[.1em] uppercase text-[var(--steel-3)] font-bold">
              {STATUS_LABELS[job.status] ?? job.status}
            </p>
            {job.scheduled_start && (
              <p className="text-[13px] text-[var(--steel-1)] mt-0.5">
                Scheduled {new Date(job.scheduled_start).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                {assignedMember ? ` - ${assignedMember.name || assignedMember.email}` : ""}
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
            <p className="text-[13px] text-[var(--ink-faint)] mb-4">{job.title || "No scope details recorded."}</p>
          )}
          {conditionLines.length > 0 && (
            <div className="mb-4 pb-4 border-b border-[var(--line)]">
              <p className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide mb-1.5">Conditions considered</p>
              <ul className="grid sm:grid-cols-2 gap-y-1 gap-x-4">
                {conditionLines.map((line) => (
                  <li key={line} className="text-[12.5px] text-[var(--ink-faint)]">• {line}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="border-t border-[var(--line)] pt-3 space-y-1">
            <div className="flex justify-between text-[13.5px]">
              <span className="text-[var(--ink-soft)]">Labour ({job.labour_hours ?? 0} hrs)</span>
              <span className="font-semibold text-[var(--ink)]">${labourCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[13.5px]">
              <span className="text-[var(--ink-soft)]">Materials</span>
              <span className="font-semibold text-[var(--ink)]">${(job.materials_cost ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[14.5px] pt-1 border-t border-[var(--line)]">
              <span className="font-bold text-[var(--ink)]">Total</span>
              <span className="font-display text-lg text-[var(--ink)]">${effectiveTotal.toLocaleString()}</span>
            </div>
            {approvedVariationsTotal > 0 && (
              <p className="text-[11.5px] text-[var(--ink-faint)] text-right">
                ${(job.total_cost ?? 0).toLocaleString()} quoted + ${approvedVariationsTotal.toLocaleString()} approved variations
              </p>
            )}
          </div>
          {quote && ((quote.markup_materials as Array<{ label: string; quantity: number; unit: string; totalCost: number }>) ?? []).length > 0 && (
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

        <JobTabs
          hiddenTabs={isAdmin ? [] : ["profit"]}
          overview={
            <>
              {stepperColumns.length > 0 && <JobProgressStepper jobId={job.id} status={job.status} columns={stepperColumns} />}

              {quote ? (
                <JobActionsBar
                  quoteId={quote.id}
                  status={quote.status}
                  totalCost={effectiveTotal}
                  amountPaid={amountPaid}
                  hasClientEmail={!!quote.client_email}
                  completedAt={quote.completed_at}
                />
              ) : (
                <QuickJobActionsBar
                  jobId={job.id}
                  status={job.status}
                  totalCost={effectiveTotal}
                  amountPaid={amountPaid}
                  completedAt={job.completed_at}
                />
              )}

              <JobTasksPanel quoteId={quote?.id ?? null} jobId={job.id} profileId={businessId} initialTasks={taskRows ?? []} teamMembers={teamMembers} />

              <DocketsPanel
                jobId={job.id}
                dockets={dockets as never}
                docketInvoices={docketInvoices as never}
                labourCatalog={docketRates.filter((r: { category: string }) => r.category === "labour") as never}
                plantCatalog={docketRates.filter((r: { category: string }) => r.category === "plant") as never}
                materialsCatalog={tradeMaterials}
                defaultHourlyRate={hourlyRate}
              />

              <JobTimeline
                acceptedAt={quote?.accepted_at ?? job.created_at}
                completedAt={job.completed_at}
                paidAt={job.paid_at ?? quote?.paid_at ?? null}
                variations={variations}
                actuals={actuals}
                attachments={attachmentsWithUrls}
                certs={certsWithUrls as never}
                payments={payments}
              />
            </>
          }
          plans={
            <>
              {quote ? (
                <JobPlansPanel quoteId={quote.id} clientId={quote.client_id} plans={jobPlans as never} materials={tradeMaterials} marginPct={marginPct} trade={job.trade ?? "electrician"} />
              ) : (
                <p className="text-[13px] text-[var(--ink-faint)]">Plan markup needs a linked quote - this job was created without one.</p>
              )}
              {quote && (
                <MaterialsChecklistPanel quoteId={quote.id} initialChecklist={quote.materials_checklist ?? []} scopeLines={scopeLines} clientName={job.client_name} />
              )}
              {/* Only renders anything if this job's quote actually went
                  through live site markup - no camera use, no report. */}
              <SiteAnnotationReport annotations={resolvedAnnotations} />
            </>
          }
          schedule={
            <>
              {quote ? (
                <JobBriefPanel
                  quoteId={quote.id}
                  siteNotes={quote.site_notes}
                  scheduledStart={quote.scheduled_start}
                  estimatedDays={quote.estimated_days}
                  assignedTo={quote.assigned_to}
                  assignedToMemberId={quote.assigned_to_member_id}
                  teamMembers={teamMembers}
                />
              ) : (
                <p className="text-[13px] text-[var(--ink-faint)]">Scheduling needs a linked quote - this job was created without one.</p>
              )}
              <JobCrewPanel jobId={job.id} initialCrew={jobCrew} teamMembers={teamMembers} />
              {isAdmin && (
                <TimesheetsPanel jobId={job.id} entries={timesheetEntries as never} teamMembers={teamMembers} ownerName={userData.user.email ?? "Owner"} />
              )}
              <Link href="/schedule" className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-xl py-2.5 hover:border-[var(--navy)]">
                View full schedule calendar
              </Link>
            </>
          }
          profit={
            isAdmin ? (
            <>
              {hasActuals ? (
                <div className={`rounded-xl p-4 sm:p-5 border ${marginTone === "green" ? "bg-green-50 border-green-200" : marginTone === "amber" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
                  <p className={`text-[11px] tracking-[.12em] uppercase font-bold mb-1 ${marginTone === "green" ? "text-green-700" : marginTone === "amber" ? "text-amber-700" : "text-red-700"}`}>Live margin</p>
                  <div className="flex items-end justify-between flex-wrap gap-3">
                    <div>
                      <p className={`font-display text-4xl ${marginTone === "green" ? "text-green-700" : marginTone === "amber" ? "text-amber-700" : "text-red-600"}`}>{liveMarginPct}%</p>
                      <p className={`text-[13.5px] font-semibold ${marginTone === "green" ? "text-green-700" : marginTone === "amber" ? "text-amber-700" : "text-red-600"}`}>{liveMargin >= 0 ? "+" : "-"}${Math.abs(liveMargin).toLocaleString()}</p>
                    </div>
                    <div className="text-right text-[12.5px] text-[var(--ink-faint)] leading-relaxed">
                      <p>${effectiveTotal.toLocaleString()} job value</p>
                      <p>−${totalActualCost.toLocaleString()} actual cost so far</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--app-bg)] border border-[var(--line)] rounded-xl p-4">
                  <p className="text-[13.5px] font-semibold text-[var(--ink)]">Job value: ${effectiveTotal.toLocaleString()}</p>
                  <p className="text-[12.5px] text-[var(--ink-faint)] mt-1">Log actual hours in Team &amp; Schedule and materials in Variations below to see your live margin on this job.</p>
                </div>
              )}

              <VariationsPanel quoteId={quote?.id ?? null} jobId={job.id} hourlyRate={hourlyRate} margin={marginPct} variations={variations} quoteTotalCost={job.total_cost ?? 0} lib={tradeMaterials} />
              <JobCostingPanel
                quoteId={quote?.id ?? null}
                jobId={job.id}
                quotedHours={job.labour_hours ?? 0}
                quotedMaterials={job.materials_cost ?? 0}
                quotedTotal={job.total_cost ?? 0}
                hourlyRate={hourlyRate}
                actuals={actuals}
                intakeData={quote?.intake_data}
              />
            </>
            ) : null
          }
          files={
            <>
              <JobFilesPanel quoteId={quote?.id ?? null} jobId={job.id} attachments={attachmentsWithUrls} />
              <CompliancePanel quoteId={quote?.id ?? null} jobId={job.id} certs={certsWithUrls as never} now={Date.now()} />
            </>
          }
        />
      </main>
    </>
  );
}
