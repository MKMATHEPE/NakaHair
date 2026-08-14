import { jsonResponse, normalizedEmail, readJsonObject, requiredString, withApiHandler } from "@/lib/server/api";
import { consumeRateLimit, rateLimitKey, serviceRequest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(async (request) => {
  const body = await readJsonObject(request);
  const name = requiredString(body.name, "Name", 160);
  const email = normalizedEmail(body.email);
  const message = requiredString(body.message, "Message", 3_000);

  await consumeRateLimit(rateLimitKey(request, "contact", email), 5, 15 * 60);
  await serviceRequest("contact_messages", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ name, email, message }),
  });

  return jsonResponse({ message: "Your message has been received." }, 201);
});
