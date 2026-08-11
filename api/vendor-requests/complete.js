const json = (response, status, body) => {
  response.status(status).setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
};

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed." });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serverKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serverKey) {
    console.error("Missing SUPABASE_URL or a Supabase server secret.");
    return json(response, 500, { error: "Vendor registration is temporarily unavailable." });
  }

  const authorization = request.headers.authorization || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken || accessToken === authorization) {
    return json(response, 401, { error: "Please sign in before creating a vendor profile." });
  }

  const businessName = String(request.body?.businessName || "").trim();
  const phone = String(request.body?.phone || "").trim();
  if (!businessName || !phone) {
    return json(response, 400, { error: "Business name and phone number are required." });
  }
  if (businessName.length > 160 || phone.length > 50) {
    return json(response, 400, { error: "Business name or phone number is too long." });
  }

  const serverHeaders = {
    apikey: serverKey,
    Authorization: `Bearer ${serverKey}`,
    "Content-Type": "application/json",
  };

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serverKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return json(response, 401, { error: "Your session has expired. Please sign in again." });
    }

    const user = await userResponse.json();
    if (!user.id || !user.email) {
      return json(response, 400, { error: "Your account is missing required profile information." });
    }

    const requestResponse = await fetch(
      `${supabaseUrl}/rest/v1/vendor_requests?on_conflict=user_id`,
      {
        method: "POST",
        headers: {
          ...serverHeaders,
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          business_name: businessName,
          phone,
          status: "approved",
          updated_at: new Date().toISOString(),
        }),
      },
    );

    if (!requestResponse.ok) {
      const errorBody = await requestResponse.text();
      console.error("Unable to save vendor profile:", requestResponse.status, errorBody);
      return json(response, 502, { error: "Unable to save your vendor profile right now." });
    }

    return json(response, 200, {
      customer: true,
      vendor: true,
      message: "Your vendor profile is ready.",
    });
  } catch (error) {
    console.error("Vendor registration failed:", error);
    return json(response, 500, { error: "Unable to create your vendor profile right now." });
  }
};
