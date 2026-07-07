import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushQuoteToXero } from "@/lib/xero";
import { getOrCreateJobForQuote } from "@/lib/jobs";
import { getActiveBusinessId } from "@/lib/team";

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
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

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

  // The moment a quote is accepted it becomes a real job - everything from
  // here (actuals, tasks, variations, invoicing) should hang off that job,
  // not off the quote directly.
  if (status === "accepted" || completeJob || status === "paid") {
    const job = await getOrCreateJobForQuote(supabase, quoteId);
    if (job) {
      const jobUpdate: Record<string, unknown> = {};
      if (completeJob) {
        jobUpdate.status = "complete";
        jobUpdate.completed_at = new Date().toISOString();
      }
      if (status === "paid") {
        jobUpdate.status = "invoiced";
        jobUpdate.invoiced_at = new Date().toISOString();
      }
      if (Object.keys(jobUpdate).length > 0) {
        await supabase.from("jobs").update(jobUpdate).eq("id", job.id);
      }
    }
  }

  // Recording a payment: fetch the current quote first so we can add to
  // amount_paid rather than overwrite it, and flip to "paid" once the
  // running total covers the full amount owed - including approved
  // variations, which previously weren't counted here at all.
  if (typeof paymentAmount === "number" && paymentAmount > 0) {
    const [{ data: existing }, { data: approvedVariations }] = await Promise.all([
      supabase.from("quotes").select("amount_paid, total_cost, markup_materials, client_name").eq("id", quoteId).eq("profile_id", businessId).single(),
      supabase.from("variations").select("total_cost").eq("quote_id", quoteId).eq("status", "approved"),
    ]);

    if (existing) {
      const variationsTotal = (approvedVariations ?? []).reduce((sum, v) => sum + (v.total_cost ?? 0), 0);
      const markupMaterialsTotal = ((existing.markup_materials as Array<{ totalCost: number }>) ?? []).reduce((sum, m) => sum + (m.totalCost ?? 0), 0);
      const effectiveTotal = (existing.total_cost ?? 0) + variationsTotal + markupMaterialsTotal;
      const newAmountPaid = (existing.amount_paid ?? 0) + paymentAmount;
      update.amount_paid = newAmountPaid;
      if (newAmountPaid >= effectiveTotal) {
        update.status = "paid";
        update.paid_at = new Date().toISOString();
      }
      const paymentJob = await getOrCreateJobForQuote(supabase, quoteId);
      await supabase.from("payments").insert({ quote_id: quoteId, job_id: paymentJob?.id ?? null, profile_id: businessId, amount: paymentAmount });

      const { sendPushToBusiness } = await import("@/lib/push");
      await sendPushToBusiness(createAdminClient(), businessId, {
        title: "Payment received 💰",
        body: `$${paymentAmount.toLocaleString()} from ${existing.client_name ?? "a client"}`,
        url: paymentJob ? `/electrician/jobs/${paymentJob.id}` : "/electrician/jobs",
      }).catch(() => null);
    }
  }

  const { error } = await supabase
    .from("quotes")
    .update(update)
    .eq("id", quoteId)
    .eq("profile_id", businessId);

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
      .eq("id", businessId)
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
