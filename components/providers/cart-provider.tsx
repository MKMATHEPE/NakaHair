"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CartItem } from "@/lib/client/types";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add(item: Omit<CartItem, "key" | "quantity">): void;
  clear(): void;
  remove(key: string): void;
  update(key: string, quantity: number): void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "naka-cart-v2";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setItems(saved);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((item: Omit<CartItem, "key" | "quantity">) => {
    const key = [item.id, item.selectedOrigin, item.selectedSize].join("::");
    setItems((current) => {
      const existing = current.find((entry) => entry.key === key);
      return existing
        ? current.map((entry) => entry.key === key
          ? { ...entry, quantity: entry.quantity + 1 }
          : entry)
        : [...current, { ...item, key, quantity: 1 }];
    });
  }, []);

  const remove = useCallback((key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);
  const update = useCallback((key: string, quantity: number) => {
    setItems((current) => quantity < 1
      ? current.filter((item) => item.key !== key)
      : current.map((item) => item.key === key ? { ...item, quantity } : item));
  }, []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    add,
    clear,
    remove,
    update,
  }), [add, clear, items, remove, update]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}
