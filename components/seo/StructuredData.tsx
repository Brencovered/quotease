/**
 * components/seo/StructuredData.tsx
 * ---------------------------------
 * Shared Schema.org JSON-LD building blocks used across the marketing and
 * directory surfaces:
 *
 *   - BreadcrumbSchema : BreadcrumbList for the Home > Directory > ... trail
 *                        that these pages already render visually. Marking it
 *                        up lets Google show the breadcrumb in results and
 *                        gives answer engines an explicit page hierarchy.
 *   - WebSiteSchema    : WebSite + SearchAction (sitelinks search box) so a
 *                        query typed in Google can deep-link into the
 *                        directory search.
 *   - ArticleSchema    : BlogPosting for individual blog posts (author, dates,
 *                        image) - required for article rich results and for
 *                        AI engines to attribute/quote the post.
 *
 * All three emit a single <script type="application/ld+json"> and take
 * absolute URLs (schema requires them).
 */

const BASE_URL = "https://swiftscope.com.au";

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export interface Crumb {
  /** Human-readable label, e.g. "Electricians in Seaford VIC". */
  name: string;
  /** Absolute or root-relative URL. Omit for the current page (last crumb). */
  url?: string;
}

/**
 * BreadcrumbList. Pass the trail in order (Home first, current page last).
 * The current page's crumb can omit `url`; Google treats the last item as
 * the current page either way, but including a self URL is also valid.
 */
export function BreadcrumbSchema({ items }: { items: Crumb[] }) {
  if (!items.length) return null;
  const toAbsolute = (u: string) => (u.startsWith("http") ? u : `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`);
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: toAbsolute(c.url) } : {}),
    })),
  };
  return <JsonLd data={data} />;
}

/**
 * WebSite entity with a SearchAction pointing at the directory search.
 * Rendered once site-wide (root layout). The directory search reads the
 * `search` query param (see app/directory/page.tsx), so the target template
 * uses `?search={search_term_string}`.
 */
export function WebSiteSchema() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Swiftscope",
    url: BASE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/directory?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  return <JsonLd data={data} />;
}

export interface ArticleSchemaProps {
  title: string;
  description?: string | null;
  slug: string;
  imageUrl?: string | null;
  authorName?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

/** BlogPosting for a single blog article. */
export function ArticleSchema({
  title,
  description,
  slug,
  imageUrl,
  authorName,
  publishedAt,
  updatedAt,
}: ArticleSchemaProps) {
  const url = `${BASE_URL}/blog/${slug}`;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title.slice(0, 110),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    ...(description ? { description } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
    author: { "@type": authorName && authorName !== "Swiftscope" ? "Person" : "Organization", name: authorName || "Swiftscope" },
    publisher: {
      "@type": "Organization",
      name: "Swiftscope",
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
    },
    ...(publishedAt ? { datePublished: new Date(publishedAt).toISOString() } : {}),
    dateModified: new Date(updatedAt || publishedAt || Date.now()).toISOString(),
  };
  return <JsonLd data={data} />;
}
