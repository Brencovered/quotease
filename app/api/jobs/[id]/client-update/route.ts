/**
 * POST /api/jobs/[id]/client-update
 * Email (and log) a short status update to the client. SMS is left to the
 * device via sms: links in the UI — no Twilio dependency.
 *
 * Body: { template: "on_way" | "running_late" | "there_tomorrow" | "done_today", customMessage?: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const TEMPLATES: Record<string, { subject: string; body: (name: string, business: string) => string }> = {
  on_way: {
    subject: "We're on our way",
    body: (name, business) =>
      `Hi${name ? ` ${name}` : ""},\n\nWe're on our way to site now.\n\nThanks,\n${business}`,
  },
  running_late: {
    subject: "Running a bit late",
    body: (name, business) =>
      `Hi${name ? ` ${name}` : ""},\n\nWe're running a bit behind — still coming today, just later than planned. Sorry for the wait.\n\nThanks,\n${business}`,
  },
  there_tomorrow: {
    subject: "See you tomorrow",
    body: (name, business) =>
      `Hi${name ? ` ${name}` : ""},\n\nJust confirming we'll be there tomorrow as planned.\n\nThanks,\n${business}`,
  },
  done_today: {
    subject: "Work finished for today",
    body: (name, business) =>
      `Hi${name ? ` ${name}` : ""},\n\nWe're wrapped up on site for today. We'll be in touch if anything else is needed.\n\nThanks,\n${business}`,
  },
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const ctx = await getTeamContext(supabase, userData.user.id);
  const body = await request.json();
  const templateKey = String(body.template ?? "");
  const customMessage = body.customMessage ? String(body.customMessage).trim() : null;
  const template = TEMPLATES[templateKey];
  if (!template && !customMessage) {
    return NextResponse.json({ error: "Choose a template or provide a message" }, { status: 400 });
  }

  const [{ data: job }, { data: profile }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, quote_id, client_name, client_email, client_phone, job_number, title, site_address")
      .eq("id", jobId)
      .eq("profile_id", ctx.businessId)
      .single(),
    supabase.from("profiles").select("business_name, contact_email").eq("id", ctx.businessId).single(),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const business = profile?.business_name ?? "Your tradie";
  const firstName = (job.client_name ?? "").split(" ")[0] || "";
  const subject = template?.subject ?? `Update from ${business}`;
  const text =
    customMessage ||
    template!.body(firstName, business);

  const email = job.client_email?.trim();
  let emailed = false;
  let emailWarning: string | null = null;

  if (email && RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${business} <${process.env.RESEND_FROM_EMAIL ?? "updates@swiftscope.com.au"}>`,
        ...(profile?.contact_email ? { reply_to: profile.contact_email } : {}),
        to: email,
        subject,
        text,
      }),
    });
    if (res.ok) emailed = true;
    else emailWarning = `Email failed (${res.status})`;
  } else if (email && !RESEND_API_KEY) {
    emailWarning = "Email not configured — use SMS from your phone.";
  } else if (!email) {
    emailWarning = "No client email on this job — use SMS.";
  }

  await supabase.from("communication_log").insert({
    profile_id: ctx.businessId,
    quote_id: job.quote_id,
    job_id: jobId,
    type: "job_update",
    subject,
    body: text,
    sent_to: email || job.client_phone || null,
  });

  const smsBody = encodeURIComponent(text);
  const smsHref = job.client_phone
    ? `sms:${job.client_phone.replace(/\s/g, "")}?&body=${smsBody}`
    : null;
  const mailtoHref = email
    ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
    : null;

  return NextResponse.json({
    ok: true,
    emailed,
    warning: emailWarning,
    smsHref,
    mailtoHref,
    subject,
    text,
  });
}
