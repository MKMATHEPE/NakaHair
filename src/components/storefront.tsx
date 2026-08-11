"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { filterProducts, type ProductCollectionFilter } from "@/lib/product-utils";
import { collectionLabels, collections, type Product } from "@/types/product";

export function Storefront({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<ProductCollectionFilter>("all");
  const filtered = useMemo(() => filterProducts(products, query, collection), [collection, products, query]);

  return (
    <section id="shop" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">Shop the range</p>
          <h2 className="font-serif text-4xl sm:text-5xl">Hair made for your moment.</h2>
        </div>
        <label className="relative block w-full lg:max-w-sm">
          <span className="sr-only">Search products</span>
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search styles and textures"
            className="h-12 w-full rounded-md border border-input bg-background pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      <div className="mb-9 flex items-center gap-2 overflow-x-auto pb-2" aria-label="Filter by collection">
        <SlidersHorizontal className="mr-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Button variant={collection === "all" ? "default" : "outline"} size="sm" onClick={() => setCollection("all")}>All</Button>
        {collections.map((item) => (
          <Button
            key={item}
            variant={collection === item ? "default" : "outline"}
            size="sm"
            onClick={() => setCollection(item)}
            className={cn("whitespace-nowrap")}
          >
            {collectionLabels[item]}
          </Button>
        ))}
      </div>
      {filtered.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {filtered.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} />)}
        </div>
      ) : (
        <div className="border border-dashed border-border py-20 text-center">
          <h3 className="font-serif text-2xl">No matching products</h3>
          <p className="mt-2 text-sm text-muted-foreground">Try another search or collection.</p>
        </div>
      )}
    </section>
  );
}
