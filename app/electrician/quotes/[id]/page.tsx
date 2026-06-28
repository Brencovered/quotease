import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadJobDetailData } from "@/lib/jobDetail";
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

  const data = await loadJobDetailData(supabase, id, userData.user.id);
  if (!data) notFound();
  const { quote, followUps, attachmentsWithUrls, marginPct } = data;

  if (quote.status === "accepted" || quote.status === "paid") {
    redirect(`/electrician/jobs/${id}`);
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
            <p className="font-display text-2xl text-[var(--ink)]">${(quote.total_cost ?? 0).toLocaleString()}</p>
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

          {quote.status === "sent" && (
            <FollowUpPanel quoteId={quote.id} followUps={followUps} followUpAt={quote.follow_up_at} expiresAt={quote.quote_expires_at} />
          )}

          <JobPlansPanel quoteId={quote.id} clientId={quote.client_id} plans={quotePlans as never} materials={tradeMaterials} marginPct={marginPct ?? 20} trade={quote.trade ?? "electrician"} />

          <JobFilesPanel quoteId={quote.id} attachments={attachmentsWithUrls} />
        </div>
      </main>
    </>
  );
}
