/**
 * POST /api/admin/blog/import
 * ---------------------------
 * Creates or updates a blog post from a single markdown document with a
 * YAML-ish frontmatter header, so writing a post is one paste instead of
 * filling six fields and hand-building tables in a textarea.
 *
 * Body: raw text (Content-Type: text/markdown or text/plain) shaped as
 *
 *   ---
 *   title: Some Title
 *   slug: some-title
 *   excerpt: One line summary used on the index and in meta description.
 *   category: Comparisons
 *   tags: pricing, servicem8
 *   cover_url: https://...
 *   featured: false
 *   published: false
 *   ---
 *   Key Takeaways
 *   - ...
 *
 * Everything after the closing --- is stored verbatim in `content` and
 * parsed at render time by the existing parseContent in
 * app/blog/[slug]/page.tsx. This route deliberately does no markdown
 * transformation: the storage format IS the authoring format, and adding
 * a conversion step here would mean two places to keep in sync.
 *
 * Upserts on `slug`, so re-posting the same document edits the existing
 * post rather than creating a duplicate. That makes "fix a typo" a
 * re-paste instead of a hunt through the admin list.
 *
 * Auth matches the rest of /api/admin: session user must be in
 * ADMIN_EMAILS. The write itself goes through the service-role client, so
 * it does not depend on profiles.subscription_status = 'admin' the way
 * the blog_posts RLS policy does - two independent admin mechanisms
 * already caused one silent failure, and this route shouldn't add a third
 * dependency on the fragile one.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

interface Frontmatter {
  [key: string]: string;
}

function splitFrontmatter(raw: string): { fm: Frontmatter; body: string } | null {
  const text = raw.replace(/\r\n/g, "\n").trimStart();
  if (!text.startsWith("---")) return null;

  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;

  const header = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n+/, "");

  const fm: Frontmatter = {};
  for (const line of header.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    let value = line.slice(idx + 1).trim();
    // Strip surrounding quotes if the author wrapped a value containing a colon
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) fm[key] = value;
  }

  return { fm, body };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: userData } = await authClient.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const raw = await request.text();
  if (!raw.trim()) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const parsed = splitFrontmatter(raw);
  if (!parsed) {
    return NextResponse.json(
      { error: "Missing frontmatter. Document must open with --- and close the header with ---" },
      { status: 400 }
    );
  }

  const { fm, body } = parsed;

  if (!fm.title) {
    return NextResponse.json({ error: "Frontmatter must include a title" }, { status: 400 });
  }
  if (!body.trim()) {
    return NextResponse.json({ error: "Document has frontmatter but no content" }, { status: 400 });
  }

  const slug = fm.slug ? slugify(fm.slug) : slugify(fm.title);
  const published = fm.published === "true";

  // Only stamp published_at on the transition into published. Re-importing
  // an already-published post must not reset its date, or every typo fix
  // would look like a brand new post to Google and reshuffle the index.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("blog_posts")
    .select("id, published, published_at")
    .eq("slug", slug)
    .maybeSingle();

  const now = new Date().toISOString();
  const publishedAt = published
    ? existing?.published_at ?? now
    : existing?.published_at ?? null;

  const row = {
    slug,
    title: fm.title,
    excerpt: fm.excerpt ?? null,
    content: body,
    cover_url: fm.cover_url || null,
    category: fm.category ?? null,
    tags: fm.tags
      ? fm.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : null,
    author_name: fm.author_name ?? "Swiftscope",
    published,
    featured: fm.featured === "true",
    published_at: publishedAt,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("blog_posts")
    .upsert(row, { onConflict: "slug" })
    .select("id, slug, title, published")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    action: existing ? "updated" : "created",
    post: data,
    url: `/blog/${data.slug}`,
  });
}
