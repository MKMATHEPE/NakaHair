const MAX_FEATURED_PRODUCTS = 4;

const productImages = (product) => {
  if (Array.isArray(product?.image_urls) && product.image_urls.some(Boolean)) {
    return product.image_urls.filter(Boolean);
  }
  return product?.image_url ? [product.image_url] : [];
};

const publicationIssue = (product) => {
  if (!String(product?.name || "").trim()) return "Add a product name before publishing.";
  if (!String(product?.product_type || "").trim()) return "Add a product type before publishing.";
  if (!String(product?.hair_type || "").trim()) return "Add a hair type before publishing.";
  if (!String(product?.description || "").trim()) return "Add a description before publishing.";
  if (!Number.isFinite(Number(product?.price)) || Number(product.price) < 0) {
    return "Add a valid price before publishing.";
  }
  if (productImages(product).length === 0) return "Add an image before publishing.";
  if (!Number.isInteger(Number(product?.stock_quantity)) || Number(product.stock_quantity) <= 0) {
    return "Add stock before publishing.";
  }
  return "";
};

const catalogueSort = (left, right) => {
  const featuredDifference = Number(Boolean(right?.is_featured ?? right?.isFeatured))
    - Number(Boolean(left?.is_featured ?? left?.isFeatured));
  if (featuredDifference) return featuredDifference;

  const orderDifference = Number(left?.display_order ?? left?.displayOrder ?? 0)
    - Number(right?.display_order ?? right?.displayOrder ?? 0);
  if (orderDifference) return orderDifference;

  const leftCreated = Date.parse(String(left?.created_at || "")) || 0;
  const rightCreated = Date.parse(String(right?.created_at || "")) || 0;
  if (leftCreated !== rightCreated) return rightCreated - leftCreated;
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
};

const displayOrderSort = (left, right) => {
  const orderDifference = Number(left?.display_order ?? left?.displayOrder ?? 0)
    - Number(right?.display_order ?? right?.displayOrder ?? 0);
  if (orderDifference) return orderDifference;
  const leftCreated = Date.parse(String(left?.created_at || "")) || 0;
  const rightCreated = Date.parse(String(right?.created_at || "")) || 0;
  if (leftCreated !== rightCreated) return leftCreated - rightCreated;
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
};

module.exports = {
  MAX_FEATURED_PRODUCTS,
  catalogueSort,
  displayOrderSort,
  productImages,
  publicationIssue,
};
