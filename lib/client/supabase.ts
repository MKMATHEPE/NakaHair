import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Portal } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? "https://kpwucuwnbkpeqwulqqfs.supabase.co";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? "sb_publishable__NGO89yfw2HbQGAJS2SLuA_m-5k3hs3";

const clientCache = globalThis as typeof globalThis & {
  __nakaPortalClients?: Partial<Record<Portal, SupabaseClient>>;
};

export function createPortalClient(portal: Portal) {
  clientCache.__nakaPortalClients ??= {};
  const existing = clientCache.__nakaPortalClients[portal];
  if (existing) return existing;

  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      storageKey: `naka-${portal}-auth-v2`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  clientCache.__nakaPortalClients[portal] = client;
  return client;
}
