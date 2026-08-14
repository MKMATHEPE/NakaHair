import { ApiError, jsonResponse, optionalString, readJsonObject, requiredString, withApiHandler } from "@/lib/server/api";
import { requireUser, serviceJson, updateAuthUser } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string;
};

export const PUT = withApiHandler(async (request) => {
  const user = await requireUser(request);
  const body = await readJsonObject(request);
  const firstName = requiredString(body.firstName, "First name", 120);
  const lastName = requiredString(body.lastName, "Last name", 120);
  const phone = requiredString(body.phone, "Phone number", 50);
  const password = optionalString(body.password, "Password", 200);

  if (password && password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters.", "validation_error");
  }
  if (password) {
    await updateAuthUser(user.id, { password });
  }

  const rows = await serviceJson<ProfileRow[]>(
    `profiles?on_conflict=id`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        phone,
      }),
    },
  );
  const profile = rows[0];
  if (!profile) {
    throw new ApiError(502, "The profile could not be updated.", "profile_update_failed");
  }

  return jsonResponse({
    user: {
      id: user.id,
      email: user.email || "",
      firstName: profile.first_name || "",
      lastName: profile.last_name || "",
      phone: profile.phone || "",
      role: profile.role || "customer",
    },
  });
});
