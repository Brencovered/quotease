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
    .select("*, profiles!quotes_profile_id_fkey(business_name, contact_phone, logo_url)")
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const quoteUrl = `${appUrl}/q/${quote.public_token}`;
  const logoHtml = quote.profiles?.logo_url
    ? `<img src="${quote.profiles.logo_url}" alt="${business}" style="max-height:48px;max-width:180px;margin-bottom:20px;" />`
    : "";

  // Short and branded - the full breakdown, accept/decline, and payment
  // details live on the quote page itself, not crammed into the email body.
  // That page is also the thing a client can actually act on (the email
  // attachment-only version had no accept/decline mechanism at all).
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      ${logoHtml}
      <h2 style="margin:0 0 8px;">Quote from ${business}</h2>
      <p style="color:#333;">Hi ${quote.client_name ?? ""},</p>
      <p style="color:#333;">Your quote for the job at ${quote.site_address ?? "the site you provided"} is ready to view.</p>
      <p style="margin:28px 0;">
        <a href="${quoteUrl}" style="background:#ffb400;color:#0a1722;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:8px;display:inline-block;">
          View quote — $${(quote.total_cost ?? 0).toLocaleString()}
        </a>
      </p>
      <p style="color:#888;font-size:13px;">You can accept or decline, see full payment details, and download a PDF from that page.</p>
      <p style="color:#888;font-size:12px;margin-top:24px;">${business}${quote.profiles?.contact_phone ? " — " + quote.profiles.contact_phone : ""}</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "quotes@yourdomain.com",
      to: quote.client_email,
      subject: `Quote from ${business} — $${(quote.total_cost ?? 0).toLocaleString()}`,
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
