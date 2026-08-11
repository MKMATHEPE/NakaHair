import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { z } from "zod";

import seedProducts from "../../server/seed-products.json";
import { parsePrice } from "@/lib/product-utils";
import { collections, type Collection, type Product } from "@/types/product";

const fallbackImage = "/content/product-fallback.png";

const vendorProductSchema = z.object({
  id: z.coerce.number().int().positive(),
  collection: z.enum(collections),
  hair_type: z.string(),
  name: z.string(),
  product_type: z.string(),
  price: z.coerce.number().nonnegative(),
  old_price: z.coerce.number().nonnegative().nullable().optional(),
  tag: z.string().nullable().optional(),
  rating: z.coerce.number().nullable().optional(),
  review_count: z.coerce.number().int().nullable().optional(),
  short_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  image_urls: z.array(z.string()).nullable().optional(),
  sizes: z.array(z.string()).nullable().optional(),
  hair_origins: z.array(z.string()).nullable().optional(),
  details: z.record(z.string(), z.string()).nullable().optional(),
  stock_quantity: z.coerce.number().int().nonnegative(),
});

const uniqueImages = (images: unknown[]) => {
  const urls = images.map((image) => String(image ?? "").trim()).filter(Boolean);
  return urls.length ? [...new Set(urls)] : [fallbackImage];
};

const normalizeSeedProduct = (row: (typeof seedProducts)[number]): Product => ({
  id: `seed-${row.id}`,
  source: "seed",
  collection: row.collection as Collection,
  hairType: row.hairType,
  name: row.name,
  type: row.type,
  price: parsePrice(row.price),
  oldPrice: row.oldPrice ? parsePrice(row.oldPrice) : null,
  tag: row.tag,
  rating: row.rating,
  reviewCount: row.reviewCount,
  shortDescription: row.shortDesc,
  description: row.desc,
  images: [fallbackImage],
  sizes: row.sizes,
  hairOrigins: row.hairOrigins,
  details: Object.fromEntries(
    Object.entries(row.details).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ),
  stockQuantity: null,
});

const normalizeVendorProduct = (input: unknown): Product | null => {
  const result = vendorProductSchema.safeParse(input);
  if (!result.success) {
    console.error("Skipping invalid vendor product", result.error.flatten().fieldErrors);
    return null;
  }
  const row = result.data;
  const rawImages = row.image_urls?.length ? row.image_urls : [row.image_url];
  return {
    id: `vendor-${row.id}`,
    vendorProductId: row.id,
    source: "vendor",
    collection: row.collection,
    hairType: row.hair_type,
    name: row.name,
    type: row.product_type,
    price: row.price,
    oldPrice: row.old_price ?? null,
    tag: row.tag ?? "Vendor",
    rating: row.rating ?? 0,
    reviewCount: row.review_count ?? 0,
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    images: uniqueImages(rawImages),
    sizes: row.sizes ?? [],
    hairOrigins: row.hair_origins ?? [],
    details: row.details ?? {},
    stockQuantity: row.stock_quantity,
  };
};

const loadProducts = async (): Promise<Product[]> => {
  const seeds = seedProducts.map(normalizeSeedProduct);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return seeds;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase
    .from("vendor_products")
    .select("*")
    .eq("status", "active")
    .gt("stock_quantity", 0)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load vendor products", error.message);
    return seeds;
  }

  const vendors = (data ?? []).map(normalizeVendorProduct).filter((product): product is Product => Boolean(product));
  return [...vendors, ...seeds];
};

export const getProducts = cache(loadProducts);

export const getProduct = cache(async (id: string) => {
  const products = await getProducts();
  return products.find((product) => product.id === id) ?? null;
});
