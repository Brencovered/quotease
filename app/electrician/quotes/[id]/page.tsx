import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadJobDetailData } from "@/lib/jobDetail";
import { getActiveBusinessId } from "@/lib/team";
import { getOrCreateJobForQuote } from "@/lib/jobs";
import AppHeader from "@/components/AppHeader";
import FollowUpPanel from "@/components/FollowUpPanel";
import JobFilesPanel from "@/components/JobFilesPanel";
import JobActionsBar from "@/components/JobActionsBar";
import JobPlansPanel from "@/components/JobPlansPanel";
import { humanizeIntake } from "@/lib/scopeOfWorks";

// This route is for a quote that hasn't been won yet - draft, sent, or
// declined. The moment a client accepts, it stops being a quote you're
// chasing and becomes a job you're running - that's a different page
// with different concerns (see /electrician/jobs/[id]), not just a
// different badge colour on the same page.
export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) notFound();
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const data = await loadJobDetailData(supabase, id, businessId);
  if (!data) notFound();
  const { quote, followUps, attachmentsWithUrls, marginPct } = data;

  if (quote.status === "accepted" || quote.status === "paid") {
    // The job is a separate record with its own id (created from the
    // quote via quote_id) - redirecting to /electrician/jobs/[id] using
    // the QUOTE's id 404s, since no job shares that id.
    // getOrCreateJobForQuote also self-heals the case where a quote was
    // marked accepted/paid but a job was never created for it.
    const job = await getOrCreateJobForQuote(supabase, id);
    if (job) redirect(`/electrician/jobs/${job.id}`);
    // No job and couldn't create one (e.g. the quote's business is
    // missing) - fall through and show the quote page rather than 404.
  }

  const scopeLines = humanizeIntake(quote.intake_data);
  const labourCost = (quote.total_cost ?? 0) - (quote.materials_cost ?? 0);

  // Materials added via plan markup carry a real cost and add to what's
  // owed - same pattern used on the job page, just not yet applied here.
  const markupMaterialsTotal = ((quote.markup_materials as Array<{ totalCost: number }>) ?? []).reduce((sum, m) => sum + (m.totalCost ?? 0), 0);
  const effectiveTotal = (quote.total_cost ?? 0) + markupMaterialsTotal;

  // Load trade materials for markup panel
  let tradeMaterials: Array<{ item_key: string; label: string; unit_cost: number }> = [];
  const { data: matRows } = await supabase
    .from("material_items")
    .select("item_key, label, unit_cost")
    .eq("profile_id", businessId)
    .eq("trade", quote.trade ?? "electrician")
    .order("label");
  if (matRows?.length) tradeMaterials = matRows;

  let quotePlans: Array<{ id: string; file_name: string; shapes: unknown[]; calibration: unknown; signedUrl?: string }> = [];
  if (quote.client_id) {
    const { data: plans } = await supabase
      .from("client_plans")
      .select("*")
      .eq("client_id", quote.client_id)
      .order("created_at", { ascending: false });
    quotePlans = await Promise.all(
      (plans ?? []).map(async (p) => {
        const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(p.storage_path, 3600 * 24);
        return { ...p, signedUrl: signed?.signedUrl };
      })
    );
  }


  const statusColor: Record<string, string> = {
    draft: "bg-[var(--app-bg)] text-[var(--ink-soft)]",
    sent: "bg-blue-50 text-blue-700",
    declined: "bg-red-50 text-red-700",
  };

  return (
    <>
      <AppHeader />
      <main className="page-wrap-narrow">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[12px] text-[var(--ink-faint)] mb-1"><Link href="/electrician/quotes" className="hover:underline">Quotes</Link> / {id.slice(0, 8)}</p>
            <h1 className="font-display text-2xl text-[var(--ink)]">{quote.client_name || "Unnamed client"}</h1>
            {quote.site_address && <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">{quote.site_address}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-2xl text-[var(--ink)]">${effectiveTotal.toLocaleString()}</p>
            {markupMaterialsTotal > 0 && <p className="text-[11px] text-[var(--green)]">+${markupMaterialsTotal.toLocaleString()} from plans</p>}
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold inline-block mt-1 ${statusColor[quote.status] ?? ""}`}>{quote.status}</span>
            <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer" className="block text-[12.5px] font-semibold text-[var(--navy)] underline mt-2">
              Download PDF
            </a>
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
            {markupMaterialsTotal > 0 && (
              <p className="text-[11.5px] text-[var(--ink-faint)] text-right">
                ${(quote.total_cost ?? 0).toLocaleString()} quoted + ${markupMaterialsTotal.toLocaleString()} from plans
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

          {quote.status === "sent" && (
            <FollowUpPanel quoteId={quote.id} followUps={followUps} followUpAt={quote.follow_up_at} expiresAt={quote.quote_expires_at} now={Date.now()} />
          )}

          <JobPlansPanel quoteId={quote.id} clientId={quote.client_id} plans={quotePlans as never} materials={tradeMaterials} marginPct={marginPct ?? 20} trade={quote.trade ?? "electrician"} />

          <JobFilesPanel quoteId={quote.id} attachments={attachmentsWithUrls} />
        </div>
      </main>
    </>
  );
}
