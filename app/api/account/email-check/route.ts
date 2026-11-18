import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Is this email's domain on public.email_domain_blocklist? Called by the
 * signup and claim forms before signUp(), so a blocked address gets a
 * clear message instead of Supabase's generic trigger error. The trigger
 * on auth.users is still what actually enforces the block.
 */
export async function POST(req: NextRequest) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email : "";
  } catch {
    return NextResponse.json({ blocked: false });
  }
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain || domain.length > 253) return NextResponse.json({ blocked: false });

  const { data, error } = await createAdminClient()
    .from("email_domain_blocklist")
    .select("domain")
    .eq("domain", domain)
    .maybeSingle();
  if (error) return NextResponse.json({ blocked: false });
  return NextResponse.json({ blocked: !!data });
}
