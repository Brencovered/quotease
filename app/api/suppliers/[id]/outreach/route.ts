import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function buildEmail(business: { business_name: string | null; contact_email: string | null; contact_phone: string | null }, supplier: { name: string; ingestion_email: string }) {
  const businessName = business.business_name || "our business";
  const subject = `Quick setup request from ${businessName}`;
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#111a22;max-width:560px;margin:0 auto;">
<p>Hi ${supplier.name} team,</p>
<p>We use Swiftscope to manage our quoting and job pricing at ${businessName}. To keep our prices with you up to date automatically, could you please add the address below to your invoice / price list distribution, alongside our usual contact?</p>
<table cellpadding="0" cellspacing="0" style="background:#f0f2f5;border-radius:10px;padding:14px 18px;margin:16px 0;">
<tr><td style="font-weight:700;font-size:15px;">${supplier.ingestion_email}</td></tr>
</table>
<p>Any invoices, price lists, or catalogue updates (CSV preferred) sent to this address will automatically update our pricing - no other action needed on your end.</p>
<p>Thanks for your help,<br/>${businessName}${business.contact_phone ? ` - ${business.contact_phone}` : ""}</p>
</body></html>`;
  return { subject, html };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: supplier } = await supabase.from("business_suppliers").select("*").eq("id", id).single();
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { data: business } = await supabase.from("profiles").select("business_name, contact_email, contact_phone").eq("id", supplier.profile_id).single();
  const draft = buildEmail(business ?? { business_name: null, contact_email: null, contact_phone: null }, supplier);

  return NextResponse.json({ draft, supplierEmail: supplier.contact_email });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: supplier } = await supabase.from("business_suppliers").select("*").eq("id", id).single();
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  if (!supplier.contact_email) return NextResponse.json({ error: "This supplier has no contact email on file" }, { status: 400 });

  const { data: business } = await supabase.from("profiles").select("business_name, contact_email, contact_phone").eq("id", supplier.profile_id).single();
  const draft = buildEmail(business ?? { business_name: null, contact_email: null, contact_phone: null }, supplier);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Email sending is not configured" }, { status: 500 });

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${business?.business_name || "Swiftscope"} <${process.env.RESEND_SUPPLIER_FROM_EMAIL ?? "suppliers@swiftscope.com.au"}>`,
      ...(business?.contact_email ? { reply_to: business.contact_email } : {}),
      to: supplier.contact_email,
      subject: draft.subject,
      html: draft.html,
    }),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    return NextResponse.json({ error: `Resend error: ${errText}` }, { status: 502 });
  }

  await supabase.from("business_suppliers").update({ status: "outreach_sent", outreach_sent_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ ok: true });
}
