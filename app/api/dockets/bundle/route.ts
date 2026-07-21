import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

export async function POST(request: Request) {
  const { jobId } = await request.json();
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  // Only signed dockets are billable - draft/sent ones are still awaiting
  // signature and have no place in an invoice yet.
  const { data: dockets, error: docketsError } = await supabase
    .from("dockets")
    .select("id, work_date, total_cost")
    .eq("job_id", jobId)
    .eq("profile_id", businessId)
    .eq("status", "signed")
    .is("docket_invoice_id", null);

  if (docketsError) {
    return NextResponse.json({ error: docketsError.message }, { status: 500 });
  }
  if (!dockets || dockets.length === 0) {
    return NextResponse.json({ error: "No signed, unbilled dockets on this job to invoice" }, { status: 400 });
  }

  const totalCost = dockets.reduce((sum, d) => sum + (d.total_cost ?? 0), 0);
  const workDates = dockets.map((d) => d.work_date).sort();
  const periodStart = workDates[0];
  const periodEnd = workDates[workDates.length - 1];

  // Simple sequential numbering per business - "DW-0001". Race conditions
  // between two simultaneous bundles are possible but rare enough not to
  // block on a proper sequence for a first pass.
  const { count } = await supabase.from("docket_invoices").select("id", { count: "exact", head: true }).eq("profile_id", businessId);
  const invoiceNumber = `DW-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: invoice, error: invoiceError } = await supabase
    .from("docket_invoices")
    .insert({
      job_id: jobId,
      profile_id: businessId,
      invoice_number: invoiceNumber,
      period_start: periodStart,
      period_end: periodEnd,
      docket_count: dockets.length,
      total_cost: totalCost,
      status: "draft",
    })
    .select()
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: invoiceError?.message ?? "Could not create invoice" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("dockets")
    .update({ status: "invoiced", invoiced_at: now, docket_invoice_id: invoice.id, updated_at: now })
    .in("id", dockets.map((d) => d.id));

  if (updateError) {
    // Roll back the invoice record rather than leaving an orphaned one with
    // no dockets actually attached to it.
    await supabase.from("docket_invoices").delete().eq("id", invoice.id);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invoice });
}
