import { afterEach, describe, expect, it, vi } from "vitest";

describe("public products API", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("loads active vendor products with a modern Supabase secret key", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([{
      id: 7,
      collection: "signature",
      hair_type: "Curly",
      name: "Vendor Curls",
      product_type: "Wig",
      price: 1950,
      old_price: null,
      tag: "Vendor",
      rating: 0,
      review_count: 0,
      short_description: "Soft curls",
      description: "Soft, long-lasting curls.",
      image_url: "https://example.test/curls.jpg",
      image_urls: ["https://example.test/curls.jpg"],
      sizes: [],
      hair_origins: [],
      size_prices: {},
      hair_origin_prices: {},
      variant_prices: [],
      details: {},
      stock_quantity: 5,
      is_featured: true,
      display_order: 1,
    }])));

    const { default: handler } = await import("../legacy/api/products.js");
    const response = {
      statusCode: 200,
      headers: new Map<string, string>(),
      body: "",
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        this.headers.set(name, value);
        return this;
      },
      end(body = "") {
        this.body = body;
      },
    };

    await handler({ method: "GET", headers: {}, body: undefined, query: {} }, response);

    const products = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(products).toContainEqual(expect.objectContaining({
      source: "vendor",
      name: "Vendor Curls",
      collection: "signature",
    }));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("vendor_products?"),
      expect.objectContaining({
        headers: expect.objectContaining({ apikey: "sb_secret_test" }),
      }),
    );
  });
});
