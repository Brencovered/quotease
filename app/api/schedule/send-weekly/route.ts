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
import { buildWeeklyScheduleEmail, type WeeklyScheduleJob } from "@/lib/email/templates";

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

export async function POST(request: Request) {
  // Instantiated here, not at module scope - module-scope instantiation
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
    // no body - default to this week
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

    // Map to the shared template's job shape
    const jobs: WeeklyScheduleJob[] = assignedJobs.map((job) => ({
      id: job.id,
      clientName: job.client_name || "Unnamed client",
      siteAddress: job.site_address,
      title: job.title,
      status: job.status,
      dateRange: job.scheduled_end
        ? `${fmtDate(job.scheduled_start)} - ${fmtDate(job.scheduled_end)}`
        : fmtDate(job.scheduled_start),
    }));

    const { subject, html } = buildWeeklyScheduleEmail({
      businessName,
      weekLabel,
      memberName: member.name,
      jobs,
      appUrl,
    });

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: [member.email],
        subject,
        html,
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
