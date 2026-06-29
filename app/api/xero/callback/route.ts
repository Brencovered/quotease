import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const XERO_CLIENT_ID     = process.env.XERO_CLIENT_ID!;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!;
const XERO_REDIRECT_URI  = process.env.NEXT_PUBLIC_APP_URL + "/api/xero/callback";
const APP_URL            = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code) return NextResponse.redirect(`${APP_URL}/settings?xero=error&msg=no_code`);

  // Exchange code for tokens
  const tokenRes = await fetch("https://identity.xero.com/connect/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      code,
      redirect_uri:  XERO_REDIRECT_URI,
      client_id:     XERO_CLIENT_ID,
      client_secret: XERO_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(`${APP_URL}/settings?xero=error&msg=token_exchange_failed`);
  const tokens = await tokenRes.json();

  // Get tenant ID
  const tenantsRes = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!tenantsRes.ok) return NextResponse.redirect(`${APP_URL}/settings?xero=error&msg=no_tenant`);
  const tenants  = await tenantsRes.json();
  const tenantId = tenants[0]?.tenantId;
  if (!tenantId) return NextResponse.redirect(`${APP_URL}/settings?xero=error&msg=no_org`);

  // Read the first active REVENUE account + its TaxType from this org
  // so we never have to guess account codes or tax types
  let xeroAccountCode = "200";
  let xeroTaxType     = "OUTPUT";

  try {
    const acctRes = await fetch(
      "https://api.xero.com/api.xro/2.0/Accounts?where=Type%3D%22REVENUE%22%26%26Status%3D%22ACTIVE%22",
      {
        headers: {
          Authorization:    `Bearer ${tokens.access_token}`,
          "Xero-tenant-id": tenantId,
          Accept:           "application/json",
        },
      }
    );
    if (acctRes.ok) {
      const acctData = await acctRes.json();
      const accounts = acctData?.Accounts ?? [];
      // Prefer account 200 (Sales) if it exists, otherwise take first revenue account
      const preferred = accounts.find((a: {Code: string}) => a.Code === "200") ?? accounts[0];
      if (preferred) {
        xeroAccountCode = preferred.Code;
        xeroTaxType     = preferred.TaxType ?? "OUTPUT";
      }
    }
  } catch (e) {
    console.error("Could not read Xero accounts on connect:", e);
  }

  // Store tokens + org-specific account/tax settings in profiles
  const userId = state ? Buffer.from(state, "base64url").toString() : null;
  if (!userId) return NextResponse.redirect(`${APP_URL}/settings?xero=error&msg=no_state`);

  const supabase = await createClient();
  await supabase.from("profiles").update({
    xero_tenant_id:        tenantId,
    xero_access_token:     tokens.access_token,
    xero_refresh_token:    tokens.refresh_token,
    xero_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    xero_connected_at:     new Date().toISOString(),
    xero_account_code:     xeroAccountCode,
    xero_tax_type:         xeroTaxType,
  }).eq("id", userId);

  return NextResponse.redirect(`${APP_URL}/settings?xero=connected`);
}
