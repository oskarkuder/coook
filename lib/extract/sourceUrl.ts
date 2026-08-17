import type { SourcePlatform } from "@/lib/types";

export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const SHORT_LINK_HOSTS = new Set([
  "vm.tiktok.com",
  "vt.tiktok.com",
  "m.tiktok.com",
  "tiktok.com",
  "youtu.be",
  "l.instagram.com",
]);

/** Share sheets hand over "check this out https://... " — dig the URL out. */
export function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (match) return match[0];

  // Bare "www.tiktok.com/..." or "tiktok.com/..." pasted without a scheme.
  const bare = text.match(
    /\b(?:www\.)?(?:tiktok|instagram|youtube|youtu)\.[a-z.]+\/[^\s<>"']+/i,
  );
  return bare ? `https://${bare[0].replace(/^www\./i, "www.")}` : null;
}

export function detectPlatform(rawUrl: string): SourcePlatform {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }

  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
  // Anything else that is a real URL gets treated as a recipe site.
  return host.includes(".") ? "website" : "unknown";
}

/** Adds a scheme when missing and drops tracking query junk. */
export function normalizeSourceUrl(raw: string): string | null {
  const candidate = extractFirstUrl(raw.trim()) ?? raw.trim();
  if (!candidate) return null;

  const withScheme = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.protocol = "https:";
  url.hash = "";

  const platform = detectPlatform(url.toString());
  if (platform === "tiktok" || platform === "instagram") {
    // Everything after the path is share tracking.
    url.search = "";
  } else if (platform === "youtube") {
    const videoId = url.searchParams.get("v");
    url.search = videoId ? `?v=${videoId}` : "";
  }

  return url.toString().replace(/\/$/, "") || null;
}

export function isSupportedPlatform(platform: SourcePlatform): boolean {
  return (
    platform === "tiktok" ||
    platform === "instagram" ||
    platform === "youtube" ||
    platform === "website"
  );
}

/**
 * Share links (vm.tiktok.com/xyz) redirect to the real post URL. oEmbed needs
 * the real one, so follow the redirect before doing anything else.
 */
export async function resolveShortLink(url: string): Promise<string> {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }

  const bare = host.replace(/^www\./, "");
  if (!SHORT_LINK_HOSTS.has(bare)) return url;

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": BROWSER_UA },
      signal: AbortSignal.timeout(10_000),
    });
    // Drain so the connection can be reused/closed cleanly.
    await response.body?.cancel();
    return normalizeSourceUrl(response.url) ?? url;
  } catch {
    return url;
  }
}

/** instagram.com/reel/ABC123/ -> ABC123 */
export function instagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

export function youtubeVideoId(url: string): string | null {
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
  if (short) return short[1];
  const shorts = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i);
  if (shorts) return shorts[1];
  try {
    return new URL(url).searchParams.get("v");
  } catch {
    return null;
  }
}
