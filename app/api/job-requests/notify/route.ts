import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePostcode } from "@/lib/resolvePostcode";
import { getTradeVariants } from "@/lib/seo/meta";
import { buildLeadMatchEmail, buildNoMatchLeadEmail } from "@/lib/email/templates";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Swiftscope Leads <noreply@swiftscope.com.au>",
        to: [to],
        subject,
        html,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { requestId, widerRadius } = await req.json();
  if (!requestId) return NextResponse.json({ error: "No requestId" }, { status: 400 });

  const supabase = await createClient();

  // Get the job request
  const { data: request } = await supabase
    .from("job_requests")
    .select("*, homeowner_profiles(name, suburb)")
    .eq("id", requestId)
    .single();

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const requestTrade = request.trade?.toLowerCase() ?? "";
  const requestSuburb = request.suburb ?? "";
  // The "Get Quotes" form only asks for a free-text suburb, so most
  // requests don't have request.postcode set at creation time even now -
  // resolve it the same way if it's missing.
  const requestPostcode = request.postcode || (await resolvePostcode(supabase, requestSuburb));

  // ── OPT-OUT MODEL: Find subscribed tradies ─────────────────────────
  // Every profile with a matching trade is a candidate by default -
  // that's what "opt-out" means. Only exclude a profile if it has an
  // explicit is_active=false row in lead_subscriptions for this trade.
  //
  // Previously this checked lead_subscriptions FIRST and, if it found
  // ANY active row for this trade (which happens automatically for
  // every onboarded tradie - see app/onboarding/page.tsx), used ONLY
  // those rows as the candidate list - completely skipping every other
  // same-trade tradie who never got a subscription row created (missing
  // suburb at signup, team members, accounts created before this
  // feature existed). Since the moment one tradie for a trade has a row,
  // every other opted-in-by-default tradie for that trade silently
  // stopped receiving leads. There's no UI to subscribe to extra
  // suburbs beyond the one auto-created at onboarding, so matching
  // directly against profiles.trades/profiles.suburb is equivalent to
  // what an active subscription row represents anyway - just without
  // requiring the row to exist.
  let profileIds: string[] = [];

  const { data: optedOut } = await supabase
    .from("lead_subscriptions")
    .select("profile_id")
    .eq("trade", requestTrade)
    .eq("is_active", false);

  const optedOutIds = new Set((optedOut ?? []).map((o) => o.profile_id));

  // Find profiles whose trades array contains the request trade
  const { data: matchingProfiles } = await supabase
    .from("profiles")
    .select("id, trades, suburb, directory_postcode")
    .overlaps("trades", getTradeVariants(requestTrade));

  if (matchingProfiles && matchingProfiles.length > 0) {
    let filtered = matchingProfiles;

    if (!widerRadius) {
      // Postcode is the real, canonical match key (same reasoning as the
      // /directory search page and admin scraper: suburb text is
      // inconsistent - typos, "Mt" vs "Mount", missing entirely). Most
      // tradie profiles only have a service suburb typed at onboarding,
      // not a postcode directly, so resolve one per profile (preferring
      // directory_postcode if they've already set one via the directory
      // listing panel) the same way the request's postcode is resolved.
      const withPostcodes = await Promise.all(
        matchingProfiles.map(async (p) => ({
          profile: p,
          postcode: p.directory_postcode || (await resolvePostcode(supabase, p.suburb)),
        }))
      );

      filtered = requestPostcode
        ? withPostcodes.filter((p) => p.postcode === requestPostcode).map((p) => p.profile)
        : // Couldn't resolve a postcode for the request at all - fall back
          // to fuzzy suburb text so matching doesn't just stop working.
          matchingProfiles.filter((p) => {
            if (!p.suburb) return false;
            const ps = p.suburb.toLowerCase();
            const rs = requestSuburb.toLowerCase();
            return ps.includes(rs) || rs.includes(ps);
          });
    }

    profileIds = filtered
      .map((p) => p.id)
      .filter((id) => !optedOutIds.has(id));
  }

  if (!profileIds.length) {
    // No tradies matched — notify team so they can manually route or follow up
    const noMatch = buildNoMatchLeadEmail({
      trade: request.trade,
      suburb: request.suburb,
      description: request.description,
    });
    await sendEmail("team@swiftscope.com.au", noMatch.subject, noMatch.html);
    return NextResponse.json({ ok: true, sent: 0, reason: "no_matching_tradies" });
  }

  // Get profile details for email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, business_name, contact_email")
    .in("id", profileIds);

  if (!profiles?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_emails" });
  }

  let sent = 0;
  const notifiedAt = new Date().toISOString();

  for (const profile of profiles) {
    if (!profile.contact_email) continue;

    const { subject, html } = buildLeadMatchEmail({
      trade: request.trade,
      suburb: request.suburb,
      postcode: request.postcode ?? undefined,
      leadTemperature: request.lead_temperature,
      description: request.description,
      additionalDetails: request.additional_details ?? undefined,
      budget: request.budget ?? undefined,
      timeline: request.timeline ?? undefined,
      photoCount: request.photo_paths?.length ?? undefined,
      appUrl: APP_URL,
    });

    const emailSent = await sendEmail(profile.contact_email, subject, html);

    // Log the notification
    // (lead_matching_log has RLS enabled with no policies -- it's a purely
    // internal audit trail with no per-tenant read access needed, so the
    // admin client is used here rather than adding a public policy. The
    // regular client's insert was silently failing before this fix, since
    // no role had permission and the error was never checked.)
    const admin = createAdminClient();
    await admin.from("lead_matching_log").insert({
      request_id: requestId,
      profile_id: profile.id,
      notified_at: notifiedAt,
      email_sent: emailSent,
      claim_status: "pending",
    });

    if (emailSent) sent++;
  }

  // If wider radius, mark the request
  if (widerRadius) {
    await supabase
      .from("job_requests")
      .update({ wider_radius_sent_at: notifiedAt })
      .eq("id", requestId);
  }

  return NextResponse.json({ ok: true, sent, total: profiles.length });
}
