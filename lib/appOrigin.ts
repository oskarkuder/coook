/**
 * Absolute origin of the app. Used for Stripe redirect URLs and OAuth
 * callbacks, where a relative path is not allowed.
 */
export function getAppOrigin(requestUrl?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // fall through
    }
  }

  return "http://localhost:3000";
}
