import "server-only";
import { BROWSER_UA } from "@/lib/extract/sourceUrl";

/** OpenAI's upload ceiling is 25 MB; stay under it. */
const MAX_MEDIA_BYTES = 24 * 1024 * 1024;
const MEDIA_TIMEOUT_MS = 25_000;
const TRANSCRIBE_TIMEOUT_MS = 60_000;

function transcribeModel(): string {
  return process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe";
}

/**
 * Downloads the video and sends it to OpenAI for transcription. The audio is
 * left inside the mp4 container — OpenAI demuxes it, so there is no ffmpeg
 * step and nothing extra to install on the serverless runtime.
 *
 * Returns null (never throws) whenever the media cannot be fetched: the
 * pipeline then falls back to the caption alone.
 */
export async function transcribeMedia(
  mediaUrl: string,
  refererUrl: string,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  let bytes: ArrayBuffer;
  let contentType: string;

  try {
    const response = await fetch(mediaUrl, {
      headers: {
        "user-agent": BROWSER_UA,
        referer: refererUrl,
        accept: "*/*",
        range: `bytes=0-${MAX_MEDIA_BYTES - 1}`,
      },
      signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    });
    if (!response.ok && response.status !== 206) return null;

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_MEDIA_BYTES) return null;

    contentType = response.headers.get("content-type") ?? "video/mp4";
    bytes = await response.arrayBuffer();
  } catch {
    return null;
  }

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) return null;

  const extension = contentType.includes("audio/mpeg")
    ? "mp3"
    : contentType.includes("webm")
      ? "webm"
      : "mp4";

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentType }), `clip.${extension}`);
  form.append("model", transcribeModel());
  form.append("response_format", "json");
  form.append(
    "prompt",
    "A short cooking video. Transcribe ingredient names, quantities and units accurately.",
  );

  try {
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      console.error("transcription failed", response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as { text?: string };
    const text = data.text?.trim();
    return text ? text : null;
  } catch (error) {
    console.error("transcription error", error);
    return null;
  }
}
