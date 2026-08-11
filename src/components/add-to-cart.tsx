"use client";

import { ShoppingBag } from "lucide-react";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";

export function AddToCart({ disabled = false }: { disabled?: boolean }) {
  const { addItem } = useCart();
  return (
    <Button type="button" size="lg" className="w-full" disabled={disabled} onClick={() => addItem()}>
      <ShoppingBag className="size-4" />
      {disabled ? "Out of stock" : "Add to bag"}
    </Button>
  );
}
