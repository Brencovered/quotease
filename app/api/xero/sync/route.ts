import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const XERO_CLIENT_ID     = process.env.XERO_CLIENT_ID!;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!;

async function getValidAccessToken(profile: {
  id: string;
  xero_access_token: string;
  xero_refresh_token: string;
  xero_token_expires_at: string;
}, supabase: Awaited<ReturnType<typeof createClient>>) {
  const expiry = new Date(profile.xero_token_expires_at);
  if (expiry > new Date(Date.now() + 60_000)) return profile.xero_access_token;

  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: profile.xero_refresh_token,
      client_id:     XERO_CLIENT_ID,
      client_secret: XERO_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh Xero token");
  const tokens = await res.json();
  await supabase.from("profiles").update({
    xero_access_token:     tokens.access_token,
    xero_refresh_token:    tokens.refresh_token ?? profile.xero_refresh_token,
    xero_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq("id", profile.id);
  return tokens.access_token as string;
}

async function getOrCreateXeroContact(
  accessToken: string,
  tenantId: string,
  profileId: string,
  clientEmail: string,
  clientName: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  // Check if we already have a mapping for this client
  const { data: mapping } = await supabase
    .from("xero_contact_mappings")
    .select("xero_contact_id")
    .eq("profile_id", profileId)
    .eq("client_email", clientEmail.toLowerCase())
    .single();

  if (mapping?.xero_contact_id) return mapping.xero_contact_id;

  // Search Xero for an existing contact with this email
  const searchRes = await fetch(
    `https://api.xero.com/api.xro/2.0/Contacts?where=EmailAddress%3D%22${encodeURIComponent(clientEmail)}%22`,
    { headers: { Authorization: `Bearer ${accessToken}`, "Xero-tenant-id": tenantId, Accept: "application/json" } }
  );
  const searchText = await searchRes.text();
  let searchData: Record<string, unknown> = {};
  try { searchData = JSON.parse(searchText); } catch { console.error("Xero contacts search non-JSON:", searchRes.status, searchText.slice(0, 200)); }
  const existing = (searchData?.Contacts as {ContactID?: string}[])?.[0];

  let xeroContactId: string;

  if (existing?.ContactID) {
    xeroContactId = existing.ContactID;
  } else {
    // Create a new contact in Xero
    const createRes = await fetch("https://api.xero.com/api.xro/2.0/Contacts", {
      method: "POST",
      headers: {
        Authorization:    `Bearer ${accessToken}`,
        "Xero-tenant-id": tenantId,
        "Content-Type":   "application/json",
        "Accept":         "application/json",
      },
      body: JSON.stringify({
        Contacts: [{ Name: clientName, EmailAddress: clientEmail }],
      }),
    });
    const createText = await createRes.text();
    let createData: Record<string, unknown> = {};
    try { createData = JSON.parse(createText); } catch { console.error("Xero contact create non-JSON:", createRes.status, createText.slice(0, 200)); }
    xeroContactId = (createData?.Contacts as {ContactID?: string}[])?.[0]?.ContactID ?? "";
    if (!xeroContactId) throw new Error(`Failed to create Xero contact (HTTP ${createRes.status})`);
  }

  // Save the mapping so we reuse this contact next time
  await supabase.from("xero_contact_mappings").upsert({
    profile_id:        profileId,
    client_email:      clientEmail.toLowerCase(),
    xero_contact_id:   xeroContactId,
    xero_contact_name: clientName,
    updated_at:        new Date().toISOString(),
  }, { onConflict: "profile_id,client_email" });

  return xeroContactId;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quoteIds } = await req.json() as { quoteIds: string[] };
  if (!quoteIds?.length) return NextResponse.json({ error: "No quote IDs" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, xero_tenant_id, xero_access_token, xero_refresh_token, xero_token_expires_at, business_name")
    .eq("id", user.id)
    .single();

  if (!profile?.xero_tenant_id || !profile?.xero_access_token) {
    return NextResponse.json({ error: "Xero not connected" }, { status: 400 });
  }

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, client_name, client_email, site_address, trade, job_type, total_cost, markup_materials, status, invoice_number, accepted_at, paid_at")
    .in("id", quoteIds)
    .eq("profile_id", user.id);

  if (!quotes?.length) return NextResponse.json({ error: "No quotes found" }, { status: 404 });

  const accessToken = await getValidAccessToken(profile as never, supabase);
  const tenantId    = profile.xero_tenant_id;
  const results: { quoteId: string; xeroInvoiceId?: string; error?: string }[] = [];

  for (const quote of quotes) {
    try {
      const total       = (quote.total_cost ?? 0) + (quote.markup_materials ?? 0);
      const clientEmail = quote.client_email?.trim() || `noemail+${quote.id}@swiftscope.com.au`;
      const clientName  = quote.client_name?.trim()  || "Unknown Client";

      // Get or create the Xero contact -- never duplicates
      const xeroContactId = await getOrCreateXeroContact(
        accessToken, tenantId, user.id,
        clientEmail, clientName, supabase
      );

      const dueDate = quote.paid_at
        ? new Date(quote.paid_at).toISOString().slice(0, 10)
        : new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

      const xeroInvoice = {
        Type:            "ACCREC",
        Contact:         { ContactID: xeroContactId },
        Date:            (quote.accepted_at ?? new Date().toISOString()).slice(0, 10),
        DueDate:         dueDate,
        Status:          quote.status === "paid" ? "AUTHORISED" : "SUBMITTED",
        InvoiceNumber:   quote.invoice_number ?? undefined,
        Reference:       `${quote.trade ?? ""} - ${quote.job_type ?? ""} at ${quote.site_address ?? ""}`.trim(),
        LineAmountTypes: "INCLUSIVE",
        LineItems: [{
          Description: `${quote.trade ?? "Trade service"} - ${quote.job_type ?? "Service"}\n${quote.site_address ?? ""}`.trim(),
          Quantity:    1,
          UnitAmount:  total,
          TaxType:     "OUTPUT2",
          AccountCode: "200",
        }],
      };

      const res  = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
        method:  "POST",
        headers: {
          Authorization:    `Bearer ${accessToken}`,
          "Xero-tenant-id": tenantId,
          "Content-Type":   "application/json",
          "Accept":         "application/json",
        },
        body: JSON.stringify({ Invoices: [xeroInvoice] }),
      });

      // Xero sometimes returns HTML error pages -- handle gracefully
      const rawText = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error("Xero non-JSON response:", res.status, rawText.slice(0, 300));
        results.push({ quoteId: quote.id, error: `Xero error ${res.status} -- check your connection in Settings and try again` });
        continue;
      }

      console.log("Xero invoice response:", JSON.stringify(data).slice(0, 500));
      const inv = (data?.Invoices as {InvoiceID?: string; InvoiceNumber?: string}[])?.[0];

      if (!res.ok || !inv?.InvoiceID) {
        const errMsg = (data?.Detail ?? data?.Message ?? (data?.Elements as {ValidationErrors?: {Message: string}[]}[])?.[0]?.ValidationErrors?.[0]?.Message ?? `HTTP ${res.status}`) as string;
        console.error("Xero invoice error:", errMsg);
        results.push({ quoteId: quote.id, error: errMsg });
        continue;
      }

      await supabase.from("quotes").update({
        xero_exported_at: new Date().toISOString(),
        xero_invoice_id:  inv.InvoiceID,
        invoice_number:   inv.InvoiceNumber ?? quote.invoice_number,
      }).eq("id", quote.id);

      results.push({ quoteId: quote.id, xeroInvoiceId: inv.InvoiceID });

    } catch (err: unknown) {
      results.push({ quoteId: quote.id, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return NextResponse.json({
    results,
    succeeded: results.filter(r => !r.error).length,
    failed:    results.filter(r => r.error).length,
  });
}
