import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { createClient } = await import("@/lib/supabase/server");
    const { getActiveBusinessId } = await import("@/lib/team");
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const businessId = await getActiveBusinessId(supabase, userData.user.id);

    const { data: quote, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", id)
      .eq("profile_id", businessId)
      .single();

    if (error || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, contact_email, contact_phone, abn, license_number, business_address, terms_and_conditions, logo_url, bank_account_name, bank_bsb, bank_account_number, accepts_cash")
      .eq("id", businessId)
      .single();

    let logoBytes: Uint8Array | null = null;
    if (profile?.logo_url) {
      try {
        const logoRes = await fetch(profile.logo_url);
        if (logoRes.ok) logoBytes = new Uint8Array(await logoRes.arrayBuffer());
      } catch { /* skip */ }
    }

    const { generateQuotePdf } = await import("@/lib/generateQuotePdf");
    const pdfBytes = await generateQuotePdf(quote, profile ?? {}, logoBytes);

    const filename = `Quote-${(quote.client_name ?? "client").replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });

  } catch (err) {
    const msg   = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? "") : "";
    console.error("[PDF] crash:", msg, stack);
    return NextResponse.json({ error: msg, stack: stack.split("\n").slice(0, 5) }, { status: 500 });
  }
}
