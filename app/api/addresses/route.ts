import { ApiError, jsonResponse, readJsonObject, requiredString, withApiHandler } from "@/lib/server/api";
import { requireUser, serviceJson } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddressRow = {
  id: number;
  label: string;
  address: string;
  province: string;
  city: string;
  street: string;
  postal_code: string;
  created_at: string;
};

export const GET = withApiHandler(async (request) => {
  const user = await requireUser(request);
  const rows = await serviceJson<AddressRow[]>(
    `addresses?select=id,label,address,province,city,street,postal_code,created_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`,
  );
  return jsonResponse(rows);
});

export const POST = withApiHandler(async (request) => {
  const user = await requireUser(request);
  const body = await readJsonObject(request);
  const rows = await serviceJson<AddressRow[]>("addresses", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      label: requiredString(body.label || "Home", "Label", 80),
      address: requiredString(body.address, "Address", 200),
      province: requiredString(body.province, "Province", 100),
      city: requiredString(body.city, "City", 100),
      street: requiredString(body.street, "Street", 200),
      postal_code: requiredString(body.postalCode, "Postal code", 20),
    }),
  });
  if (!rows[0]) throw new ApiError(502, "The address could not be saved.", "address_create_failed");
  return jsonResponse(rows[0], 201);
});

export const DELETE = withApiHandler(async (request) => {
  const user = await requireUser(request);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Select a valid address.", "validation_error");
  }
  const rows = await serviceJson<AddressRow[]>(
    `addresses?id=eq.${id}&user_id=eq.${encodeURIComponent(user.id)}`,
    { method: "DELETE", headers: { Prefer: "return=representation" } },
  );
  if (!rows[0]) throw new ApiError(404, "Address not found.", "not_found");
  return new Response(null, { status: 204 });
});
