import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) notFound();
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const [{ data: client }, { data: quotes }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).eq("profile_id", businessId).single(),
    supabase.from("quotes").select("id, total_cost, status, created_at, trade").eq("client_id", id).order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();

  // A quote's own id and its job's id are different records (jobs are a
  // separate table, created from a quote via quote_id, with their own
  // auto-generated id) - linking to /jobs/[quoteId] 404s,
  // since no job shares that id.
  const acceptedOrPaidIds = (quotes ?? []).filter((q) => q.status === "accepted" || q.status === "paid").map((q) => q.id);
  let jobIdByQuoteId = new Map<string, string>();
  if (acceptedOrPaidIds.length > 0) {
    const { data: jobRows } = await supabase
      .from("jobs")
      .select("id, quote_id")
      .eq("profile_id", businessId)
      .in("quote_id", acceptedOrPaidIds);
    jobIdByQuoteId = new Map((jobRows ?? []).map((j) => [j.quote_id as string, j.id as string]));
  }

  return (
    <>
      <AppHeader />
      <main className="page-wrap-narrow">
        <p className="text-[12px] text-[var(--ink-faint)] mb-1">
          <Link href="/clients" className="hover:underline">Clients</Link> / {client.name}
        </p>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="font-display text-2xl text-[var(--ink)]">{client.name}</h1>
          <Link href={`/quote?client_id=${client.id}`} className="btn-secondary text-[12.5px] py-2 px-3 shrink-0">
            + New quote
          </Link>
        </div>
        {client.billing_address && <p className="text-[13px] text-[var(--ink-faint)] mb-5">{client.billing_address}</p>}

        <div className="flex flex-col gap-4">
          {/* Plans now live per quote/job (see each row below), rather than
              as one flat client-wide list - a plan uploaded for one job no
              longer shows up on every other job this client happens to
              have. Click into a quote or job to view or upload its plans. */}
          <div className="card">
            <p className="section-tag mb-3">Quotes &amp; jobs</p>
            {!quotes || quotes.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-faint)]">No quotes for this client yet.</p>
            ) : (
              <div className="divide-y divide-[var(--line-subtle)]">
                {quotes.map((q) => {
                  const isJob = q.status === "accepted" || q.status === "paid";
                  const jobId = jobIdByQuoteId.get(q.id);
                  return (
                    <Link
                      key={q.id}
                      href={isJob && jobId ? `/jobs/${jobId}` : `/quotes/${q.id}`}
                      className="flex items-center justify-between py-2.5 hover:bg-[var(--app-bg)] -mx-2 px-2 rounded-lg"
                    >
                      <div>
                        <p className="text-[13.5px] font-semibold text-[var(--ink)] capitalize">{q.trade}</p>
                        <p className="text-[11.5px] text-[var(--ink-faint)]">{new Date(q.created_at).toLocaleDateString("en-AU")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[13.5px] font-bold text-[var(--ink)]">${(q.total_cost ?? 0).toLocaleString()}</p>
                        <p className="text-[11px] text-[var(--ink-faint)] capitalize">{q.status}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
