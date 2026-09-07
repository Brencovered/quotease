import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestNextChunk } from "@/lib/abnBulkIngest";
import { runAbnEnrichmentBatch } from "@/lib/abnDirectoryEnrichment";

/**
 * POST body { phase: "ingest" } runs phase 1 (download/filter the next
 * chunk of the ABN Bulk Extract into the candidate queue).
 * POST body { phase: "enrich" } (or omitted) runs phase 2 (guess +
 * verify websites for the next 50 queued candidates, create listings).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const phase = body.phase === "ingest" ? "ingest" : "enrich";

  if (phase === "ingest") {
    const result = await ingestNextChunk();
    return NextResponse.json({ phase, ...result });
  }

  const result = await runAbnEnrichmentBatch();
  return NextResponse.json({ phase, ...result });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [
    { count: totalCandidates },
    { count: unprocessed },
    { count: listingsCreated },
    { data: cursor },
  ] = await Promise.all([
    admin.from("abn_trade_candidates").select("id", { count: "exact", head: true }),
    admin.from("abn_trade_candidates").select("id", { count: "exact", head: true }).is("processed_at", null),
    admin.from("abn_trade_candidates").select("id", { count: "exact", head: true }).not("directory_listing_id", "is", null),
    admin.from("abn_ingest_cursor").select("*").eq("id", 1).single(),
  ]);

  return NextResponse.json({
    totalCandidates: totalCandidates ?? 0,
    unprocessed: unprocessed ?? 0,
    listingsCreated: listingsCreated ?? 0,
    ingestCursor: cursor ?? null,
  });
}
