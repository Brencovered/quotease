import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildXeroInvoiceCsv, type QuoteForExport } from "@/lib/xeroCsv";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const profileId = userData.user.id;

  // Only quotes the client has accepted, and not already pulled into a
  // previous CSV export - this is what stops a tradie double-invoicing
  // the same job if they export twice.
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("profile_id", profileId)
    .eq("status", "accepted")
    .is("xero_exported_at", null)
    .order("accepted_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!quotes || quotes.length === 0) {
    return NextResponse.json({ error: "No accepted quotes ready to export" }, { status: 404 });
  }

  // Assign sequential invoice numbers to any quote that doesn't have one yet,
  // using this tradie's own running counter.
  const { data: counter } = await supabase
    .from("invoice_counters")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  let nextNumber = counter?.next_number ?? 1;
  const exportRows: QuoteForExport[] = [];
  const now = new Date().toISOString();

  for (const q of quotes) {
    let invoiceNumber = q.invoice_number as string | null;
    if (!invoiceNumber) {
      invoiceNumber = `INV-${String(nextNumber).padStart(4, "0")}`;
      nextNumber += 1;
      await supabase.from("quotes").update({ invoice_number: invoiceNumber }).eq("id", q.id);
    }

    exportRows.push({
      invoiceNumber,
      clientName: q.client_name ?? "Unknown client",
      clientEmail: q.client_email,
      siteAddress: q.site_address,
      acceptedAt: q.accepted_at,
      completedAt: q.completed_at,
      createdAt: q.created_at ?? now,
      totalCost: q.total_cost ?? 0,
      jobType: q.job_type,
      paymentTerms: q.payment_terms ?? [],
    });
  }

  await supabase
    .from("invoice_counters")
    .upsert({ profile_id: profileId, next_number: nextNumber }, { onConflict: "profile_id" });

  await supabase
    .from("quotes")
    .update({ xero_exported_at: now })
    .in("id", quotes.map((q) => q.id));

  const csv = buildXeroInvoiceCsv(exportRows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="xero-import-${now.slice(0, 10)}.csv"`,
    },
  });
}
