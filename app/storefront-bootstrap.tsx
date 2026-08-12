"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";

declare global {
  interface Window {
    supabaseClient?: SupabaseClient;
    activateSupabasePortal?: (
      portal: "customer" | "vendor",
    ) => Promise<SupabaseClient>;
    clearSupabasePortalSessions?: () => Promise<void>;
    __nakaStorefrontStarted?: boolean;
  }
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://kpwucuwnbkpeqwulqqfs.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable__NGO89yfw2HbQGAJS2SLuA_m-5k3hs3";

const portalStorageKeys = {
  customer: "naka-customer-auth",
  vendor: "naka-vendor-auth",
} as const;

function createPortalClient(
  portal: keyof typeof portalStorageKeys,
  detectSessionInUrl = false,
) {
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storageKey: portalStorageKeys[portal],
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl,
    },
  });
}

export function StorefrontBootstrap() {
  useEffect(() => {
    if (window.__nakaStorefrontStarted) return;
    window.__nakaStorefrontStarted = true;
    const savedType = window.localStorage.getItem("NAKA_session_type");
    const activeType = savedType === "vendor" ? "vendor" : "customer";
    const clients = {
      customer: createPortalClient("customer", activeType === "customer"),
      vendor: createPortalClient("vendor", activeType === "vendor"),
    };

    const initialize = async () => {
      const inactiveType = activeType === "vendor" ? "customer" : "vendor";

      // Remove the previous shared auth token introduced before customer and
      // vendor sessions had distinct storage. Existing users sign in once more.
      const legacyClient = createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      await legacyClient.auth.signOut({ scope: "local" });
      await clients[inactiveType].auth.signOut({ scope: "local" });

      window.supabaseClient = clients[activeType];
      window.activateSupabasePortal = async (portal) => {
        const inactivePortal = portal === "vendor" ? "customer" : "vendor";
        await clients[inactivePortal].auth.signOut({ scope: "local" });
        window.supabaseClient = clients[portal];
        return clients[portal];
      };
      window.clearSupabasePortalSessions = async () => {
        await Promise.all([
          clients.customer.auth.signOut({ scope: "local" }),
          clients.vendor.auth.signOut({ scope: "local" }),
        ]);
        window.localStorage.removeItem("NAKA_session_type");
      };

      // Load the preserved behavior as a classic script so its existing inline
      // event handlers remain globally available during the React migration.
      const script = document.createElement("script");
      script.src = "/scripts/storefront.js";
      script.async = false;
      script.dataset.nakaStorefront = "true";
      document.body.appendChild(script);
    };

    void initialize();
  }, []);

  return null;
}
