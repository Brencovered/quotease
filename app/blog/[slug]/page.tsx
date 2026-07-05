import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";
import { ArrowLeft, Calendar, Tag, Clock, BookOpen, Quote, CheckCircle, ArrowRight, BarChart3, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Enhanced markdown parser                                          */
/* ------------------------------------------------------------------ */

interface ContentBlock {
  type: "heading" | "paragraph" | "blockquote" | "list" | "hr" | "image" | "cta" | "sources" | "statbox" | "keytakeaways" | "table" | "graph";
  content?: string;
  items?: string[];
  src?: string;
  alt?: string;
  level?: number;
  rows?: string[][];
  headers?: string[];
  bars?: { label: string; value: number; unit?: string }[];
  maxValue?: number;
  graphTitle?: string;
}

function parseContent(md: string): ContentBlock[] {
  if (!md) return [];
  const blocks: ContentBlock[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Images: ![alt](url)
    const imgMatch = line.match(/^!\[(.+?)\]\((.+?)\)$/);
    if (imgMatch) {
      blocks.push({ type: "image", alt: imgMatch[1], src: imgMatch[2] });
      i++;
      continue;
    }

    // Headings: #H2 text #H2  (custom format used by content)
    const customH2Match = line.match(/^#H2\s*(.+?)\s*#H2$/);
    if (customH2Match) {
      blocks.push({ type: "heading", content: customH2Match[1], level: 2 });
      i++;
      continue;
    }

    // Headings: #H3 text #H3
    const customH3Match = line.match(/^#H3\s*(.+?)\s*#H3$/);
    if (customH3Match) {
      blocks.push({ type: "heading", content: customH3Match[1], level: 3 });
      i++;
      continue;
    }

    // Standard headings: ## text
    const h2Match = line.match(/^##\s*(.+)$/);
    if (h2Match) {
      blocks.push({ type: "heading", content: h2Match[1], level: 2 });
      i++;
      continue;
    }

    const h3Match = line.match(/^###\s*(.+)$/);
    if (h3Match) {
      blocks.push({ type: "heading", content: h3Match[1], level: 3 });
      i++;
      continue;
    }

    const h1Match = line.match(/^#\s*(.+)$/);
    if (h1Match) {
      blocks.push({ type: "heading", content: h1Match[1], level: 1 });
      i++;
      continue;
    }

    // Blockquote: lines starting with >
    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", content: quoteLines.join(" ") });
      continue;
    }

    // Key Takeaways section detector
    if (line.trim().toLowerCase().startsWith("key takeaway") || line.trim().toLowerCase().startsWith("the solution")) {
      const takeawayLines: string[] = [];
      takeawayLines.push(line);
      i++;
      while (i < lines.length && lines[i].trim() && !lines[i].match(/^#{1,6}\s|^#H[23]/)) {
        takeawayLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "keytakeaways", content: takeawayLines.join("\n") });
      continue;
    }

    // Sources section detector
    if (line.trim().toLowerCase().startsWith("sources") || line.trim().toLowerCase().startsWith("references")) {
      const sourceLines: string[] = [];
      sourceLines.push(line);
      i++;
      while (i < lines.length && lines[i].trim()) {
        sourceLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "sources", content: sourceLines.join("\n") });
      continue;
    }

    // List items
    const listMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (listMatch) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const m = lines[i].match(/^\s*[-*+]\s+(.+)$/);
        if (m) items.push(m[1]);
        else break;
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Graph block: [graph] ... [/graph]
    if (line.trim().toLowerCase() === "[graph]") {
      const graphLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim().toLowerCase() !== "[/graph]") {
        graphLines.push(lines[i]);
        i++;
      }
      i++; // skip [/graph]

      const titleLine = graphLines.find(l => l.trim().startsWith("title:"));
      const graphTitle = titleLine ? titleLine.replace(/^\s*title:\s*/, "").trim() : undefined;
      const dataLines = graphLines.filter(l => l.includes(":") && !l.trim().startsWith("title:"));
      const bars = dataLines.map(l => {
        const idx = l.indexOf(":");
        const label = l.slice(0, idx).trim();
        const valStr = l.slice(idx + 1).trim().replace(/[^\d.]/g, "");
        const unitMatch = l.slice(idx + 1).trim().match(/[^\d.\s].*$/);
        const value = parseFloat(valStr) || 0;
        const unit = unitMatch ? unitMatch[0] : "";
        return { label, value, unit };
      }).filter(b => b.value > 0);

      const maxValue = bars.length > 0 ? Math.max(...bars.map(b => b.value)) : 100;
      blocks.push({ type: "graph", bars, maxValue, graphTitle });
      continue;
    }

    // Table: lines starting with |
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Remove separator line (| --- | --- |)
      const dataLines = tableLines.filter(l => !/^\s*\|[\s\-|]+\|\s*$/.test(l));
      if (dataLines.length >= 1) {
        const headers = dataLines[0].split("|").map(h => h.trim()).filter(Boolean);
        const rows = dataLines.slice(1).map(row =>
          row.split("|").map(c => c.trim()).filter((_, idx) => idx < headers.length)
        ).filter(r => r.length > 0);
        blocks.push({ type: "table", headers, rows });
      }
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Regular paragraph
    let para = line;
    i++;
    while (i < lines.length && lines[i].trim() && !lines[i].match(/^#{1,6}\s|^#H[23]|^!\[|^---+$/)) {
      para += " " + lines[i];
      i++;
    }
    blocks.push({ type: "paragraph", content: para });
  }

  return blocks;
}

function inlineMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="rounded-xl my-6" />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#ffb400] hover:underline font-semibold">$1</a>');
}

/* ------------------------------------------------------------------ */
/*  Section heading with visual number                                */
/* ------------------------------------------------------------------ */
function SectionHeading({ number, title }: { number: number; title: string }) {
  return (
    <h2 className="group flex items-start gap-4 mb-5 mt-14">
      <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#0a1722] text-[#ffb400] flex items-center justify-center font-display text-[18px] font-bold leading-none mt-0.5">
        {number}
      </span>
      <span
        className="font-display text-[1.6rem] sm:text-[1.9rem] leading-tight text-[#0a1722] uppercase"
        dangerouslySetInnerHTML={{ __html: inlineMarkdown(title) }}
      />
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/*  Quote block                                                       */
/* ------------------------------------------------------------------ */
function QuoteBlock({ content }: { content: string }) {
  return (
    <blockquote className="relative my-10 pl-8 pr-6 py-6 bg-[#f8f9fa] rounded-2xl border-l-4 border-[#ffb400]">
      <Quote size={24} className="text-[#ffb400] mb-3 opacity-60" />
      <p
        className="text-[17px] italic text-[#374151] leading-relaxed font-serif"
        dangerouslySetInnerHTML={{ __html: inlineMarkdown(content) }}
      />
    </blockquote>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat highlight box                                                */
/* ------------------------------------------------------------------ */
function StatHighlight({ content }: { content: string }) {
  const statMatch = content.match(/(\d+%|\d+\s*(?:percent|million|billion))/i);
  const numberMatch = content.match(/(\d[\d,]*)/);
  const stat = statMatch ? statMatch[1] : numberMatch ? numberMatch[1] : null;

  if (stat) {
    const rest = content.replace(stat, "").trim().replace(/^[–-]\s*/, "").replace(/^:\s*/, "");
    return (
      <div className="my-8 flex items-start gap-5 p-6 bg-gradient-to-r from-[#0a1722] to-[#1a2d3d] rounded-2xl text-white">
        <div className="flex-shrink-0">
          <span className="font-display text-[2.5rem] sm:text-[3rem] text-[#ffb400] leading-none">{stat}</span>
        </div>
        <p
          className="text-[15px] text-white/90 leading-relaxed pt-1"
          dangerouslySetInnerHTML={{ __html: inlineMarkdown(rest) }}
        />
      </div>
    );
  }

  return (
    <div
      className="my-6 p-5 bg-amber-50 border border-[#ffb400]/20 rounded-xl text-[15px] text-[#374151] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: inlineMarkdown(content) }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Key takeaways box                                                 */
/* ------------------------------------------------------------------ */
function KeyTakeaways({ content }: { content: string }) {
  const lines = content.split("\n").filter(l => l.trim());
  const title = lines[0];
  const items = lines.slice(1);

  return (
    <div className="my-10 p-6 sm:p-8 bg-gradient-to-br from-[#0a1722] to-[#1a2d3d] rounded-2xl">
      <div className="flex items-center gap-2 mb-5">
        <BookOpen size={18} className="text-[#ffb400]" />
        <span className="font-display text-[14px] tracking-[.15em] uppercase text-[#ffb400]">
          {inlineMarkdown(title)}
        </span>
      </div>
      <div className="space-y-4">
        {items.map((item, i) => {
          const colonIndex = item.indexOf(":");
          if (colonIndex > 0) {
            const label = item.slice(0, colonIndex + 1);
            const desc = item.slice(colonIndex + 1);
            return (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle size={16} className="text-[#ffb400] flex-shrink-0 mt-1" />
                <p className="text-[14px] text-white/90 leading-relaxed">
                  <strong className="text-white">{inlineMarkdown(label)}</strong>
                  <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(desc) }} />
                </p>
              </div>
            );
          }
          return (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle size={16} className="text-[#ffb400] flex-shrink-0 mt-1" />
              <p className="text-[14px] text-white/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sources section                                                   */
/* ------------------------------------------------------------------ */
function SourcesBlock({ content }: { content: string }) {
  const lines = content.split("\n").filter(l => l.trim());
  const title = lines[0];
  const items = lines.slice(1);

  return (
    <div className="mt-14 pt-8 border-t-2 border-[#e8ecef]">
      <h3 className="font-display text-[14px] tracking-[.15em] uppercase text-[#8aa4b4] mb-5 flex items-center gap-2">
        <BookOpen size={14} /> {title}
      </h3>
      <div className="space-y-3">
        {items.map((item, i) => {
          const labelMatch = item.match(/^(.+?):\s*(.+)$/);
          if (labelMatch) {
            return (
              <div key={i} className="text-[13px] text-[#5a6a78] leading-relaxed pl-4 border-l-2 border-[#e8ecef]">
                <strong className="text-[#0a1722]">{labelMatch[1]}:</strong>{" "}
                <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(labelMatch[2]) }} />
              </div>
            );
          }
          return (
            <div key={i} className="text-[13px] text-[#5a6a78] leading-relaxed pl-4 border-l-2 border-[#e8ecef]"
              dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CTA Section                                                       */
/* ------------------------------------------------------------------ */
function CTASection() {
  return (
    <div className="my-14 p-8 sm:p-10 bg-gradient-to-br from-[#0a1722] via-[#0f1e2b] to-[#1a2d3d] rounded-2xl text-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-[#ffb400]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#ffb400]/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      <div className="relative z-10">
        <h3 className="font-display text-[1.6rem] sm:text-[2rem] text-white uppercase mb-3">
          Reclaim Your Evenings with <span className="text-[#ffb400]">Swiftscope</span>
        </h3>
        <p className="text-[15px] text-white/70 leading-relaxed max-w-xl mx-auto mb-6">
          Stop letting profitable jobs slip through the cracks because of paperwork bottlenecks.
          Speed up your workflow, give your clients the rapid experience they expect, and watch your win rate skyrocket.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup"
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-bold text-[14px] px-6 py-3 rounded-xl hover:bg-[#e6a200] transition-colors">
            Start quoting faster <ArrowRight size={14} />
          </Link>
          <Link href="/features"
            className="inline-flex items-center gap-2 text-white/80 font-semibold text-[14px] px-6 py-3 rounded-xl border border-white/20 hover:bg-white/10 transition-colors">
            See how it works
          </Link>
        </div>
        <p className="text-[12px] text-white/40 mt-4">Free 14-day trial. No credit card required.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Table block                                                       */
/* ------------------------------------------------------------------ */
function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-8 overflow-x-auto">
      <table className="w-full border-collapse rounded-xl overflow-hidden shadow-sm">
        <thead>
          <tr className="bg-[#0a1722]">
            {headers.map((h, i) => (
              <th key={i} className="text-left text-[12px] font-bold tracking-[.1em] uppercase text-[#ffb400] px-4 py-3 border-b-2 border-[#ffb400]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-[#f8f9fa]"}>
              {row.map((cell, ci) => (
                <td key={ci} className="text-[13.5px] text-[#374151] px-4 py-3 border-b border-[#e8ecef] font-medium">
                  <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(cell) }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Graph block                                                       */
/* ------------------------------------------------------------------ */
function GraphBlock({ bars, maxValue, graphTitle }: { bars: { label: string; value: number; unit?: string }[]; maxValue: number; graphTitle?: string }) {
  const max = maxValue || 100;
  return (
    <div className="my-8 p-5 sm:p-6 bg-[#f8f9fa] rounded-2xl border border-[#e8ecef]">
      {graphTitle && (
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 size={16} className="text-[#ffb400]" />
          <span className="font-display text-[13px] tracking-[.1em] uppercase text-[#0a1722]">{graphTitle}</span>
        </div>
      )}
      <div className="space-y-3">
        {bars.map((bar, i) => {
          const pct = Math.min((bar.value / max) * 100, 100);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="flex-shrink-0 w-24 sm:w-32 text-right text-[12.5px] font-semibold text-[#374151] truncate">{bar.label}</span>
              <div className="flex-1 h-8 bg-white rounded-lg overflow-hidden border border-[#e8ecef] relative">
                <div
                  className="h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    background: i % 2 === 0
                      ? "linear-gradient(90deg, #0a1722 0%, #1a2d3d 100%)"
                      : "linear-gradient(90deg, #ffb400 0%, #e6a200 100%)",
                    minWidth: pct > 0 ? "32px" : "0",
                  }}
                >
                  {pct > 15 && (
                    <span className={`text-[11px] font-bold ${i % 2 === 0 ? "text-white" : "text-[#0a1722]"}`}>
                      {bar.value}{bar.unit}
                    </span>
                  )}
                </div>
                {pct <= 15 && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#0a1722]">
                    {bar.value}{bar.unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reading progress bar                                              */
/* ------------------------------------------------------------------ */
function ReadingProgressBar() {
  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-[#e8ecef] z-50">
      <div
        id="reading-progress"
        className="h-full bg-[#ffb400] transition-all duration-100"
        style={{ width: "0%" }}
      />
      <script dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var bar = document.getElementById('reading-progress');
            if (!bar) return;
            function update() {
              var scrollTop = window.scrollY || document.documentElement.scrollTop;
              var docHeight = document.documentElement.scrollHeight - window.innerHeight;
              var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
              bar.style.width = pct + '%';
            }
            window.addEventListener('scroll', update, { passive: true });
            update();
          })();
        `
      }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TOC Sidebar                                                       */
/* ------------------------------------------------------------------ */
function TableOfContents({ blocks }: { blocks: ContentBlock[] }) {
  const headings = blocks.filter(b => b.type === "heading" && b.level === 2);
  if (headings.length < 3) return null;

  return (
    <div className="hidden lg:block sticky top-24 self-start w-64 flex-shrink-0">
      <div className="p-5 bg-[#f8f9fa] rounded-2xl border border-[#e8ecef]">
        <h4 className="font-display text-[12px] tracking-[.15em] uppercase text-[#8aa4b4] mb-4 flex items-center gap-2">
          <Clock size={12} /> In this article
        </h4>
        <nav className="space-y-2">
          {headings.map((h, i) => (
            <a
              key={i}
              href={`#section-${i + 1}`}
              className="flex items-start gap-2 text-[12.5px] text-[#5a6a78] hover:text-[#0a1722] transition-colors leading-snug group"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-md bg-white border border-[#e8ecef] flex items-center justify-center text-[10px] font-bold text-[#8aa4b4] group-hover:bg-[#ffb400] group-hover:text-[#0a1722] group-hover:border-[#ffb400] transition-colors mt-0.5">
                {i + 1}
              </span>
              <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(h.content || "") }} />
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();

  const { data: post } = await admin
    .from("blog_posts")
    .select("*")
    .eq("slug", params.slug)
    .eq("published", true)
    .single();

  if (!post) notFound();

  const { data: related } = await admin
    .from("blog_posts")
    .select("id, slug, title, cover_url, category, published_at, excerpt")
    .eq("published", true)
    .eq("category", post.category)
    .neq("id", post.id)
    .order("published_at", { ascending: false })
    .limit(3);

  const blocks = parseContent(post.content);
  let sectionNumber = 0;

  return (
    <main className="bg-white text-[#0a1722] min-h-screen">
      <ReadingProgressBar />
      <MarketingNav />

      {/* Cover image */}
      {post.cover_url && (
        <div className="w-full h-[28vh] sm:h-[32vh] max-h-[340px] overflow-hidden bg-[#f8f9fa] relative">
          <img src={post.cover_url} alt={post.title} className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
        </div>
      )}

      {/* Article */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex gap-10">

          {/* TOC Sidebar */}
          <TableOfContents blocks={blocks} />

          {/* Main content */}
          <div className="flex-1 min-w-0 max-w-3xl mx-auto lg:mx-0">

            <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5a6a78] hover:text-[#ffb400] transition-colors mb-8">
              <ArrowLeft size={14} /> Back to blog
            </Link>

            {/* Meta tags */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {post.category && (
                <span className="text-[11px] font-bold tracking-[.15em] uppercase text-[#ffb400] bg-amber-50 px-3 py-1.5 rounded-full">
                  {post.category}
                </span>
              )}
              {(post.tags ?? []).map((tag: string) => (
                <span key={tag} className="text-[11px] font-semibold text-[#5a6a78] bg-[#f8f9fa] border border-[#e8ecef] px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Tag size={9} /> {tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="font-display uppercase text-[2.4rem] sm:text-[3.2rem] leading-[0.95] text-[#0a1722] mb-6">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <div className="mb-8 p-5 sm:p-6 bg-[#f8f9fa] rounded-2xl border-l-4 border-[#ffb400]">
                <p className="text-[17px] sm:text-[18px] text-[#5a6a78] leading-relaxed">
                  {post.excerpt}
                </p>
              </div>
            )}

            {/* Author & date */}
            <div className="flex items-center gap-4 text-[13px] text-[#8aa4b4] mb-10 pb-8 border-b-2 border-[#e8ecef]">
              {post.author_avatar && (
                <img src={post.author_avatar} alt={post.author_name} className="w-10 h-10 rounded-full object-cover border-2 border-[#e8ecef]" />
              )}
              {!post.author_avatar && post.author_name && (
                <div className="w-10 h-10 rounded-full bg-[#0a1722] text-[#ffb400] flex items-center justify-center font-display text-[16px] font-bold">
                  {post.author_name[0]}
                </div>
              )}
              <div>
                {post.author_name && <span className="font-bold text-[#0a1722] block">{post.author_name}</span>}
                {post.published_at && (
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(post.published_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>

            {/* Content blocks */}
            {blocks.map((block, i) => {
              switch (block.type) {
                case "heading":
                  if (block.level === 2) {
                    sectionNumber++;
                    return (
                      <div key={i} id={`section-${sectionNumber}`}>
                        <SectionHeading number={sectionNumber} title={block.content || ""} />
                      </div>
                    );
                  }
                  return <h3 key={i} className="font-display text-[1.3rem] text-[#0a1722] uppercase mt-10 mb-4"
                    dangerouslySetInnerHTML={{ __html: inlineMarkdown(block.content || "") }} />;

                case "blockquote":
                  return <QuoteBlock key={i} content={block.content || ""} />;

                case "list":
                  return (
                    <ul key={i} className="my-6 space-y-3">
                      {(block.items || []).map((item, j) => {
                        const colonIdx = item.indexOf(":");
                        if (colonIdx > 0) {
                          const label = item.slice(0, colonIdx + 1);
                          const rest = item.slice(colonIdx + 1);
                          return (
                            <li key={j} className="flex items-start gap-3 text-[15px] text-[#374151] leading-relaxed">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ffb400]/10 text-[#ffb400] flex items-center justify-center text-[11px] font-bold mt-0.5">
                                {j + 1}
                              </span>
                              <span>
                                <strong className="text-[#0a1722]">{inlineMarkdown(label)}</strong>
                                <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(rest) }} />
                              </span>
                            </li>
                          );
                        }
                        return (
                          <li key={j} className="flex items-start gap-3 text-[15px] text-[#374151] leading-relaxed">
                            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-[#ffb400] mt-2" />
                            <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
                          </li>
                        );
                      })}
                    </ul>
                  );

                case "image":
                  return (
                    <figure key={i} className="my-8">
                      <img src={block.src} alt={block.alt} className="w-full rounded-2xl" />
                      {block.alt && <figcaption className="text-center text-[12px] text-[#8aa4b4] mt-2">{block.alt}</figcaption>}
                    </figure>
                  );

                case "hr":
                  return <hr key={i} className="my-10 border-[#e8ecef]" />;

                case "keytakeaways":
                  return <KeyTakeaways key={i} content={block.content || ""} />;

                case "sources":
                  return <SourcesBlock key={i} content={block.content || ""} />;

                case "table":
                  return block.headers && block.rows ? (
                    <TableBlock key={i} headers={block.headers} rows={block.rows} />
                  ) : null;

                case "graph":
                  return block.bars && block.bars.length > 0 ? (
                    <GraphBlock key={i} bars={block.bars} maxValue={block.maxValue ?? 100} graphTitle={block.graphTitle} />
                  ) : null;

                case "paragraph":
                default: {
                  const text = block.content || "";
                  if (/^\d+%/.test(text) || /^\d+\s+(?:in|out|of)/.test(text)) {
                    return <StatHighlight key={i} content={text} />;
                  }
                  return (
                    <p
                      key={i}
                      className="text-[15.5px] text-[#374151] leading-[1.8] mb-5"
                      dangerouslySetInnerHTML={{ __html: inlineMarkdown(text) }}
                    />
                  );
                }
              }
            })}

            {/* CTA */}
            <CTASection />

            {/* Back to blog */}
            <div className="mt-10 text-center">
              <Link href="/blog" className="inline-flex items-center gap-2 text-[13px] font-bold text-[#5a6a78] hover:text-[#ffb400] transition-colors px-5 py-2.5 rounded-xl border border-[#e8ecef] hover:border-[#ffb400]">
                <ArrowLeft size={14} /> Back to all articles
              </Link>
            </div>
          </div>

          {/* Spacer for symmetry on large screens */}
          <div className="hidden lg:block w-64 flex-shrink-0" />
        </div>
      </div>

      {/* Related posts */}
      {related && related.length > 0 && (
        <div className="bg-[#f8f9fa] border-t border-[#e8ecef]">
          <div className="max-w-7xl mx-auto px-6 py-14">
            <h3 className="font-display text-[1.5rem] text-[#0a1722] mb-8 uppercase">More from {post.category}</h3>
            <div className="grid sm:grid-cols-3 gap-6">
              {related.map(p => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="group bg-white rounded-2xl border border-[#e8ecef] overflow-hidden hover:border-[#ffb400] hover:shadow-lg transition-all">
                  {p.cover_url && (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  )}
                  <div className="p-5">
                    <p className="font-bold text-[14px] text-[#0a1722] group-hover:text-[#ffb400] transition-colors line-clamp-2 leading-snug">{p.title}</p>
                    {p.published_at && (
                      <p className="text-[11.5px] text-[#8aa4b4] mt-2 flex items-center gap-1">
                        <Calendar size={10} />
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

      {/* Footer */}
      <footer className="bg-[#0a1722]">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-display text-lg text-white">SWIFTSCOPE</span>
            <p className="text-[12px] text-white/40 mt-1">Quote it, send it, win the job</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/blog" className="text-[13px] font-semibold text-white/50 hover:text-[#ffb400] transition-colors">
              Blog
            </Link>
            <Link href="/features" className="text-[13px] font-semibold text-white/50 hover:text-[#ffb400] transition-colors">
              Features
            </Link>
            <Link href="/signup" className="text-[13px] font-semibold text-[#ffb400] hover:text-white transition-colors">
              Sign up free
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
