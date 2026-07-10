import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

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
  if (!res.ok) {
    // Xero rotates refresh tokens on every use - if this one's already
    // been consumed (a previous refresh succeeded but this stale token
    // is being retried), or the connection was revoked/expired on
    // Xero's side, refresh will fail with invalid_grant. Previously this
    // just threw and crashed the whole route with an unhandled 500 -
    // clear the dead connection so Settings correctly shows
    // "not connected" instead of a stale "connected" state that
    // silently fails on every sync attempt, and surface a clear,
    // actionable message instead of a raw error.
    const errBody = await res.text().catch(() => "");
    console.error("[xero] refresh token rejected:", res.status, errBody.slice(0, 300));
    await supabase.from("profiles").update({
      xero_tenant_id:        null,
      xero_access_token:     null,
      xero_refresh_token:    null,
      xero_token_expires_at: null,
      xero_connected_at:     null,
    }).eq("id", profile.id);
    throw new Error("XERO_RECONNECT_REQUIRED");
  }
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
  supabase: Awaited<ReturnType<typeof createClient>>,
  forceCreate = false
): Promise<string> {
  // Check if we already have a mapping for this client
  if (!forceCreate) {
    const { data: mapping } = await supabase
      .from("xero_contact_mappings")
      .select("xero_contact_id")
      .eq("profile_id", profileId)
      .eq("client_email", clientEmail.toLowerCase())
      .single();

    if (mapping?.xero_contact_id) return mapping.xero_contact_id;
  }

  // Search Xero for an existing contact with this email (skipped when
  // force-creating after a stale/broken cached contact - re-searching
  // by email could just find the same broken contact again).
  let existing: { ContactID?: string } | undefined;
  if (!forceCreate) {
    const searchRes = await fetch(
      `https://api.xero.com/api.xro/2.0/Contacts?where=EmailAddress%3D%22${encodeURIComponent(clientEmail)}%22`,
      { headers: { Authorization: `Bearer ${accessToken}`, "Xero-tenant-id": tenantId, Accept: "application/json" } }
    );
    const searchText = await searchRes.text();
    let searchData: Record<string, unknown> = {};
    try { searchData = JSON.parse(searchText); } catch { console.error("Xero contacts search non-JSON:", searchRes.status, searchText.slice(0, 200)); }
    existing = (searchData?.Contacts as {ContactID?: string}[])?.[0];
  }

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
  // Xero is connected once per business (one tenant, one token pair) - a
  // team member syncing invoices should use the business's connection,
  // not look for one under their own individual profile.
  const businessId = await getActiveBusinessId(supabase, user.id);

  const { quoteIds } = await req.json() as { quoteIds: string[] };
  if (!quoteIds?.length) return NextResponse.json({ error: "No quote IDs" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, xero_tenant_id, xero_access_token, xero_refresh_token, xero_token_expires_at, business_name, xero_account_code, xero_tax_type")
    .eq("id", businessId)
    .single();

  if (!profile?.xero_tenant_id || !profile?.xero_access_token) {
    return NextResponse.json({ error: "Xero not connected" }, { status: 400 });
  }

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, client_name, client_email, site_address, trade, job_type, total_cost, markup_materials, status, invoice_number, accepted_at, paid_at")
    .in("id", quoteIds)
    .eq("profile_id", businessId);

  if (!quotes?.length) return NextResponse.json({ error: "No quotes found" }, { status: 404 });

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(profile as never, supabase);
  } catch (err) {
    if (err instanceof Error && err.message === "XERO_RECONNECT_REQUIRED") {
      return NextResponse.json(
        { error: "Your Xero connection has expired. Please reconnect Xero in Settings and try again." },
        { status: 400 }
      );
    }
    console.error("[xero/sync] unexpected error getting access token:", err);
    return NextResponse.json({ error: "Couldn't connect to Xero right now - try again shortly." }, { status: 502 });
  }
  const tenantId    = profile.xero_tenant_id;
  const results: { quoteId: string; xeroInvoiceId?: string; error?: string }[] = [];

  for (const quote of quotes) {
    try {
      // markup_materials is an array of line items ({label, quantity,
      // unitCost, totalCost}), not a dollar figure - adding it directly
      // to total_cost silently string-concatenated ("366[object Object],
      // [object Object]...") instead of summing, which Xero then
      // rejected outright when trying to parse it as a decimal.
      const markupTotal = ((quote.markup_materials as Array<{ totalCost?: number }>) ?? [])
        .reduce((sum, m) => sum + (m.totalCost ?? 0), 0);
      const total       = (quote.total_cost ?? 0) + markupTotal;
      const clientEmail = quote.client_email?.trim() || `noemail+${quote.id}@swiftscope.com.au`;
      const clientName  = quote.client_name?.trim()  || "Unknown Client";

      // Get or create the Xero contact -- never duplicates
      let xeroContactId = await getOrCreateXeroContact(
        accessToken, tenantId, businessId,
        clientEmail, clientName, supabase
      );

      const dueDate = quote.paid_at
        ? new Date(quote.paid_at).toISOString().slice(0, 10)
        : new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

      async function submitInvoice(contactId: string) {
        const xeroInvoice = {
          Type:            "ACCREC",
          Contact:         { ContactID: contactId },
          Date:            (quote.accepted_at ?? new Date().toISOString()).slice(0, 10),
          DueDate:         dueDate,
          Status:          quote.status === "paid" ? "AUTHORISED" : "SUBMITTED",
          InvoiceNumber:   quote.invoice_number ?? undefined,
          Reference:       `${quote.trade ?? ""} - ${quote.job_type ?? ""} at ${quote.site_address ?? ""}`.trim(),
          LineItems: [{
            Description: `${quote.trade ?? "Trade service"} - ${quote.job_type ?? "Service"} at ${quote.site_address ?? ""}`.trim(),
            Quantity:    1,
            UnitAmount:  total,
            AccountCode: (profile as Record<string,unknown>).xero_account_code as string || "200",
            TaxType:     (profile as Record<string,unknown>).xero_tax_type as string || "OUTPUT",
          }],
        };

        const res = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
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
          return { ok: false, errMsg: `Xero error ${res.status} -- check your connection in Settings and try again` };
        }

        const inv = (data?.Invoices as {InvoiceID?: string; InvoiceNumber?: string}[])?.[0];

        if (!res.ok || !inv?.InvoiceID) {
          const validationErrors = (data?.Elements as {ValidationErrors?: {Message: string}[]}[])?.[0]?.ValidationErrors?.map((e: {Message: string}) => e.Message).join("; ");
          const errMsg = (validationErrors ?? data?.Detail ?? data?.Message ?? `HTTP ${res.status}`) as string;
          console.error("Xero invoice error:", errMsg, JSON.stringify(data).slice(0, 400));
          return { ok: false, errMsg };
        }

        return { ok: true, inv };
      }

      let attempt = await submitInvoice(xeroContactId);

      // "Contact could not be found... Name field required to create a
      // new contact" happens when the cached ContactID no longer
      // resolves to a usable contact on Xero's side (archived, merged,
      // etc) - our cache has no way to know that on its own. Clear the
      // stale mapping and retry once with a genuinely fresh contact
      // rather than failing every future invoice for this client forever.
      if (!attempt.ok && attempt.errMsg && /contact/i.test(attempt.errMsg)) {
        console.error(`[xero/sync] contact ${xeroContactId} appears stale for ${clientEmail} - clearing cached mapping and retrying with a fresh contact`);
        await supabase.from("xero_contact_mappings").delete().eq("profile_id", businessId).eq("client_email", clientEmail.toLowerCase());
        xeroContactId = await getOrCreateXeroContact(accessToken, tenantId, businessId, clientEmail, clientName, supabase, true);
        attempt = await submitInvoice(xeroContactId);
      }

      if (!attempt.ok) {
        results.push({ quoteId: quote.id, error: attempt.errMsg ?? "Unknown Xero error" });
        continue;
      }

      const inv = attempt.inv!;
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
