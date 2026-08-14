import type { Product } from "./types";

const storageKey = "naka-wishlist-v1";
export const wishlistChangedEvent = "naka:wishlist-changed";

export function readWishlist(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveWishlist(products: Product[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(products));
  window.dispatchEvent(new Event(wishlistChangedEvent));
}

export function addToWishlist(product: Product) {
  const products = readWishlist();
  if (!products.some((item) => item.id === product.id)) saveWishlist([...products, product]);
}

export function removeFromWishlist(productId: Product["id"]) {
  saveWishlist(readWishlist().filter((product) => product.id !== productId));
}
