"use client";

import type { Product } from "@/lib/client/types";
import { productImage } from "@/lib/client/types";

import { ProductImage } from "../shared/product-image";

export function ProductCard({ onSelect, product }: { onSelect(product: Product): void; product: Product }) {
  return (
    <button className="naka-product-card" onClick={() => onSelect(product)} type="button">
      <div className="naka-product-image">
        <ProductImage alt={product.name} src={productImage(product)} />
        {product.tag ? <span className="naka-product-tag">{product.tag}</span> : null}
      </div>
      <span className="naka-product-type">{product.type}</span>
      <strong>{product.name}</strong>
      <span className="naka-product-price">{product.oldPrice ? <del>{product.oldPrice}</del> : null} {product.price}</span>
    </button>
  );
}
