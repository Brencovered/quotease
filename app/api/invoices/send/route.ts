import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function POST(request: Request) {
  const { quoteId } = await request.json();
  if (!quoteId) return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, profiles!quotes_profile_id_fkey(business_name, contact_email, contact_phone, logo_url, hourly_rate)")
    .eq("id", quoteId)
    .eq("profile_id", businessId)
    .single();

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (!quote.client_email) return NextResponse.json({ error: "No client email" }, { status: 400 });

  const owing = Math.max((quote.total_cost ?? 0) - (quote.amount_paid ?? 0), 0);
  if (owing <= 0) return NextResponse.json({ error: "Nothing owing" }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  const business = (quote.profiles as unknown as Record<string, string>)?.business_name ?? "Your tradie";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const quoteUrl = `${appUrl}/q/${quote.public_token ?? quote.id}`;
  const invoiceNum = quote.invoice_number ?? `INV-${quote.id.slice(0, 6).toUpperCase()}`;

  const logoHtml = (quote.profiles as unknown as Record<string, string>)?.logo_url
    ? `<img src="${(quote.profiles as unknown as Record<string, string>).logo_url}" alt="${business}" style="max-height:52px;max-width:200px;display:block;margin-bottom:4px;" />`
    : `<div style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:2px;color:#ffffff;">${business.toUpperCase()}</div>`;

  const terms: Array<{ label: string; percent: number; days: number }> = quote.payment_terms ?? [];
  let termsHtml = "";
  if (terms.length > 0) {
    termsHtml = `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0;">
      <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-size:12px;font-weight:700;color:#64748b;">Payment Term</td><td style="padding:10px 14px;font-size:12px;font-weight:700;color:#64748b;text-align:right">Amount</td><td style="padding:10px 14px;font-size:12px;font-weight:700;color:#64748b;text-align:right">Due</td></tr>
      ${terms.map((t) => `<tr><td style="padding:10px 14px;font-size:13px;border-top:1px solid #e2e8f0;">${t.label}</td><td style="padding:10px 14px;font-size:13px;border-top:1px solid #e2e8f0;text-align:right">$${Math.round((quote.total_cost ?? 0) * t.percent / 100).toLocaleString()}</td><td style="padding:10px 14px;font-size:13px;border-top:1px solid #e2e8f0;text-align:right">${t.days} days</td></tr>`).join("")}
      </table>`;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;">
<tr><td style="background:#0a1722;border-radius:16px 16px 0 0;padding:28px 32px 24px;">${logoHtml}
<p style="color:#a9bcc8;font-size:12px;margin:6px 0 0;">${(quote.profiles as unknown as Record<string, string>)?.contact_phone ?? ""}</p></td></tr>
<tr><td style="background:#ffb400;padding:12px 32px;"><table width="100%"><tr><td style="font-family:Arial Black,Arial,sans-serif;font-size:13px;font-weight:900;letter-spacing:2px;color:#0a1722;">INVOICE</td><td align="right" style="font-family:Arial Black,Arial,sans-serif;font-size:22px;font-weight:900;color:#0a1722;">$${owing.toLocaleString()}</td></tr></table></td></tr>
<tr><td style="background:#ffffff;padding:32px;">
<p style="font-size:15px;color:#334155;margin:0 0 6px;">Hi ${quote.client_name ?? "there"},</p>
<p style="font-size:14px;color:#64748b;margin:0 0 16px;">Please find your invoice below for work at <strong style="color:#0a1722;">${quote.site_address ?? "your property"}</strong>.</p>
<p style="font-size:13px;color:#94a3b8;margin:0 0 16px;">Invoice #: <strong style="color:#0a1722;">${invoiceNum}</strong></p>
${quote.amount_paid && quote.amount_paid > 0 ? `<p style="font-size:13px;color:#64748b;margin:0 0 16px;">Deposit received: $${quote.amount_paid.toLocaleString()}</p>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
<tr style="background:#0a1722;"><td style="padding:12px 14px;font-size:14px;font-weight:800;color:#ffffff;">Amount Due</td><td style="padding:12px 14px;font-size:20px;font-weight:900;color:#ffb400;text-align:right;">$${owing.toLocaleString()}</td></tr>
</table>
${termsHtml}
<table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="border-radius:12px;background:#ffb400;">
<a href="${quoteUrl}" style="display:block;padding:18px 32px;font-family:Arial Black,Arial,sans-serif;font-size:17px;font-weight:900;color:#0a1722;text-decoration:none;">View Invoice &amp; Pay</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:16px 32px;border-top:1px solid #e2e8f0;">
<p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">Questions? Reply to this email or call ${(quote.profiles as unknown as Record<string, string>)?.contact_phone ?? "us"}.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${business} <${process.env.RESEND_FROM_EMAIL ?? "quotes@swiftscope.com.au"}>`,
      ...((quote.profiles as unknown as Record<string, string>)?.contact_email ? { reply_to: (quote.profiles as unknown as Record<string, string>).contact_email } : {}),
      to: quote.client_email,
      subject: `Invoice from ${business} - $${owing.toLocaleString()}`,
      html,
    }),
  });

  await supabase.from("quotes").update({ invoiced_at: new Date().toISOString() }).eq("id", quoteId);
  return NextResponse.json({ ok: true });
}
