import { notFound, redirect } from "next/navigation";
import { CategoryClient } from "@/components/CategoryClient";
import { getStore } from "@/lib/data";
import { getServerUser } from "@/lib/supabase/serverUser";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getServerUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/category/${id}`)}`);

  const store = getStore();
  const [categories, recipes] = await Promise.all([
    store.listCategories(user.id),
    store.listCategoryRecipes(user.id, id),
  ]);

  const category = categories.find((item) => item.id === id);
  if (!category) notFound();

  return <CategoryClient category={category} recipes={recipes} />;
}
