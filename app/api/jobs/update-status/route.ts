import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamContext } from "@/lib/team";

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

  const ctx = await getTeamContext(supabase, userData.user.id);
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let timesheetLogged: { hours: number } | null = null;

  if (status) {
    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = status;
    if (status === "archived") update.archived_at = new Date().toISOString();
    if (status === "cancelled") update.cancelled_at = new Date().toISOString();
    // Start the clock when work begins (don't reset if already started).
    if (status === "in_progress" && !job.work_started_at) {
      update.work_started_at = new Date().toISOString();
    }
  }

  if (completeJob) {
    update.status = "complete";
    update.completed_at = new Date().toISOString();
    if (job.quote_id) {
      await supabase
        .from("quotes")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", job.quote_id);
    }

    // Auto-log time from Start → Done for the person tapping Done.
    const startedAt = job.work_started_at ? new Date(job.work_started_at) : null;
    if (startedAt && !Number.isNaN(startedAt.getTime())) {
      const hoursRaw = (Date.now() - startedAt.getTime()) / 3600000;
      const hours = Math.round(Math.min(Math.max(hoursRaw, 0.25), 16) * 4) / 4; // 15-min steps, cap 16h
      if (hours >= 0.25) {
        const { data: membership } = await supabase
          .from("team_members")
          .select("id, name, email, hourly_rate")
          .eq("member_user_id", userData.user.id)
          .eq("status", "active")
          .maybeSingle();

        let rate = membership?.hourly_rate ?? null;
        if (rate == null) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("hourly_rate")
            .eq("id", ctx.businessId)
            .single();
          rate = profile?.hourly_rate ?? 95;
        }

        const memberName =
          membership?.name ||
          membership?.email ||
          userData.user.email ||
          "Team member";

        const { error: tsErr } = await supabase.from("timesheets").insert({
          profile_id: ctx.businessId,
          job_id: jobId,
          team_member_id: membership?.id ?? null,
          member_name: memberName,
          hours,
          hourly_rate_used: rate,
          work_date: new Date().toISOString().slice(0, 10),
          notes: "Logged from Start → Done on My day",
          created_by: userData.user.id,
        });
        if (!tsErr) {
          timesheetLogged = { hours };
          update.work_started_at = null;
        }
      }
    }
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
    await supabase.from("payments").insert({
      job_id: jobId,
      quote_id: job.quote_id ?? null,
      profile_id: job.profile_id,
      amount: paymentAmount,
    });

    if (job.quote_id) {
      await supabase
        .from("quotes")
        .update({
          amount_paid: newAmountPaid,
          ...(newAmountPaid >= (job.total_cost ?? 0)
            ? { status: "paid", paid_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", job.quote_id);
    }

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

  return NextResponse.json({ ok: true, timesheetLogged });
}
