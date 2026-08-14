"use client";

import { useEffect, useState } from "react";

import type { Product } from "@/lib/client/types";
import { productImage } from "@/lib/client/types";
import { readWishlist, removeFromWishlist, wishlistChangedEvent } from "@/lib/client/wishlist";

import { ProductImage } from "../shared/product-image";

export function WishlistPanel() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const refresh = () => setProducts(readWishlist());
    refresh();
    window.addEventListener(wishlistChangedEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(wishlistChangedEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return <>
    <p className="naka-eyebrow">Saved styles</p>
    <h2>Wishlist</h2>
    {!products.length ? <p className="naka-empty">Your wishlist is empty.</p> : <div className="naka-wishlist-grid">
      {products.map((product) => <article key={product.id}>
        <div className="naka-wishlist-image"><ProductImage alt={product.name} src={productImage(product)} /></div>
        <div><span>{product.type}</span><h3>{product.name}</h3><p>{product.price}</p><button className="naka-text-action" onClick={() => removeFromWishlist(product.id)} type="button">Remove</button></div>
      </article>)}
    </div>}
  </>;
}
