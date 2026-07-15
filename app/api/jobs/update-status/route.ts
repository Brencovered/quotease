import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_STATUSES = ["scheduled", "in_progress", "on_hold", "awaiting_sign_off", "complete", "invoiced", "partially_paid", "archived", "cancelled"];

export async function POST(request: Request) {
  const body = await request.json();
  const { jobId, status, completeJob, paymentAmount } = body;

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (status) {
    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = status;
    if (status === "archived") update.archived_at = new Date().toISOString();
    if (status === "cancelled") update.cancelled_at = new Date().toISOString();
  }

  if (completeJob) {
    update.status = "complete";
    update.completed_at = new Date().toISOString();
  }

  if (typeof paymentAmount === "number" && paymentAmount > 0) {
    const newAmountPaid = (job.amount_paid ?? 0) + paymentAmount;
    update.amount_paid = newAmountPaid;
    if (newAmountPaid >= (job.total_cost ?? 0)) {
      update.status = "invoiced";
      update.paid_at = new Date().toISOString();
    } else {
      update.status = "partially_paid";
    }
    await supabase.from("payments").insert({ job_id: jobId, profile_id: job.profile_id, amount: paymentAmount });

    const { sendPushToBusiness } = await import("@/lib/push");
    await sendPushToBusiness(createAdminClient(), job.profile_id, {
      title: "Payment received 💰",
      body: `$${paymentAmount.toLocaleString()} from ${job.client_name ?? "a client"} (Job #${job.job_number})`,
      url: `/jobs/${jobId}`,
    }).catch(() => null);
  }

  const { error } = await supabase.from("jobs").update(update).eq("id", jobId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
