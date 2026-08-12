"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";

declare global {
  interface Window {
    supabaseClient?: SupabaseClient;
    __nakaStorefrontStarted?: boolean;
  }
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://kpwucuwnbkpeqwulqqfs.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable__NGO89yfw2HbQGAJS2SLuA_m-5k3hs3";

export function StorefrontBootstrap() {
  useEffect(() => {
    if (window.__nakaStorefrontStarted) return;
    window.__nakaStorefrontStarted = true;
    window.supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    // Load the preserved behavior as a classic script so its existing inline
    // event handlers remain globally available during the React migration.
    const script = document.createElement("script");
    script.src = "/scripts/storefront.js";
    script.async = false;
    script.dataset.nakaStorefront = "true";
    document.body.appendChild(script);
  }, []);

  return null;
}
