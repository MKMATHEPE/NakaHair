import { describe, expect, it } from "vitest";
import pricing from "../lib/product-variant-pricing";

describe("calculateVariantPrice", () => {
  it("combines explicit size and hair-origin prices relative to the base price", () => {
    expect(pricing.calculateVariantPrice({
      price: 1000,
      size_prices: { '14"': 1000, '18"': 1400 },
      hair_origin_prices: { Brazilian: 1000, Cambodian: 1250 },
    }, "Cambodian", '18"')).toBe(1650);
  });

  it("uses the base price when an option has no configured override", () => {
    expect(pricing.calculateVariantPrice({ price: 2950 }, "Cambodian", '16"')).toBe(2950);
  });
});
