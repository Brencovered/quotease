import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import Image from "next/image";
import MarketingNav from "@/components/MarketingNav";
import { ArrowRight, Calendar, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blog & Insights - Swiftscope",
  description: "Trade business tips, industry insights, and product updates from the Swiftscope team.",
};

export default async function BlogPage() {
  const admin = createAdminClient();

  const { data: posts } = await admin
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_url, category, tags, author_name, published_at, featured")
    .eq("published", true)
    .order("published_at", { ascending: false });

  const featured   = posts?.find(p => p.featured);
  const rest        = posts?.filter(p => !p.featured) ?? [];
  const categories  = [...new Set(posts?.map(p => p.category).filter(Boolean))];

  return (
    <main className="bg-white text-[#0a1722] min-h-screen">
      <MarketingNav />

      {/* Header */}
      <div className="bg-[#0a1722] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-16">
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Blog & Insights</p>
          <h1 className="font-display uppercase text-[2.6rem] sm:text-[3.4rem] leading-[0.93] text-white max-w-2xl">
            Trade business thinking.
          </h1>
          <p className="text-[15px] text-[#8aa4b4] mt-4 max-w-xl">
            Tips, tools, and industry insights for Australian trade businesses.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-14">

        {/* Category filter pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            {categories.map(cat => (
              <span key={cat} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#f8f9fa] border border-[#e8ecef] text-[#5a6a78]">
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* No posts */}
        {(!posts || posts.length === 0) && (
          <div className="text-center py-24">
            <p className="text-[#5a6a78] text-[16px]">No posts yet. Check back soon.</p>
          </div>
        )}

        {/* Featured post */}
        {featured && (
          <Link href={`/blog/${featured.slug}`} className="group block mb-12">
            <div className="grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-[#e8ecef] hover:border-[#ffb400] hover:shadow-lg transition-all">
              <div className="relative aspect-[16/9] md:aspect-auto overflow-hidden bg-[#f8f9fa]">
                {featured.cover_url
                  ? <Image src={featured.cover_url} alt={featured.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  : <div className="w-full h-full min-h-[240px] bg-gradient-to-br from-[#0a1722] to-[#1a3a52] flex items-center justify-center">
                      <span className="font-display text-[#ffb400] text-[2rem] opacity-30">Swiftscope</span>
                    </div>
                }
              </div>
              <div className="p-8 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold tracking-[.15em] uppercase text-[#ffb400] bg-amber-50 px-2 py-1 rounded-full">Featured</span>
                  {featured.category && <span className="text-[11px] text-[#5a6a78]">{featured.category}</span>}
                </div>
                <h2 className="font-display text-[1.8rem] sm:text-[2.2rem] leading-tight text-[#0a1722] mb-3 group-hover:text-[#ffb400] transition-colors">
                  {featured.title}
                </h2>
                {featured.excerpt && <p className="text-[14px] text-[#5a6a78] leading-relaxed mb-4 line-clamp-3">{featured.excerpt}</p>}
                <div className="flex items-center gap-3 text-[12px] text-[#8aa4b4]">
                  {featured.author_name && <span>{featured.author_name}</span>}
                  {featured.published_at && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(featured.published_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Post grid */}
        {rest.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map(post => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="group flex flex-col rounded-2xl border border-[#e8ecef] hover:border-[#ffb400] hover:shadow-lg transition-all overflow-hidden">
                <div className="relative aspect-[16/9] overflow-hidden bg-[#f8f9fa]">
                  {post.cover_url
                    ? <Image src={post.cover_url} alt={post.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full bg-gradient-to-br from-[#0a1722] to-[#1a3a52] flex items-center justify-center">
                        <span className="font-display text-[#ffb400] opacity-20 text-[1.4rem]">Swiftscope</span>
                      </div>
                  }
                </div>
                <div className="flex flex-col flex-1 p-5">
                  {post.category && (
                    <span className="text-[10px] font-bold tracking-[.12em] uppercase text-[#ffb400] mb-2">{post.category}</span>
                  )}
                  <h3 className="font-display text-[1.2rem] leading-tight text-[#0a1722] mb-2 group-hover:text-[#ffb400] transition-colors flex-1">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-[13px] text-[#5a6a78] line-clamp-2 mb-4">{post.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <div className="text-[11.5px] text-[#8aa4b4]">
                      {post.published_at && new Date(post.published_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    <ArrowRight size={14} className="text-[#ffb400] group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#0a1722] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <span className="font-display text-lg text-white">SWIFTSCOPE</span>
          <div className="flex gap-6 text-[12.5px] font-semibold text-white/40">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/features" className="hover:text-white transition-colors">Features</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Sign up</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
