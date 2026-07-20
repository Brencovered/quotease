import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

// Requires a RESEND_API_KEY env var (https://resend.com) and a verified sending domain.
// Mirrors app/api/quotes/send/route.ts's pattern.
export async function POST(request: Request) {
  const { docketId } = await request.json();
  if (!docketId) {
    return NextResponse.json({ error: "Missing docketId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: docket, error: docketError } = await supabase
    .from("dockets")
    .select("*, jobs(job_number, title, client_name), profiles!dockets_profile_id_fkey(business_name, contact_email, contact_phone, logo_url)")
    .eq("id", docketId)
    .eq("profile_id", businessId)
    .single();

  if (docketError || !docket) {
    return NextResponse.json({ error: "Docket not found" }, { status: 404 });
  }
  if (!docket.client_email) {
    return NextResponse.json({ error: "Add the supervisor or client's email before sending" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const docketUrl = `${appUrl}/docket/${docket.public_token}`;

  const job = docket.jobs as unknown as { job_number: number; title: string | null; client_name: string | null } | null;
  const business = docket.profiles?.business_name ?? "Your tradie";
  const workDate = new Date(docket.work_date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  // ── Graceful fallback: no email config → still mark sent, return warning ──
  if (!apiKey) {
    await supabase.from("dockets").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", docketId);
    return NextResponse.json({
      ok: true,
      docketUrl,
      warning: "Docket marked sent but email was not delivered — RESEND_API_KEY is not configured.",
    });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

  <tr><td style="background:#0a1722;border-radius:16px 16px 0 0;padding:28px 32px 24px;">
    <div style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:2px;color:#ffffff;">${business.toUpperCase()}</div>
  </td></tr>

  <tr><td style="background:#ffb400;padding:12px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:Arial Black,Arial,sans-serif;font-size:13px;font-weight:900;letter-spacing:2px;color:#0a1722;">DAYWORKS DOCKET</td>
      <td align="right" style="font-family:Arial Black,Arial,sans-serif;font-size:22px;font-weight:900;color:#0a1722;">$${(docket.total_cost ?? 0).toLocaleString()}</td>
    </tr></table>
  </td></tr>

  <tr><td style="background:#ffffff;padding:32px;">
    <p style="font-size:15px;color:#334155;margin:0 0 6px;">Hi ${docket.client_name ?? job?.client_name ?? "there"},</p>
    <p style="font-size:14px;color:#64748b;margin:0 0 24px;">
      ${business} has recorded a day of work on ${workDate} for job #${job?.job_number ?? ""}${job?.title ? ` - ${job.title}` : ""}.
      Please review the hours, plant and materials below and sign to confirm it&apos;s accurate.
    </p>

    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;">
      <tr><td align="center" style="border-radius:12px;background:#ffb400;">
        <a href="${docketUrl}"
           style="display:block;padding:18px 32px;font-family:Arial Black,Arial,sans-serif;font-size:17px;font-weight:900;color:#0a1722;text-decoration:none;letter-spacing:0.5px;">
          Review &amp; sign docket
        </a>
      </td></tr>
    </table>

    <p style="font-size:13px;color:#94a3b8;text-align:center;margin:0;">
      Tap the button to review the day&apos;s work and sign electronically.
    </p>
  </td></tr>

  <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:16px 32px;border-top:1px solid #e2e8f0;">
    <p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">
      Sent by ${business} via Swiftscope.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${business} <${process.env.RESEND_FROM_EMAIL ?? "quotes@yourdomain.com"}>`,
      ...(docket.profiles?.contact_email ? { reply_to: docket.profiles.contact_email } : {}),
      to: docket.client_email,
      subject: `Docket for signature - ${workDate} - $${(docket.total_cost ?? 0).toLocaleString()}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `Resend error: ${body}` }, { status: 502 });
  }

  await supabase.from("dockets").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", docketId);

  return NextResponse.json({ ok: true, docketUrl });
}
