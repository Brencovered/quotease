import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuotePdf } from "@/lib/generateQuotePdf";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("profile_id", userData.user.id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, contact_email, contact_phone, abn, license_number, business_address, terms_and_conditions, logo_url")
    .eq("id", userData.user.id)
    .single();

  let logoBytes: Uint8Array | null = null;
  if (profile?.logo_url) {
    try {
      const logoRes = await fetch(profile.logo_url);
      if (logoRes.ok) {
        logoBytes = new Uint8Array(await logoRes.arrayBuffer());
      }
    } catch {
      // Logo fetch failing shouldn't block the whole PDF - just renders without it.
    }
  }

  const pdfBytes = await generateQuotePdf(quote, profile ?? {}, logoBytes);

  const filename = `Quote${quote.invoice_number ? "-" + quote.invoice_number : ""}-${(quote.client_name ?? "client").replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
