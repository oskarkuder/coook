import { redirect } from "next/navigation";
import { extractFirstUrl } from "@/lib/extract/sourceUrl";

export const dynamic = "force-dynamic";

/**
 * Android share-target landing page. The share sheet sends the link in one of
 * `url`, `text` or `title` depending on the app, so check all three and hand
 * the result to the home page, which starts the extraction on its own.
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; text?: string; title?: string }>;
}) {
  const params = await searchParams;
  const candidate =
    params.url?.trim() ||
    extractFirstUrl(params.text ?? "") ||
    extractFirstUrl(params.title ?? "");

  if (!candidate) redirect("/");
  redirect(`/?url=${encodeURIComponent(candidate)}`);
}
