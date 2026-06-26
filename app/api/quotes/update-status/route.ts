import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pushQuoteToXero } from "@/lib/xero";

const ALLOWED_STATUSES = ["draft", "sent", "accepted", "declined", "paid"];

export async function POST(request: Request) {
  const body = await request.json();
  const { quoteId, status, completeJob, paymentAmount } = body;

  if (!quoteId) {
    return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (status) {
    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = status;
    if (status === "accepted") update.accepted_at = new Date().toISOString();
  }

  if (completeJob) {
    update.completed_at = new Date().toISOString();
  }

  // Recording a payment: fetch the current quote first so we can add to
  // amount_paid rather than overwrite it, and flip to "paid" once the
  // running total covers the full quote.
  if (typeof paymentAmount === "number" && paymentAmount > 0) {
    const { data: existing } = await supabase
      .from("quotes")
      .select("amount_paid, total_cost")
      .eq("id", quoteId)
      .eq("profile_id", userData.user.id)
      .single();

    if (existing) {
      const newAmountPaid = (existing.amount_paid ?? 0) + paymentAmount;
      update.amount_paid = newAmountPaid;
      if (newAmountPaid >= (existing.total_cost ?? 0)) {
        update.status = "paid";
        update.paid_at = new Date().toISOString();
      }
    }
  }

  const { error } = await supabase
    .from("quotes")
    .update(update)
    .eq("id", quoteId)
    .eq("profile_id", userData.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Push to Xero the moment a quote is won - that's the point it actually
  // needs invoicing, not just whenever someone happens to export a CSV.
  // Best-effort: a Xero failure shouldn't block the accept action itself,
  // since the tradie's quote is still genuinely accepted either way.
  let xeroResult: { ok: boolean; error?: string } | null = null;
  if (status === "accepted") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, xero_connected, xero_tenant_id, xero_access_token, xero_refresh_token, xero_token_expires_at")
      .eq("id", userData.user.id)
      .single();
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, client_name, client_email, total_cost, invoice_number")
      .eq("id", quoteId)
      .single();
    if (profile?.xero_connected && quote) {
      xeroResult = await pushQuoteToXero(quote, profile);
    }
  }

  return NextResponse.json({ ok: true, xero: xeroResult });
}
