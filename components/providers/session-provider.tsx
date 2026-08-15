"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createPortalClient } from "@/lib/client/supabase";
import type { Portal, SessionUser } from "@/lib/client/types";

type Credentials = { email: string; password: string };
type Registration = Credentials & { firstName: string; lastName: string; phone: string };

type SessionContextValue = {
  client: SupabaseClient;
  loading: boolean;
  portal: Portal;
  user: SessionUser | null;
  accessToken(): Promise<string>;
  login(credentials: Credentials, targetPortal?: Portal): Promise<void>;
  logout(): Promise<void>;
  register(details: Registration): Promise<string>;
  refresh(): Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function resolveUser(client: SupabaseClient): Promise<SessionUser | null> {
  const { data: { session } } = await client.auth.getSession();
  if (!session?.user) return null;

  const [profileResult, vendorResult] = await Promise.all([
    client.from("profiles").select("first_name,last_name,phone,role").eq("id", session.user.id).maybeSingle(),
    client.from("vendor_requests").select("status,business_name").eq("user_id", session.user.id).maybeSingle(),
  ]);

  const profile = profileResult.data;
  const vendor = vendorResult.data;
  return {
    id: session.user.id,
    email: session.user.email || "",
    firstName: profile?.first_name || String(session.user.user_metadata?.first_name || ""),
    lastName: profile?.last_name || String(session.user.user_metadata?.last_name || ""),
    phone: profile?.phone || String(session.user.user_metadata?.phone || ""),
    role: profile?.role === "admin" ? "admin" : "customer",
    isVendor: vendor?.status === "approved",
    vendorBusinessName: vendor?.business_name || "",
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const portal: Portal = pathname.startsWith("/vendor") ? "vendor" : "customer";
  const clients = useMemo(() => ({
    customer: createPortalClient("customer"),
    vendor: createPortalClient("vendor"),
  }), []);
  const client = clients[portal];
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(await resolveUser(client));
  }, [client]);

  useEffect(() => {
    let active = true;
    const inactive = portal === "vendor" ? clients.customer : clients.vendor;
    const initialize = async () => {
      await inactive.auth.signOut({ scope: "local" });
      const nextUser = await resolveUser(client);
      if (active) {
        setUser(nextUser);
        setLoading(false);
      }
    };
    void initialize();
    const { data: listener } = client.auth.onAuthStateChange(() => {
      void resolveUser(client).then((nextUser) => {
        if (active) setUser(nextUser);
      });
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [client, clients.customer, clients.vendor, portal]);

  const login = useCallback(async ({ email, password }: Credentials, targetPortal: Portal = portal) => {
    const selectedClient = clients[targetPortal];
    const inactive = targetPortal === "vendor" ? clients.customer : clients.vendor;
    await inactive.auth.signOut({ scope: "local" });
    const { error } = await selectedClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const nextUser = await resolveUser(selectedClient);
    if (targetPortal === "vendor" && !nextUser?.isVendor) {
      await selectedClient.auth.signOut({ scope: "local" });
      throw new Error("No approved vendor profile was found for this account.");
    }
    if (targetPortal === portal) {
      setUser(nextUser);
      return;
    }
    setUser(null);
    router.replace(targetPortal === "vendor" ? "/vendor/products" : "/account/orders");
  }, [clients, portal, router]);

  const register = useCallback(async (details: Registration) => {
    const { data, error } = await client.auth.signUp({
      email: details.email,
      password: details.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: details.firstName,
          last_name: details.lastName,
          phone: details.phone,
        },
      },
    });
    if (error) throw error;
    if (data.session) setUser(await resolveUser(client));
    return data.session
      ? "Your account is ready."
      : "Check your email to confirm your account.";
  }, [client]);

  const logout = useCallback(async () => {
    await Promise.all([
      clients.customer.auth.signOut({ scope: "local" }),
      clients.vendor.auth.signOut({ scope: "local" }),
    ]);
    setUser(null);
    router.replace("/");
    router.refresh();
  }, [clients.customer, clients.vendor, router]);

  const accessToken = useCallback(async () => {
    const { data } = await client.auth.getSession();
    return data.session?.access_token || "";
  }, [client]);

  const value = useMemo<SessionContextValue>(() => ({
    client,
    loading,
    portal,
    user,
    accessToken,
    login,
    logout,
    register,
    refresh,
  }), [accessToken, client, loading, login, logout, portal, refresh, register, user]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider.");
  return value;
}
