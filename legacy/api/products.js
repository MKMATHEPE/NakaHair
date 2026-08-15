const { json, supabaseRest } = require("../../lib/supabase-server");
const { catalogueSort, publicationIssue } = require("../../lib/vendor-product-rules");

const money = (value) => `R${Number(value).toLocaleString("en-ZA", {
  minimumFractionDigits: Number(value) % 1 ? 2 : 0,
  maximumFractionDigits: 2,
})}`;

const toPublicProduct = (row, collectionCoverImage = "") => {
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
    tag: row.tag || "",
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
    isFeatured: Boolean(row.is_featured),
    displayOrder: Number(row.display_order || 0),
    collectionCoverImage,
  };
};

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "Method not allowed." });
  }

  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)) {
    return json(response, 503, { error: "The product catalogue is temporarily unavailable." });
  }

  try {
    const [result, coversResult] = await Promise.all([
      supabaseRest(
        "vendor_products?select=*&status=eq.active&stock_quantity=gt.0&order=is_featured.desc,display_order.asc,created_at.desc",
      ),
      supabaseRest("vendor_collection_covers?select=cover_product_id,cover_image_url"),
    ]);
    if (!result.ok) {
      const errorBody = await result.text();
      console.error("Unable to load vendor products:", result.status, errorBody);
      return json(response, 502, { error: "The product catalogue is temporarily unavailable." });
    }
    let collectionCovers = [];
    if (coversResult.ok) {
      collectionCovers = await coversResult.json();
    } else {
      console.error("Unable to load collection covers:", coversResult.status, await coversResult.text());
    }
    const coverImages = new Map(collectionCovers.map((cover) => [
      Number(cover.cover_product_id),
      String(cover.cover_image_url || ""),
    ]));
    const vendorProducts = (await result.json())
      .filter((product) => !publicationIssue(product))
      .map((product) => toPublicProduct(product, coverImages.get(Number(product.id)) || ""));
    return json(response, 200, vendorProducts.sort(catalogueSort));
  } catch (error) {
    console.error("Product catalogue failed:", error);
    return json(response, 502, { error: "The product catalogue is temporarily unavailable." });
  }
};
