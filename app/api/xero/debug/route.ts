import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("xero_tenant_id, xero_access_token")
    .eq("id", user.id)
    .single();

  if (!profile?.xero_tenant_id) return NextResponse.json({ error: "Not connected" });

  // Fetch the actual accounts from this Xero org
  const accountsRes = await fetch(
    "https://api.xero.com/api.xro/2.0/Accounts?where=Type%3D%22REVENUE%22",
    {
      headers: {
        Authorization:    `Bearer ${profile.xero_access_token}`,
        "Xero-tenant-id": profile.xero_tenant_id,
        Accept:           "application/json",
      },
    }
  );
  const accounts = await accountsRes.json();

  // Fetch tax rates for this org
  const taxRes = await fetch(
    "https://api.xero.com/api.xro/2.0/TaxRates?where=Status%3D%22ACTIVE%22",
    {
      headers: {
        Authorization:    `Bearer ${profile.xero_access_token}`,
        "Xero-tenant-id": profile.xero_tenant_id,
        Accept:           "application/json",
      },
    }
  );
  const taxes = await taxRes.json();

  return NextResponse.json({
    revenue_accounts: accounts?.Accounts?.map((a: {Code: string; Name: string; TaxType: string}) => ({
      code: a.Code, name: a.Name, taxType: a.TaxType
    })),
    tax_rates: taxes?.TaxRates?.map((t: {Name: string; TaxType: string; TaxComponents: unknown[]}) => ({
      name: t.Name, taxType: t.TaxType, components: t.TaxComponents
    })),
  });
}
