import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  POST  – create a new blog post                                     */
/* ------------------------------------------------------------------ */
export async function POST(request: Request) {
  const supabase = await createClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug, title, excerpt, content, cover_url, category, tags, author_name, author_avatar, published, featured, published_at } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const payload = {
    slug: (slug && typeof slug === "string") ? slug.trim() : title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    title: title.trim(),
    excerpt: (excerpt && typeof excerpt === "string") ? excerpt.trim() : null,
    content: (content && typeof content === "string") ? content : "",
    cover_url: (cover_url && typeof cover_url === "string") ? cover_url : null,
    category: (category && typeof category === "string") ? category : "Blog",
    tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [],
    author_name: (author_name && typeof author_name === "string") ? author_name.trim() : "Swiftscope",
    author_avatar: (author_avatar && typeof author_avatar === "string") ? author_avatar : null,
    published: published === true,
    featured: featured === true,
    published_at: published_at && typeof published_at === "string" ? published_at : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("blog_posts").insert(payload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data });
}

/* ------------------------------------------------------------------ */
/*  PUT  – update an existing blog post                                */
/* ------------------------------------------------------------------ */
export async function PUT(request: Request) {
  const supabase = await createClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = body.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
  }

  const { slug, title, excerpt, content, cover_url, category, tags, author_name, author_avatar, published, featured, published_at } = body;

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (slug !== undefined) payload.slug = typeof slug === "string" ? slug.trim() : undefined;
  if (title !== undefined) payload.title = typeof title === "string" ? title.trim() : undefined;
  if (excerpt !== undefined) payload.excerpt = typeof excerpt === "string" && excerpt.trim() ? excerpt.trim() : null;
  if (content !== undefined) payload.content = typeof content === "string" ? content : "";
  if (cover_url !== undefined) payload.cover_url = typeof cover_url === "string" && cover_url ? cover_url : null;
  if (category !== undefined) payload.category = typeof category === "string" ? category : "Blog";
  if (tags !== undefined) payload.tags = Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [];
  if (author_name !== undefined) payload.author_name = typeof author_name === "string" && author_name.trim() ? author_name.trim() : "Swiftscope";
  if (author_avatar !== undefined) payload.author_avatar = typeof author_avatar === "string" && author_avatar ? author_avatar : null;
  if (published !== undefined) payload.published = published === true;
  if (featured !== undefined) payload.featured = featured === true;
  if (published_at !== undefined) payload.published_at = typeof published_at === "string" ? published_at : null;

  const { data, error } = await supabase.from("blog_posts").update(payload).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data });
}

/* ------------------------------------------------------------------ */
/*  DELETE  – delete a blog post                                       */
/* ------------------------------------------------------------------ */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
  }

  const { error } = await supabase.from("blog_posts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
