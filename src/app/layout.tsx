import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import Link from "next/link";

import { CartProvider } from "@/components/cart-provider";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-cormorant", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://naka-hair.vercel.app"),
  title: { default: "NAKA Hair", template: "%s · NAKA Hair" },
  description: "Premium wigs, bundles, closures and frontals crafted for confidence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${cormorant.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <CartProvider>
          <SiteHeader />
          <main>{children}</main>
          <footer className="border-t border-border bg-primary text-primary-foreground">
            <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
              <div>
                <p className="font-serif text-2xl">NAKA Hair</p>
                <p className="mt-3 max-w-sm text-sm leading-6 text-primary-foreground/65">Premium hair selected for confidence, beauty and everyday elegance.</p>
              </div>
              <div className="text-sm">
                <p className="mb-3 font-semibold uppercase tracking-wider">Shop</p>
                <div className="grid gap-2 text-primary-foreground/65"><Link href="/#shop">All products</Link><Link href="/#collections">Collections</Link></div>
              </div>
              <div className="text-sm">
                <p className="mb-3 font-semibold uppercase tracking-wider">Account</p>
                <div className="grid gap-2 text-primary-foreground/65"><Link href="/legacy.html#account">Customer account</Link><Link href="/legacy.html#account">Vendor portal</Link></div>
              </div>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
