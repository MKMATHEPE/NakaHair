"use client";

import { useMemo, useState } from "react";

import { collectionLabel, vendorCollectionTabs, type VendorCollectionTab } from "@/lib/client/collections";
import type { Product, VendorProduct } from "@/lib/client/types";
import { formatMoney } from "@/lib/client/types";
import { catalogueSort } from "@/lib/vendor-product-rules";

import { ProductCard } from "../store/product-card";
import { useVendorProducts } from "./use-vendor-data";

function previewProduct(product: VendorProduct): Product {
  return { id: `vendor-${product.id}`, source: "vendor", vendorProductId: product.id, name: product.name, collection: product.collection, type: product.product_type, hairType: product.hair_type, price: formatMoney(Number(product.price)), oldPrice: product.old_price == null ? null : formatMoney(Number(product.old_price)), tag: product.tag || "", rating: 0, reviewCount: 0, shortDesc: product.short_description || "", desc: product.description || "", image: product.image_url || "", images: product.image_urls || [], sizes: product.sizes || [], hairOrigins: product.hair_origins || [], variantPrices: product.variant_prices || [], details: product.details || {}, stockQuantity: product.stock_quantity, isFeatured: product.is_featured, displayOrder: product.display_order };
}

export function VendorPreviewPanel() {
  const { products, loading } = useVendorProducts();
  const [selectedTab, setSelectedTab] = useState<VendorCollectionTab>("catalogue");
  const visible = useMemo(() => products
    .filter((product) => product.status === "active" && product.stock_quantity > 0 && (product.image_urls?.some(Boolean) || product.image_url))
    .filter((product) => selectedTab === "catalogue" || product.collection === selectedTab)
    .sort(catalogueSort)
    .map(previewProduct), [products, selectedTab]);
  const counts = useMemo(() => Object.fromEntries(vendorCollectionTabs.map((tab) => [tab.key, products.filter((product) => product.status === "active" && product.stock_quantity > 0 && (product.image_urls?.some(Boolean) || product.image_url) && (tab.key === "catalogue" || product.collection === tab.key)).length])), [products]);

  return <><p className="naka-eyebrow">Customer view</p><h2>Store Preview</h2><p>This is how active, in-stock products appear in the customer store. Shopping controls are disabled here.</p><nav aria-label="Preview collections" className="naka-product-collection-tabs naka-preview-tabs">{vendorCollectionTabs.map((tab) => <button aria-current={selectedTab === tab.key ? "page" : undefined} className={selectedTab === tab.key ? "active" : ""} key={tab.key} onClick={() => setSelectedTab(tab.key)} type="button"><span>{tab.label}</span><small>{counts[tab.key] || 0}</small></button>)}</nav><p className="naka-editing-collection">Previewing: <strong>{selectedTab === "catalogue" ? "The Catalogue" : collectionLabel(selectedTab)}</strong></p>{loading ? <p>Loading preview…</p> : <div className="naka-product-grid">{visible.map((product) => <ProductCard key={product.id} onSelect={() => {}} product={product} />)}</div>}{!loading && !visible.length ? <p className="naka-empty">Customers cannot see any products in this collection yet.</p> : null}</>;
}
