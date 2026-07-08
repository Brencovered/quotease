import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import LeadsPanel from "@/components/LeadsPanel";
import { getActiveBusinessId } from "@/lib/team";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Leads are a business-wide resource (subscriptions, claims) - a team
  // member should see and claim leads for the business they work for,
  // not have their own empty, siloed subscription set.
  const businessId = await getActiveBusinessId(supabase, user.id);

  // Profile and subscriptions don't depend on each other - fetch both at
  // once instead of one after another. (Previously fully sequential:
  // profile, then subscriptions, then job_requests, then myClaims - each
  // waiting on the last even though most don't actually depend on it.)
  const [{ data: profile }, { data: subscriptions }] = await Promise.all([
    supabase.from("profiles").select("id, trades, suburb, business_name").eq("id", businessId).single(),
    supabase.from("lead_subscriptions").select("trade, suburb, is_active").eq("profile_id", businessId),
  ]);

  const trades = (profile?.trades ?? []).map((t: string) => t.toLowerCase());
  const tradieSuburb = profile?.suburb ?? "";

  // Build list of active (trade, suburb) combos they're subscribed to
  const activeSubs = (subscriptions ?? []).filter((s) => s.is_active);

  // If they have no subscriptions yet but have trades + suburb,
  // create them on-the-fly (migration path for existing users)
  if (activeSubs.length === 0 && trades.length > 0 && tradieSuburb) {
    const newSubs = trades.map((trade: string) => ({
      profile_id: businessId,
      trade,
      suburb: tradieSuburb,
      is_active: true,
    }));
    await supabase.from("lead_subscriptions").upsert(newSubs, {
      onConflict: "profile_id,trade,suburb",
      ignoreDuplicates: true,
    });
    // Refresh
    const { data: freshSubs } = await supabase
      .from("lead_subscriptions")
      .select("trade, suburb, is_active")
      .eq("profile_id", businessId);
    activeSubs.push(...(freshSubs ?? []).filter((s) => s.is_active));
  }

  // Determine which suburbs and trades to query for
  const subscribedSuburbs = [...new Set(activeSubs.map((s) => s.suburb))];
  const subscribedTrades = [...new Set(activeSubs.map((s) => s.trade))];

  // Build the query — match any of their subscribed trade+suburb combos
  let query = supabase
    .from("job_requests")
    .select("*, job_claims(request_id, status)")
    .in("status", ["open", "partially_claimed", "fully_claimed"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (subscribedTrades.length > 0) {
    query = query.in(
      "trade",
      subscribedTrades
    );
  }

  // job_requests and myClaims are also independent of each other.
  const [{ data: allRequests }, { data: myClaims }] = await Promise.all([
    query,
    supabase.from("job_claims").select("request_id").eq("tradie_profile_id", businessId).eq("status", "claimed"),
  ]);

  // Filter by suburb client-side for fuzzy matching
  const requests = (allRequests ?? []).filter((r) => {
    // Must match at least one subscribed suburb
    if (subscribedSuburbs.length === 0) return true; // Show all if no suburb filter
    const requestSuburb = (r.suburb ?? "").toLowerCase();
    return subscribedSuburbs.some(
      (s) =>
        s.toLowerCase().includes(requestSuburb) ||
        requestSuburb.includes(s.toLowerCase())
    );
  });

  const myClaimedIds = myClaims?.map((c) => c.request_id) ?? [];

  // Resolve photo_paths into signed URLs
  const requestsWithPhotoUrls = await Promise.all(
    requests.map(async (r) => {
      if (!r.photo_paths?.length) return { ...r, photo_urls: [] as string[] };
      const signed = await Promise.all(
        (r.photo_paths as string[]).map((p: string) =>
          supabase.storage.from("job-files").createSignedUrl(p, 3600)
        )
      );
      return {
        ...r,
        photo_urls: signed
          .map((s) => s.data?.signedUrl)
          .filter((u): u is string => !!u),
      };
    })
  );

  // Check if they're opted out of all leads
  const allOptedOut = subscriptions && subscriptions.length > 0 && subscriptions.every((s) => !s.is_active);

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

        {allOptedOut ? (
          <div className="card text-center py-12">
            <p className="text-[32px] mb-3">🔕</p>
            <p className="font-semibold text-[var(--ink)] mb-1">
              Lead notifications are paused
            </p>
            <p className="text-[13.5px] text-[var(--ink-faint)] max-w-xs mx-auto mb-5">
              You've opted out of lead notifications. Turn them back on in
              settings to start receiving leads again.
            </p>
            <a href="/settings" className="btn-primary inline-flex">
              Manage lead preferences
            </a>
          </div>
        ) : activeSubs.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-[32px] mb-3">📍</p>
            <p className="font-semibold text-[var(--ink)] mb-1">
              Set your service area
            </p>
            <p className="text-[13.5px] text-[var(--ink-faint)] max-w-xs mx-auto mb-5">
              Add your service suburb and trade in your profile to start
              receiving leads from homeowners in your area.
            </p>
            <a href="/settings" className="btn-primary inline-flex">
              Update your profile
            </a>
          </div>
        ) : (
          <LeadsPanel
            requests={requestsWithPhotoUrls}
            myClaimedIds={myClaimedIds}
            now={Date.now()}
          />
        )}
      </div>
    </>
  );
}
