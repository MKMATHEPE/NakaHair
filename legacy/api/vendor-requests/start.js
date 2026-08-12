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
  // Supabase's newer `sb_secret_...` keys replace the legacy JWT-shaped
  // service-role key. Accept either server-only variable during migration.
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const appUrl = String(process.env.APP_URL || "").replace(/\/$/, "");

  if (!supabaseUrl || !serviceRoleKey || !appUrl) {
    console.error(
      "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY, or APP_URL.",
    );
    return json(response, 500, { error: "Vendor applications are temporarily unavailable." });
  }

  const authorization = request.headers.authorization || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken || accessToken === authorization) {
    return json(response, 401, { error: "Please sign in before requesting an application link." });
  }

  try {
    // Resolve the email from the verified Supabase session; never trust an
    // address supplied by the browser for this privileged email operation.
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return json(response, 401, { error: "Your session has expired. Please sign in again." });
    }

    const user = await userResponse.json();
    if (!user.email) {
      return json(response, 400, { error: "Your account does not have an email address." });
    }

    // Supabase sends the existing user a one-time Magic Link. create_user is
    // disabled so this endpoint cannot be used to create arbitrary accounts.
    const emailResponse = await fetch(`${supabaseUrl}/auth/v1/otp`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        create_user: false,
        gotrue_meta_security: {},
        options: {
          // Supabase's implicit auth flow uses the URL fragment for session
          // tokens, so keep our application destination in the query string.
          email_redirect_to: `${appUrl}/?vendor_application=1`,
        },
      }),
    });

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text();
      console.error("Supabase vendor-link email failed:", emailResponse.status, errorBody);

      // Supabase's built-in email sender has a strict project-wide rate limit.
      // The caller's identity was already verified from their access token
      // above, so a rate-limited user can safely continue in this session.
      if (emailResponse.status === 429) {
        return json(response, 200, {
          canContinue: true,
          emailSent: false,
          message:
            "Email sending is temporarily limited. Your account is verified, so you can continue the vendor application below.",
        });
      }

      return json(response, 502, { error: "Unable to send the application link right now." });
    }

    return json(response, 200, {
      canContinue: false,
      emailSent: true,
      message: "Application link sent. Check your email.",
    });
  } catch (error) {
    console.error("Vendor application start failed:", error);
    return json(response, 500, { error: "Unable to send the application link right now." });
  }
};
