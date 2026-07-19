import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBusinessId } from "@/lib/team";
import { CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";

const MAX_PHOTOS = 8;

/**
 * GET/PATCH for the editable fields on a business's own claimed listing:
 * description, logo, gallery photos, socials. Uses the admin client for
 * the actual directory_listing reads/writes -- same reasoning as
 * claim/route.ts and goal/route.ts: directory_listing has no owner-scoped
 * RLS policy (public-read only), so the session client would silently
 * no-op on any write here.
 */
export async function GET() {
  if (!CLAIMED_DIRECTORY_PAGES_ENABLED) {
    return NextResponse.json({ error: "Not available yet" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, user.id);
  const admin = createAdminClient();

  const { data: listing, error } = await admin
    .from("directory_listing")
    .select("id, business_name, suburb, trades, blurb, logo_url, photo_references, website_url, instagram_url, facebook_url, services_offered, years_experience, licenses")
    .eq("profile_id", businessId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Failed to load listing" }, { status: 500 });
  if (!listing) return NextResponse.json({ error: "No claimed listing for this business" }, { status: 404 });

  return NextResponse.json({ listing, businessId });
}

export async function PATCH(req: NextRequest) {
  if (!CLAIMED_DIRECTORY_PAGES_ENABLED) {
    return NextResponse.json({ error: "Not available yet" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, user.id);
  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("directory_listing")
    .select("id")
    .eq("profile_id", businessId)
    .maybeSingle();

  if (!listing) return NextResponse.json({ error: "No claimed listing for this business" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.blurb === "string") update.blurb = body.blurb.trim().slice(0, 1500) || null;
  if (typeof body.logo_url === "string") update.logo_url = body.logo_url.trim() || null;
  if (typeof body.website_url === "string") update.website_url = body.website_url.trim() || null;
  if (typeof body.instagram_url === "string") update.instagram_url = body.instagram_url.trim() || null;
  if (typeof body.facebook_url === "string") update.facebook_url = body.facebook_url.trim() || null;
  if (Array.isArray(body.photo_references)) {
    update.photo_references = body.photo_references
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .slice(0, MAX_PHOTOS);
  }
  if (Array.isArray(body.services_offered)) {
    update.services_offered = body.services_offered
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 60))
      .slice(0, 15);
  }
  if (body.years_experience !== undefined) {
    if (body.years_experience === null) {
      update.years_experience = null;
    } else {
      const years = Number(body.years_experience);
      update.years_experience = Number.isInteger(years) && years >= 0 && years <= 80 ? years : null;
    }
  }
  if (Array.isArray(body.licenses)) {
    update.licenses = body.licenses
      .filter(
        (l): l is { type: string; number?: string } =>
          typeof l === "object" && l !== null &&
          typeof (l as Record<string, unknown>).type === "string"
      )
      .map((l) => ({
        type: l.type.trim().slice(0, 80),
        number: typeof l.number === "string" ? l.number.trim().slice(0, 40) : "",
      }))
      .filter((l) => l.type)
      .slice(0, 10);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await admin
    .from("directory_listing")
    .update(update)
    .eq("id", listing.id);

  if (error) return NextResponse.json({ error: "Failed to save changes" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
