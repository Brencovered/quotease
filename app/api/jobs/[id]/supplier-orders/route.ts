import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export type SupplierOrderLine = {
  label: string;
  qty: number;
  unit: string;
  sku?: string | null;
  unit_cost?: number | null;
  job_line_item_id?: string | null;
};

function buildBody(opts: {
  businessName: string;
  contactPhone: string | null;
  jobNumber: number;
  clientName: string | null;
  siteAddress: string | null;
  fulfillment: "pickup" | "delivery";
  neededBy: string | null;
  deliveryNotes: string | null;
  lines: SupplierOrderLine[];
}) {
  const lines = opts.lines.map((l) => {
    const sku = l.sku ? ` [${l.sku}]` : "";
    const cost = l.unit_cost != null && l.unit_cost > 0 ? ` @ $${Number(l.unit_cost).toFixed(2)}` : "";
    return `- ${l.qty} ${l.unit} × ${l.label}${sku}${cost}`;
  });

  return [
    `Hi,`,
    ``,
    `Please supply the following for Job #${opts.jobNumber}${opts.clientName ? ` (${opts.clientName})` : ""}:`,
    ``,
    ...lines,
    ``,
    `Fulfilment: ${opts.fulfillment === "delivery" ? "Delivery" : "Pickup"}`,
    opts.neededBy ? `Needed by: ${opts.neededBy}` : null,
    opts.siteAddress ? `Site: ${opts.siteAddress}` : null,
    opts.deliveryNotes ? `Notes: ${opts.deliveryNotes}` : null,
    ``,
    `Thanks,`,
    opts.businessName,
    opts.contactPhone,
  ]
    .filter((l) => l != null && l !== "")
    .join("\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const { data, error } = await supabase
    .from("supplier_order_sends")
    .select("id, supplier_name, recipient_email, subject, line_items, fulfillment, needed_by, send_method, sent_at")
    .eq("job_id", jobId)
    .eq("profile_id", businessId)
    .order("sent_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sends: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  const body = await request.json();
  const supplierName = String(body.supplierName ?? "").trim();
  const recipientEmail = String(body.recipientEmail ?? "").trim().toLowerCase();
  const fulfillment = body.fulfillment === "delivery" ? "delivery" : "pickup";
  const neededBy = body.neededBy ? String(body.neededBy).slice(0, 10) : null;
  const deliveryNotes = body.deliveryNotes ? String(body.deliveryNotes).trim() : null;
  const saveContact = Boolean(body.saveContact);
  const markOrdered = body.markOrdered !== false;
  const lines = Array.isArray(body.lines) ? (body.lines as SupplierOrderLine[]) : [];
  const preferMailto = Boolean(body.preferMailto);

  if (!supplierName || !recipientEmail || lines.length === 0) {
    return NextResponse.json({ error: "Supplier, email, and at least one line are required" }, { status: 400 });
  }

  const [{ data: job }, { data: profile }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, quote_id, job_number, client_name, site_address, profile_id")
      .eq("id", jobId)
      .eq("profile_id", businessId)
      .single(),
    supabase
      .from("profiles")
      .select("business_name, contact_phone, contact_email")
      .eq("id", businessId)
      .single(),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const businessName = profile?.business_name ?? "Your tradie";
  const subject = `Materials order — Job #${job.job_number}${job.client_name ? ` — ${job.client_name}` : ""}`;
  const bodyText = buildBody({
    businessName,
    contactPhone: profile?.contact_phone ?? null,
    jobNumber: job.job_number,
    clientName: job.client_name,
    siteAddress: job.site_address,
    fulfillment,
    neededBy,
    deliveryNotes,
    lines,
  });

  let sendMethod: "mailto" | "email" = "mailto";
  let emailWarning: string | null = null;

  const apiKey = process.env.RESEND_API_KEY;
  if (!preferMailto && apiKey) {
    const from = process.env.RESEND_FROM_EMAIL ?? "orders@swiftscope.com.au";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${businessName} <${from}>`,
        ...(profile?.contact_email ? { reply_to: profile.contact_email } : {}),
        to: recipientEmail,
        subject,
        text: bodyText,
      }),
    });
    if (res.ok) {
      sendMethod = "email";
    } else {
      const errText = await res.text().catch(() => "");
      emailWarning = `Email API failed (${res.status}). Use the mailto draft instead. ${errText.slice(0, 120)}`;
    }
  }

  const { data: sendRow, error: sendError } = await supabase
    .from("supplier_order_sends")
    .insert({
      profile_id: businessId,
      job_id: jobId,
      quote_id: job.quote_id,
      supplier_name: supplierName,
      recipient_email: recipientEmail,
      subject,
      body_text: bodyText,
      line_items: lines,
      fulfillment,
      needed_by: neededBy,
      delivery_notes: deliveryNotes,
      send_method: sendMethod,
    })
    .select("id, sent_at, send_method")
    .single();

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 });
  }

  if (saveContact) {
    await supabase.from("supplier_contacts").upsert(
      {
        profile_id: businessId,
        supplier_name: supplierName,
        email: recipientEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,supplier_name,email" }
    );
  }

  let marked = 0;
  if (markOrdered) {
    const ids = lines
      .map((l) => l.job_line_item_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (ids.length) {
      const { data: updated } = await supabase
        .from("job_line_items")
        .update({ status: "materials_ordered" })
        .in("id", ids)
        .eq("job_id", jobId)
        .in("status", ["not_started"])
        .select("id");
      marked = updated?.length ?? 0;
    }
  }

  return NextResponse.json({
    ok: true,
    send: sendRow,
    sendMethod,
    subject,
    bodyText,
    mailto:
      sendMethod === "mailto"
        ? `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`
        : null,
    markedOrdered: marked,
    warning: emailWarning,
  });
}
