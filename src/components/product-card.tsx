import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatPrice, type Product } from "@/types/product";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  return (
    <article className="group min-w-0">
      <Link href={`/products/${product.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
          />
          {product.tag && <Badge className="absolute left-3 top-3">{product.tag}</Badge>}
          {product.stockQuantity !== null && product.stockQuantity <= 3 && (
            <span className="absolute bottom-3 left-3 bg-background/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
              Only {product.stockQuantity} left
            </span>
          )}
        </div>
        <div className="space-y-1.5 pt-4">
          <p className="text-[11px] uppercase tracking-[0.17em] text-muted-foreground">{product.type}</p>
          <h3 className="font-serif text-lg leading-tight">{product.name}</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{formatPrice(product.price)}</span>
            {product.oldPrice && <span className="text-muted-foreground line-through">{formatPrice(product.oldPrice)}</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}
