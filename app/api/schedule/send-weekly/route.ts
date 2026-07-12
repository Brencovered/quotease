/**
 * POST /api/schedule/send-weekly
 * -----------------------------
 * Sends a weekly schedule digest email to every active team member
 * who has jobs assigned to them in the upcoming week (Mon-Sun).
 *
 * Auth: business owner only (team members can't trigger sends).
 *
 * Body: { weekOffset?: number }  // 0 = this week, 1 = next week, -1 = last week
 *
 * Returns: { sent: number, skipped: number, errors: string[] }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const FROM_EMAIL = "Swiftscope <noreply@swiftscope.com.au>";

function getWeekRange(weekOffset: number) {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday, mondayStr: monday.toISOString(), sundayStr: sunday.toISOString() };
}

function fmtDate(d: string | null) {
  if (!d) return "Not scheduled";
  return new Date(d).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function htmlEscape(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  // Instantiated here, not at module scope -- module-scope instantiation
  // throws at build time (during Next's "Collecting page data" static
  // analysis pass, which imports every route module) in any environment
  // where RESEND_API_KEY isn't set, which fails the whole build rather
  // than just this route at request time.
  const resend = new Resend(process.env.RESEND_API_KEY);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ownerId = userData.user.id;

  // Verify this user is a business owner (not a team member)
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("business_name")
    .eq("id", ownerId)
    .single();

  const businessName = ownerProfile?.business_name || "Swiftscope";

  // Read optional week offset
  let weekOffset = 0;
  try {
    const body = await request.json();
    if (typeof body.weekOffset === "number") weekOffset = body.weekOffset;
  } catch {
    // no body — default to this week
  }

  const { monday, sunday, mondayStr, sundayStr } = getWeekRange(weekOffset);

  // Find all active team members for this business
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, email, name")
    .eq("owner_profile_id", ownerId)
    .eq("status", "active")
    .order("name");

  if (!teamMembers || teamMembers.length === 0) {
    return NextResponse.json({ error: "No active team members found. Add team members first." }, { status: 400 });
  }

  const weekLabel =
    weekOffset === 0
      ? "this week"
      : weekOffset === 1
        ? "next week"
        : `week of ${monday.toLocaleDateString("en-AU", { day: "numeric", month: "long" })}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const errors: string[] = [];
  let sent = 0;
  let skipped = 0;

  for (const member of teamMembers) {
    // Find jobs assigned to this member that fall within the week range
    const { data: assignedJobs } = await supabase
      .from("jobs")
      .select("id, job_number, client_name, site_address, status, scheduled_start, scheduled_end, title")
      .eq("profile_id", ownerId)
      .eq("assigned_to_member_id", member.id)
      .not("scheduled_start", "is", null)
      .gte("scheduled_start", mondayStr)
      .lte("scheduled_start", sundayStr)
      .not("status", "in", "(archived,cancelled)")
      .order("scheduled_start", { ascending: true });

    if (!assignedJobs || assignedJobs.length === 0) {
      skipped++;
      continue;
    }

    const greeting = member.name ? `Hi ${htmlEscape(member.name)},` : "Hi,";

    // Build job rows
    const jobRows = assignedJobs
      .map((job) => {
        const jobUrl = `${appUrl}/electrician/jobs/${job.id}`;
        const dateRange = job.scheduled_end
          ? `${fmtDate(job.scheduled_start)} — ${fmtDate(job.scheduled_end)}`
          : fmtDate(job.scheduled_start);
        const statusColor =
          job.status === "complete"
            ? "#16a34a"
            : job.status === "in_progress"
              ? "#d97706"
              : job.status === "on_hold"
                ? "#dc2626"
                : "#334155";
        const statusLabel =
          job.status === "scheduled"
            ? "Scheduled"
            : job.status === "in_progress"
              ? "In progress"
              : job.status === "on_hold"
                ? "On hold"
                : job.status === "awaiting_sign_off"
                  ? "Awaiting sign-off"
                  : job.status === "complete"
                    ? "Complete"
                    : job.status;

        return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;">
              <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">
                <a href="${jobUrl}" style="color:#0f172a;text-decoration:none;">${htmlEscape(job.client_name || "Unnamed client")}</a>
              </p>
              ${job.site_address ? `<p style="margin:4px 0 0;font-size:13px;color:#64748b;">${htmlEscape(job.site_address)}</p>` : ""}
              ${job.title ? `<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">${htmlEscape(job.title)}</p>` : ""}
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:right;white-space:nowrap;">
              <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">${dateRange}</p>
              <p style="margin:4px 0 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${statusColor};">${statusLabel}</p>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:right;white-space:nowrap;">
              <a href="${jobUrl}" style="display:inline-block;padding:6px 14px;background:#0f172a;color:#fff;font-size:12px;font-weight:700;text-decoration:none;border-radius:8px;">Open job</a>
            </td>
          </tr>
        `;
      })
      .join("");

    const totalJobs = assignedJobs.length;

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: [member.email],
        subject: `${businessName} — Your schedule ${weekLabel} (${totalJobs} job${totalJobs > 1 ? "s" : ""})`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 24px 20px;background:#0f172a;">
              <p style="margin:0;font-size:20px;font-weight:800;color:#fbbf24;letter-spacing:-0.02em;">${htmlEscape(businessName)}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Weekly schedule — ${htmlEscape(weekLabel)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 0;">
              <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${greeting}</p>
              <p style="margin:8px 0 0;font-size:14px;color:#334155;line-height:1.6;">You have <strong>${totalJobs} job${totalJobs > 1 ? "s" : ""}</strong> scheduled. Tap any job to open it in Swiftscope.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">${jobRows}</table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;text-align:center;">
              <a href="${appUrl}/electrician/schedule" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fbbf24;font-size:14px;font-weight:800;text-decoration:none;border-radius:10px;">View full schedule in Swiftscope</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">Sent from Swiftscope • <a href="${appUrl}" style="color:#64748b;">Open Swiftscope</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      });
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to send to ${member.email}: ${msg}`);
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    errors,
    weekRange: { from: monday.toISOString(), to: sunday.toISOString() },
  });
}
