import { MetadataRoute } from "next";

const BASE_URL = "https://swiftscope.com.au";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/electrician/",   // tradie app -- not public content
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
