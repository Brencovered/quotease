import type { SupabaseClient } from "@supabase/supabase-js";

const INGESTION_DOMAIN = process.env.SUPPLIER_INGESTION_DOMAIN ?? "invoices.swiftscope.com.au";

function randomToken(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Generate a globally-unique inbound address for a new business_suppliers row. */
export async function generateIngestionEmail(supabase: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `inv-${randomToken()}@${INGESTION_DOMAIN}`;
    const { data } = await supabase.from("business_suppliers").select("id").eq("ingestion_email", candidate).maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Could not generate a unique ingestion email after 5 attempts");
}
