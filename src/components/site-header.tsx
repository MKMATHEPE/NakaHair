"use client";

import Link from "next/link";
import { Heart, Search, ShoppingBag, UserRound } from "lucide-react";

import { useCart } from "@/components/cart-provider";

export function SiteHeader() {
  const { itemCount } = useCart();
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-serif text-2xl tracking-tight" aria-label="NAKA Hair home">
          NAKA Hair
        </Link>
        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Primary navigation">
          <Link href="/#collections" className="transition-colors hover:text-muted-foreground">Collections</Link>
          <Link href="/#shop" className="transition-colors hover:text-muted-foreground">Shop</Link>
          <Link href="/legacy.html#account" className="transition-colors hover:text-muted-foreground">Vendor portal</Link>
        </nav>
        <div className="flex items-center gap-1">
          <a href="#shop" className="header-action" aria-label="Search products"><Search /></a>
          <button className="header-action hidden sm:inline-flex" aria-label="Wishlist"><Heart /></button>
          <Link href="/legacy.html#account" className="header-action" aria-label="My account"><UserRound /></Link>
          <button className="header-action relative" aria-label={`Shopping bag with ${itemCount} items`}>
            <ShoppingBag />
            {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}
