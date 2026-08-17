import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { BROWSER_UA } from "@/lib/extract/sourceUrl";
import { isDemoMode } from "@/lib/demo";

const BUCKET = "recipe-images";
const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Copies a platform thumbnail into our own storage and returns the permanent
 * URL. Social CDNs sign their image URLs with an expiry, so hotlinking means
 * older recipes quietly lose their picture.
 *
 * Never throws: on any failure the caller keeps the original URL, which still
 * works today and simply may not in a month.
 */
export async function persistThumbnail(
  sourceUrl: string | null,
  userId: string,
  recipeId: string,
  referer: string,
): Promise<string | null> {
  if (!sourceUrl) return null;
  // Demo mode has no Supabase project to write to.
  if (isDemoMode()) return sourceUrl;

  try {
    const response = await fetch(sourceUrl, {
      headers: { "user-agent": BROWSER_UA, referer, accept: "image/*" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return sourceUrl;

    const contentType = (response.headers.get("content-type") ?? "image/jpeg")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const extension = EXTENSIONS[contentType];
    if (!extension) return sourceUrl;

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return sourceUrl;

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return sourceUrl;

    const admin = createSupabaseAdmin();
    const path = `${userId}/${recipeId}.${extension}`;

    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType,
        upsert: true,
        cacheControl: "31536000",
      });

    if (error) {
      console.error("thumbnail upload failed", error.message);
      return sourceUrl;
    }

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl || sourceUrl;
  } catch (error) {
    console.error("thumbnail copy failed", error);
    return sourceUrl;
  }
}

/** Called when a recipe is deleted so the bucket does not grow forever. */
export async function removeThumbnail(
  userId: string,
  recipeId: string,
): Promise<void> {
  if (isDemoMode()) return;
  try {
    const admin = createSupabaseAdmin();
    await admin.storage
      .from(BUCKET)
      .remove(
        ["jpg", "png", "webp", "avif"].map(
          (extension) => `${userId}/${recipeId}.${extension}`,
        ),
      );
  } catch {
    // A leftover image is harmless; never block a delete on it.
  }
}
