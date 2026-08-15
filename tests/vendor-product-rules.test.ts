import { describe, expect, it } from "vitest";

import { vendorCollectionTabs } from "../lib/client/collections";
import {
  MAX_FEATURED_PRODUCTS,
  catalogueSort,
  displayOrderSort,
  publicationIssue,
} from "../lib/vendor-product-rules";

const publishableProduct = {
  id: 1,
  name: "Brazilian Body Wave",
  product_type: "Bundles",
  hair_type: "Human Hair",
  description: "Three premium bundles.",
  price: 2450,
  stock_quantity: 8,
  image_url: "https://example.test/product.jpg",
  image_urls: [],
  is_featured: false,
  display_order: 1,
  created_at: "2026-08-01T00:00:00.000Z",
};

describe("vendor product catalogue rules", () => {
  it("exposes the all-products tab and the three customer collections", () => {
    expect(vendorCollectionTabs.map((tab) => [tab.key, tab.label])).toEqual([
      ["catalogue", "The Catalogue"],
      ["everyday", "Glam On A Budget"],
      ["signature", "Signature Collection"],
      ["luxe", "Luxe Collection"],
    ]);
  });

  it("keeps the featured product limit explicit", () => {
    expect(MAX_FEATURED_PRODUCTS).toBe(4);
  });

  it("blocks incomplete products from publishing", () => {
    expect(publicationIssue(publishableProduct)).toBe("");
    expect(publicationIssue({ ...publishableProduct, image_url: null })).toBe("Add an image before publishing.");
    expect(publicationIssue({ ...publishableProduct, stock_quantity: 0 })).toBe("Add stock before publishing.");
    expect(publicationIssue({ ...publishableProduct, description: "" })).toBe("Add a description before publishing.");
  });

  it("puts featured products first on the customer storefront", () => {
    const products = [
      { ...publishableProduct, id: 1, display_order: 1, is_featured: false },
      { ...publishableProduct, id: 2, display_order: 3, is_featured: true },
      { ...publishableProduct, id: 3, display_order: 2, is_featured: false },
    ].sort(catalogueSort);

    expect(products.map((product) => product.id)).toEqual([2, 1, 3]);
  });

  it("uses vendor display order independently of featured placement", () => {
    const products = [
      { ...publishableProduct, id: 1, display_order: 2, is_featured: true },
      { ...publishableProduct, id: 2, display_order: 1, is_featured: false },
    ].sort(displayOrderSort);

    expect(products.map((product) => product.id)).toEqual([2, 1]);
  });
});
