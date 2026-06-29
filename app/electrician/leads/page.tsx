import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import LeadsPanel from "@/components/LeadsPanel";
import Link from "next/link";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check directory access
  const { data: settings } = await supabase
    .from("tradie_directory_settings")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  const hasAccess = settings?.directory_active && settings?.monthly_fee_active;

  if (!hasAccess) {
    return (
      <>
        <AppHeader />
        <div className="page-wrap-narrow">
          <div className="card text-center py-12">
            <p className="text-[32px] mb-3">🔒</p>
            <p className="font-semibold text-[var(--ink)] mb-1">Directory access required</p>
            <p className="text-[13.5px] text-[var(--ink-faint)] max-w-xs mx-auto mb-5">
              Get access to homeowner quote requests in your area for $10/month on top of your Swiftscope plan.
            </p>
            <Link href="/settings" className="btn-primary inline-flex">
              Set up directory access
            </Link>
          </div>
        </div>
      </>
    );
  }

  // Get job requests matching this tradie's service suburbs and trade
  const profile = await supabase
    .from("profiles")
    .select("trades")
    .eq("id", user.id)
    .single();

  const trades = profile.data?.trades ?? [];
  const serviceSuburbs = settings.service_suburbs ?? [];
  const leadTemps = settings.lead_temps_wanted ?? ["early","warm","hot"];

  // Fetch open requests in their area
  let query = supabase
    .from("job_requests")
    .select("*, job_claims(request_id, status)")
    .in("status", ["open","partially_claimed","fully_claimed"])
    .in("lead_temperature", leadTemps)
    .order("created_at", { ascending: false })
    .limit(50);

  if (trades.length > 0) query = query.in("trade", trades);

  const { data: allRequests } = await query;

  // Filter by service suburbs client-side
  const requests = (allRequests ?? []).filter(r =>
    serviceSuburbs.length === 0 ||
    serviceSuburbs.some((s: string) =>
      s.toLowerCase().includes(r.suburb.toLowerCase()) ||
      r.suburb.toLowerCase().includes(s.toLowerCase())
    )
  );

  // Get this tradie's claimed request IDs
  const { data: myClaims } = await supabase
    .from("job_claims")
    .select("request_id")
    .eq("tradie_profile_id", user.id)
    .eq("status", "claimed");

  const myClaimedIds = myClaims?.map(c => c.request_id) ?? [];

  return (
    <>
      <AppHeader />
      <div className="page-wrap-narrow">
        <div className="mb-6">
          <h1 className="font-display text-[26px] text-[var(--ink)]">Leads</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
            Homeowners in your service area looking for quotes.
            Claim a lead to get their contact details.
          </p>
        </div>
        <LeadsPanel requests={requests} myClaimedIds={myClaimedIds} />
      </div>
    </>
  );
}
