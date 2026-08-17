import "server-only";

/**
 * TikTok and Instagram throttle datacenter IPs, which is exactly where Vercel
 * runs. Captions usually still come through from the page itself, but the
 * direct media URL that the transcription step needs often does not — so the
 * app can hand that lookup to a third-party resolver.
 *
 * Three adapters, chosen with MEDIA_RESOLVER_PROVIDER:
 *
 *   apify     — Apify actor, run synchronously. Most reliable, priced per run.
 *               MEDIA_RESOLVER_KEY   = your Apify API token
 *               MEDIA_RESOLVER_ACTOR = actor id, default truefetch~best-video-downloader
 *   rapidapi  — any RapidAPI TikTok/Instagram downloader. Cheapest, flakiest.
 *               MEDIA_RESOLVER_URL   = full endpoint, e.g.
 *                                      https://<host>/api/download
 *               MEDIA_RESOLVER_KEY   = your RapidAPI key
 *   custom    — anything of your own that answers GET ?url=… with JSON.
 *               MEDIA_RESOLVER_URL, MEDIA_RESOLVER_KEY (sent as Bearer + x-api-key)
 *
 * Leaving MEDIA_RESOLVER_PROVIDER unset disables the whole thing; the app then
 * runs caption-only and asks the user to paste text when a post yields nothing.
 */

export type ResolvedMedia = {
  caption: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
};

const TIMEOUT_MS = 25_000;

/** Providers all name these things differently — search rather than guess. */
const MEDIA_KEYS = [
  "media_url", "mediaUrl", "video_url", "videoUrl", "play", "playAddr",
  "downloadAddr", "download_url", "downloadUrl", "url", "hd", "nwm_video_url",
  "no_watermark", "audio_url", "audioUrl",
];
const CAPTION_KEYS = [
  "caption", "desc", "description", "title", "text", "content",
];
const AUTHOR_KEYS = [
  "author", "author_name", "authorName", "username", "uniqueId", "nickname",
  "ownerUsername", "channel",
];
const THUMB_KEYS = [
  "thumbnail_url", "thumbnailUrl", "thumbnail", "cover", "displayUrl",
  "display_url", "image", "originCover",
];

type Json = unknown;

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Depth-first search for the first plausible value under any of `keys`.
 * Providers nest their payloads differently and change shape without notice,
 * so walking the tree is far more durable than a fixed path.
 */
function findValue(
  node: Json,
  keys: string[],
  predicate: (value: string) => boolean,
  depth = 0,
): string | null {
  if (depth > 6) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findValue(item, keys, predicate, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(node)) return null;

  for (const key of keys) {
    const value = node[key];
    if (typeof value === "string" && predicate(value)) return value;
    // Some actors wrap it: { video: { url: "..." } }
    if (isRecord(value) || Array.isArray(value)) {
      const nested = findValue(value, keys, predicate, depth + 1);
      if (nested) return nested;
    }
  }

  for (const value of Object.values(node)) {
    if (isRecord(value) || Array.isArray(value)) {
      const found = findValue(value, keys, predicate, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());
const isText = (value: string) => value.trim().length > 0 && !isHttpUrl(value);

function mapPayload(payload: Json): ResolvedMedia {
  return {
    mediaUrl: findValue(payload, MEDIA_KEYS, isHttpUrl),
    caption: findValue(payload, CAPTION_KEYS, isText),
    author: findValue(payload, AUTHOR_KEYS, isText),
    thumbnailUrl: findValue(payload, THUMB_KEYS, isHttpUrl),
  };
}

async function readJson(response: Response): Promise<Json | null> {
  try {
    return (await response.json()) as Json;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------- apify

async function viaApify(url: string): Promise<ResolvedMedia | null> {
  const token = process.env.MEDIA_RESOLVER_KEY?.trim();
  if (!token) return null;

  const actor =
    process.env.MEDIA_RESOLVER_ACTOR?.trim() || "truefetch~best-video-downloader";

  const response = await fetch(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Actors disagree on the input key, so send the common spellings at once;
      // extras are ignored rather than rejected.
      body: JSON.stringify({
        urls: [url],
        startUrls: [{ url }],
        videoUrls: [url],
        url,
        maxItems: 1,
        metadataOnly: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    console.error("apify resolver failed", response.status);
    return null;
  }
  const payload = await readJson(response);
  return payload ? mapPayload(payload) : null;
}

// ------------------------------------------------------------------ rapidapi

async function viaRapidApi(url: string): Promise<ResolvedMedia | null> {
  const endpoint = process.env.MEDIA_RESOLVER_URL?.trim();
  const key = process.env.MEDIA_RESOLVER_KEY?.trim();
  if (!endpoint || !key) return null;

  let host: string;
  try {
    host = new URL(endpoint).hostname;
  } catch {
    return null;
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  const response = await fetch(
    `${endpoint}${separator}url=${encodeURIComponent(url)}`,
    {
      headers: {
        "x-rapidapi-key": key,
        "x-rapidapi-host": host,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    console.error("rapidapi resolver failed", response.status);
    return null;
  }
  const payload = await readJson(response);
  return payload ? mapPayload(payload) : null;
}

// -------------------------------------------------------------------- custom

/**
 * Works with almost any provider without a code change, because the parts that
 * differ between them are all env-configurable:
 *
 *   MEDIA_RESOLVER_METHOD       GET (default) or POST
 *   MEDIA_RESOLVER_URL          the endpoint
 *   MEDIA_RESOLVER_KEY          your API key
 *   MEDIA_RESOLVER_AUTH_HEADER  header name, default "Authorization"
 *   MEDIA_RESOLVER_AUTH_PREFIX  value prefix, default "Bearer " (use "" for raw)
 *   MEDIA_RESOLVER_PARAM        the url parameter/body field, default "url"
 *
 * The response is then walked for the media URL, caption, author and thumbnail,
 * so a provider renaming a field does not break you either.
 */
async function viaCustom(url: string): Promise<ResolvedMedia | null> {
  const endpoint = process.env.MEDIA_RESOLVER_URL?.trim();
  if (!endpoint) return null;

  const key = process.env.MEDIA_RESOLVER_KEY?.trim();
  const method = (process.env.MEDIA_RESOLVER_METHOD?.trim() || "GET").toUpperCase();
  const param = process.env.MEDIA_RESOLVER_PARAM?.trim() || "url";

  const headers: Record<string, string> = { accept: "application/json" };
  if (key) {
    const header = process.env.MEDIA_RESOLVER_AUTH_HEADER?.trim() || "Authorization";
    const prefix = process.env.MEDIA_RESOLVER_AUTH_PREFIX ?? "Bearer ";
    headers[header.toLowerCase()] = `${prefix}${key}`;
    // Harmless for providers that ignore it, and correct for the ones that don't.
    headers["x-api-key"] = key;
  }

  let response: Response;
  if (method === "POST") {
    headers["content-type"] = "application/json";
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ [param]: url }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } else {
    const separator = endpoint.includes("?") ? "&" : "?";
    response = await fetch(
      `${endpoint}${separator}${param}=${encodeURIComponent(url)}`,
      { headers, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
  }

  if (!response.ok) {
    console.error("custom resolver failed", response.status, await response.text());
    return null;
  }
  const payload = await readJson(response);
  return payload ? mapPayload(payload) : null;
}

export function resolverProvider(): string | null {
  const provider = process.env.MEDIA_RESOLVER_PROVIDER?.trim().toLowerCase();
  if (provider) return provider;
  // Back-compat: a bare MEDIA_RESOLVER_URL still means "custom".
  return process.env.MEDIA_RESOLVER_URL?.trim() ? "custom" : null;
}

export async function resolveMedia(url: string): Promise<ResolvedMedia | null> {
  const provider = resolverProvider();
  if (!provider) return null;

  try {
    switch (provider) {
      case "apify":
        return await viaApify(url);
      case "rapidapi":
        return await viaRapidApi(url);
      case "custom":
        return await viaCustom(url);
      default:
        console.error(`Unknown MEDIA_RESOLVER_PROVIDER "${provider}"`);
        return null;
    }
  } catch (error) {
    console.error("media resolver error", error);
    return null;
  }
}
