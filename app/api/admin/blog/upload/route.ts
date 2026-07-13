import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

/* ------------------------------------------------------------------ */
/*  POST  – upload a blog image to storage                             */
/*  FormData: file (File), type ("cover" | "avatar")                   */
/* ------------------------------------------------------------------ */
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  let file: File | null = null;
  let type = "cover";

  try {
    const formData = await request.formData();
    const f = formData.get("file");
    const t = formData.get("type");
    if (f instanceof File) file = f;
    if (t && typeof t === "string") type = t;
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type: ${file.type}. Allowed: JPG, PNG, WebP, GIF` },
      { status: 400 }
    );
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `blog/${Date.now()}-${type}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("blog-images")
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from("blog-images")
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrlData.publicUrl });
}
