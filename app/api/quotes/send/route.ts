import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Requires a RESEND_API_KEY env var (https://resend.com) and a verified sending domain.
export async function POST(request: Request) {
  const { quoteId } = await request.json();
  if (!quoteId) {
    return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*, profiles!quotes_profile_id_fkey(business_name, contact_email, contact_phone, logo_url)")
    .eq("id", quoteId)
    .eq("profile_id", userData.user.id)
    .single();

  if (quoteError || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  if (!quote.client_email) {
    return NextResponse.json({ error: "Quote has no client email" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured on this deployment" },
      { status: 500 }
    );
  }

  const business = quote.profiles?.business_name ?? "Your tradie";
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const quoteUrl = `${appUrl}/q/${quote.public_token}`;

  const logoHtml = quote.profiles?.logo_url
    ? `<img src="${quote.profiles.logo_url}" alt="${business}" style="max-height:52px;max-width:200px;display:block;margin-bottom:4px;" />`
    : `<div style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:2px;color:#ffffff;">${business.toUpperCase()}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

  <!-- Header -->
  <tr><td style="background:#0a1722;border-radius:16px 16px 0 0;padding:28px 32px 24px;">
    ${logoHtml}
    <p style="color:#a9bcc8;font-size:12px;margin:6px 0 0;">${[quote.profiles?.contact_phone].filter(Boolean).join(" · ")}</p>
  </td></tr>

  <!-- Amber bar -->
  <tr><td style="background:#ffb400;padding:12px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:Arial Black,Arial,sans-serif;font-size:13px;font-weight:900;letter-spacing:2px;color:#0a1722;">QUOTE</td>
      <td align="right" style="font-family:Arial Black,Arial,sans-serif;font-size:22px;font-weight:900;color:#0a1722;">$${(quote.total_cost ?? 0).toLocaleString()}</td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:32px;">
    <p style="font-size:15px;color:#334155;margin:0 0 6px;">Hi ${quote.client_name ?? "there"},</p>
    <p style="font-size:14px;color:#64748b;margin:0 0 24px;">
      ${business} has sent you a quote for the job at
      <strong style="color:#0a1722;">${quote.site_address ?? "your property"}</strong>.
    </p>

    <!-- BIG ACCEPT BUTTON -->
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;">
      <tr><td align="center" style="border-radius:12px;background:#ffb400;">
        <a href="${quoteUrl}"
           style="display:block;padding:18px 32px;font-family:Arial Black,Arial,sans-serif;font-size:17px;font-weight:900;color:#0a1722;text-decoration:none;letter-spacing:0.5px;">
          ✓ &nbsp;Accept quote &amp; choose payment
        </a>
      </td></tr>
    </table>

    <p style="font-size:13px;color:#94a3b8;text-align:center;margin:0 0 28px;">
      Tap the button to review the full quote, accept, and choose how you&apos;d like to pay.
    </p>

    <!-- Quote summary strip -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;" colspan="2">Quote summary</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:13.5px;color:#475569;border-bottom:1px solid #e2e8f0;">Labour</td>
        <td style="padding:10px 14px;font-size:13.5px;font-weight:700;color:#0a1722;text-align:right;border-bottom:1px solid #e2e8f0;">$${Math.round(((quote.total_cost ?? 0) - (quote.materials_cost ?? 0))).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:13.5px;color:#475569;border-bottom:2px solid #0a1722;">Materials</td>
        <td style="padding:10px 14px;font-size:13.5px;font-weight:700;color:#0a1722;text-align:right;border-bottom:2px solid #0a1722;">$${(quote.materials_cost ?? 0).toLocaleString()}</td>
      </tr>
      <tr style="background:#0a1722;">
        <td style="padding:12px 14px;font-size:14px;font-weight:800;color:#ffffff;">Total</td>
        <td style="padding:12px 14px;font-size:20px;font-weight:900;color:#ffb400;text-align:right;">$${(quote.total_cost ?? 0).toLocaleString()}</td>
      </tr>
    </table>

    <!-- Second button - smaller -->
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center">
        <a href="${quoteUrl}"
           style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:#0a1722;background:#ffb400;text-decoration:none;border-radius:8px;">
          View full quote, accept &amp; pay →
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:16px 32px;border-top:1px solid #e2e8f0;">
    <p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">
      This quote is valid for 30 days. Sent by ${business} via Swiftscope.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Resend supports "Display Name <address>" - the client should see the
      // tradie's business name as the sender, not "Swiftscope" or a bare address.
      from: `${business} <${process.env.RESEND_FROM_EMAIL ?? "quotes@yourdomain.com"}>`,
      // The send address belongs to Swiftscope's domain (needed for SPF/DKIM
      // to pass), but if the client hits Reply, that needs to reach the
      // tradie, not Swiftscope's own inbox - hence reply_to.
      ...(quote.profiles?.contact_email ? { reply_to: quote.profiles.contact_email } : {}),
      to: quote.client_email,
      subject: `Quote from ${business} - $${(quote.total_cost ?? 0).toLocaleString()}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `Resend error: ${body}` }, { status: 502 });
  }

  await supabase.from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", quoteId);

  return NextResponse.json({ ok: true, quoteUrl });
}
