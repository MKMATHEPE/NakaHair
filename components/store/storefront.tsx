"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { collections } from "@/lib/client/collections";
import type { Product } from "@/lib/client/types";
import { productImage } from "@/lib/client/types";

import { ProductImage } from "../shared/product-image";
import { ProductCard } from "./product-card";
import { ProductDialog } from "./product-dialog";

export function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/products", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load products.");
        return response.json() as Promise<Product[]>;
      })
      .then(setProducts)
      .catch((error) => {
        if (error.name !== "AbortError") setNotice(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = query ? products.filter((product) => [product.name, product.type, product.hairType, product.collection].some((value) => value.toLowerCase().includes(query))) : products;
    return matches.slice(0, 4);
  }, [products, search]);

  return (
    <main>
      <section className="naka-hero">
        <div><p className="naka-eyebrow">Premium hair · South Africa</p><h1>Confidence starts with great hair.</h1><p>Discover wigs, bundles, closures, and frontals selected for quality, comfort, and effortless beauty.</p><a className="naka-button" href="#shop">Shop the Collection</a></div>
        <div className="naka-hero-art"><span>NAKA</span><p>Premium hair for every version of you.</p></div>
      </section>

      <section className="naka-section" id="shop">
        <div className="naka-section-heading"><div><p className="naka-eyebrow">The catalogue</p><h2>Shop NAKA Hair</h2></div><label className="naka-search"><span className="sr-only">Search products</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" type="search" value={search} /></label></div>
        {loading ? <p className="naka-empty">Loading the collection…</p> : null}
        {notice ? <p className="naka-notice">{notice}</p> : null}
        {!loading && !visible.length ? <p className="naka-empty">No products match your search.</p> : null}
        <div className="naka-product-grid">{visible.map((product) => <ProductCard key={product.id} onSelect={setSelected} product={product} />)}</div>
      </section>

      <section className="naka-collection-showcase">
        <div className="naka-collection-showcase-heading"><p className="naka-eyebrow">Shop by collection</p><span aria-hidden="true" /></div>
        <div className="naka-collection-card-grid">
          {collections.map((collection) => {
            const featuredProduct = products.find((product) => product.collection === collection.key);
            return <Link aria-label={`View ${collection.eyebrow}`} className={`naka-collection-card naka-collection-card-${collection.key}`} href={`/collections/${collection.key}`} id={collection.key} key={collection.key}>
              <div className="naka-collection-card-image"><ProductImage alt={featuredProduct?.name || collection.eyebrow} src={featuredProduct ? productImage(featuredProduct) : undefined} /></div>
              <div className="naka-collection-card-copy"><p className="naka-eyebrow">{collection.eyebrow}</p><h2>{collection.title}</h2><p>{collection.copy}</p><span>View collection →</span></div>
            </Link>;
          })}
        </div>
      </section>

      {selected ? <ProductDialog onClose={() => setSelected(null)} product={selected} /> : null}
    </main>
  );
}
