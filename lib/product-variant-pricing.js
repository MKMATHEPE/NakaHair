const asPrice = (value, fallback) => {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : fallback;
};

const optionPrice = (prices, option, basePrice) => {
  if (!option || !prices || typeof prices !== "object" || Array.isArray(prices)) {
    return basePrice;
  }
  return asPrice(prices[option], basePrice);
};

const calculateVariantPrice = (product, origin, size) => {
  const basePrice = asPrice(product?.price, 0);
  const sizePrices = product?.size_prices || product?.sizePrices;
  const hairOriginPrices = product?.hair_origin_prices || product?.hairOriginPrices;
  const sizePrice = optionPrice(sizePrices, size, basePrice);
  const originPrice = optionPrice(hairOriginPrices, origin, basePrice);
  return Math.round((basePrice + (sizePrice - basePrice) + (originPrice - basePrice)) * 100) / 100;
};

module.exports = { calculateVariantPrice };
