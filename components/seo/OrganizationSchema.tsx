/**
 * components/seo/OrganizationSchema.tsx
 * --------------------------------------
 * Site-wide Schema.org Organization markup, rendered once in the root
 * layout. This is the technical prerequisite for Google to associate a
 * specific logo image with "Swiftscope" as a brand/entity (e.g. in a
 * Knowledge Panel, or next to the brand name in some search contexts) --
 * separate from the favicon shown next to the URL in a search result,
 * which is unrelated markup.
 *
 * IMPORTANT CAVEAT: correct markup is necessary but not sufficient --
 * whether Google actually surfaces a Knowledge Panel or brand logo is its
 * own algorithmic judgement based on brand authority, search volume, and
 * mentions elsewhere, which can take months to develop for a new site
 * regardless of what's technically correct here.
 *
 * logo requirements per Google's guidelines: square image, minimum
 * 112x112px, on a plain background -- public/logo.png (512x512) meets
 * this using the same brand mark as the favicon.
 */

const BASE_URL = "https://www.swiftscope.com.au";

export default function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Swiftscope",
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: "Quoting and job management platform for Australian trade businesses, plus a public directory of curated local tradies.",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
