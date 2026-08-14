"use client";

import type { Product, VendorProduct } from "@/lib/client/types";
import { formatMoney } from "@/lib/client/types";

import { ProductCard } from "../store/product-card";
import { useVendorProducts } from "./use-vendor-data";

function previewProduct(product: VendorProduct): Product {
  return { id: `vendor-${product.id}`, source: "vendor", vendorProductId: product.id, name: product.name, collection: product.collection, type: product.product_type, hairType: product.hair_type, price: formatMoney(Number(product.price)), oldPrice: product.old_price == null ? null : formatMoney(Number(product.old_price)), tag: product.tag || "Vendor", rating: 0, reviewCount: 0, shortDesc: product.short_description || "", desc: product.description || "", image: product.image_url || "", images: product.image_urls || [], sizes: product.sizes || [], hairOrigins: product.hair_origins || [], variantPrices: product.variant_prices || [], details: product.details || {}, stockQuantity: product.stock_quantity };
}

export function VendorPreviewPanel() {
  const { products, loading } = useVendorProducts();
  const visible = products.filter((product) => product.status === "active" && product.stock_quantity > 0).map(previewProduct);
  return <><p className="naka-eyebrow">Customer view</p><h2>Store Preview</h2><p>This is how active, in-stock products appear in the customer store. Shopping controls are disabled here.</p>{loading ? <p>Loading preview…</p> : <div className="naka-product-grid">{visible.map((product) => <ProductCard key={product.id} onSelect={() => {}} product={product} />)}</div>}{!loading && !visible.length ? <p className="naka-empty">Customers cannot see any of your products yet.</p> : null}</>;
}
