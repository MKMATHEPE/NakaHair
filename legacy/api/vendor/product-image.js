const { randomUUID } = require("node:crypto");

const {
  getApprovedVendor,
  getConfig,
  json,
  serviceHeaders,
  supabaseRest,
} = require("../../../lib/supabase-server");

const allowedTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const maxImageBytes = 2 * 1024 * 1024;
const maxProductImages = 8;

const hasExpectedSignature = (image, contentType) => {
  if (contentType === "image/jpeg") return image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  if (contentType === "image/png") return image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/gif") return ["GIF87a", "GIF89a"].includes(image.subarray(0, 6).toString("ascii"));
  if (contentType === "image/webp") return image.subarray(0, 4).toString("ascii") === "RIFF" && image.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
};

const storageObjectPath = (url) => {
  const marker = "/storage/v1/object/public/vendor-products/";
  const index = String(url || "").indexOf(marker);
  if (index === -1) return "";
  try { return decodeURIComponent(String(url).slice(index + marker.length)); } catch { return ""; }
};

module.exports = async function handler(request, response) {
  try {
    if (!["POST", "DELETE"].includes(request.method)) {
      response.setHeader("Allow", "POST, DELETE");
      return json(response, 405, { error: "Method not allowed." });
    }

    const access = await getApprovedVendor(request);
    if (!access) return json(response, 403, { error: "Approved vendor access is required." });
    const id = Number(request.body?.id);
    if (!Number.isInteger(id) || id <= 0) return json(response, 400, { error: "Invalid product." });

    const userId = encodeURIComponent(access.user.id);
    const existingResult = await supabaseRest(
      `vendor_products?select=id,image_url,image_urls&id=eq.${id}&vendor_user_id=eq.${userId}&limit=1`,
    );
    if (!existingResult.ok) throw new Error(`Unable to verify product ownership (${existingResult.status}).`);
    const existing = (await existingResult.json())[0];
    if (!existing) return json(response, 404, { error: "Product not found." });

    const { url, key } = getConfig();
    const currentImages = [...new Set(Array.isArray(existing.image_urls) && existing.image_urls.length
      ? existing.image_urls
      : existing.image_url ? [existing.image_url] : [])];

    if (request.method === "DELETE") {
      const imageUrl = String(request.body?.imageUrl || "");
      if (!currentImages.includes(imageUrl)) return json(response, 404, { error: "Image not found." });
      const nextImages = currentImages.filter((item) => item !== imageUrl);
      const coverResult = await supabaseRest(
        `vendor_collection_covers?vendor_user_id=eq.${userId}&cover_product_id=eq.${id}&cover_image_url=eq.${encodeURIComponent(imageUrl)}`,
        nextImages.length
          ? {
            method: "PATCH",
            body: JSON.stringify({ cover_image_url: nextImages[0], updated_at: new Date().toISOString() }),
          }
          : { method: "DELETE" },
      );
      if (!coverResult.ok) return json(response, 502, { error: "Unable to update the collection cover." });
      const updateResult = await supabaseRest(
        `vendor_products?id=eq.${id}&vendor_user_id=eq.${userId}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            image_urls: nextImages,
            image_url: nextImages[0] || null,
            ...(nextImages.length ? {} : { status: "draft", is_featured: false }),
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!updateResult.ok) return json(response, 502, { error: "Unable to remove the product image." });
      const objectPath = storageObjectPath(imageUrl);
      if (objectPath && objectPath.startsWith(`${access.user.id}/`)) {
        try {
          const deleteResult = await fetch(`${url}/storage/v1/object/vendor-products/${objectPath}`, {
            method: "DELETE",
            headers: serviceHeaders(key),
            signal: AbortSignal.timeout(8000),
          });
          if (!deleteResult.ok) {
            console.error("Unable to delete vendor product image:", deleteResult.status);
          }
        } catch (error) {
          console.error("Unable to delete vendor product image:", error);
        }
      }
      return json(response, 200, (await updateResult.json())[0]);
    }

    if (currentImages.length >= maxProductImages) {
      return json(response, 409, { error: `A product can have up to ${maxProductImages} images.` });
    }
    const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(request.body?.image || ""));
    const contentType = match?.[1];
    if (!allowedTypes[contentType]) {
      return json(response, 400, { error: "Choose a JPG, PNG, WEBP, or GIF image." });
    }
    const image = Buffer.from(match[2], "base64");
    if (!image.length || image.length > maxImageBytes) {
      return json(response, 400, { error: "The image must be 2 MB or smaller." });
    }
    if (!hasExpectedSignature(image, contentType)) {
      return json(response, 400, { error: "The selected file is not a valid image." });
    }

    const objectPath = `${access.user.id}/${id}-${randomUUID()}.${allowedTypes[contentType]}`;
    const uploadResult = await fetch(`${url}/storage/v1/object/vendor-products/${objectPath}`, {
      method: "POST",
      headers: serviceHeaders(key, { "Content-Type": contentType, "x-upsert": "false" }),
      body: image,
      signal: AbortSignal.timeout(8000),
    });
    if (!uploadResult.ok) {
      const body = await uploadResult.text();
      console.error("Unable to upload vendor product image:", uploadResult.status, body);
      return json(response, 502, { error: "Unable to upload the product image." });
    }

    const imageUrl = `${url}/storage/v1/object/public/vendor-products/${objectPath}`;
    const nextImages = [...currentImages, imageUrl];
    const updateResult = await supabaseRest(
      `vendor_products?id=eq.${id}&vendor_user_id=eq.${userId}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ image_urls: nextImages, image_url: nextImages[0], updated_at: new Date().toISOString() }),
      },
    );
    if (!updateResult.ok) {
      await fetch(`${url}/storage/v1/object/vendor-products/${objectPath}`, {
        method: "DELETE",
        headers: serviceHeaders(key),
        signal: AbortSignal.timeout(8000),
      });
      return json(response, 502, { error: "Unable to attach the image to the product." });
    }

    return json(response, 200, (await updateResult.json())[0]);
  } catch (error) {
    console.error("Vendor product image request failed:", error);
    return json(response, 500, { error: "Unable to upload the product image." });
  }
};
