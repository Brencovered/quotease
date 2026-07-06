import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPLIER_PRESETS, parseCSV, guessMapping, rowsToPriceBookRecords } from "@/lib/priceBookImport";

const CSV_TYPES = ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"];

export async function POST(request: Request) {
  const rawBody = await request.text();
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Verify this really came from Resend before touching anything.
  let event: { type: string; data: { email_id: string; to: string[]; from: string; subject: string; attachments: Array<{ id: string; filename: string; content_type: string }> } };
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    }) as typeof event;
  } catch (err) {
    console.error("resend-inbound: signature verification failed -", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const toAddress = event.data.to?.[0]?.toLowerCase();
  if (!toAddress) return NextResponse.json({ ok: true });

  const { data: supplier } = await supabase
    .from("business_suppliers")
    .select("*")
    .eq("ingestion_email", toAddress)
    .maybeSingle();

  if (!supplier) {
    console.warn("resend-inbound: no business_supplier matches", toAddress);
    return NextResponse.json({ ok: true });
  }

  const csvAttachments = (event.data.attachments ?? []).filter(
    (a) => CSV_TYPES.includes(a.content_type) || /\.csv$/i.test(a.filename)
  );

  if (csvAttachments.length === 0) {
    await supabase.from("supplier_price_imports").insert({
      business_supplier_id: supplier.id,
      profile_id: supplier.profile_id,
      resend_email_id: event.data.email_id,
      status: "failed",
      error: "No CSV attachment found on this email",
    });
    return NextResponse.json({ ok: true });
  }

  const { data: attachmentList } = await resend.emails.receiving.attachments.list({ emailId: event.data.email_id });

  for (const meta of csvAttachments) {
    const full = attachmentList?.data?.find((a: { id: string }) => a.id === meta.id);
    if (!full?.download_url) continue;

    try {
      const fileRes = await fetch(full.download_url);
      const text = await fileRes.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        await supabase.from("supplier_price_imports").insert({
          business_supplier_id: supplier.id,
          profile_id: supplier.profile_id,
          resend_email_id: event.data.email_id,
          attachment_filename: meta.filename,
          status: "failed",
          error: "Could not parse any rows from this file",
        });
        continue;
      }

      const headers = Object.keys(rows[0]);
      const knownPreset = supplier.catalog_key && SUPPLIER_PRESETS[supplier.catalog_key]?.descCol ? supplier.catalog_key : null;
      const mapping = guessMapping(headers, knownPreset);

      if (!mapping.descCol || !mapping.priceCol) {
        await supabase.from("supplier_price_imports").insert({
          business_supplier_id: supplier.id,
          profile_id: supplier.profile_id,
          resend_email_id: event.data.email_id,
          attachment_filename: meta.filename,
          status: "needs_mapping",
          row_count: rows.length,
          error: "Could not confidently match description/price columns - needs manual mapping",
        });
        continue;
      }

      const { data: catalogEntry } = await supabase.from("supplier_catalog").select("trades").eq("key", supplier.catalog_key ?? "").maybeSingle();
      const trade = catalogEntry?.trades?.[0] ?? null;

      const records = rowsToPriceBookRecords(rows, mapping, {
        profileId: supplier.profile_id,
        supplierKey: supplier.catalog_key ?? supplier.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        trade,
      });

      if (records.length === 0) {
        await supabase.from("supplier_price_imports").insert({
          business_supplier_id: supplier.id,
          profile_id: supplier.profile_id,
          resend_email_id: event.data.email_id,
          attachment_filename: meta.filename,
          status: "needs_mapping",
          row_count: rows.length,
          error: "Columns matched but no valid priced rows found",
        });
        continue;
      }

      // Full replace, same as the manual import flow: this supplier's
      // previous price book rows are superseded by the new file.
      await supabase.from("price_book_items").delete().eq("profile_id", supplier.profile_id).eq("supplier", records[0].supplier);
      for (let i = 0; i < records.length; i += 500) {
        await supabase.from("price_book_items").insert(records.slice(i, i + 500));
      }

      await supabase.from("supplier_price_imports").insert({
        business_supplier_id: supplier.id,
        profile_id: supplier.profile_id,
        resend_email_id: event.data.email_id,
        attachment_filename: meta.filename,
        status: "imported",
        row_count: records.length,
      });

      await supabase.from("business_suppliers").update({ status: "active", last_import_at: new Date().toISOString() }).eq("id", supplier.id);
    } catch (err) {
      console.error("resend-inbound: failed processing attachment -", err);
      await supabase.from("supplier_price_imports").insert({
        business_supplier_id: supplier.id,
        profile_id: supplier.profile_id,
        resend_email_id: event.data.email_id,
        attachment_filename: meta.filename,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
