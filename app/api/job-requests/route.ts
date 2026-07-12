/**
 * POST /api/job-requests
 * ------------------------
 * Creates a new lead from the public "Get Quotes" form
 * (components/GetQuotesForm.tsx).
 *
 * Accepts multipart/form-data (not JSON) so photos can come in the same
 * request as the rest of the job details -- fields are sent as regular
 * form fields, photos as one or more "photos" file entries.
 *
 * Sibling routes /api/job-requests/{notify,claim,reject} already existed
 * and already expect a real job_requests row with a homeowner_id, trade,
 * suburb, description, budget, timeline, and lead_temperature.
 *
 * Flow:
 *   1. Create a homeowner_profiles row for the person submitting
 *   2. Create the job_requests row linked to it
 *   3. Upload any photos to the job-files bucket under leads/{id}/... and
 *      save their storage paths on the request
 *   4. Fire the existing notify route so matching tradies get emailed
 *      (best-effort -- the lead is saved either way, so a notify hiccup
 *      doesn't lose the request itself)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import { resolvePostcode } from "@/lib/resolvePostcode";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB each

// GetQuotesForm's JOB_STAGES values -> job_requests.lead_temperature.
// "ready to hire" reads as hot, "planning stage" reads as early -- these
// don't share the same words by coincidence, they're describing the same
// three-stage funnel the notify route already understands.
const STAGE_TO_TEMPERATURE: Record<string, string> = {
  ready: "hot",
  warm: "warm",
  planning: "early",
};

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const trade = str(form.get("trade"));
  const jobDescription = str(form.get("job_description"));
  const propertyType = str(form.get("property_type"));
  const timeline = str(form.get("timeline")) || null;
  const budget = str(form.get("budget")) || null;
  const stage = str(form.get("stage"));
  const location = str(form.get("location"));
  const name = str(form.get("name"));
  const email = str(form.get("email"));
  const phone = str(form.get("phone")) || null;
  const consent = form.get("consent") === "true";
  const additionalDetails = str(form.get("additional_details")) || null;
  const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  if (!trade || !jobDescription || !location || !name || !email) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: "You must agree to be contacted by tradies about this job." }, { status: 400 });
  }
  if (photos.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `Please attach at most ${MAX_PHOTOS} photos.` }, { status: 400 });
  }
  for (const p of photos) {
    if (p.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: `${p.name} is too large -- please keep photos under 10MB.` }, { status: 400 });
    }
    if (!p.type.startsWith("image/")) {
      return NextResponse.json({ error: `${p.name} isn't an image file.` }, { status: 400 });
    }
  }

  // homeowner_profiles/job_requests RLS requires auth.uid() = id, which was
  // designed around a logged-in homeowner portal that doesn't exist yet --
  // this form is a public, no-login "get quotes" flow, so an anonymous
  // session can never satisfy that policy. Use the admin client for these
  // writes; everything is validated above first.
  const supabase = createAdminClient();

  // property_type has no column of its own on job_requests -- fold it
  // into the description rather than lose it or add a column for a
  // single extra word.
  const description = propertyType ? `[${propertyType}] ${jobDescription}` : jobDescription;

  const { data: homeowner, error: homeownerError } = await supabase
    .from("homeowner_profiles")
    .insert({ id: randomUUID(), name, email, phone, suburb: location || null })
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
      // The "Get Quotes" form only ever collects free-text suburb - no
      // postcode field exists on it. Resolve one anyway (embedded 4-digit
      // code, or a lookup against the directory's suburb/postcode table)
      // so leads have a real, matchable postcode instead of relying on
      // fuzzy suburb-text matching downstream.
      postcode: await resolvePostcode(supabase, location),
      description,
      budget,
      timeline,
      num_quotes_wanted: 3,
      lead_temperature: STAGE_TO_TEMPERATURE[stage] ?? "warm",
      status: "open",
      additional_details: additionalDetails,
    })
    .select("id")
    .single();

  if (jobError || !jobRequest) {
    console.error("[job-requests] job_requests insert error:", jobError?.message);
    return NextResponse.json({ error: "Could not save your job request. Please try again." }, { status: 500 });
  }

  // Upload any photos. Best-effort per file -- one bad upload shouldn't
  // lose the whole lead, which is already saved by this point.
  if (photos.length > 0) {
    const paths: string[] = [];
    for (const photo of photos) {
      const safeName = photo.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `leads/${jobRequest.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("job-files").upload(path, photo, {
        contentType: photo.type,
      });
      if (uploadError) {
        console.error("[job-requests] photo upload error:", uploadError.message);
        continue;
      }
      paths.push(path);
    }
    if (paths.length > 0) {
      await supabase.from("job_requests").update({ photo_paths: paths }).eq("id", jobRequest.id);
    }
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
