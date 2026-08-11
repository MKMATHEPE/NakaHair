const seedProducts = require("../server/seed-products.json");
const {
  getAccessToken,
  getAuthenticatedUser,
  json,
  supabaseRest,
} = require("../lib/supabase-server");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getVendorId = (id) => {
  const match = /^vendor-(\d+)$/.exec(String(id));
  return match ? Number(match[1]) : null;
};

const parseSeedPrice = (value) => Number(String(value || "").replace(/[^0-9.]/g, ""));

const createOrderNumber = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(100000 + Math.random() * 900000);
  return `NAKA-${stamp}-${random}`;
};

const safeItems = (items) => items.map((item) => ({
  id: item.id,
  name: item.name,
  collection: item.collection || "",
  selectedOrigin: item.selectedOrigin || "",
  selectedSize: item.selectedSize || "",
  price: Number(item.price),
  quantity: Number(item.quantity),
  image: item.image || "",
}));

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const user = await getAuthenticatedUser(request);
      if (!user?.id) return json(response, 401, { error: "Please sign in to view your orders." });
      const result = await supabaseRest(
        `store_orders?select=id,order_number,items,total,status,created_at&customer_user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`,
      );
      if (!result.ok) return json(response, 502, { error: "Unable to load your orders." });
      return json(response, 200, await result.json());
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return json(response, 405, { error: "Method not allowed." });
    }

    const body = request.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const deliveryAddress = String(body.deliveryAddress || "").trim();
    const deliveryMethod = String(body.deliveryMethod || "");
    const paymentMethod = String(body.paymentMethod || "");

    if (!items.length || items.length > 100 || !emailPattern.test(email) || !phone || !deliveryAddress) {
      return json(response, 400, { error: "Complete checkout details are required." });
    }
    if (!["Standard Delivery", "Express Delivery"].includes(deliveryMethod)) {
      return json(response, 400, { error: "Select a valid delivery method." });
    }
    if (!["PayFast", "Yoco", "EFT"].includes(paymentMethod)) {
      return json(response, 400, { error: "Select a valid payment method." });
    }
    if (items.some((item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 50)) {
      return json(response, 400, { error: "Product quantities are invalid." });
    }

    let customer = null;
    if (getAccessToken(request)) {
      customer = await getAuthenticatedUser(request);
      if (!customer) return json(response, 401, { error: "Your session has expired. Please sign in again." });
    }

    const vendorIds = [...new Set(items.map((item) => getVendorId(item.id)).filter(Boolean))];
    let vendorProducts = [];
    if (vendorIds.length) {
      const result = await supabaseRest(
        `vendor_products?select=id,vendor_user_id,name,price,stock_quantity,status&status=eq.active&id=in.(${vendorIds.join(",")})`,
      );
      if (!result.ok) return json(response, 502, { error: "Unable to verify vendor products." });
      vendorProducts = await result.json();
      if (vendorProducts.length !== vendorIds.length) {
        return json(response, 409, { error: "A vendor product in your cart is no longer available." });
      }
    }

    const vendorMap = new Map(vendorProducts.map((product) => [Number(product.id), product]));
    const seedMap = new Map(seedProducts.map((product) => [Number(product.id), product]));
    const normalizedItems = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      const vendorId = getVendorId(item.id);
      if (vendorId) {
        const product = vendorMap.get(vendorId);
        if (!product || product.stock_quantity < quantity) {
          return json(response, 409, { error: `${product?.name || "A vendor product"} does not have enough stock.` });
        }
        normalizedItems.push({
          ...safeItems([{ ...item, name: product.name, price: Number(product.price), quantity }])[0],
          vendorUserId: product.vendor_user_id,
          vendorProductId: product.id,
        });
      } else {
        const seed = seedMap.get(Number(item.id));
        const price = parseSeedPrice(seed?.price);
        if (!seed || !Number.isFinite(price) || price < 0) {
          return json(response, 409, { error: "A product in your cart is no longer available." });
        }
        normalizedItems.push(safeItems([{
          ...item,
          name: seed.name,
          collection: seed.collection,
          image: seed.image,
          price,
          quantity,
        }])[0]);
      }
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = deliveryMethod === "Express Delivery" ? 250 : 150;
    const total = subtotal + deliveryFee;
    const orderNumber = createOrderNumber();
    const orderResult = await supabaseRest("store_orders", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        order_number: orderNumber,
        customer_user_id: customer?.id || null,
        email,
        phone,
        delivery_address: deliveryAddress,
        delivery_method: deliveryMethod,
        payment_method: paymentMethod,
        items: normalizedItems,
        subtotal,
        delivery_fee: deliveryFee,
        total,
      }),
    });
    if (!orderResult.ok) {
      const errorBody = await orderResult.text();
      console.error("Unable to create order:", orderResult.status, errorBody);
      return json(response, 502, { error: "Unable to place your order." });
    }
    const order = (await orderResult.json())[0];

    const byVendor = new Map();
    for (const item of normalizedItems.filter((entry) => entry.vendorUserId)) {
      if (!byVendor.has(item.vendorUserId)) byVendor.set(item.vendorUserId, []);
      byVendor.get(item.vendorUserId).push(item);
    }
    const vendorRows = [...byVendor.entries()].map(([vendorUserId, vendorItems]) => ({
      order_id: order.id,
      vendor_user_id: vendorUserId,
      order_number: orderNumber,
      customer_email: email,
      customer_phone: phone,
      delivery_address: deliveryAddress,
      delivery_method: deliveryMethod,
      items: vendorItems,
      subtotal: vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }));

    if (vendorRows.length) {
      const vendorOrderResult = await supabaseRest("vendor_orders", {
        method: "POST",
        body: JSON.stringify(vendorRows),
      });
      if (!vendorOrderResult.ok) {
        const errorBody = await vendorOrderResult.text();
        console.error("Unable to create vendor fulfillment:", vendorOrderResult.status, errorBody);
        await supabaseRest(`store_orders?id=eq.${order.id}`, { method: "DELETE" });
        return json(response, 502, { error: "Unable to create vendor fulfillment." });
      }
    }

    return json(response, 201, { orderNumber, total });
  } catch (error) {
    console.error("Order request failed:", error);
    return json(response, 500, { error: "Unable to process your order." });
  }
};
