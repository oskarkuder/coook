import "server-only";
import type { DataStore } from "@/lib/data/types";
import { demoStore } from "@/lib/data/demoStore";
import { supabaseStore } from "@/lib/data/supabaseStore";
import { isDemoMode } from "@/lib/demo";

/** The one place that decides whether the app talks to Supabase or memory. */
export function getStore(): DataStore {
  return isDemoMode() ? demoStore : supabaseStore;
}

export type { DataStore } from "@/lib/data/types";
