import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import VariationsPanel from "@/components/VariationsPanel";
import JobCostingPanel from "@/components/JobCostingPanel";
import CompliancePanel from "@/components/CompliancePanel";
import FollowUpPanel from "@/components/FollowUpPanel";
import JobFilesPanel from "@/components/JobFilesPanel";

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

  // Generate signed URLs for attachments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachmentsWithUrls: any[] = await Promise.all(
    (attachments ?? []).map(async (a: Record<string, unknown>) => {
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(a.storage_path as string, 3600);
      return { ...a, signedUrl: signed?.signedUrl };
    })
  );

  // Generate signed URLs for compliance certs that have a file
  const certsWithUrls = await Promise.all(
    (certs ?? []).map(async (c: Record<string, unknown>) => {
      if (!c.storage_path) return c;
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(c.storage_path as string, 3600 * 24 * 365);
      return { ...c, signedUrl: signed?.signedUrl };
    })
  );

  const hourlyRate = (profile as { hourly_rate: number } | null)?.hourly_rate ?? 95;
  const marginPct = (profile as { materials_margin_pct: number } | null)?.materials_margin_pct ?? 20;

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
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-[12px] text-[var(--ink-faint)] mb-1"><Link href="/electrician/quotes" className="hover:underline">Quotes</Link> / {quote.invoice_number ?? id.slice(0, 8)}</p>
            <h1 className="font-display text-2xl text-[var(--ink)]">{quote.client_name || "Unnamed client"}</h1>
            {quote.site_address && <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">{quote.site_address}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-2xl text-[var(--ink)]">${(quote.total_cost ?? 0).toLocaleString()}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold inline-block mt-1 ${statusColor[quote.status] ?? ""}`}>{quote.status}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Follow-up — always shown for sent/draft quotes */}
          {(quote.status === "sent" || quote.status === "draft") && (
            <FollowUpPanel
              quoteId={quote.id}
              followUps={followUps ?? []}
              followUpAt={quote.follow_up_at}
              expiresAt={quote.quote_expires_at}
            />
          )}

          {/* Drawings and job files */}
          <JobFilesPanel quoteId={quote.id} attachments={attachmentsWithUrls} />

          {/* Variations — for accepted/active jobs */}
          {(quote.status === "accepted" || quote.status === "paid") && (
            <VariationsPanel
              quoteId={quote.id}
              hourlyRate={hourlyRate}
              margin={marginPct}
              variations={variations ?? []}
              quoteTotalCost={quote.total_cost ?? 0}
            />
          )}

          {/* Job costing actuals */}
          {(quote.status === "accepted" || quote.status === "paid") && (
            <JobCostingPanel
              quoteId={quote.id}
              quotedHours={quote.labour_hours ?? 0}
              quotedMaterials={quote.materials_cost ?? 0}
              quotedTotal={quote.total_cost ?? 0}
              hourlyRate={hourlyRate}
              actuals={actuals ?? []}
            />
          )}

          {/* Compliance certs */}
          {(quote.status === "accepted" || quote.status === "paid") && (
            <CompliancePanel quoteId={quote.id} certs={certsWithUrls as never} />
          )}
        </div>
      </main>
    </>
  );
}
