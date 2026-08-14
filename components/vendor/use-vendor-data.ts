"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/providers/session-provider";
import type { VendorProduct } from "@/lib/client/types";

export function useVendorProducts() {
  const { accessToken } = useSession();
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const token = await accessToken();
    const response = await fetch("/api/vendor/products", { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load products.");
    setProducts(body);
    setError("");
    setLoading(false);
    return body as VendorProduct[];
  }, [accessToken]);
  useEffect(() => { void load().catch((reason) => { setError(reason.message); setLoading(false); }); }, [load]);
  return { error, load, loading, products, setError };
}
