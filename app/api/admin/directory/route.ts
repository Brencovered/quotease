import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(
  query: any,
  params: { trade: string; email: string; phone: string; website: string; rating: string; search: string }
) {
  const { trade, email, phone, website, rating, search } = params;
  let q = query;

  if (trade) q = q.contains("trades", [trade]);

  if (email === "yes") q = q.or("scraped_contact_email.not.is.null,private_email.not.is.null");
  else if (email === "no") q = q.is("scraped_contact_email", null).is("private_email", null);

  if (phone === "yes") q = q.not("scraped_contact_phone", "is", null);
  else if (phone === "no") q = q.is("scraped_contact_phone", null);

  if (website === "yes") q = q.not("website_url", "is", null);
  else if (website === "no") q = q.is("website_url", null);

  if (rating === "yes") q = q.not("google_rating", "is", null);
  else if (rating === "no") q = q.is("google_rating", null);

  if (search) {
    const s = `%${search}%`;
    q = q.or(`business_name.ilike.${s},suburb.ilike.${s},scraped_contact_email.ilike.${s},website_url.ilike.${s}`);
  }

  return q;
}

const CSV_COLUMNS = [
  "business_name", "trades", "suburb", "postcode",
  "scraped_contact_email", "scraped_contact_phone", "private_email", "website_url",
  "google_rating", "google_reviews_count", "blurb", "place_id", "created_at",
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = Array.isArray(value) ? value.join("; ") : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const unauthorised = await requireAdmin();
  if (unauthorised) return unauthorised;

  const { searchParams } = new URL(req.url);
  const trade = searchParams.get("trade") ?? "";
  const email = searchParams.get("email") ?? "";      // "yes" | "no" | ""
  const phone = searchParams.get("phone") ?? "";      // "yes" | "no" | ""
  const website = searchParams.get("website") ?? "";  // "yes" | "no" | ""
  const rating = searchParams.get("rating") ?? "";    // "yes" | "no" | ""
  const search = searchParams.get("search") ?? "";
  const format = searchParams.get("format") ?? "";

  const admin = createAdminClient();

  if (format === "csv") {
    // Export mode: same filters, but no 200-row UI cap -- the tradie picks
    // how many rows they want (up to a safety ceiling), and we page through
    // Supabase's own 1000-row-per-request limit internally to get there.
    const EXPORT_CEILING = 10000;
    const requested = searchParams.get("count") ?? "all";
    const wantCount = requested === "all" ? EXPORT_CEILING : Math.min(EXPORT_CEILING, Math.max(1, parseInt(requested, 10) || EXPORT_CEILING));

    const rows: Record<string, unknown>[] = [];
    const PAGE = 1000;
    for (let from = 0; rows.length < wantCount; from += PAGE) {
      const to = Math.min(from + PAGE, wantCount) - 1;
      let query = admin.from("directory_listing").select("*");
      query = applyFilters(query, { trade, email, phone, website, rating, search });
      const { data, error } = await query.order("created_at", { ascending: false }).range(from, to);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < to - from + 1) break;
    }

    const header = CSV_COLUMNS.join(",");
    const lines = rows.map((r) => CSV_COLUMNS.map((c) => csvEscape(r[c])).join(","));
    const csv = [header, ...lines].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="swiftscope-directory-${stamp}.csv"`,
      },
    });
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));

  let query = admin.from("directory_listing").select("*", { count: "exact" });
  query = applyFilters(query, { trade, email, phone, website, rating, search });

  // Pagination
  const from = (page - 1) * limit;
  query = query.order("created_at", { ascending: false }).range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listings: data ?? [], total: count ?? 0, page, limit });
}

export async function PATCH(req: NextRequest) {
  const unauthorised = await requireAdmin();
  if (unauthorised) return unauthorised;

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Only allow specific fields to be updated
  const allowed = ["business_name", "trades", "website_url", "suburb", "postcode",
    "scraped_contact_email", "scraped_contact_phone", "private_email",
    "google_rating", "google_reviews_count", "blurb", "logo_url"];
  const clean: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) clean[key] = updates[key];
  }

  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  clean.updated_at = new Date().toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("directory_listing")
    .update(clean)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listing: data });
}

export async function DELETE(req: NextRequest) {
  const unauthorised = await requireAdmin();
  if (unauthorised) return unauthorised;

  const body = await req.json();
  const { ids } = body as { ids: string[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Missing ids array" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error, count } = await admin
    .from("directory_listing")
    .delete()
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: count ?? ids.length });
}
