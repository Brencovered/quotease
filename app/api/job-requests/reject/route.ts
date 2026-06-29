import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { requestId } = await req.json();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Mark claim as rejected
  await supabase.from("job_claims")
    .update({ status: "rejected", rejected_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .eq("tradie_profile_id", user.id);

  // Reopen a slot on the request
  const { data: request } = await supabase
    .from("job_requests")
    .select("status, num_quotes_wanted, job_claims(status)")
    .eq("id", requestId)
    .single();

  if (request) {
    const activeClaims = request.job_claims?.filter((c: {status: string}) => c.status === "claimed").length ?? 0;
    const newStatus = activeClaims === 0 ? "open" :
      activeClaims < request.num_quotes_wanted ? "partially_claimed" : "fully_claimed";
    await supabase.from("job_requests").update({ status: newStatus }).eq("id", requestId);
  }

  return NextResponse.json({ ok: true });
}
