"use client";

import { useMemo, useState } from "react";

import { useCart } from "@/components/providers/cart-provider";
import type { Product } from "@/lib/client/types";
import { formatMoney, productImage, variantPrice } from "@/lib/client/types";
import { addToWishlist } from "@/lib/client/wishlist";

import { ProductImage } from "../shared/product-image";

export function ProductDialog({ onClose, product }: { onClose(): void; product: Product }) {
  const { add } = useCart();
  const [origin, setOrigin] = useState(product.hairOrigins[0] || "");
  const [size, setSize] = useState(product.sizes[0] || "");
  const [image, setImage] = useState(productImage(product));
  const [saved, setSaved] = useState(false);
  const price = useMemo(() => variantPrice(product, origin, size), [origin, product, size]);
  const images = product.images?.length ? product.images : [productImage(product)];

  return (
    <div className="naka-modal-backdrop" onMouseDown={onClose} role="presentation">
      <section aria-labelledby="product-title" aria-modal="true" className="naka-modal naka-product-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <button aria-label="Close" className="naka-modal-close" onClick={onClose} type="button">×</button>
        <div className="naka-product-gallery">
          <div className="naka-product-main-image"><ProductImage alt={product.name} priority src={image} /></div>
          {images.length > 1 ? <div className="naka-thumbnails">{images.map((source, index) => <button aria-label={`Show image ${index + 1}`} className={image === source ? "active" : ""} key={source} onClick={() => setImage(source)} type="button"><ProductImage alt="" src={source} /></button>)}</div> : null}
        </div>
        <div className="naka-product-info">
          <p className="naka-eyebrow">{product.type}</p>
          <h2 id="product-title">{product.name}</h2>
          <p className="naka-rating">★★★★★ <span>{product.rating} ({product.reviewCount} reviews)</span></p>
          <p className="naka-product-modal-price">{formatMoney(price)}</p>
          <p>{product.desc}</p>
          {product.hairOrigins.length ? <fieldset><legend>Hair origin</legend><div className="naka-option-row">{product.hairOrigins.map((value) => <button className={origin === value ? "active" : ""} key={value} onClick={() => setOrigin(value)} type="button">{value}</button>)}</div></fieldset> : null}
          {product.sizes.length ? <fieldset><legend>Length</legend><div className="naka-option-row">{product.sizes.map((value) => <button className={size === value ? "active" : ""} key={value} onClick={() => setSize(value)} type="button">{value}</button>)}</div></fieldset> : null}
          <button className="naka-button naka-button-block" onClick={() => {
            add({ id: product.id, name: product.name, collection: product.collection, selectedOrigin: origin, selectedSize: size, price, image: productImage(product) });
            onClose();
          }} type="button">Add to Bag · {formatMoney(price)}</button>
          <button className="naka-button-secondary naka-button-block naka-wishlist-button" onClick={() => {
            addToWishlist(product);
            setSaved(true);
          }} type="button">{saved ? "Saved to Wishlist" : "Save to Wishlist"}</button>
          <dl className="naka-details">{Object.entries(product.details).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value}</dd></div>)}</dl>
        </div>
      </section>
    </div>
  );
}
