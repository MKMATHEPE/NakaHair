import { describe, expect, it } from "vitest";

import { filterProducts, parsePrice } from "./product-utils";
import type { Product } from "@/types/product";

const baseProduct: Product = {
  id: "seed-1",
  source: "seed",
  collection: "everyday",
  hairType: "Straight",
  name: "Everyday Straight",
  type: "Synthetic Blend",
  price: 499,
  oldPrice: null,
  tag: "",
  rating: 4,
  reviewCount: 1,
  shortDescription: "",
  description: "",
  images: ["/content/product-fallback.png"],
  sizes: [],
  hairOrigins: [],
  details: {},
  stockQuantity: null,
};

describe("parsePrice", () => {
  it("parses the formatted rand values in the seed catalogue", () => {
    expect(parsePrice("R1 499")).toBe(1499);
    expect(parsePrice("R549")).toBe(549);
  });
});

describe("filterProducts", () => {
  const signature: Product = { ...baseProduct, id: "seed-2", collection: "signature", name: "Curly Signature", hairType: "Curly" };

  it("matches product names, types and hair textures case-insensitively", () => {
    expect(filterProducts([baseProduct, signature], "CURLY", "all")).toEqual([signature]);
    expect(filterProducts([baseProduct, signature], "synthetic", "all")).toHaveLength(2);
  });

  it("combines search and collection filters", () => {
    expect(filterProducts([baseProduct, signature], "straight", "signature")).toEqual([]);
    expect(filterProducts([baseProduct, signature], "", "everyday")).toEqual([baseProduct]);
  });
});
