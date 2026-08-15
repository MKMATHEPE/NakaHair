"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/components/providers/cart-provider";
import { useSession } from "@/components/providers/session-provider";

import { AuthDialog } from "./auth-dialog";
import { CartDrawer } from "./cart-drawer";

export function SiteHeader() {
  const { count } = useCart();
  const { loading, logout, portal, user } = useSession();
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  if (portal === "vendor") {
    return (
      <header className="naka-header naka-vendor-header">
        <Link className="naka-logo" href="/vendor/products">NAKA Hair</Link>
        <nav aria-label="Vendor navigation">
          <Link href="/vendor/products">Vendor</Link>
          {user ? <button className="naka-link-button" onClick={() => void logout()} type="button">Log out</button> : <Link href="/vendor/login">Vendor login</Link>}
        </nav>
      </header>
    );
  }

  return (
    <>
      <header className="naka-header">
        <Link className="naka-logo" href="/">NAKA Hair</Link>
        <nav aria-label="Main navigation" className="naka-main-nav">
          <Link href="/#shop">Shop</Link>
          <Link href="/collections/everyday">Glam On A Budget</Link>
          <Link href="/collections/signature">Signature</Link>
          <Link href="/collections/luxe">Luxe</Link>
        </nav>
        <div className="naka-header-actions">
          {!loading && user ? (
            <Link href="/account/orders">Hi, {user.firstName || "there"}</Link>
          ) : <button className="naka-link-button" onClick={() => setAuthMode("login")} type="button">Login</button>}
          <button aria-label={`Cart with ${count} items`} className="naka-cart-button" onClick={() => setCartOpen(true)} type="button">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M5.5 8.5h13l1 12h-15l1-12Z" />
              <path d="M9 9V6.5a3 3 0 0 1 6 0V9" />
            </svg>
            <span>{count}</span>
          </button>
        </div>
      </header>
      {authMode ? <AuthDialog mode={authMode} onClose={() => setAuthMode(null)} /> : null}
      {cartOpen ? <CartDrawer onClose={() => setCartOpen(false)} /> : null}
    </>
  );
}
