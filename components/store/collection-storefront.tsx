"use client";

import { useEffect, useState } from "react";

import type { CollectionKey } from "@/lib/client/collections";
import type { Product } from "@/lib/client/types";

import { ProductCard } from "./product-card";
import { ProductDialog } from "./product-dialog";

export function CollectionStorefront({
  collection,
  copy,
  eyebrow,
  title,
}: {
  collection: CollectionKey;
  copy: string;
  eyebrow: string;
  title: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/products", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load this collection.");
        return response.json() as Promise<Product[]>;
      })
      .then((items) => setProducts(items.filter((product) => product.collection === collection)))
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [collection]);

  return <main className="naka-collection-page">
    <section className="naka-section">
      <div className="naka-section-heading"><div><p className="naka-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></div></div>
      {loading ? <p className="naka-empty">Loading the collection…</p> : null}
      {error ? <p className="naka-error">{error}</p> : null}
      {!loading && !error && !products.length ? <p className="naka-empty">No products are available in this collection yet.</p> : null}
      <div className="naka-product-grid">{products.map((product) => <ProductCard key={product.id} onSelect={setSelected} product={product} />)}</div>
    </section>
    {selected ? <ProductDialog onClose={() => setSelected(null)} product={selected} /> : null}
  </main>;
}
