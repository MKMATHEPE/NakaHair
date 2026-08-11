import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ShieldCheck, Truck } from "lucide-react";
import { notFound } from "next/navigation";

import { AddToCart } from "@/components/add-to-cart";
import { ProductGallery } from "@/components/product-gallery";
import { Badge } from "@/components/ui/badge";
import { getProduct } from "@/lib/catalog";
import { collectionLabels, formatPrice } from "@/types/product";

export const dynamic = "force-dynamic";

type ProductPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  return product ? { title: product.name, description: product.shortDescription } : { title: "Product not found" };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <Link href="/#shop" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Back to shop</Link>
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <ProductGallery images={product.images} name={product.name} />
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">{collectionLabels[product.collection]}</p>
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{product.name}</h1>
            {product.tag && <Badge className="mt-2 shrink-0">{product.tag}</Badge>}
          </div>
          <div className="mt-5 flex items-center gap-3 text-lg">
            <span className="font-semibold">{formatPrice(product.price)}</span>
            {product.oldPrice && <span className="text-muted-foreground line-through">{formatPrice(product.oldPrice)}</span>}
          </div>
          <p className="mt-7 leading-7 text-muted-foreground">{product.description}</p>

          {product.sizes.length > 0 && <div className="mt-8"><p className="mb-3 text-xs font-semibold uppercase tracking-wider">Available lengths</p><div className="flex flex-wrap gap-2">{product.sizes.map((size) => <span key={size} className="border border-border bg-background px-4 py-2 text-sm">{size}</span>)}</div></div>}
          {product.hairOrigins.length > 0 && <div className="mt-7"><p className="mb-2 text-xs font-semibold uppercase tracking-wider">Hair origins</p><p className="text-sm text-muted-foreground">{product.hairOrigins.join(" · ")}</p></div>}

          <div className="mt-9"><AddToCart disabled={product.stockQuantity === 0} /></div>

          <div className="mt-8 divide-y divide-border border-y border-border text-sm">
            <div className="flex gap-3 py-4"><Truck className="size-5" /><div><p className="font-medium">Nationwide delivery</p><p className="mt-1 text-muted-foreground">Tracked delivery across South Africa.</p></div></div>
            <div className="flex gap-3 py-4"><ShieldCheck className="size-5" /><div><p className="font-medium">Secure checkout</p><p className="mt-1 text-muted-foreground">Your payment and account details stay protected.</p></div></div>
          </div>

          {Object.keys(product.details).length > 0 && <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">{Object.entries(product.details).map(([key, value]) => <div key={key} className="border-b border-border pb-3"><dt className="text-muted-foreground">{key}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl>}
        </div>
      </div>
    </div>
  );
}
