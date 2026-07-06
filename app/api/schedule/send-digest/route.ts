import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@swiftscope.com.au";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface JobRow {
  id: string;
  client_name: string | null;
  site_address: string | null;
  scheduled_start: string;
  scheduled_end: string | null;
  estimated_days: number | null;
  total_cost: number | null;
  status: string;
  assigned_to_member_id: string | null;
  job_number: number | null;
}

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekDays(monday: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function buildEmailHtml({
  weekLabel,
  weekDays,
  memberJobs,
  businessName,
  appUrl,
}: {
  weekLabel: string;
  weekDays: Date[];
  memberJobs: Record<string, { member: TeamMember; jobs: JobRow[] }>;
  businessName: string;
  appUrl: string;
}) {
  const dateStyle = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = date.getTime() === today.getTime();
    return isToday ? 'style="background:#ffb400;color:#0a1722;border:2px solid #ffb400;"' : 'style="background:#f1f5f9;color:#64748b;border:2px solid #e2e8f0;"';
  };

  const dayGrid = weekDays.map((d) => {
    const dateStr = toDateStr(d);
    const dayLabel = `${SHORT_DAY[d.getDay()]} ${d.getDate()}`;
    return `
      <td style="width:14.28%;vertical-align:top;padding:4px;">
        <div style="text-align:center;font-size:11px;font-weight:800;padding:6px 2px;border-radius:8px;margin-bottom:6px;${dateStyle(d).replace('style="', '').replace('"', '')}">
          ${dayLabel}
        </div>
      </td>`;
  }).join("");

  let jobsHtml = "";
  for (const [, { member, jobs }] of Object.entries(memberJobs)) {
    const sorted = jobs.sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

    const daysMap: Record<string, JobRow[]> = {};
    for (const j of sorted) {
      const start = new Date(j.scheduled_start);
      const end = j.scheduled_end ? new Date(j.scheduled_end) : start;
      const startMs = start.getTime();
      const endMs = end.getTime();
      const oneDay = 86400000;
      for (let ms = startMs; ms <= endMs; ms += oneDay) {
        const ds = toDateStr(new Date(ms));
        if (!daysMap[ds]) daysMap[ds] = [];
        if (!daysMap[ds].find((x) => x.id === j.id)) daysMap[ds].push(j);
      }
    }

    const dayBlocks = weekDays.map((d) => {
      const ds = toDateStr(d);
      const dayJobs = daysMap[ds] ?? [];
      if (dayJobs.length === 0) return `<div style="min-height:48px;"></div>`;
      return dayJobs.map((j) => {
        const statusColor =
          j.status === "scheduled" ? "#0369a1" :
          j.status === "in_progress" ? "#92400e" :
          j.status === "on_hold" ? "#dc2626" :
          j.status === "complete" ? "#166534" :
          "#64748b";
        const statusBg =
          j.status === "scheduled" ? "#eff6ff" :
          j.status === "in_progress" ? "#fffbeb" :
          j.status === "on_hold" ? "#fef2f2" :
          j.status === "complete" ? "#f0fdf4" :
          "#f8fafc";
        return `
          <a href="${appUrl}/electrician/jobs/${j.id}" style="display:block;text-decoration:none;background:${statusBg};border-radius:6px;padding:8px;margin-bottom:4px;border-left:3px solid ${statusColor};">
            <p style="font-size:12px;font-weight:700;color:#0a1722;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${j.client_name ?? "Unnamed"}</p>
            <p style="font-size:10px;color:#64748b;margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${j.site_address ?? ""}</p>
            <p style="font-size:9px;color:${statusColor};font-weight:700;margin:3px 0 0;text-transform:uppercase;letter-spacing:0.5px;">${j.status.replace(/_/g, " ")}${j.estimated_days ? ` · ${j.estimated_days}d` : ""}</p>
          </a>`;
      }).join("");
    }).join("");

    jobsHtml += `
      <tr>
        <td colspan="7" style="padding-top:16px;">
          <p style="font-size:14px;font-weight:800;color:#0a1722;margin:0 0 8px;">
            ${member.name ?? member.email}
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
            <tr>${weekDays.map((d) => {
              const ds = toDateStr(d);
              const dayJobs = daysMap[ds] ?? [];
              return `<td style="width:14.28%;vertical-align:top;padding:4px;">
                <div style="text-align:center;font-size:10px;font-weight:700;padding:4px 2px;border-radius:6px;margin-bottom:4px;background:#f1f5f9;color:#64748b;">
                  ${SHORT_DAY[d.getDay()]} ${d.getDate()}
                </div>
                ${dayJobs.length === 0 ? `<div style="min-height:32px;"></div>` : dayJobs.map((j) => {
                  const statusColor = j.status === "scheduled" ? "#0369a1" : j.status === "in_progress" ? "#92400e" : j.status === "on_hold" ? "#dc2626" : j.status === "complete" ? "#166534" : "#64748b";
                  const statusBg = j.status === "scheduled" ? "#eff6ff" : j.status === "in_progress" ? "#fffbeb" : j.status === "on_hold" ? "#fef2f2" : j.status === "complete" ? "#f0fdf4" : "#f8fafc";
                  return `<a href="${appUrl}/electrician/jobs/${j.id}" style="display:block;text-decoration:none;background:${statusBg};border-radius:6px;padding:6px;margin-bottom:4px;border-left:3px solid ${statusColor};">
                    <p style="font-size:10px;font-weight:700;color:#0a1722;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${j.client_name ?? "Unnamed"}</p>
                    <p style="font-size:9px;color:#64748b;margin:1px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${j.site_address ?? ""}</p>
                  </a>`;
                }).join("")}
              </td>`;
            }).join("")}</tr>
          </table>
        </td>
      </tr>
      <tr><td colspan="7" style="border-bottom:1px solid #e2e8f0;padding-top:8px;"></td></tr>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">

  <tr><td style="background:#0a1722;border-radius:16px 16px 0 0;padding:28px 32px 24px;">
    <p style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:2px;color:#ffffff;margin:0;">${businessName.toUpperCase()}</p>
    <p style="color:#a9bcc8;font-size:12px;margin:6px 0 0;">Weekly schedule</p>
  </td></tr>

  <tr><td style="background:#ffb400;padding:12px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:Arial Black,Arial,sans-serif;font-size:13px;font-weight:900;letter-spacing:2px;color:#0a1722;">${weekLabel}</td>
    </tr></table>
  </td></tr>

  <tr><td style="background:#ffffff;padding:24px 24px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
      <tr>${weekDays.map((d) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = d.getTime() === today.getTime();
        const bg = isToday ? "#ffb400" : "#f1f5f9";
        const fg = isToday ? "#0a1722" : "#64748b";
        return `<td style="width:14.28%;vertical-align:top;padding:4px;">
          <div style="text-align:center;font-size:10px;font-weight:800;padding:6px 2px;border-radius:8px;margin-bottom:4px;background:${bg};color:${fg};">
            ${SHORT_DAY[d.getDay()]} ${d.getDate()}
          </div>
        </td>`;
      }).join("")}</tr>
    </table>
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 24px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${jobsHtml}
    </table>
  </td></tr>

  <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:16px 32px;border-top:1px solid #e2e8f0;">
    <p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">
      Sent by ${businessName} via <a href="${appUrl}" style="color:#0a1722;font-weight:700;text-decoration:none;">Swiftscope</a>. Tap any job to open it.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { weekStart?: string; sendToAll?: boolean };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, contact_email, send_weekly_digest")
    .eq("id", userData.user.id)
    .single();

  const businessName = profile?.business_name ?? "Your team";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  // Parse week range
  let monday: Date;
  if (body.weekStart) {
    monday = new Date(body.weekStart + "T00:00:00");
  } else {
    monday = getMonday(new Date());
  }
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const weekLabel = `Week of ${monday.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
  const weekDays = getWeekDays(monday);

  // Fetch all scheduled jobs for this week that have team members assigned
  const { data: jobRows } = await supabase
    .from("jobs")
    .select("id, client_name, site_address, scheduled_start, scheduled_end, estimated_days, total_cost, status, assigned_to_member_id, job_number")
    .eq("profile_id", userData.user.id)
    .not("assigned_to_member_id", "is", null)
    .or(`scheduled_start.gte.${toDateStr(monday)},scheduled_end.gte.${toDateStr(monday)}`)
    .lte("scheduled_start", toDateStr(sunday))
    .in("status", ["scheduled", "in_progress", "on_hold", "awaiting_sign_off"])
    .order("scheduled_start", { ascending: true });

  if (!jobRows || jobRows.length === 0) {
    return NextResponse.json({ sent: 0, message: "No scheduled jobs with assigned team members for this week." });
  }

  // Fetch team members for the assigned IDs
  const memberIds = [...new Set(jobRows.map((j) => j.assigned_to_member_id))];
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, email, name")
    .in("id", memberIds);

  const memberMap: Record<string, TeamMember> = {};
  for (const m of teamMembers ?? []) {
    memberMap[m.id] = m;
  }

  // Group jobs by member
  const memberJobs: Record<string, { member: TeamMember; jobs: JobRow[] }> = {};
  for (const job of jobRows as JobRow[]) {
    if (!job.assigned_to_member_id || !memberMap[job.assigned_to_member_id]) continue;
    const mid = job.assigned_to_member_id;
    if (!memberJobs[mid]) {
      memberJobs[mid] = { member: memberMap[mid], jobs: [] };
    }
    memberJobs[mid].jobs.push(job);
  }

  if (Object.keys(memberJobs).length === 0) {
    return NextResponse.json({ sent: 0, message: "No jobs with valid team member assignments for this week." });
  }

  // No Resend configured — return preview HTML instead
  if (!RESEND_API_KEY) {
    const previewHtml = buildEmailHtml({ weekLabel, weekDays, memberJobs, businessName, appUrl });
    return NextResponse.json({
      sent: 0,
      warning: "RESEND_API_KEY is not configured. Email was not sent.",
      previewHtml,
      recipientCount: Object.keys(memberJobs).length,
      weekLabel,
    });
  }

  // Send individual emails to each team member
  const results: Array<{ email: string; ok: boolean; error?: string }> = [];

  for (const [, { member, jobs }] of Object.entries(memberJobs)) {
    const singleMemberJobs: Record<string, { member: TeamMember; jobs: JobRow[] }> = {
      [member.id]: { member, jobs },
    };
    const html = buildEmailHtml({
      weekLabel,
      weekDays,
      memberJobs: singleMemberJobs,
      businessName,
      appUrl,
    });

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${businessName} <${RESEND_FROM_EMAIL}>`,
          to: member.email,
          subject: `Your schedule: ${weekLabel}`,
          html,
        }),
      });

      if (res.ok) {
        results.push({ email: member.email, ok: true });
      } else {
        const text = await res.text();
        results.push({ email: member.email, ok: false, error: text });
      }
    } catch (err: unknown) {
      results.push({ email: member.email, ok: false, error: String(err) });
    }
  }

  // Also send owner summary
  const ownerHtml = buildEmailHtml({ weekLabel, weekDays, memberJobs, businessName, appUrl });
  if (profile?.contact_email) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${businessName} <${RESEND_FROM_EMAIL}>`,
          to: profile.contact_email,
          subject: `Team schedule: ${weekLabel}`,
          html: ownerHtml,
        }),
      });
    } catch {
      // Owner summary is best-effort
    }
  }

  const sentCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ sent: sentCount, results, weekLabel });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name")
    .eq("id", userData.user.id)
    .single();

  const businessName = profile?.business_name ?? "Your team";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  let monday: Date;
  if (weekStart) {
    monday = new Date(weekStart + "T00:00:00");
  } else {
    monday = getMonday(new Date());
  }
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const weekLabel = `Week of ${monday.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`;
  const weekDays = getWeekDays(monday);

  const { data: jobRows } = await supabase
    .from("jobs")
    .select("id, client_name, site_address, scheduled_start, scheduled_end, estimated_days, total_cost, status, assigned_to_member_id, job_number")
    .eq("profile_id", userData.user.id)
    .not("assigned_to_member_id", "is", null)
    .or(`scheduled_start.gte.${toDateStr(monday)},scheduled_end.gte.${toDateStr(monday)}`)
    .lte("scheduled_start", toDateStr(sunday))
    .in("status", ["scheduled", "in_progress", "on_hold", "awaiting_sign_off"])
    .order("scheduled_start", { ascending: true });

  if (!jobRows || jobRows.length === 0) {
    return NextResponse.json({ previewHtml: null, recipientCount: 0, weekLabel });
  }

  const memberIds = [...new Set(jobRows.map((j) => j.assigned_to_member_id))];
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, email, name")
    .in("id", memberIds);

  const memberMap: Record<string, TeamMember> = {};
  for (const m of teamMembers ?? []) {
    memberMap[m.id] = m;
  }

  const memberJobs: Record<string, { member: TeamMember; jobs: JobRow[] }> = {};
  for (const job of jobRows as JobRow[]) {
    if (!job.assigned_to_member_id || !memberMap[job.assigned_to_member_id]) continue;
    const mid = job.assigned_to_member_id;
    if (!memberJobs[mid]) {
      memberJobs[mid] = { member: memberMap[mid], jobs: [] };
    }
    memberJobs[mid].jobs.push(job);
  }

  const previewHtml = buildEmailHtml({ weekLabel, weekDays, memberJobs, businessName, appUrl });
  return NextResponse.json({
    previewHtml,
    recipientCount: Object.keys(memberJobs).length,
    weekLabel,
    memberBreakdown: Object.values(memberJobs).map(({ member, jobs }) => ({
      name: member.name ?? member.email,
      email: member.email,
      jobCount: jobs.length,
    })),
  });
}
