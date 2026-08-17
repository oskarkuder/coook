import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coook!",
    short_name: "Coook!",
    description: "Turn cooking videos into recipes you can actually cook.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#FFC400",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    // Android: makes Coook! appear in the TikTok/Instagram share sheet.
    // iOS has no equivalent — there the paste box on the home screen is the way in.
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  } satisfies MetadataRoute.Manifest;
}
