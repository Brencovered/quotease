import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";
import { ArrowLeft, Calendar, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();

  const { data: post } = await admin
    .from("blog_posts")
    .select("*")
    .eq("slug", params.slug)
    .eq("published", true)
    .single();

  if (!post) notFound();

  // Related posts
  const { data: related } = await admin
    .from("blog_posts")
    .select("id, slug, title, cover_url, category, published_at")
    .eq("published", true)
    .eq("category", post.category)
    .neq("id", post.id)
    .order("published_at", { ascending: false })
    .limit(3);

  return (
    <main className="bg-white text-[#0a1722] min-h-screen">
      <MarketingNav />

      {/* Cover image */}
      {post.cover_url && (
        <div className="w-full h-[45vh] overflow-hidden bg-[#f8f9fa]">
          <img src={post.cover_url} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Article */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5a6a78] hover:text-[#ffb400] transition-colors mb-8">
          <ArrowLeft size={14} /> Back to blog
        </Link>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {post.category && (
            <span className="text-[11px] font-bold tracking-[.15em] uppercase text-[#ffb400] bg-amber-50 px-2.5 py-1 rounded-full">
              {post.category}
            </span>
          )}
          {(post.tags ?? []).map((tag: string) => (
            <span key={tag} className="text-[11px] font-semibold text-[#5a6a78] bg-[#f8f9fa] border border-[#e8ecef] px-2.5 py-1 rounded-full flex items-center gap-1">
              <Tag size={9} /> {tag}
            </span>
          ))}
        </div>

        <h1 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.95] text-[#0a1722] mb-5">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-[17px] text-[#5a6a78] leading-relaxed mb-6 border-l-4 border-[#ffb400] pl-4">
            {post.excerpt}
          </p>
        )}

        <div className="flex items-center gap-4 text-[13px] text-[#8aa4b4] mb-10 pb-8 border-b border-[#e8ecef]">
          {post.author_avatar && (
            <img src={post.author_avatar} alt={post.author_name} className="w-9 h-9 rounded-full object-cover" />
          )}
          {post.author_name && <span className="font-semibold text-[#0a1722]">{post.author_name}</span>}
          {post.published_at && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(post.published_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
        </div>

        {/* Content -- supports markdown-style formatting via CSS */}
        <div
          className="prose prose-lg max-w-none prose-headings:font-display prose-headings:text-[#0a1722] prose-p:text-[#374151] prose-p:leading-relaxed prose-a:text-[#ffb400] prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-strong:text-[#0a1722]"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content) }}
        />
      </div>

      {/* Related posts */}
      {related && related.length > 0 && (
        <div className="bg-[#f8f9fa] border-t border-[#e8ecef]">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h3 className="font-display text-[1.4rem] text-[#0a1722] mb-6">More from {post.category}</h3>
            <div className="grid sm:grid-cols-3 gap-5">
              {related.map(p => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="group rounded-xl border border-[#e8ecef] overflow-hidden hover:border-[#ffb400] transition-colors">
                  {p.cover_url && (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                  )}
                  <div className="p-4">
                    <p className="font-bold text-[13.5px] text-[#0a1722] group-hover:text-[#ffb400] transition-colors line-clamp-2">{p.title}</p>
                    {p.published_at && (
                      <p className="text-[11.5px] text-[#8aa4b4] mt-1">
                        {new Date(p.published_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#0a1722] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <span className="font-display text-lg text-white">SWIFTSCOPE</span>
          <Link href="/blog" className="text-[13px] font-semibold text-white/50 hover:text-white transition-colors">
            ← Back to blog
          </Link>
        </div>
      </div>
    </main>
  );
}

// Simple markdown-to-HTML converter
function markdownToHtml(md: string): string {
  if (!md) return "";
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^---$/gm, "<hr />")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[h|p|u|o|l|h|b|i|c])/gm, "<p>")
    .replace(/(<p>.*?)$/gm, "$1</p>")
    .replace(/<p><\/p>/g, "")
    .replace(/<p>(<h[1-6]>)/g, "$1")
    .replace(/(<\/h[1-6]>)<\/p>/g, "$1");
}
