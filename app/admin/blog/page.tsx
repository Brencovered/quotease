import { createAdminClient } from "@/lib/supabase/admin";
import AdminBlogPanel from "@/components/AdminBlogPanel";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const admin = createAdminClient();

  const { data: posts } = await admin
    .from("blog_posts")
    .select("id, slug, title, category, published, featured, published_at, cover_url, created_at")
    .order("created_at", { ascending: false });

  return <AdminBlogPanel posts={posts ?? []} />;
}
