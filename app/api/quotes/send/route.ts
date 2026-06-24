import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Requires a RESEND_API_KEY env var (https://resend.com) and a verified sending domain.
// Resend is used here as a simple, low-setup choice — swap for any transactional
// email provider (Postmark, SendGrid) by changing only this file.
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
    .select("*, profiles!quotes_profile_id_fkey(business_name, contact_email, contact_phone)")
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

  const html = `
    <h2>Quote from ${business}</h2>
    <p>Hi ${quote.client_name ?? ""},</p>
    <p>Here's your quote for the job at ${quote.site_address ?? "the site you provided"}.</p>
    <table cellpadding="6" style="border-collapse:collapse;width:100%">
      <tr><td>Labour</td><td>${quote.labour_hours} hrs</td></tr>
      <tr><td>Materials</td><td>$${quote.materials_cost}</td></tr>
      <tr style="font-weight:bold"><td>Total</td><td>$${quote.total_cost}</td></tr>
    </table>
    <p>This quote is an estimate based on the details provided and may change once the job is reviewed on site.</p>
    <p>${business}${quote.profiles?.contact_phone ? " — " + quote.profiles.contact_phone : ""}</p>
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
      subject: `Quote from ${business}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `Resend error: ${body}` }, { status: 502 });
  }

  await supabase.from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", quoteId);

  return NextResponse.json({ ok: true });
}
