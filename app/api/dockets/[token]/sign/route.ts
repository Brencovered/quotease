import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { signedByName, signatureData } = await request.json();

  if (!signedByName?.trim() || !signatureData) {
    return NextResponse.json({ error: "Name and signature are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: docket, error } = await supabase
    .from("dockets")
    .select("id, status")
    .eq("public_token", token)
    .single();

  if (error || !docket) {
    return NextResponse.json({ error: "Docket not found" }, { status: 404 });
  }
  if (docket.status === "signed" || docket.status === "invoiced") {
    return NextResponse.json({ error: "This docket has already been signed" }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("dockets")
    .update({
      status: "signed",
      signed_by_name: signedByName.trim(),
      signature_data: signatureData,
      signed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", docket.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not save signature" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
