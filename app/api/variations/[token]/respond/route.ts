import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action === "decline" ? "decline" : "approve";
  const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";

  if (action === "approve" && !signerName) {
    return NextResponse.json({ error: "Name is required to approve" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: variation, error } = await supabase
    .from("variations")
    .select("id, status, profile_id, title, total_cost, jobs(job_number, client_name)")
    .eq("public_token", token)
    .single();

  if (error || !variation) {
    return NextResponse.json({ error: "Variation not found" }, { status: 404 });
  }
  if (variation.status !== "pending") {
    return NextResponse.json({ error: "This variation has already been responded to" }, { status: 409 });
  }

  const patch =
    action === "approve"
      ? {
          status: "approved" as const,
          client_approved_at: new Date().toISOString(),
          client_signer_name: signerName,
        }
      : { status: "declined" as const };

  const { error: updateError } = await supabase.from("variations").update(patch).eq("id", variation.id);
  if (updateError) {
    return NextResponse.json({ error: "Could not save response" }, { status: 500 });
  }

  const job = variation.jobs as unknown as { job_number?: number; client_name?: string } | null;
  const { sendPushToBusiness } = await import("@/lib/push");
  await sendPushToBusiness(supabase, variation.profile_id, {
    title: action === "approve" ? "Variation approved ✓" : "Variation declined",
    body:
      action === "approve"
        ? `${signerName} approved "${variation.title}" (+$${(variation.total_cost ?? 0).toLocaleString()})${job?.job_number ? ` on Job #${job.job_number}` : ""}`
        : `"${variation.title}" was declined${job?.job_number ? ` on Job #${job.job_number}` : ""}`,
    url: "/jobs",
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
