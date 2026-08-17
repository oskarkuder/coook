import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RecipeView } from "@/components/RecipeView";
import { ProcessingState } from "@/components/ProcessingState";
import { getStore } from "@/lib/data";
import { getServerUser } from "@/lib/supabase/serverUser";

export const dynamic = "force-dynamic";

/** A run that never came back — the serverless function died mid-extraction. */
const STALE_AFTER_MS = 5 * 60 * 1000;

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getServerUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/recipe/${id}`)}`);

  const store = getStore();
  const recipe = await store.getRecipe(user.id, id);
  if (!recipe) notFound();

  const [allCategories, memberIds] = await Promise.all([
    store.listCategories(user.id),
    store.getRecipeCategoryIds(user.id, id),
  ]);
  const memberSet = new Set(memberIds);
  const categories = allCategories.filter((c) => memberSet.has(c.id));

  if (recipe.status === "processing") {
    const age = Date.now() - new Date(recipe.created_at).getTime();
    if (age < STALE_AFTER_MS) return <ProcessingState />;
    return (
      <FailedState
        title="That took too long"
        message="The video never finished processing. Try the link again."
        sourceUrl={recipe.source_url}
      />
    );
  }

  if (recipe.status === "failed") {
    return (
      <FailedState
        title="Could not read that video"
        message={recipe.error_message ?? "Try a different link."}
        sourceUrl={recipe.source_url}
      />
    );
  }

  return <RecipeView recipe={recipe} categories={categories} />;
}

function FailedState({
  title,
  message,
  sourceUrl,
}: {
  title: string;
  message: string;
  sourceUrl: string;
}) {
  return (
    <div className="page">
      <Link href="/library" className="text-sm text-muted hover:text-ink">
        ← Library
      </Link>
      <div className="card mt-4 p-6">
        <h1 className="h2">{title}</h1>
        <p className="meta mt-2">{message}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/?url=${encodeURIComponent(sourceUrl)}`}
            className="btn-primary sm:w-48"
          >
            Try again
          </Link>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary sm:w-48"
          >
            Open the video
          </a>
        </div>
      </div>
    </div>
  );
}
