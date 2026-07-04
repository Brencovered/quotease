import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { recipients, subject, html, text } = await req.json();

  if (!recipients?.length || !subject || !html) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const results = { sent: 0, failed: 0, errors: [] as string[] };
  const FROM = process.env.RESEND_FROM_EMAIL ?? "team@swiftscope.com.au";
  const RESEND_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  // Send in batches of 10 to avoid rate limits
  const BATCH = 10;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    await Promise.all(batch.map(async (to: string) => {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({ from: `Swiftscope <${FROM}>`, to, subject, html, text }),
        });
        if (res.ok) { results.sent++; }
        else {
          results.failed++;
          const err = await res.json().catch(() => ({}));
          results.errors.push(`${to}: ${err.message ?? res.status}`);
        }
      } catch (e) {
        results.failed++;
        results.errors.push(`${to}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }));
    // Brief pause between batches
    if (i + BATCH < recipients.length) await new Promise(r => setTimeout(r, 300));
  }

  // Log the outreach in Supabase
  const admin = createAdminClient();
  await admin.from("admin_outreach_log").insert({
    sent_by: user.email,
    subject,
    recipient_count: results.sent,
    failed_count: results.failed,
    preview_html: html.slice(0, 500),
  }).select().single().catch(() => null); // table may not exist yet, non-fatal

  return NextResponse.json(results);
}
