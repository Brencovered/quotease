import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBusinessId } from "@/lib/team";

/**
 * Syncs a business's own directory_listing row from the directory_* fields
 * on their profile (DirectoryPanel in Settings).
 *
 * Bug this fixes: DirectoryPanel previously only wrote directory_enabled/
 * directory_suburb/etc onto `profiles`. Nothing anywhere read those columns
 * to create or update a directory_listing row, so a business signing up
 * fresh (no pre-existing scraped listing to claim) could toggle "list my
 * business", fill in every field, hit save, and see "Saved" - while their
 * business never appeared on /directory at all. directory_listing has no
 * owner-scoped RLS write policy (see manage/route.ts), so this has to run
 * through the admin client server-side; the client-side Supabase call in
 * DirectoryPanel could never have written it either way.
 *
 * Only creates/updates when directory_enabled is true. Disabling currently
 * leaves any existing row as-is (no "hidden" flag on directory_listing
 * yet) - safe default since it never deletes a listing, including one
 * that came from the original claim flow rather than this panel, but a
 * true hide-on-disable needs a schema addition and is a separate follow-up.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, user.id);
  const admin = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const enabled = body.enabled === true;

  if (!enabled) {
    // Nothing to sync - see note above on why disable doesn't delete.
    return NextResponse.json({ ok: true, synced: false });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("business_name, trades")
    .eq("id", businessId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Could not load business profile" }, { status: 500 });
  }

  if (!profile.business_name || !profile.business_name.trim()) {
    return NextResponse.json(
      { error: "Add a business name in Settings before enabling your directory listing" },
      { status: 400 }
    );
  }

  const suburb = typeof body.suburb === "string" ? body.suburb.trim() || null : null;
  const postcode = typeof body.postcode === "string" ? body.postcode.trim() || null : null;
  const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 1500) || null : null;
  const website = typeof body.website === "string" ? body.website.trim() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const email = typeof body.email === "string" ? body.email.trim() || null : null;

  const { data: existing } = await admin
    .from("directory_listing")
    .select("id")
    .eq("profile_id", businessId)
    .maybeSingle();

  const sharedFields = {
    business_name: profile.business_name.trim(),
    trades: profile.trades ?? [],
    suburb,
    postcode,
    blurb: bio,
    contact_phone: phone,
    private_email: email,
    website_url: website,
  };

  if (existing) {
    const { error } = await admin
      .from("directory_listing")
      .update(sharedFields)
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update listing" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, synced: true, listingId: existing.id });
  }

  const { data: created, error } = await admin
    .from("directory_listing")
    .insert({
      ...sharedFields,
      profile_id: businessId,
      source: "self_signup",
      is_claimed: true,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to create listing" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, synced: true, listingId: created.id });
}
