/**
 * GET /api/cron/trial-onboarding-nudge
 * -------------------------------------
 * Daily automation (see vercel.json for schedule). Sends each trialing
 * business a "today's focus" email matching their current trial day
 * (days 2-7 -- day 1 happens live in the signup/onboarding wizard, so no
 * email is needed for it).
 *
 * Skips a business if:
 *   - their trial has already ended or they've converted to paid
 *   - they dismissed the in-app checklist widget (treat that as "stop
 *     nagging me" for email too)
 *   - they're an invited team member rather than the business owner --
 *     team members get their own stub profile + trial_ends_at from the
 *     signup trigger, but the checklist (upload pricing, invite your
 *     team...) is owner-oriented and would be confusing to send them
 *   - that day's tasks are already fully complete (nothing to nudge)
 *   - a nudge for this day (or later) was already sent, tracked via
 *     onboarding_state.last_nudge_sent_day so a re-run or slow cron
 *     can never double-send
 *
 * AUTH: protected by CRON_SECRET, same pattern as the other cron routes.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeTrialDay, getOnboardingProgress } from "@/lib/onboarding";
import { Resend } from "resend";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[trial-onboarding-nudge] CRON_SECRET is not set -- rejecting all requests, including Vercel's own cron trigger.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function htmlEscape(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM_EMAIL = "Swiftscope <noreply@swiftscope.com.au>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const nowIso = new Date().toISOString();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, business_name, contact_email, created_at, trial_ends_at, subscription_status")
    .not("trial_ends_at", "is", null)
    .gt("trial_ends_at", nowIso)
    .neq("subscription_status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  // Exclude invited team members -- their own stub profile has a trial too,
  // but the owner-oriented checklist doesn't apply to them.
  const { data: memberRows } = await admin
    .from("team_members")
    .select("member_user_id")
    .not("member_user_id", "is", null)
    .in("status", ["invited", "active"]);
  const memberIds = new Set((memberRows ?? []).map((r) => r.member_user_id));

  const { data: stateRows } = await admin
    .from("onboarding_state")
    .select("profile_id, dismissed, last_nudge_sent_day")
    .in("profile_id", profiles.map((p) => p.id));
  const stateByProfile = new Map((stateRows ?? []).map((r) => [r.profile_id, r]));

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const profile of profiles) {
    if (memberIds.has(profile.id)) { skipped++; continue; }
    if (!profile.contact_email) { skipped++; continue; }

    const day = computeTrialDay(profile.created_at);
    if (day < 2 || day > 7) { skipped++; continue; } // day 1 is handled live, day 7+ has nothing further to nudge

    const state = stateByProfile.get(profile.id);
    if (state?.dismissed) { skipped++; continue; }
    if (state?.last_nudge_sent_day && state.last_nudge_sent_day >= day) { skipped++; continue; }

    const progress = await getOnboardingProgress(admin, profile.id);
    const dayInfo = progress.days.find((d) => d.day === day);
    if (!dayInfo || dayInfo.complete) { skipped++; continue; }

    const remainingTasks = dayInfo.tasks.filter((t) => !t.done);
    const businessName = profile.business_name || "there";

    const taskRows = remainingTasks
      .map(
        (t) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <a href="${appUrl}${t.href}" style="color:#0f172a;text-decoration:none;font-size:14px;font-weight:700;">${htmlEscape(t.label)} &rarr;</a>
          </td>
        </tr>`
      )
      .join("");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#d97706;">Day ${day} of your trial</p>
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${htmlEscape(dayInfo.title)}</h1>
        <p style="font-size:14px;color:#334155;line-height:1.5;margin:0 0 20px;">Hi ${htmlEscape(businessName)}, here's today's focus in Swiftscope:</p>
        <table width="100%" cellpadding="0" cellspacing="0">${taskRows}</table>
        <p style="font-size:12px;color:#94a3b8;margin:24px 0 0;">
          ${progress.daysRemaining} day${progress.daysRemaining !== 1 ? "s" : ""} left in your trial.
        </p>
      </div>
    `;

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: profile.contact_email,
        subject: `Day ${day}: ${dayInfo.title}`,
        html,
      });
      await admin
        .from("onboarding_state")
        .upsert({ profile_id: profile.id, last_nudge_sent_day: day }, { onConflict: "profile_id" });
      sent++;
    } catch (err) {
      errors.push(`${profile.id}: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped, errors });
}
