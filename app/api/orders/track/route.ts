import { ApiError, jsonResponse, normalizedEmail, readJsonObject, requiredString, withApiHandler } from "@/lib/server/api";
import { consumeRateLimit, rateLimitKey, serviceJson } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrackingRow = {
  order_number: string;
  status: string;
  created_at: string;
};

export const POST = withApiHandler(async (request) => {
  const body = await readJsonObject(request);
  const orderNumber = requiredString(body.orderNumber, "Order number", 80).toUpperCase();
  const email = normalizedEmail(body.email);

  await consumeRateLimit(rateLimitKey(request, "order-tracking", email), 10, 15 * 60);
  const rows = await serviceJson<TrackingRow[]>(
    `store_orders?select=order_number,status,created_at&order_number=eq.${encodeURIComponent(orderNumber)}&email=eq.${encodeURIComponent(email)}&limit=1`,
  );
  if (!rows[0]) {
    throw new ApiError(404, "We could not find an order with those details.", "not_found");
  }

  return jsonResponse({
    orderNumber: rows[0].order_number,
    status: rows[0].status,
    createdAt: rows[0].created_at,
  });
});
