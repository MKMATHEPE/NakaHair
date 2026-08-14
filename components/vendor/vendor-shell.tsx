"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useSession } from "@/components/providers/session-provider";

const links = [
  ["/vendor/products", "My Products"],
  ["/vendor/orders", "My Orders"],
  ["/vendor/analytics", "Analytics"],
  ["/vendor/preview", "Store Preview"],
  ["/vendor/profile", "Vendor Profile"],
] as const;

export function VendorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading, user } = useSession();
  if (loading) return <main className="naka-dashboard-loading">Loading vendor portal…</main>;
  if (!user) return <main className="naka-access"><p className="naka-eyebrow">Vendor portal</p><h1>Vendor login required</h1><p>Use Vendor Login in the header to open your management dashboard.</p></main>;
  if (!user.isVendor) return <main className="naka-access"><p className="naka-eyebrow">Vendor portal</p><h1>No approved vendor profile</h1><p>Submit your application from your customer account before signing in here.</p><Link className="naka-button" href="/account/vendor">Open Application</Link></main>;

  return <main className="naka-vendor-layout"><div className="naka-vendor-intro"><p className="naka-eyebrow">Vendor management</p><h1>{user.vendorBusinessName || "Vendor Dashboard"}</h1></div><nav className="naka-tabs">{links.map(([href, label]) => <Link className={pathname === href ? "active" : ""} href={href} key={href}>{label}</Link>)}</nav><section className="naka-vendor-content">{children}</section></main>;
}
