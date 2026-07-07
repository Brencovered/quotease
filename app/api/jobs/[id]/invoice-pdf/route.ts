import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // RLS ("Business jobs" policy, accessible_business_ids()) scopes this
    // to jobs the authenticated user's business (or team) can see - no
    // extra profile_id filter needed here.
    const { data: job, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, contact_email, contact_phone, abn, license_number, business_address, terms_and_conditions, logo_url, bank_account_name, bank_bsb, bank_account_number, accepts_cash")
      .eq("id", job.profile_id)
      .single();

    const { data: lineItemRows } = await supabase
      .from("job_line_items")
      .select("label, quantity, unit")
      .eq("job_id", id)
      .order("sort_order");

    let logoBytes: Uint8Array | null = null;
    if (profile?.logo_url) {
      try {
        const logoRes = await fetch(profile.logo_url);
        if (logoRes.ok) logoBytes = new Uint8Array(await logoRes.arrayBuffer());
      } catch { /* skip */ }
    }

    const { generateInvoicePdf } = await import("@/lib/generateInvoicePdf");
    const pdfBytes = await generateInvoicePdf(job, profile ?? {}, logoBytes, lineItemRows ?? []);

    const filename = `Invoice-${job.job_number}-${(job.client_name ?? "client").replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });

  } catch (err) {
    const msg   = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? "") : "";
    console.error("[Invoice PDF] crash:", msg, stack);
    return NextResponse.json({ error: msg, stack: stack.split("\n").slice(0, 5) }, { status: 500 });
  }
}
