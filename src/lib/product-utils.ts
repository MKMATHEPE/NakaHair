import type { Collection, Product } from "@/types/product";

export type ProductCollectionFilter = "all" | Collection;

export function parsePrice(value: unknown) {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "").replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export function filterProducts(
  products: Product[],
  query: string,
  collection: ProductCollectionFilter,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return products.filter((product) => {
    const matchesCollection = collection === "all" || product.collection === collection;
    const haystack = `${product.name} ${product.type} ${product.hairType}`.toLowerCase();
    return matchesCollection && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}
