import { MetadataRoute } from "next";

const BASE_URL = "https://swiftscope.com.au";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Internal app pages -- not public content. Previously one
          // shared "/electrician/" prefix; now trade-neutral top-level
          // paths with nothing in common to prefix-match on.
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
        ],
      },
      // Ahrefs and Semrush do not send traffic to this site or influence
      // its Google/Bing rankings -- they crawl to build data products they
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
