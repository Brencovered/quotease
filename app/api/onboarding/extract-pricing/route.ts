/**
 * POST /api/onboarding/extract-pricing
 * -------------------------------------
 * Onboarding step: accepts 1-5 uploaded quote files (PDF/image), runs each
 * through AI extraction (lib/ai/quotePricingExtraction.ts), and inserts the
 * combined result into price_book_items so the new account starts with
 * real pricing instead of empty defaults.
 *
 * Deliberately additive, not a full-replace like the CSV importer --
 * these are supplementary items the tradie is adding on top of whatever
 * else they set up (manual entry, CSV, Xero), tagged with their own
 * supplier label so they're visually distinguishable in the price book.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { extractPricingFromQuote } from "@/lib/ai/quotePricingExtraction";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPLIER_LABEL = "From your quotes";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`extract-pricing:${user.id}`, 10, 10 * 60 * 1000);
  const rlBlocked = rateLimitResponseInit(rl);
  if (rlBlocked) return NextResponse.json(rlBlocked.body, rlBlocked.init);

  const businessId = await getActiveBusinessId(supabase, user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("trades")
    .eq("id", businessId)
    .single();
  const trade = profile?.trades?.[0] ?? "electrician";

  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Please upload at most ${MAX_FILES} quotes at a time` }, { status: 400 });
  }
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `${file.name} is too large (max 10MB)` }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `${file.name}: unsupported file type. Use PDF, JPG, PNG, or WebP.` }, { status: 400 });
    }
  }

  // Process files sequentially -- these are vision-model calls, and running
  // 5 of them in parallel against the same per-user rate limit budget adds
  // nothing but risk of hitting provider-side concurrency limits.
  const allItems: Array<{ description: string; unit: string; unit_cost: number }> = [];
  const fileResults: Array<{ name: string; itemsFound: number }> = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const items = await extractPricingFromQuote(base64, file.type, trade);
    allItems.push(...items);
    fileResults.push({ name: file.name, itemsFound: items.length });
  }

  if (allItems.length === 0) {
    return NextResponse.json({
      imported: 0,
      files: fileResults,
      message: "No priced line items could be extracted from the uploaded file(s). You can still add pricing manually or via CSV.",
    });
  }

  const rows = allItems.map((item) => ({
    profile_id: businessId,
    supplier: SUPPLIER_LABEL,
    sku: null,
    description: item.description,
    unit: item.unit,
    cost_price: item.unit_cost,
    trade,
  }));

  const { error: insertError } = await supabase.from("price_book_items").insert(rows);

  if (insertError) {
    console.error("[extract-pricing] insert error:", insertError.message);
    return NextResponse.json({ error: "Extraction succeeded but saving to your price book failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    imported: allItems.length,
    files: fileResults,
  });
}
