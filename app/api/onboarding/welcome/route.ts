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
import { createClient } from "@/lib/supabase/server";
import { getAdminEmails } from "@/lib/admin";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Swiftscope <noreply@swiftscope.com.au>";

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

export async function POST() {
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
  const { data: claimed } = await supabase
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("welcome_email_sent_at", null)
    .select("id")
    .single();

  if (!claimed) {
    return NextResponse.json({ ok: true, alreadySent: true });
  }

  const businessName = profile.business_name?.trim() || "there";
  const trade = Array.isArray(profile.trades) && profile.trades.length > 0 ? profile.trades[0] : "trade";

  await sendEmail(
    user.email!,
    "Welcome to Swiftscope - your 7-day free trial has started",
    `
      <h2>Welcome to Swiftscope, ${htmlEscape(businessName)}!</h2>
      <p>Your 7-day free trial just started - no card needed until it ends.</p>
      <p>A few things worth doing first:</p>
      <ul>
        <li>Finish setting up your pricing so quotes come out accurate from day one</li>
        <li>Try building your first quote - even a test one, to get a feel for it</li>
        <li>Add your team if you're not working solo</li>
      </ul>
      <p><a href="https://www.swiftscope.com.au/onboarding">Continue setting up your account</a></p>
      <hr/>
      <p style="color:#888;font-size:12px">Questions? Just reply to this email.</p>
    `
  );

  const adminEmails = getAdminEmails();
  if (adminEmails.length > 0) {
    await sendEmail(
      adminEmails,
      `New signup: ${businessName} (${trade})`,
      `
        <h2>New Swiftscope signup</h2>
        <p><strong>Business:</strong> ${htmlEscape(businessName)}</p>
        <p><strong>Trade:</strong> ${htmlEscape(trade)}</p>
        <p><strong>Suburb:</strong> ${htmlEscape(profile.suburb?.trim() || "Not set")}</p>
        <p><strong>Email:</strong> ${htmlEscape(user.email ?? "")}</p>
        <hr/>
        <p style="color:#888;font-size:12px">Sent automatically on first onboarding visit.</p>
      `
    );
  }

  return NextResponse.json({ ok: true });
}
