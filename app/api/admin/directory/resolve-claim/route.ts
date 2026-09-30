import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

/**
 * Approves or rejects a directory_claim_attempts row with
 * outcome='pending_review' - the other half of the change in
 * app/api/directory/claim that stopped claims (and new listing
 * creation) from activating on submission.
 *
 * On approve: copies claim_pending_profile_id into profile_id, flips
 * is_claimed, clears the pending column. Outcome becomes 'claimed' for
 * an existing scraped listing, or 'created_new' for one the claimant
 * created from scratch - distinguished by directory_listing.source
 * ('manual' means they created it; anything else means it was already
 * a scraped listing) rather than trying to track that distinction
 * separately, since source already carries it.
 *
 * On reject: clears the pending column, leaving is_claimed false. A
 * rejected claim on a genuine scraped listing leaves the listing itself
 * untouched and available for someone else to claim later. A rejected
 * claim on a source='manual' listing deletes the listing outright -
 * every fake signup this session (BetaBoard, Temporary Fencing,
 * Electrical) came through exactly this path, fabricated data with no
 * scraped provenance to preserve, so there's nothing worth keeping.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  let body: { attemptId?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
  const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : null;
  if (!attemptId || !decision) {
    return NextResponse.json({ error: "attemptId and decision ('approve' | 'reject') are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: attempt, error: attemptErr } = await admin
    .from("directory_claim_attempts")
    .select("id, outcome, matched_listing_id, attempted_by_profile_id")
    .eq("id", attemptId)
    .single();

  if (attemptErr || !attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.outcome !== "pending_review") {
    return NextResponse.json({ error: `This attempt is already resolved (outcome: ${attempt.outcome})` }, { status: 409 });
  }
  if (!attempt.matched_listing_id || !attempt.attempted_by_profile_id) {
    return NextResponse.json({ error: "Attempt is missing the listing or profile it refers to" }, { status: 400 });
  }

  const { data: listing, error: listingErr } = await admin
    .from("directory_listing")
    .select("id, source, claim_pending_profile_id")
    .eq("id", attempt.matched_listing_id)
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (listing.claim_pending_profile_id !== attempt.attempted_by_profile_id) {
    // The pending state has moved on since this attempt was logged (a
    // second attempt superseded it, or it was already resolved some
    // other way) - resolving this one now would act on stale state.
    return NextResponse.json({ error: "This listing's pending claim no longer matches this attempt" }, { status: 409 });
  }

  if (decision === "approve") {
    const { error: updateErr } = await admin
      .from("directory_listing")
      .update({ is_claimed: true, profile_id: attempt.attempted_by_profile_id, claim_pending_profile_id: null })
      .eq("id", listing.id);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to approve claim" }, { status: 500 });
    }

    await admin.from("directory_claim_attempts").update({
      outcome: listing.source === "manual" ? "created_new" : "claimed",
      resolved_at: new Date().toISOString(),
      resolved_by: user.email,
    }).eq("id", attemptId);

    return NextResponse.json({ ok: true, decision: "approve" });
  }

  // Reject.
  if (listing.source === "manual") {
    const { error: deleteErr } = await admin.from("directory_listing").delete().eq("id", listing.id);
    if (deleteErr) {
      return NextResponse.json({ error: "Failed to reject claim (listing delete failed)" }, { status: 500 });
    }
  } else {
    const { error: clearErr } = await admin
      .from("directory_listing")
      .update({ claim_pending_profile_id: null })
      .eq("id", listing.id);
    if (clearErr) {
      return NextResponse.json({ error: "Failed to reject claim" }, { status: 500 });
    }
  }

  await admin.from("directory_claim_attempts").update({
    outcome: "rejected",
    resolved_at: new Date().toISOString(),
    resolved_by: user.email,
  }).eq("id", attemptId);

  return NextResponse.json({ ok: true, decision: "reject" });
}
