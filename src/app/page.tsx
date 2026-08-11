import Image from "next/image";
import Link from "next/link";

import { Storefront } from "@/components/storefront";
import { buttonVariants } from "@/components/ui/button";
import { getProducts } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { collectionLabels, collections } from "@/types/product";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProducts();
  return (
    <>
      <section className="relative min-h-[72vh] overflow-hidden bg-[#e9dfd2]">
        <Image src="/content/product-fallback.png" alt="Straight premium hair bundles and lace wig" fill priority sizes="100vw" className="object-cover object-center md:object-[65%_48%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="relative mx-auto flex min-h-[72vh] max-w-7xl items-end px-4 pb-16 sm:px-6 md:items-center md:pb-0 lg:px-8">
          <div className="max-w-2xl text-white">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-white/75">The NAKA Hair collection</p>
            <h1 className="font-serif text-5xl leading-[0.92] sm:text-7xl lg:text-8xl">Your crown,<br />your signature.</h1>
            <p className="mt-6 max-w-lg text-sm leading-6 text-white/80 sm:text-base">Premium wigs, bundles, closures and frontals chosen for effortless beauty and lasting confidence.</p>
            <Link href="#shop" className={cn(buttonVariants({ size: "lg" }), "mt-8 bg-white text-black hover:bg-white/90")}>Shop the collection</Link>
          </div>
        </div>
      </section>

      <section id="collections" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <p className="eyebrow">Find your finish</p>
          <h2 className="font-serif text-4xl sm:text-5xl">Three collections. One standard.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {collections.map((collection, index) => (
            <Link key={collection} href={`/#shop`} className="group relative min-h-72 overflow-hidden bg-muted p-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Image src="/content/product-fallback.png" alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <div className="absolute inset-x-8 bottom-8 text-white">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/65">Collection 0{index + 1}</p>
                <h3 className="mt-1 font-serif text-3xl">{collectionLabels[collection]}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Storefront products={products} />
    </>
  );
}
