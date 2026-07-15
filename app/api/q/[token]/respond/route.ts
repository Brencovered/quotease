import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushQuoteToXero } from "@/lib/xero";
import { getOrCreateJobForQuote } from "@/lib/jobs";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { action } = await request.json();
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id, profile_id, client_name, client_email, total_cost, invoice_number, status, profiles!quotes_profile_id_fkey(business_name, contact_email)")
    .eq("public_token", token)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  if (quote.status !== "sent") {
    return NextResponse.json({ error: "This quote has already been responded to" }, { status: 409 });
  }

  const newStatus = action === "accept" ? "accepted" : "declined";
  const update: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
  if (action === "accept") update.accepted_at = new Date().toISOString();

  await supabase.from("quotes").update(update).eq("id", quote.id);

  if (action === "accept") {
    // Create the job now, not lazily - this is the primary way quotes get
    // accepted (via the emailed client link), so it shouldn't depend on the
    // tradie happening to open the quote/job detail page afterwards to
    // trigger the self-healing backfill in getOrCreateJobForQuote.
    await getOrCreateJobForQuote(supabase, quote.id).catch((err) => {
      console.error("[q/respond] failed to create job on accept", { quoteId: quote.id, err });
      return null;
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, xero_connected, xero_tenant_id, xero_access_token, xero_refresh_token, xero_token_expires_at")
      .eq("id", quote.profile_id)
      .single();
    if (profile?.xero_connected) {
      // Best-effort - a Xero hiccup shouldn't block the client's acceptance.
      await pushQuoteToXero(quote, profile).catch(() => null);
    }
  }

  // The "win" moment - tell the tradie the moment it happens, not just a
  // colour change next time they happen to open the app. Best-effort: if
  // Resend isn't configured or the send fails, the accept itself still
  // succeeds - a missing celebration email shouldn't block the real action.
  const apiKey = process.env.RESEND_API_KEY;
  const profile = quote.profiles as unknown as { business_name?: string; contact_email?: string } | null;

  const { sendPushToBusiness } = await import("@/lib/push");
  await sendPushToBusiness(supabase, quote.profile_id, {
    title: action === "accept" ? "Quote accepted! 🎉" : "Quote declined",
    body:
      action === "accept"
        ? `${quote.client_name ?? "A client"} accepted your quote for $${(quote.total_cost ?? 0).toLocaleString()}`
        : `${quote.client_name ?? "A client"} declined your quote for $${(quote.total_cost ?? 0).toLocaleString()}`,
    url: "/jobs",
  }).catch(() => null);

  if (apiKey && profile?.contact_email) {
    try {
      const subject =
        action === "accept"
          ? `🎉 ${quote.client_name ?? "A client"} accepted your quote - $${(quote.total_cost ?? 0).toLocaleString()}`
          : `${quote.client_name ?? "A client"} declined your quote`;
      const html =
        action === "accept"
          ? `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
               <h2 style="color:#0a1722;">You just won a job 🎉</h2>
               <p>${quote.client_name ?? "Your client"} accepted the quote worth <strong>$${(quote.total_cost ?? 0).toLocaleString()}</strong>.</p>
               <p>It's now showing as an active job in Swiftscope - head to the Jobs tab to get it scheduled.</p>
             </div>`
          : `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
               <h2>Quote declined</h2>
               <p>${quote.client_name ?? "The client"} declined the quote for $${(quote.total_cost ?? 0).toLocaleString()}.</p>
             </div>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `Swiftscope <${process.env.RESEND_FROM_EMAIL ?? "quotes@yourdomain.com"}>`,
          to: profile.contact_email,
          subject,
          html,
        }),
      });
    } catch {
      // Notification failing is not the client's problem - swallow it.
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
