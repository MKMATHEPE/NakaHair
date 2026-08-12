const { getApprovedVendor, json, supabaseRest } = require("../../../lib/supabase-server");

const statuses = [
  "Order received",
  "Processing",
  "Ready for dispatch",
  "Dispatched",
  "Completed",
  "Cancelled",
];

module.exports = async function handler(request, response) {
  try {
    const access = await getApprovedVendor(request);
    if (!access) return json(response, 403, { error: "Approved vendor access is required." });
    const userId = encodeURIComponent(access.user.id);

    if (request.method === "GET") {
      const result = await supabaseRest(
        `vendor_orders?select=*&vendor_user_id=eq.${userId}&order=created_at.desc`,
      );
      if (!result.ok) throw new Error(`Unable to load vendor orders (${result.status}).`);
      return json(response, 200, await result.json());
    }

    if (request.method === "PATCH") {
      const id = Number(request.body?.id);
      const status = String(request.body?.status || "");
      if (!Number.isInteger(id) || id <= 0) return json(response, 400, { error: "Invalid order." });
      if (!statuses.includes(status)) return json(response, 400, { error: "Invalid order status." });
      const result = await supabaseRest(
        `vendor_orders?id=eq.${id}&vendor_user_id=eq.${userId}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
        },
      );
      if (!result.ok) return json(response, 502, { error: "Unable to update the order." });
      const rows = await result.json();
      if (!rows[0]) return json(response, 404, { error: "Order not found." });
      return json(response, 200, rows[0]);
    }

    response.setHeader("Allow", "GET, PATCH");
    return json(response, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error("Vendor order request failed:", error);
    return json(response, 500, { error: "Unable to manage vendor orders." });
  }
};
