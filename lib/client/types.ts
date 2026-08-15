export type Portal = "customer" | "vendor";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "customer" | "admin";
  isVendor: boolean;
  vendorBusinessName: string;
};

export type ProductVariantPrice = {
  hairOrigin: string | null;
  size: string | null;
  price: number;
};

export type Product = {
  id: number | string;
  vendorProductId?: number;
  source?: "vendor";
  collection: "everyday" | "signature" | "luxe";
  hairType: string;
  name: string;
  type: string;
  price: string;
  oldPrice?: string | null;
  tag?: string;
  rating: number;
  reviewCount: number;
  shortDesc: string;
  desc: string;
  image?: string;
  images?: string[];
  sizes: string[];
  hairOrigins: string[];
  sizePrices?: Record<string, number>;
  hairOriginPrices?: Record<string, number>;
  variantPrices?: ProductVariantPrice[];
  details: Record<string, string>;
  stockQuantity?: number;
  isFeatured?: boolean;
  displayOrder?: number;
};

export type CartItem = {
  key: string;
  id: number | string;
  name: string;
  collection: string;
  selectedOrigin: string;
  selectedSize: string;
  price: number;
  quantity: number;
  image: string;
};

export type VendorProduct = {
  id: number;
  name: string;
  collection: Product["collection"];
  product_type: string;
  hair_type: string;
  price: number;
  old_price: number | null;
  tag: string | null;
  short_description: string | null;
  description: string | null;
  stock_quantity: number;
  status: "draft" | "active";
  is_featured: boolean;
  display_order: number;
  image_url: string | null;
  image_urls: string[] | null;
  sizes: string[];
  hair_origins: string[];
  variant_prices: ProductVariantPrice[];
  details: Record<string, string>;
  created_at: string;
};

export function parseMoney(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: number) {
  return `R${value.toLocaleString("en-ZA", {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function productImage(product: Pick<Product, "image" | "images">) {
  return product.images?.find(Boolean) || product.image || "/content/product-fallback.png";
}

export function variantPrice(product: Product, origin: string, size: string) {
  const exact = product.variantPrices?.find(
    (variant) => (variant.hairOrigin || "") === origin && (variant.size || "") === size,
  );
  if (exact) return Number(exact.price);
  const base = parseMoney(product.price);
  const sizePrice = product.sizePrices?.[size] ?? base;
  const originPrice = product.hairOriginPrices?.[origin] ?? base;
  return Math.max(0, base + (sizePrice - base) + (originPrice - base));
}
