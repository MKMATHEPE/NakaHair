"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const fallback = "/content/product-fallback.png";

function normalizeSource(source: string | null | undefined) {
  if (!source) return fallback;
  if (/^(https?:\/\/|blob:|data:)/i.test(source) || source.startsWith("/")) return source;
  return fallback;
}

export function ProductImage({
  alt,
  className,
  priority = false,
  src,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
  src?: string | null;
}) {
  const normalized = normalizeSource(src);
  const [activeSource, setActiveSource] = useState(normalized);
  useEffect(() => setActiveSource(normalized), [normalized]);

  return (
    <Image
      alt={alt}
      className={className}
      fill
      onError={() => setActiveSource(fallback)}
      priority={priority}
      sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
      src={activeSource}
      unoptimized={activeSource.startsWith("blob:") || activeSource.startsWith("data:")}
    />
  );
}
