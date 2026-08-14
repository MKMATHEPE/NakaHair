"use client";

import type { ReactNode } from "react";

import { CartProvider } from "./cart-provider";
import { SessionProvider } from "./session-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>{children}</CartProvider>
    </SessionProvider>
  );
}
