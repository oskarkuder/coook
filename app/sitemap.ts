import type { MetadataRoute } from "next";
import { getAppOrigin } from "@/lib/appOrigin";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getAppOrigin();
  return ["", "/pricing", "/login", "/signup", "/terms", "/privacy"].map(
    (path) => ({
      url: `${origin}${path}`,
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.5,
    }),
  );
}
