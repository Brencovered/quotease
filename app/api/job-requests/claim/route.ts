import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function POST(req: NextRequest) {
  const { requestId } = await req.json();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Claims belong to the business, not the individual team member who
  // clicked "claim" - otherwise a claim made by one team member would be
  // invisible to the owner and everyone else on the team.
  const businessId = await getActiveBusinessId(supabase, user.id);

  // Get request and current claim count
  const { data: request } = await supabase
    .from("job_requests")
    .select("*, job_claims(id, status)")
    .eq("id", requestId)
    .single();

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status === "fully_claimed" || request.status === "expired") {
    return NextResponse.json({ error: "This request is no longer available" }, { status: 400 });
  }

  const activeClaims = request.job_claims?.filter((c: {status: string}) => c.status === "claimed").length ?? 0;
  if (activeClaims >= request.num_quotes_wanted) {
    return NextResponse.json({ error: "This request has been fully claimed" }, { status: 400 });
  }

  // Create the claim
  const { error: claimErr } = await supabase.from("job_claims").insert({
    request_id:        requestId,
    tradie_profile_id: businessId,
    status:            "claimed",
  });
  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 400 });

  // Update request status
  const newActiveClaims = activeClaims + 1;
  const newStatus = newActiveClaims >= request.num_quotes_wanted ? "fully_claimed" : "partially_claimed";
  await supabase.from("job_requests").update({ status: newStatus }).eq("id", requestId);

  // Get homeowner contact details to return to tradie
  const { data: homeowner } = await supabase
    .from("homeowner_profiles")
    .select("name, email, phone, suburb")
    .eq("id", request.homeowner_id)
    .single();

  return NextResponse.json({ ok: true, homeowner });
}
