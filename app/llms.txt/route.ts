/**
 * app/llms.txt/route.ts
 * ---------------------
 * Serves /llms.txt - an emerging convention (llmstxt.org) that gives AI /
 * answer engines a concise, curated map of the site's most useful content,
 * so they can find and cite the right pages instead of guessing from the
 * raw crawl. Plain text (Markdown), cached at the edge.
 */

const BASE_URL = "https://swiftscope.com.au";

const BODY = `# Swiftscope

> Swiftscope (swiftscope.com.au) is an Australian platform with two sides:
> (1) quoting and job-management software for trade businesses - build and
> send a priced quote on site, run the job, push a draft invoice to Xero;
> and (2) a free public directory of local tradies (electricians, plumbers,
> builders, roofers, painters and more) that homeowners can browse by trade
> and suburb with real Google ratings.

## Directory (public, free to browse)
- [Tradie directory](${BASE_URL}/directory): search verified local tradies by trade, suburb and rating.
- Trade + suburb pages follow the pattern \`${BASE_URL}/{trade-plural}-{suburb}-{state}\` (e.g. \`/electricians-seaford-vic\`).
- Suburb hub pages follow the pattern \`${BASE_URL}/tradies-in/{suburb}-{state}\` (all trades in one suburb).
- Individual business listings live at \`${BASE_URL}/directory/{business-slug}\`.

## Product (for tradies)
- [How it works](${BASE_URL}/how-it-works)
- [Features](${BASE_URL}/features)
- [Quoting software by trade](${BASE_URL}/quoting-software): per-trade landing pages.
- Pricing: flat AUD $45/month after a 7-day free trial; unlimited quotes, jobs and team members.

## Free tools
- [Charge-out rate calculator](${BASE_URL}/tools/charge-out-rate)
- [Margin & markup calculator](${BASE_URL}/tools/margin-markup)
- [Ballpark job cost](${BASE_URL}/tools/ballpark-cost)
- [Quote PDF generator](${BASE_URL}/tools/quote-pdf)
- [Vehicle running cost](${BASE_URL}/tools/vehicle-cost)
- [DIY materials estimator](${BASE_URL}/tools/diy-materials)

## Content
- [Blog](${BASE_URL}/blog): guides on quoting, pricing and running a trade business.

## Full index
- [Sitemap](${BASE_URL}/sitemap.xml): complete list of directory, trade+suburb and blog URLs.
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
