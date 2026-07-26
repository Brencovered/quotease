import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

/**
 * Uploads a single photo file during the manual scraper's review step,
 * before any real listing exists yet -- stored under a staging path
 * (manual-staging/) since there's no listing id to scope it to at this
 * point. The confirm step (app/api/admin/scrape-url) re-downloads and
 * re-stores whatever's still in photo_urls under the actual listing's own
 * path once it's created/updated, so this staged file doesn't need to be
 * cleaned up by anything else -- it's just a transient stop on the way to
 * being added to fields.photo_urls for review/reordering/removal like any
 * other photo.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  const admin = createAdminClient();
  const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  const path = `manual-staging/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from("directory-photos")
    .upload(path, buffer, { upsert: false, contentType: file.type });

  if (error) {
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  }

  const { data: pub } = admin.storage.from("directory-photos").getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl });
}
