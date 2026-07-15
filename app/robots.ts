import { MetadataRoute } from "next";

const BASE_URL = "https://www.swiftscope.com.au";

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
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
