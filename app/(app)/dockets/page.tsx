import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import { CheckCircle2, Clock, FileClock, Receipt, ArrowRight } from "lucide-react";

interface DocketRow {
  id: string;
  job_id: string;
  work_date: string;
  status: string;
  total_cost: number;
  client_name: string | null;
  signed_by_name: string | null;
  jobs: { job_number: number; title: string | null; client_name: string | null } | { job_number: number; title: string | null; client_name: string | null }[] | null;
}

function jobOf(row: DocketRow) {
  return Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
}

function DocketRowCard({ row }: { row: DocketRow }) {
  const job = jobOf(row);
  const workDate = new Date(row.work_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  return (
    <Link href={`/jobs/${row.job_id}`} className="flex items-center justify-between border border-[var(--line)] rounded-xl px-4 py-3 hover:border-[var(--ink-faint)] transition-colors">
      <div>
        <p className="text-[14px] font-semibold text-[var(--ink)]">
          {row.client_name || job?.client_name || "Job"} - Job #{job?.job_number}{job?.title ? ` - ${job.title}` : ""}
        </p>
        <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">
          {workDate}{row.signed_by_name ? ` - signed by ${row.signed_by_name}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[14px] font-bold text-[var(--ink)]">${row.total_cost.toLocaleString()}</span>
        <ArrowRight size={14} className="text-[var(--ink-faint)]" />
      </div>
    </Link>
  );
}

export default async function DocketsOverviewPage() {
  let signed: DocketRow[] = [];
  let awaiting: DocketRow[] = [];
  let recentlyInvoiced: DocketRow[] = [];

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const { data: rows } = await supabase
        .from("dockets")
        .select("id, job_id, work_date, status, total_cost, client_name, signed_by_name, jobs(job_number, title, client_name)")
        .eq("profile_id", businessId)
        .order("work_date", { ascending: false })
        .limit(200);

      const all = (rows ?? []) as unknown as DocketRow[];
      signed = all.filter((r) => r.status === "signed");
      awaiting = all.filter((r) => r.status === "draft" || r.status === "sent");
      recentlyInvoiced = all.filter((r) => r.status === "invoiced").slice(0, 10);
    }
  } catch (err) {
    console.error("Dockets overview page:", err);
  }

  const signedTotal = signed.reduce((sum, r) => sum + r.total_cost, 0);

  return (
    <>
      <AppHeader />
      <div className="page-wrap">
        <h1 className="font-display text-[26px] text-[var(--ink)] mb-1">Dockets</h1>
        <p className="text-[13px] text-[var(--ink-faint)] mb-6">Every dayworks docket across your jobs, in one place.</p>

        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-green-700" />
            <p className="font-bold text-[var(--ink)]">Signed - ready to invoice</p>
            {signed.length > 0 && <span className="text-[13px] text-[var(--ink-faint)]">${signedTotal.toLocaleString()} across {signed.length}</span>}
          </div>
          {signed.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-faint)]">Nothing signed and waiting right now.</p>
          ) : (
            <div className="space-y-2">
              {signed.map((r) => <DocketRowCard key={r.id} row={r} />)}
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
              {awaiting.map((r) => <DocketRowCard key={r.id} row={r} />)}
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
              {recentlyInvoiced.map((r) => <DocketRowCard key={r.id} row={r} />)}
            </div>
          </section>
        )}

        {signed.length === 0 && awaiting.length === 0 && recentlyInvoiced.length === 0 && (
          <div className="text-center py-16">
            <FileClock size={28} className="text-[var(--ink-faint)] mx-auto mb-3" />
            <p className="text-[14px] text-[var(--ink-faint)]">No dockets yet. Log one from a job&apos;s Overview tab.</p>
          </div>
        )}
      </div>
    </>
  );
}
