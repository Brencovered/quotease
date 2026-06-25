import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  return NextResponse.json({ ok: true });
}
