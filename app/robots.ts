import { MetadataRoute } from "next";

const BASE_URL = "https://swiftscope.com.au";

// Internal app pages - not public content. Shared by the general crawler
// rule and the explicit AI-crawler rules below so the block list can never
// drift between them. Previously one shared "/electrician/" prefix; now
// trade-neutral top-level paths with nothing in common to prefix-match on.
const DISALLOW_INTERNAL = [
  "/dashboard/",
  "/quote",
  "/quote/",
  "/quotes/",
  "/jobs/",
  "/clients/",
  "/materials/",
  "/packages/",
  "/plans/",
  "/schedule/",
  "/margins/",
  "/reports/",
  "/leads/",
  "/map/",
  "/export/",
  "/settings/",
  "/billing/",
  "/onboarding/",
  "/admin/",
  "/team/",
  "/api/",
  "/auth/",
  "/camera/",
];

// AI / answer-engine crawlers. Split into two intents:
//   - retrieval/answer bots (ChatGPT Search, Perplexity, Google AI
//     Overviews, Claude with browsing) - these cite pages back to users,
//     so a public directory wants them to read the public content.
//   - training bots (GPTBot, CCBot, Google-Extended, Applebot-Extended,
//     ClaudeBot) - crawl for model training corpora.
// This site allows both (public directory: visibility and brand recall
// outweigh withholding), but they are listed explicitly so any single bot
// can be flipped to a hard `disallow: "/"` without touching the others.
const AI_CRAWLERS = [
  "OAI-SearchBot",   // ChatGPT Search (retrieval)
  "ChatGPT-User",    // ChatGPT user-triggered browsing
  "GPTBot",          // OpenAI training
  "PerplexityBot",   // Perplexity index (retrieval)
  "Perplexity-User", // Perplexity user-triggered fetch
  "ClaudeBot",       // Anthropic crawler
  "anthropic-ai",    // Anthropic (legacy UA)
  "Claude-User",     // Claude user-triggered browsing
  "Google-Extended",   // Gemini / AI Overviews training signal
  "Applebot-Extended", // Apple Intelligence training signal
  "CCBot",           // Common Crawl (feeds many models)
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW_INTERNAL,
      },
      // Answer/AI engines: allow public content, keep internal app paths out.
      {
        userAgent: AI_CRAWLERS,
        allow: "/",
        disallow: DISALLOW_INTERNAL,
      },
      // Ahrefs and Semrush do not send traffic to this site or influence
      // its Google/Bing rankings - they crawl to build data products they
      // sell to their own customers. 72 AhrefsBot hits in 24h vs 158
      // Googlebot + 170 GoogleOther, so this is not currently a load
      // problem, but there is no reason to give them the same unthrottled
      // access as the crawlers that actually matter. crawl-delay asks for
      // seconds between requests; both bots are documented to respect it.
      // Deliberately not a hard block: an outright disallow here would
      // also hide the site from anyone who does pay for Ahrefs/Semrush to
      // do legitimate competitive research, which is a normal thing
      // prospective advertisers or partners might do.
      {
        userAgent: "AhrefsBot",
        crawlDelay: 10,
      },
      {
        userAgent: "SemrushBot",
        crawlDelay: 10,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
