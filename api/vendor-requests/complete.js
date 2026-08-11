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
  const contactName = String(request.body?.contactName || "").trim();
  const phone = String(request.body?.phone || "").trim();
  const businessType = String(request.body?.businessType || "").trim();
  const registrationNumber = String(request.body?.registrationNumber || "").trim();
  const taxNumber = String(request.body?.taxNumber || "").trim();
  const websiteUrl = String(request.body?.websiteUrl || "").trim();
  const socialMediaUrl = String(request.body?.socialMediaUrl || "").trim();
  const streetAddress = String(request.body?.streetAddress || "").trim();
  const city = String(request.body?.city || "").trim();
  const province = String(request.body?.province || "").trim();
  const postalCode = String(request.body?.postalCode || "").trim();
  const businessDescription = String(request.body?.businessDescription || "").trim();

  const requiredFields = [
    businessName,
    contactName,
    phone,
    businessType,
    streetAddress,
    city,
    province,
    postalCode,
    businessDescription,
  ];
  if (requiredFields.some((value) => !value)) {
    return json(response, 400, { error: "Please complete all required business fields." });
  }

  const fieldLengths = [
    [businessName, 160],
    [contactName, 120],
    [phone, 50],
    [businessType, 50],
    [registrationNumber, 100],
    [taxNumber, 100],
    [websiteUrl, 500],
    [socialMediaUrl, 500],
    [streetAddress, 200],
    [city, 100],
    [province, 100],
    [postalCode, 20],
    [businessDescription, 2000],
  ];
  if (fieldLengths.some(([value, max]) => value.length > max)) {
    return json(response, 400, { error: "One or more business details are too long." });
  }

  const businessTypes = ["salon", "stylist", "retailer", "wholesaler", "online-store", "other"];
  if (!businessTypes.includes(businessType)) {
    return json(response, 400, { error: "Please select a valid business type." });
  }

  const isHttpUrl = (value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };
  if (!isHttpUrl(websiteUrl) || !isHttpUrl(socialMediaUrl)) {
    return json(response, 400, { error: "Website and social profile links must be valid URLs." });
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
          contact_name: contactName,
          phone,
          business_type: businessType,
          registration_number: registrationNumber || null,
          tax_number: taxNumber || null,
          website_url: websiteUrl || null,
          social_media_url: socialMediaUrl || null,
          street_address: streetAddress,
          city,
          province,
          postal_code: postalCode,
          business_description: businessDescription,
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
