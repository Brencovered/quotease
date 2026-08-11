/**
 * POST /api/onboarding/welcome
 * -----------------------------
 * Fired once from the onboarding page on mount. Sends:
 *   1. A welcome email to the person who just signed up.
 *   2. A "new user signed up" notification to every address in
 *      ADMIN_EMAILS.
 *
 * Idempotent via profiles.welcome_email_sent_at - the client may call this
 * more than once (page refresh, React effect re-run), but only the first
 * call that finds the column unset actually sends anything. Uses an
 * update(...).is("welcome_email_sent_at", null) as the guard so two
 * near-simultaneous calls can't both slip through and double-send.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getClientIp, getUserAgent } from "@/lib/clientIp";
import { createClient } from "@/lib/supabase/server";
import { getAdminEmails } from "@/lib/admin";
import { buildWelcomeEmail, buildAdminNewSignupEmail } from "@/lib/email/templates";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Swiftscope <noreply@swiftscope.com.au>";

async function sendEmail(to: string | string[], subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error("[onboarding/welcome] RESEND_API_KEY not set - skipping send:", subject);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[onboarding/welcome] Resend error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[onboarding/welcome] Send exception:", err);
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = userData.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, suburb, trades, welcome_email_sent_at")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.welcome_email_sent_at) {
    return NextResponse.json({ ok: true, alreadySent: true });
  }

  // Guard against a duplicate near-simultaneous call: only the request that
  // actually flips the column from null wins. If another request already
  // claimed it between our select above and this update, rowCount is 0 and
  // we skip sending rather than double up.
  // Signup forensics captured on the same write, since this route fires once
  // per account at onboarding. Supabase's auth.audit_log_entries is pruned and
  // came back completely empty when four suspicious signups needed
  // investigating, so this is the only durable record of where an account was
  // created from. Written once and never updated, so it stays the signup IP
  // rather than drifting to wherever they last logged in.
  const { data: claimed } = await supabase
    .from("profiles")
    .update({
      welcome_email_sent_at: new Date().toISOString(),
      signup_ip: getClientIp(req),
      signup_user_agent: getUserAgent(req),
    })
    .eq("id", user.id)
    .is("welcome_email_sent_at", null)
    .select("id")
    .single();

  if (!claimed) {
    return NextResponse.json({ ok: true, alreadySent: true });
  }

  const businessName = profile.business_name?.trim() || "there";
  const trade = Array.isArray(profile.trades) && profile.trades.length > 0 ? profile.trades[0] : "trade";

  const welcome = buildWelcomeEmail({ businessName });
  await sendEmail(user.email!, welcome.subject, welcome.html);

  const adminEmails = getAdminEmails();
  if (adminEmails.length > 0) {
    const adminNotify = buildAdminNewSignupEmail({
      businessName,
      trade,
      suburb: profile.suburb?.trim() || "Not set",
      userEmail: user.email ?? "",
    });
    await sendEmail(adminEmails, adminNotify.subject, adminNotify.html);
  }

  return NextResponse.json({ ok: true });
}
