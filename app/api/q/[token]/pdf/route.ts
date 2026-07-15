import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateQuotePdf } from "@/lib/generateQuotePdf";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*, profiles!quotes_profile_id_fkey(business_name, contact_email, contact_phone, abn, license_number, business_address, terms_and_conditions, logo_url, bank_account_name, bank_bsb, bank_account_number, accepts_cash)")
    .eq("public_token", token)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const profile = quote.profiles ?? {};

  let logoBytes: Uint8Array | null = null;
  if (profile.logo_url) {
    try {
      const logoRes = await fetch(profile.logo_url);
      if (logoRes.ok) logoBytes = new Uint8Array(await logoRes.arrayBuffer());
    } catch {
      // skip logo on fetch failure
    }
  }

  const pdfBytes = await generateQuotePdf(quote, profile, logoBytes, supabase);
  const filename = `Quote-${(quote.client_name ?? "client").replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
