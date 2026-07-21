import { createAdminClient } from "@/lib/supabase/admin";

interface XeroProfile {
  id: string;
  xero_connected: boolean;
  xero_tenant_id: string | null;
  xero_access_token: string | null;
  xero_refresh_token: string | null;
  xero_token_expires_at: string | null;
}

// Xero access tokens expire after 30 minutes - refresh proactively rather
// than waiting for a 401, since this runs as a background side-effect of
// marking a quote accepted and a silent failure here shouldn't be the
// thing the tradie notices first.
async function getValidAccessToken(profile: XeroProfile): Promise<string | null> {
  if (!profile.xero_refresh_token) return null;

  const expiresAt = profile.xero_token_expires_at ? new Date(profile.xero_token_expires_at).getTime() : 0;
  const stillValid = expiresAt - Date.now() > 60_000; // more than a minute left

  if (stillValid && profile.xero_access_token) return profile.xero_access_token;

  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: profile.xero_refresh_token }),
  });
  if (!res.ok) return null;
  const tokens = await res.json();

  const supabase = createAdminClient();
  await supabase
    .from("profiles")
    .update({
      xero_access_token: tokens.access_token,
      xero_refresh_token: tokens.refresh_token,
      xero_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("id", profile.id);

  return tokens.access_token;
}

export async function pushQuoteToXero(quote: {
  id: string;
  client_name: string | null;
  client_email: string | null;
  total_cost: number | null;
  invoice_number: string | null;
}, profile: XeroProfile): Promise<{ ok: boolean; error?: string }> {
  if (!profile.xero_connected || !profile.xero_tenant_id) {
    return { ok: false, error: "Xero not connected" };
  }

  const accessToken = await getValidAccessToken(profile);
  if (!accessToken) return { ok: false, error: "Could not refresh Xero token - reconnect in Settings" };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Xero-tenant-id": profile.xero_tenant_id,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Xero's API will match an existing contact by name automatically if one
  // exists - no need to search-then-create, a plain create with the same
  // name reuses it.
  const invoiceRes = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
    method: "POST",
    headers,
    body: JSON.stringify({
      Invoices: [
        {
          Type: "ACCREC",
          Contact: { Name: quote.client_name || "Unnamed client", EmailAddress: quote.client_email || undefined },
          LineItems: [
            {
              Description: `Quote ${quote.invoice_number ?? quote.id.slice(0, 8)}`,
              Quantity: 1,
              UnitAmount: quote.total_cost ?? 0,
              AccountCode: "200", // standard default sales account code in a new Xero org
            },
          ],
          Status: "DRAFT",
          Reference: quote.invoice_number ?? undefined,
        },
      ],
    }),
  });

  if (!invoiceRes.ok) {
    const body = await invoiceRes.text();
    return { ok: false, error: `Xero rejected the invoice: ${body.slice(0, 300)}` };
  }

  return { ok: true };
}

export async function pushDocketInvoiceToXero(
  bundle: {
    invoice_number: string;
    total_cost: number;
  },
  dockets: { work_date: string; total_cost: number; description: string | null }[],
  client: { name: string | null; email: string | null },
  profile: XeroProfile
): Promise<{ ok: boolean; error?: string; xeroInvoiceId?: string }> {
  if (!profile.xero_connected || !profile.xero_tenant_id) {
    return { ok: false, error: "Xero not connected" };
  }

  const accessToken = await getValidAccessToken(profile);
  if (!accessToken) return { ok: false, error: "Could not refresh Xero token - reconnect in Settings" };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Xero-tenant-id": profile.xero_tenant_id,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // One line item per docket in the bundle (dated, with its own total)
  // rather than a single lump sum - gives the client's Xero invoice the
  // same day-by-day breakdown the signed dockets themselves recorded,
  // instead of collapsing a month of dayworks into one opaque number.
  const lineItems = dockets.map((d) => ({
    Description: `Dayworks - ${new Date(d.work_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}${d.description ? ` - ${d.description}` : ""}`,
    Quantity: 1,
    UnitAmount: d.total_cost,
    AccountCode: "200", // standard default sales account code in a new Xero org
  }));

  const invoiceRes = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
    method: "POST",
    headers,
    body: JSON.stringify({
      Invoices: [
        {
          Type: "ACCREC",
          Contact: { Name: client.name || "Unnamed client", EmailAddress: client.email || undefined },
          LineItems: lineItems,
          Status: "DRAFT",
          Reference: bundle.invoice_number,
        },
      ],
    }),
  });

  if (!invoiceRes.ok) {
    const body = await invoiceRes.text();
    return { ok: false, error: `Xero rejected the invoice: ${body.slice(0, 300)}` };
  }

  const result = await invoiceRes.json();
  const xeroInvoiceId = result?.Invoices?.[0]?.InvoiceID as string | undefined;

  return { ok: true, xeroInvoiceId };
}
