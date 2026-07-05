/**
 * POST /api/job-requests
 * ------------------------
 * Creates a new lead from the public "Get Quotes" form
 * (components/GetQuotesForm.tsx). This route never existed -- the form
 * was posting to /api/jobs, which is a 404, so every "get quotes" / raise
 * a quote request submission has been silently failing.
 *
 * Sibling routes /api/job-requests/{notify,claim,reject} already existed
 * and already expect a real job_requests row with a homeowner_id, trade,
 * suburb, description, budget, timeline, and lead_temperature -- this is
 * the missing piece that actually creates one.
 *
 * Flow:
 *   1. Create a homeowner_profiles row for the person submitting
 *   2. Create the job_requests row linked to it
 *   3. Fire the existing notify route so matching tradies get emailed
 *      (best-effort -- the lead is saved either way, so a notify hiccup
 *      doesn't lose the request itself)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GetQuotesForm's JOB_STAGES values -> job_requests.lead_temperature.
// "ready to hire" reads as hot, "planning stage" reads as early -- these
// don't share the same words by coincidence, they're describing the same
// three-stage funnel the notify route already understands.
const STAGE_TO_TEMPERATURE: Record<string, string> = {
  ready: "hot",
  warm: "warm",
  planning: "early",
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const trade = typeof body.trade === "string" ? body.trade.trim() : "";
  const jobDescription = typeof body.job_description === "string" ? body.job_description.trim() : "";
  const propertyType = typeof body.property_type === "string" ? body.property_type.trim() : "";
  const timeline = typeof body.timeline === "string" ? body.timeline.trim() || null : null;
  const budget = typeof body.budget === "string" ? body.budget.trim() || null : null;
  const stage = typeof body.stage === "string" ? body.stage.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const consent = body.consent === true;

  if (!trade || !jobDescription || !location || !name || !email) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: "You must agree to be contacted by tradies about this job." }, { status: 400 });
  }

  // homeowner_profiles/job_requests RLS requires auth.uid() = id, which is
  // designed around a logged-in homeowner portal that doesn't exist yet --
  // this form is a public, no-login "get quotes" flow, so an anonymous
  // session can never satisfy that policy. Use the admin client for these
  // two inserts; everything written here is validated above first.
  const supabase = createAdminClient();

  // property_type has no column of its own on job_requests -- fold it
  // into the description rather than lose it or add a column for a
  // single extra word.
  const description = propertyType ? `[${propertyType}] ${jobDescription}` : jobDescription;

  const { data: homeowner, error: homeownerError } = await supabase
    .from("homeowner_profiles")
    .insert({ name, email, phone, suburb: location || null })
    .select("id")
    .single();

  if (homeownerError || !homeowner) {
    console.error("[job-requests] homeowner insert error:", homeownerError?.message);
    return NextResponse.json({ error: "Could not save your details. Please try again." }, { status: 500 });
  }

  const { data: jobRequest, error: jobError } = await supabase
    .from("job_requests")
    .insert({
      homeowner_id: homeowner.id,
      trade,
      suburb: location,
      description,
      budget,
      timeline,
      num_quotes_wanted: 3,
      lead_temperature: STAGE_TO_TEMPERATURE[stage] ?? "warm",
      status: "new",
    })
    .select("id")
    .single();

  if (jobError || !jobRequest) {
    console.error("[job-requests] job_requests insert error:", jobError?.message);
    return NextResponse.json({ error: "Could not save your job request. Please try again." }, { status: 500 });
  }

  // Best-effort: notify matching tradies. The lead is already saved, so
  // a failure here shouldn't turn into a failure response for the
  // homeowner -- log it and move on.
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    await fetch(`${appUrl}/api/job-requests/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: jobRequest.id }),
    });
  } catch (err) {
    console.error("[job-requests] notify call failed:", err);
  }

  return NextResponse.json({ ok: true, id: jobRequest.id });
}
