"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useSession } from "@/components/providers/session-provider";

const links = [
  ["/account/orders", "My Orders"],
  ["/account/wishlist", "Wishlist"],
  ["/account/addresses", "Addresses"],
  ["/account/settings", "Account Settings"],
] as const;

export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading, logout, user } = useSession();

  if (loading) return <main className="naka-dashboard-loading">Loading your account…</main>;
  if (!user) return <main className="naka-access"><p className="naka-eyebrow">My account</p><h1>Please sign in</h1><p>Use the Login button in the header to access your account.</p></main>;

  return (
    <main className="naka-account-layout">
      <aside className="naka-account-sidebar">
        <p className="naka-eyebrow">My account</p>
        <h1>{user.firstName || "Welcome"}</h1>
        <nav>{links.map(([href, label]) => <Link className={pathname === href ? "active" : ""} href={href} key={href}>{label}</Link>)}{user.isVendor ? <Link href="/vendor/products">Vendor Portal</Link> : null}<button className="naka-link-button" onClick={() => void logout()} type="button">Log out</button></nav>
      </aside>
      <section className="naka-account-content">{children}</section>
    </main>
  );
}
