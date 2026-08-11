"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0];
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <Image src={activeImage} alt={`${name}, view ${activeIndex + 1}`} fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
      </div>
      {images.length > 1 && (
        <div className="mt-4 grid grid-cols-5 gap-3" aria-label="Product images">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn("relative aspect-square overflow-hidden border bg-muted", activeIndex === index ? "border-foreground" : "border-transparent")}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-current={activeIndex === index}
            >
              <Image src={image} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
