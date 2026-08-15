const { getApprovedVendor, json, supabaseRest } = require("../../../lib/supabase-server");

const allowedCollections = ["everyday", "signature", "luxe"];

module.exports = async function handler(request, response) {
  try {
    if (!["GET", "POST"].includes(request.method)) {
      response.setHeader("Allow", "GET, POST");
      return json(response, 405, { error: "Method not allowed." });
    }

    const access = await getApprovedVendor(request);
    if (!access) return json(response, 403, { error: "Approved vendor access is required." });
    const userId = encodeURIComponent(access.user.id);

    if (request.method === "GET") {
      const result = await supabaseRest(
        `vendor_collection_covers?select=collection,cover_product_id,cover_image_url&vendor_user_id=eq.${userId}`,
      );
      if (!result.ok) throw new Error(`Unable to load collection covers (${result.status}).`);
      return json(response, 200, await result.json());
    }

    const collection = String(request.body?.collection || "").trim();
    const productId = Number(request.body?.productId);
    const imageUrl = String(request.body?.imageUrl || "").trim();
    if (!allowedCollections.includes(collection)) {
      return json(response, 400, { error: "Select a valid collection." });
    }
    if (!Number.isInteger(productId) || productId <= 0) {
      return json(response, 400, { error: "Select a valid product." });
    }
    if (!imageUrl || imageUrl.length > 2048) {
      return json(response, 400, { error: "Select a valid product image." });
    }

    const productResult = await supabaseRest(
      `vendor_products?select=id,collection,status,stock_quantity,image_url,image_urls&id=eq.${productId}&vendor_user_id=eq.${userId}&collection=eq.${encodeURIComponent(collection)}&limit=1`,
    );
    if (!productResult.ok) throw new Error(`Unable to verify the cover product (${productResult.status}).`);
    const product = (await productResult.json())[0];
    if (!product || product.status !== "active" || Number(product.stock_quantity) <= 0) {
      return json(response, 400, { error: "Choose an active product with stock from this collection." });
    }
    const productImages = [...new Set(Array.isArray(product.image_urls) && product.image_urls.length
      ? product.image_urls.filter(Boolean)
      : product.image_url ? [product.image_url] : [])];
    if (!productImages.includes(imageUrl)) {
      return json(response, 400, { error: "Choose an image belonging to the selected product." });
    }

    const result = await supabaseRest(
      "vendor_collection_covers?on_conflict=vendor_user_id%2Ccollection",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          vendor_user_id: access.user.id,
          collection,
          cover_product_id: productId,
          cover_image_url: imageUrl,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!result.ok) {
      console.error("Unable to save collection cover:", result.status, await result.text());
      return json(response, 502, { error: "Unable to save the collection cover." });
    }
    return json(response, 200, (await result.json())[0]);
  } catch (error) {
    console.error("Vendor collection cover request failed:", error);
    return json(response, 500, { error: "Unable to manage the collection cover." });
  }
};
