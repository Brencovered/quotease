import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export async function POST(request: Request) {
  const { quoteId, type, templateId } = await request.json();
  if (!quoteId || !type) {
    return NextResponse.json({ error: "Missing quoteId or type" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, profiles!quotes_profile_id_fkey(business_name, contact_email, contact_phone, logo_url, branding_primary_color)")
    .eq("id", quoteId)
    .eq("profile_id", businessId)
    .single();

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (!quote.client_email) return NextResponse.json({ error: "No client email" }, { status: 400 });

  let subject = "";
  let body = "";

  if (templateId) {
    const { data: t } = await supabase.from("communication_templates").select("subject, body")
      .eq("id", templateId).eq("profile_id", businessId).single();
    if (t) { subject = t.subject; body = t.body; }
  }
  if (!subject) {
    const { data: t } = await supabase.from("communication_templates").select("subject, body")
      .eq("profile_id", businessId).eq("type", type).eq("is_default", true).maybeSingle();
    if (t) { subject = t.subject; body = t.body; }
  }

  const business = (quote.profiles as unknown as Record<string, string>)?.business_name ?? "Your tradie";
  const owing = Math.max((quote.total_cost ?? 0) - (quote.amount_paid ?? 0), 0);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://swiftscope.com.au";
  const quoteUrl = `${appUrl}/q/${quote.public_token ?? quote.id}`;

  if (!subject) {
    if (type === "overdue_invoice") {
      subject = `Payment reminder for ${business} invoice`;
      body = `Hi {{client_name}},\n\nThis is a friendly reminder that payment of $${owing} is outstanding for work completed at {{site_address}}.\n\nPlease contact us to arrange payment.\n\nThanks,\n{{business_name}}`;
    } else {
      subject = `Your quote from ${business}`;
      body = `Hi {{client_name}},\n\nJust a reminder that your quote of $${quote.total_cost} for work at {{site_address}}.\n\nTo accept, visit: {{quote_url}}\n\nThanks,\n{{business_name}}`;
    }
  }

  const vars: Record<string, string> = {
    client_name: quote.client_name ?? "there",
    amount: owing > 0 ? owing.toLocaleString() : (quote.total_cost ?? 0).toLocaleString(),
    quote_url: quoteUrl,
    business_name: business,
    site_address: quote.site_address ?? "your property",
  };

  const finalSubject = applyTemplate(subject, vars);
  const finalBody = applyTemplate(body, vars).replace(/\n/g, "<br>");

  const brandColor = (quote.profiles as unknown as Record<string, string>)?.branding_primary_color ?? "#ffb400";
  const logoHtml = (quote.profiles as unknown as Record<string, string>)?.logo_url
    ? `<img src="${(quote.profiles as unknown as Record<string, string>).logo_url}" alt="${business}" style="max-height:52px;max-width:200px;display:block;margin-bottom:4px;" />`
    : `<div style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:2px;color:#ffffff;">${business.toUpperCase()}</div>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;">
<tr><td style="background:#0a1722;border-radius:16px 16px 0 0;padding:28px 32px 24px;">${logoHtml}</td></tr>
<tr><td style="background:${brandColor};padding:12px 32px;"><strong style="color:#0a1722;">${type === "overdue_invoice" ? "INVOICE REMINDER" : "QUOTE REMINDER"}</strong></td></tr>
<tr><td style="background:#ffffff;padding:32px;">
<p style="font-size:15px;color:#334155;margin:0 0 24px;">${finalBody}</p>
<table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="border-radius:12px;background:${brandColor};">
<a href="${quoteUrl}" style="display:block;padding:18px 32px;font-family:Arial Black,Arial,sans-serif;font-size:17px;font-weight:900;color:#0a1722;text-decoration:none;">${type === "overdue_invoice" ? "Pay now" : "View quote"}</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:16px 32px;border-top:1px solid #e2e8f0;">
<p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">${(quote.profiles as unknown as Record<string, string>)?.branding_email_footer ?? "Sent via Swiftscope"}</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${business} <${process.env.RESEND_FROM_EMAIL ?? "quotes@swiftscope.com.au"}>`,
        ...(quote.profiles && (quote.profiles as unknown as Record<string, string>).contact_email
          ? { reply_to: (quote.profiles as unknown as Record<string, string>).contact_email } : {}),
        to: quote.client_email,
        subject: finalSubject,
        html,
      }),
    });
  }

  await supabase.from("communication_log").insert({
    profile_id: businessId,
    quote_id: quoteId,
    type,
    subject: finalSubject,
    body: finalBody,
    sent_to: quote.client_email,
  });

  return NextResponse.json({ ok: true });
}
