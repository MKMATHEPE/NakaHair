const {
  getApprovedVendor,
  getConfig,
  json,
  serviceHeaders,
  supabaseRest,
} = require("../../lib/supabase-server");

const allowedTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const maxImageBytes = 2 * 1024 * 1024;

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
  return index === -1 ? "" : decodeURIComponent(String(url).slice(index + marker.length));
};

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return json(response, 405, { error: "Method not allowed." });
    }

    const access = await getApprovedVendor(request);
    if (!access) return json(response, 403, { error: "Approved vendor access is required." });
    const id = Number(request.body?.id);
    if (!Number.isInteger(id) || id <= 0) return json(response, 400, { error: "Invalid product." });

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

    const userId = encodeURIComponent(access.user.id);
    const existingResult = await supabaseRest(
      `vendor_products?select=id,image_url&id=eq.${id}&vendor_user_id=eq.${userId}&limit=1`,
    );
    if (!existingResult.ok) throw new Error(`Unable to verify product ownership (${existingResult.status}).`);
    const existing = (await existingResult.json())[0];
    if (!existing) return json(response, 404, { error: "Product not found." });

    const { url, key } = getConfig();
    const objectPath = `${access.user.id}/${id}-${Date.now()}.${allowedTypes[contentType]}`;
    const uploadResult = await fetch(`${url}/storage/v1/object/vendor-products/${objectPath}`, {
      method: "POST",
      headers: serviceHeaders(key, { "Content-Type": contentType, "x-upsert": "false" }),
      body: image,
    });
    if (!uploadResult.ok) {
      const body = await uploadResult.text();
      console.error("Unable to upload vendor product image:", uploadResult.status, body);
      return json(response, 502, { error: "Unable to upload the product image." });
    }

    const imageUrl = `${url}/storage/v1/object/public/vendor-products/${objectPath}`;
    const updateResult = await supabaseRest(
      `vendor_products?id=eq.${id}&vendor_user_id=eq.${userId}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ image_url: imageUrl, updated_at: new Date().toISOString() }),
      },
    );
    if (!updateResult.ok) {
      await fetch(`${url}/storage/v1/object/vendor-products/${objectPath}`, {
        method: "DELETE",
        headers: serviceHeaders(key),
      });
      return json(response, 502, { error: "Unable to attach the image to the product." });
    }

    const oldObjectPath = storageObjectPath(existing.image_url);
    if (oldObjectPath) {
      fetch(`${url}/storage/v1/object/vendor-products/${oldObjectPath}`, {
        method: "DELETE",
        headers: serviceHeaders(key),
      }).catch((error) => console.error("Unable to remove replaced vendor image:", error));
    }
    return json(response, 200, (await updateResult.json())[0]);
  } catch (error) {
    console.error("Vendor product image request failed:", error);
    return json(response, 500, { error: "Unable to upload the product image." });
  }
};
