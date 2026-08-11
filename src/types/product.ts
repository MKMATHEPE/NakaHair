export const collections = ["everyday", "signature", "luxe"] as const;

export type Collection = (typeof collections)[number];

export type Product = {
  id: string;
  vendorProductId?: number;
  source: "seed" | "vendor";
  collection: Collection;
  hairType: string;
  name: string;
  type: string;
  price: number;
  oldPrice: number | null;
  tag: string;
  rating: number;
  reviewCount: number;
  shortDescription: string;
  description: string;
  images: string[];
  sizes: string[];
  hairOrigins: string[];
  details: Record<string, string>;
  stockQuantity: number | null;
};

export const collectionLabels: Record<Collection, string> = {
  everyday: "Glam On A Budget",
  signature: "Signature Collection",
  luxe: "Luxe Collection",
};

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: value % 1 ? 2 : 0,
  }).format(value);
}
