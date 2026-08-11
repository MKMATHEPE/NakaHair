"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type CartContextValue = {
  itemCount: number;
  addItem: (quantity?: number) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [itemCount, setItemCount] = useState(0);
  const value = useMemo(
    () => ({
      itemCount,
      addItem: (quantity = 1) => setItemCount((count) => count + Math.max(1, quantity)),
    }),
    [itemCount],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}
