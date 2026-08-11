import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return <div className="grid min-h-[60vh] place-items-center px-4 text-center"><div><p className="eyebrow">404</p><h1 className="font-serif text-5xl">This style has moved.</h1><p className="mt-3 text-sm text-muted-foreground">Browse the latest NAKA Hair collection instead.</p><Link href="/#shop" className={`${buttonVariants()} mt-7`}>Return to shop</Link></div></div>;
}
