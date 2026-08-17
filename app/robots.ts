import type { MetadataRoute } from "next";
import { getAppOrigin } from "@/lib/appOrigin";

export default function robots(): MetadataRoute.Robots {
  const origin = getAppOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/terms", "/privacy"],
      disallow: [
        "/api/",
        "/account",
        "/library",
        "/category/",
        "/plan",
        "/shopping",
        "/recipe/",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
