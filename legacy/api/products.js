const seedProducts = require("../../server/seed-products.json");
const { json, supabaseRest } = require("../../lib/supabase-server");

const money = (value) => `R${Number(value).toLocaleString("en-ZA", {
  minimumFractionDigits: Number(value) % 1 ? 2 : 0,
  maximumFractionDigits: 2,
})}`;

const toPublicProduct = (row) => {
  const images = Array.isArray(row.image_urls) && row.image_urls.length
    ? row.image_urls
    : row.image_url ? [row.image_url] : [];
  return {
    id: `vendor-${row.id}`,
    vendorProductId: row.id,
    source: "vendor",
    collection: row.collection,
    hairType: row.hair_type,
    name: row.name,
    type: row.product_type,
    price: money(row.price),
    oldPrice: row.old_price == null ? null : money(row.old_price),
    tag: row.tag || "Vendor",
    rating: Number(row.rating || 0),
    reviewCount: Number(row.review_count || 0),
    shortDesc: row.short_description || "",
    desc: row.description || "",
    image: images[0] || "",
    images,
    sizes: row.sizes || [],
    hairOrigins: row.hair_origins || [],
    sizePrices: row.size_prices || {},
    hairOriginPrices: row.hair_origin_prices || {},
    variantPrices: row.variant_prices || [],
    details: row.details || {},
    stockQuantity: row.stock_quantity,
  };
};

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "Method not allowed." });
  }

  try {
    const result = await supabaseRest(
      "vendor_products?select=*&status=eq.active&stock_quantity=gt.0&order=created_at.desc",
    );
    if (!result.ok) {
      const errorBody = await result.text();
      console.error("Unable to load vendor products:", result.status, errorBody);
      return json(response, 200, seedProducts);
    }
    const vendorProducts = (await result.json()).map(toPublicProduct);
    return json(response, 200, [...seedProducts, ...vendorProducts]);
  } catch (error) {
    console.error("Product catalogue failed:", error);
    return json(response, 200, seedProducts);
  }
};
