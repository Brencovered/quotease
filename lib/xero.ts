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

type XeroLineItem = {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  AccountCode: string;
};

/** Build Xero line items from quote intake when we have priced site scope.
 *  Falls back to a single total line when there is nothing itemised. */
export function buildXeroQuoteLineItems(quote: {
  id: string;
  total_cost: number | null;
  invoice_number: string | null;
  intake_data?: Record<string, unknown> | null;
}): XeroLineItem[] {
  const accountCode = "200"; // default sales account in a new Xero org
  const siteItems = Array.isArray(quote.intake_data?.site_items)
    ? (quote.intake_data!.site_items as {
        label?: string;
        qty?: number;
        unit?: string;
        note?: string;
        materialsCost?: number;
        labourHrs?: number;
      }[])
    : [];

  const lines: XeroLineItem[] = [];
  for (const item of siteItems) {
    const label = (item.label ?? "").trim();
    if (!label) continue;
    const qty = Number(item.qty) || 0;
    if (qty <= 0) continue;
    const materials = Number(item.materialsCost) || 0;
    const labourHrs = Number(item.labourHrs) || 0;
    // Prefer materials sell total when present; otherwise skip zero-dollar noise.
    // Labour without materials becomes a separate hours note line if hours exist.
    if (materials > 0) {
      const note = item.note?.trim();
      lines.push({
        Description: note ? `${label} (${note})` : label,
        Quantity: qty,
        UnitAmount: Math.round((materials / qty) * 100) / 100,
        AccountCode: accountCode,
      });
    } else if (labourHrs > 0) {
      lines.push({
        Description: `${label} - labour`,
        Quantity: labourHrs,
        UnitAmount: 0,
        AccountCode: accountCode,
      });
    }
  }

  const lineSum = lines.reduce((s, l) => s + l.Quantity * l.UnitAmount, 0);
  const total = Number(quote.total_cost) || 0;
  const remainder = Math.round((total - lineSum) * 100) / 100;

  if (lines.length === 0) {
    return [
      {
        Description: `Quote ${quote.invoice_number ?? quote.id.slice(0, 8)}`,
        Quantity: 1,
        UnitAmount: total,
        AccountCode: accountCode,
      },
    ];
  }

  // Keep the invoice total aligned with the accepted quote when scope lines
  // don't cover labour/extras (common - site_items often hold materials only).
  if (Math.abs(remainder) >= 0.01) {
    lines.push({
      Description: remainder >= 0 ? "Labour and other charges" : "Quote adjustment",
      Quantity: 1,
      UnitAmount: remainder,
      AccountCode: accountCode,
    });
  }

  return lines;
}

export async function pushQuoteToXero(quote: {
  id: string;
  client_name: string | null;
  client_email: string | null;
  total_cost: number | null;
  invoice_number: string | null;
  intake_data?: Record<string, unknown> | null;
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

  const lineItems = buildXeroQuoteLineItems(quote);

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
          LineItems: lineItems,
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
