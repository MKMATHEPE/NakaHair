const {
  getApprovedVendor,
  getConfig,
  json,
  serviceHeaders,
  supabaseRest,
} = require("../../lib/supabase-server");

const allowedCollections = ["everyday", "straight", "bundles", "wigs"];

const normalizeStringArray = (value, label) => {
  if (!Array.isArray(value) || value.length > 20) throw new Error(`${label} are invalid.`);
  const values = value.map((item) => String(item || "").trim());
  if (values.some((item) => !item || item.length > 80)) throw new Error(`${label} are invalid.`);
  return [...new Set(values)];
};

const normalizeDetails = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Product details are invalid.");
  }
  const entries = Object.entries(value);
  if (entries.length > 20) throw new Error("Too many product details.");
  const details = {};
  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey || "").trim();
    const detailValue = String(rawValue || "").trim();
    if (["__proto__", "prototype", "constructor"].includes(key.toLowerCase()) || !key || key.length > 50 || !detailValue || detailValue.length > 200) {
      throw new Error("Product details are invalid.");
    }
    details[key] = detailValue;
  }
  return details;
};

const normalizeProduct = (body, partial = false) => {
  const source = body || {};
  const product = {};
  const textFields = {
    name: 160,
    hairType: 100,
    productType: 100,
    tag: 50,
    shortDescription: 300,
    description: 3000,
    imageUrl: 500,
  };

  for (const [field, max] of Object.entries(textFields)) {
    if (!partial || source[field] !== undefined) {
      const value = String(source[field] || "").trim();
      if (value.length > max) throw new Error(`${field} is too long.`);
      product[field] = value;
    }
  }

  if (!partial || source.collection !== undefined) {
    const collection = String(source.collection || "").trim();
    if (!allowedCollections.includes(collection)) throw new Error("Select a valid collection.");
    product.collection = collection;
  }

  for (const field of ["price", "oldPrice"]) {
    if (!partial || source[field] !== undefined) {
      const raw = source[field];
      const value = raw === "" || raw == null ? null : Number(raw);
      if (field === "price" && (!Number.isFinite(value) || value < 0)) {
        throw new Error("Enter a valid product price.");
      }
      if (field === "oldPrice" && value !== null && (!Number.isFinite(value) || value < 0)) {
        throw new Error("Enter a valid old price.");
      }
      product[field] = value;
    }
  }

  if (!partial || source.stockQuantity !== undefined) {
    const stock = Number(source.stockQuantity);
    if (!Number.isInteger(stock) || stock < 0) throw new Error("Stock must be a whole number.");
    product.stockQuantity = stock;
  }

  if (!partial || source.status !== undefined) {
    const status = String(source.status || "draft");
    if (!["draft", "active"].includes(status)) throw new Error("Select a valid product status.");
    product.status = status;
  }

  if (!partial || source.sizes !== undefined) {
    product.sizes = normalizeStringArray(source.sizes || [], "Sizes");
  }

  if (!partial || source.hairOrigins !== undefined) {
    product.hairOrigins = normalizeStringArray(source.hairOrigins || [], "Hair origins");
  }

  if (!partial || source.details !== undefined) {
    product.details = normalizeDetails(source.details || {});
  }

  if (!partial && (!product.name || !product.hairType || !product.productType || !product.description)) {
    throw new Error("Name, hair type, product type, and description are required.");
  }

  return product;
};

const toRow = (product) => {
  const row = {};
  const mappings = {
    name: "name",
    collection: "collection",
    hairType: "hair_type",
    productType: "product_type",
    price: "price",
    oldPrice: "old_price",
    tag: "tag",
    shortDescription: "short_description",
    description: "description",
    imageUrl: "image_url",
    stockQuantity: "stock_quantity",
    status: "status",
    sizes: "sizes",
    hairOrigins: "hair_origins",
    details: "details",
  };
  for (const [source, target] of Object.entries(mappings)) {
    if (product[source] !== undefined) row[target] = product[source] || null;
  }
  if (product.price !== undefined) row.price = product.price;
  if (product.stockQuantity !== undefined) row.stock_quantity = product.stockQuantity;
  if (product.status !== undefined) row.status = product.status;
  return row;
};

module.exports = async function handler(request, response) {
  try {
    const access = await getApprovedVendor(request);
    if (!access) return json(response, 403, { error: "Approved vendor access is required." });
    const userId = encodeURIComponent(access.user.id);

    if (request.method === "GET") {
      const result = await supabaseRest(
        `vendor_products?select=*&vendor_user_id=eq.${userId}&order=created_at.desc`,
      );
      if (!result.ok) throw new Error(`Unable to load products (${result.status}).`);
      return json(response, 200, await result.json());
    }

    if (request.method === "POST") {
      const product = normalizeProduct(request.body);
      const result = await supabaseRest("vendor_products", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          vendor_user_id: access.user.id,
          ...toRow(product),
        }),
      });
      if (!result.ok) {
        const body = await result.text();
        console.error("Unable to create vendor product:", result.status, body);
        return json(response, 502, { error: "Unable to create the product." });
      }
      return json(response, 201, (await result.json())[0]);
    }

    if (request.method === "PATCH") {
      const id = Number(request.body?.id);
      if (!Number.isInteger(id) || id <= 0) return json(response, 400, { error: "Invalid product." });
      const product = normalizeProduct(request.body, true);
      const row = { ...toRow(product), updated_at: new Date().toISOString() };
      const result = await supabaseRest(
        `vendor_products?id=eq.${id}&vendor_user_id=eq.${userId}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(row),
        },
      );
      if (!result.ok) return json(response, 502, { error: "Unable to update the product." });
      const rows = await result.json();
      if (!rows[0]) return json(response, 404, { error: "Product not found." });
      return json(response, 200, rows[0]);
    }

    if (request.method === "DELETE") {
      const id = Number(request.query?.id || request.body?.id);
      if (!Number.isInteger(id) || id <= 0) return json(response, 400, { error: "Invalid product." });
      const result = await supabaseRest(
        `vendor_products?id=eq.${id}&vendor_user_id=eq.${userId}`,
        { method: "DELETE", headers: { Prefer: "return=representation" } },
      );
      if (!result.ok) return json(response, 502, { error: "Unable to delete the product." });
      const rows = await result.json();
      if (!rows[0]) return json(response, 404, { error: "Product not found." });
      const marker = "/storage/v1/object/public/vendor-products/";
      const imageUrl = String(rows[0].image_url || "");
      const markerIndex = imageUrl.indexOf(marker);
      if (markerIndex !== -1) {
        const { url, key } = getConfig();
        let objectPath = "";
        try { objectPath = decodeURIComponent(imageUrl.slice(markerIndex + marker.length)); } catch {}
        if (objectPath) {
          fetch(`${url}/storage/v1/object/vendor-products/${objectPath}`, {
            method: "DELETE",
            headers: serviceHeaders(key),
          }).catch((error) => console.error("Unable to remove deleted vendor image:", error));
        }
      }
      return json(response, 200, { deleted: true });
    }

    response.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return json(response, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error("Vendor product request failed:", error);
    return json(response, 400, { error: error.message || "Unable to manage vendor products." });
  }
};
