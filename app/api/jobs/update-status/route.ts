import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamContext } from "@/lib/team";
import { suggestHoursFromStart } from "@/lib/jobTime";

const ALLOWED_STATUSES = [
  "scheduled",
  "in_progress",
  "on_hold",
  "awaiting_sign_off",
  "complete",
  "invoiced",
  "partially_paid",
  "archived",
  "cancelled",
];

async function insertTimesheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    businessId: string;
    jobId: string;
    userId: string;
    userEmail: string | undefined;
    hours: number;
    note: string;
  }
) {
  const { data: membership } = await supabase
    .from("team_members")
    .select("id, name, email, hourly_rate")
    .eq("member_user_id", opts.userId)
    .eq("status", "active")
    .maybeSingle();

  let rate = membership?.hourly_rate ?? null;
  if (rate == null) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("hourly_rate")
      .eq("id", opts.businessId)
      .single();
    rate = profile?.hourly_rate ?? 95;
  }

  const memberName =
    membership?.name || membership?.email || opts.userEmail || "Team member";

  const { error } = await supabase.from("timesheets").insert({
    profile_id: opts.businessId,
    job_id: opts.jobId,
    team_member_id: membership?.id ?? null,
    member_name: memberName,
    hours: opts.hours,
    hourly_rate_used: rate,
    work_date: new Date().toISOString().slice(0, 10),
    notes: opts.note,
    created_by: opts.userId,
  });
  return !error;
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    jobId,
    status,
    completeJob,
    paymentAmount,
    hours: hoursBody,
    skipTimesheet,
    logHoursOnly,
  } = body;

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
  let pausedOther: { id: string; job_number: number } | null = null;

  const resolvedHours = (): number | null => {
    if (skipTimesheet) return null;
    if (typeof hoursBody === "number" && Number.isFinite(hoursBody)) {
      const h = Math.round(Math.min(Math.max(hoursBody, 0), 24) * 4) / 4;
      return h >= 0.25 ? h : null;
    }
    return suggestHoursFromStart(job.work_started_at);
  };

  async function maybeLogHours(note: string) {
    const hours = resolvedHours();
    if (hours == null) return;
    const ok = await insertTimesheet(supabase, {
      businessId: ctx.businessId,
      jobId,
      userId: userData.user!.id,
      userEmail: userData.user!.email,
      hours,
      note,
    });
    if (ok) {
      timesheetLogged = { hours };
      update.work_started_at = null;
    }
  }

  if (status) {
    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = status;
    if (status === "archived") update.archived_at = new Date().toISOString();
    if (status === "cancelled") update.cancelled_at = new Date().toISOString();

    // Start / resume clock. Pause keeps work_started_at so resume is honest.
    if (status === "in_progress") {
      if (!job.work_started_at) {
        update.work_started_at = new Date().toISOString();
      }
      // Pause any other in-progress job for this business that has a running clock
      // so switching jobs doesn't invent a double day.
      const { data: others } = await supabase
        .from("jobs")
        .select("id, job_number, work_started_at")
        .eq("profile_id", ctx.businessId)
        .eq("status", "in_progress")
        .not("work_started_at", "is", null)
        .neq("id", jobId)
        .limit(5);
      if (others && others.length > 0) {
        const first = others[0];
        await supabase
          .from("jobs")
          .update({ status: "on_hold", updated_at: new Date().toISOString() })
          .in(
            "id",
            others.map((o) => o.id)
          );
        pausedOther = { id: first.id, job_number: first.job_number };
      }
    }

    if (logHoursOnly && (status === "awaiting_sign_off" || status === "on_hold")) {
      await maybeLogHours(
        status === "awaiting_sign_off"
          ? "Logged at sign-off"
          : "Logged from Pause"
      );
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
    await maybeLogHours("Logged from Done");
    if (!timesheetLogged) update.work_started_at = null;
  }

  if (typeof paymentAmount === "number" && paymentAmount > 0) {
    const newAmountPaid = (job.amount_paid ?? 0) + paymentAmount;
    update.amount_paid = newAmountPaid;
    if (newAmountPaid >= (job.total_cost ?? 0)) {
      update.status = "invoiced";
      update.paid_at = new Date().toISOString();
    } else if (!completeJob) {
      update.status = "partially_paid";
    } else if (newAmountPaid < (job.total_cost ?? 0)) {
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

  return NextResponse.json({ ok: true, timesheetLogged, pausedOther });
}
