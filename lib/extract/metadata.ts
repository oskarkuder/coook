import "server-only";
import type { SourcePlatform } from "@/lib/types";
import {
  BROWSER_UA,
  instagramShortcode,
  youtubeVideoId,
} from "@/lib/extract/sourceUrl";
import { resolveMedia } from "@/lib/extract/resolvers";

export type SourceMetadata = {
  platform: SourcePlatform;
  url: string;
  caption: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  /** Direct media URL, when we can find one. Used for transcription. */
  mediaUrl: string | null;
};

const FETCH_TIMEOUT_MS = 12_000;

async function fetchText(url: string, headers: Record<string, string> = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": BROWSER_UA,
        "accept-language": "en-US,en;q=0.9",
        ...headers,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const text = await fetchText(url, { accept: "application/json" });
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const match = html.match(pattern);
  if (match?.[1]) return decodeEntities(match[1]);

  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  );
  const reverseMatch = html.match(reversed);
  return reverseMatch?.[1] ? decodeEntities(reverseMatch[1]) : null;
}

/** Unescapes a JSON string literal captured out of raw HTML. */
function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  }
}

// --------------------------------------------------------------------- TikTok

type TikTokOEmbed = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

async function readTikTok(url: string): Promise<SourceMetadata> {
  const oembed = await fetchJson<TikTokOEmbed>(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  );

  let caption = oembed?.title?.trim() || null;
  let author = oembed?.author_name?.trim() || null;
  let thumbnailUrl = oembed?.thumbnail_url?.trim() || null;
  let mediaUrl: string | null = null;

  // The page HTML carries the full description and a playable URL. It often
  // works; when TikTok blocks the datacenter IP we still have oEmbed.
  const html = await fetchText(url);
  if (html) {
    if (!caption) {
      caption =
        metaContent(html, "og:description") ??
        metaContent(html, "description");
    }
    if (!thumbnailUrl) thumbnailUrl = metaContent(html, "og:image");

    const desc = html.match(/"desc":"((?:[^"\\]|\\.)*)"/);
    if (desc?.[1]) {
      const full = unescapeJsonString(desc[1]);
      if (full.length > (caption?.length ?? 0)) caption = full;
    }

    const play =
      html.match(/"playAddr":"((?:[^"\\]|\\.)*)"/) ??
      html.match(/"downloadAddr":"((?:[^"\\]|\\.)*)"/);
    if (play?.[1]) mediaUrl = unescapeJsonString(play[1]);
  }

  return { platform: "tiktok", url, caption, author, thumbnailUrl, mediaUrl };
}

// ------------------------------------------------------------------ Instagram

async function readInstagram(url: string): Promise<SourceMetadata> {
  const shortcode = instagramShortcode(url);
  let caption: string | null = null;
  let author: string | null = null;
  let thumbnailUrl: string | null = null;
  let mediaUrl: string | null = null;

  // The embed endpoint returns the caption without a login for public posts.
  if (shortcode) {
    const embed = await fetchText(
      `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
    );
    if (embed) {
      const captionBlock = embed.match(
        /class="Caption"[\s\S]*?<\/div>/i,
      )?.[0];
      if (captionBlock) {
        const text = decodeEntities(
          captionBlock
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]+>/g, " ")
            .replace(/[ \t]+/g, " ")
            .trim(),
        );
        if (text) caption = text;
      }

      author =
        embed.match(/class="UsernameText">([^<]+)</i)?.[1]?.trim() ?? null;

      const video = embed.match(/"video_url":"((?:[^"\\]|\\.)*)"/);
      if (video?.[1]) mediaUrl = unescapeJsonString(video[1]);

      const poster = embed.match(/"display_url":"((?:[^"\\]|\\.)*)"/);
      if (poster?.[1]) thumbnailUrl = unescapeJsonString(poster[1]);
    }
  }

  const html = await fetchText(url);
  if (html) {
    if (!caption) {
      const og = metaContent(html, "og:description");
      // og:description looks like: 12K likes, 340 comments - user on ...: "caption"
      const quoted = og?.match(/:\s*"([\s\S]*)"\s*$/)?.[1];
      caption = quoted ?? og ?? null;
    }
    if (!thumbnailUrl) thumbnailUrl = metaContent(html, "og:image");
    if (!mediaUrl) {
      const video =
        html.match(/"video_url":"((?:[^"\\]|\\.)*)"/) ??
        html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i);
      if (video?.[1]) mediaUrl = unescapeJsonString(video[1]);
    }
    if (!author) {
      author =
        html.match(/"owner":\{"username":"([^"]+)"/)?.[1] ??
        metaContent(html, "og:title")?.split(" on Instagram")[0] ??
        null;
    }
  }

  return { platform: "instagram", url, caption, author, thumbnailUrl, mediaUrl };
}

// -------------------------------------------------------------------- YouTube

type YouTubeOEmbed = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

async function readYouTube(url: string): Promise<SourceMetadata> {
  const oembed = await fetchJson<YouTubeOEmbed>(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  );

  const title = oembed?.title?.trim() || null;
  let description: string | null = null;

  const videoId = youtubeVideoId(url);
  if (videoId) {
    const html = await fetchText(`https://www.youtube.com/watch?v=${videoId}`);
    if (html) {
      const short = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
      if (short?.[1]) description = unescapeJsonString(short[1]);
      if (!description) description = metaContent(html, "og:description");
    }
  }

  const caption = [title, description].filter(Boolean).join("\n\n") || null;

  return {
    platform: "youtube",
    url,
    caption,
    author: oembed?.author_name?.trim() || null,
    thumbnailUrl:
      oembed?.thumbnail_url?.trim() ||
      (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
    // YouTube media needs a signed-stream extractor; caption is normally rich
    // enough on cooking channels, and the resolver below can fill the gap.
    mediaUrl: null,
  };
}

// ---------------------------------------------------- generic recipe website

async function readGenericPage(url: string): Promise<SourceMetadata> {
  const html = await fetchText(url);
  if (!html) {
    return {
      platform: "website",
      url,
      caption: null,
      author: null,
      thumbnailUrl: null,
      mediaUrl: null,
    };
  }

  // Strip the chrome, then keep the body text — enough for the model to work
  // with when the site has no structured markup.
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const title = metaContent(html, "og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1];

  return {
    platform: "website",
    url,
    caption: [title, decodeEntities(body).slice(0, 12_000)]
      .filter(Boolean)
      .join("\n\n"),
    author: metaContent(html, "author") ?? metaContent(html, "og:site_name"),
    thumbnailUrl: metaContent(html, "og:image"),
    mediaUrl: null,
  };
}

export async function readSourceMetadata(
  url: string,
  platform: SourcePlatform,
): Promise<SourceMetadata> {
  let metadata: SourceMetadata;

  switch (platform) {
    case "tiktok":
      metadata = await readTikTok(url);
      break;
    case "instagram":
      metadata = await readInstagram(url);
      break;
    case "youtube":
      metadata = await readYouTube(url);
      break;
    case "website":
      // Reached only when JSON-LD parsing already failed, so fall back to the
      // page's own text and let the model try.
      metadata = await readGenericPage(url);
      break;
    default:
      metadata = {
        platform,
        url,
        caption: null,
        author: null,
        thumbnailUrl: null,
        mediaUrl: null,
      };
  }

  // Only pay for the resolver when scraping fell short of what we need.
  const needsHelp = !metadata.mediaUrl || !metadata.caption;
  if (needsHelp) {
    const resolved = await resolveMedia(url);
    if (resolved) {
      metadata = {
        ...metadata,
        caption: metadata.caption ?? resolved.caption ?? null,
        author: metadata.author ?? resolved.author ?? null,
        thumbnailUrl: metadata.thumbnailUrl ?? resolved.thumbnailUrl ?? null,
        mediaUrl: metadata.mediaUrl ?? resolved.mediaUrl ?? null,
      };
    }
  }

  return metadata;
}
