import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trade = searchParams.get("trade") ?? "";
  const hasEmail = searchParams.get("hasEmail") === "true";
  const hasPhone = searchParams.get("hasPhone") === "true";
  const hasWebsite = searchParams.get("hasWebsite") === "true";
  const hasRating = searchParams.get("hasRating") === "true";
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));

  const admin = createAdminClient();
  let query = admin
    .from("directory_listing")
    .select("*", { count: "exact" });

  // Trade filter
  if (trade) {
    query = query.contains("trades", [trade]);
  }

  // Has filters
  if (hasEmail) {
    query = query.or("scraped_contact_email.not.is.null,private_email.not.is.null");
  }
  if (hasPhone) {
    query = query.not("scraped_contact_phone", "is", null);
  }
  if (hasWebsite) {
    query = query.not("website_url", "is", null);
  }
  if (hasRating) {
    query = query.not("google_rating", "is", null);
  }

  // Text search
  if (search) {
    const q = `%${search}%`;
    query = query.or(
      `business_name.ilike.${q},suburb.ilike.${q},scraped_contact_email.ilike.${q},website_url.ilike.${q}`
    );
  }

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
