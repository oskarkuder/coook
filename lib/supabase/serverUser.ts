import "server-only";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStore } from "@/lib/data";
import { DEMO_USER, isDemoMode } from "@/lib/demo";
import type { Profile } from "@/lib/types";

const demoUser = {
  id: DEMO_USER.id,
  email: DEMO_USER.email,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date(0).toISOString(),
} as unknown as User;

/**
 * Never throws. A missing session, an expired token or an unconfigured
 * environment all mean the same thing to a page: nobody is signed in.
 */
export async function getServerUser(): Promise<User | null> {
  if (isDemoMode()) return demoUser;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    return await getStore().getProfile(userId);
  } catch {
    return null;
  }
}

export async function getUserAndProfile(): Promise<{
  user: User | null;
  profile: Profile | null;
}> {
  const user = await getServerUser();
  if (!user) return { user: null, profile: null };
  return { user, profile: await getProfile(user.id) };
}
