import { redirect } from "next/navigation";
import { LibraryClient } from "@/components/LibraryClient";
import { getStore } from "@/lib/data";
import { getServerUser } from "@/lib/supabase/serverUser";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await getServerUser();
  if (!user) redirect("/login?next=/library");

  const store = getStore();
  const [recipes, categories] = await Promise.all([
    store.listRecipes(user.id),
    store.listCategories(user.id),
  ]);

  return <LibraryClient recipes={recipes} categories={categories} />;
}
