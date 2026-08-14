import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="naka-footer">
      <div><Link className="naka-logo" href="/">NAKA Hair</Link><p>Premium hair, wigs, bundles, closures, and frontals crafted for confidence and everyday elegance.</p></div>
      <div><h3>Help</h3><Link href="/#shipping">Shipping Info</Link><Link href="/#track">Track Order</Link><Link href="/#contact">Contact Us</Link></div>
      <div><h3>Company</h3><Link href="/#about">About Us</Link><Link href="/account/settings">My Account</Link><Link href="/account/vendor">Become a Vendor</Link></div>
      <small>© {new Date().getFullYear()} NAKA Hair. All rights reserved.</small>
    </footer>
  );
}
