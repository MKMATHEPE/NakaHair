const {
  consumeRateLimit,
  getAuthenticatedUser,
  getConfig,
  json,
  rateLimitKey,
} = require("../../../lib/supabase-server");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed." });
  }

  const appUrl = String(process.env.APP_URL || "").replace(/\/$/, "");

  let parsedAppUrl;
  try {
    parsedAppUrl = new URL(appUrl);
  } catch {
    parsedAppUrl = null;
  }
  const safeAppUrl = parsedAppUrl
    && (parsedAppUrl.protocol === "https:"
      || (parsedAppUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedAppUrl.hostname)));
  if (!safeAppUrl) {
    console.error(
      "APP_URL must be HTTPS (or local HTTP during development).",
    );
    return json(response, 500, { error: "Vendor applications are temporarily unavailable." });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return json(response, 401, { error: "Your session has expired. Please sign in again." });
    }
    if (!user.email) {
      return json(response, 400, { error: "Your account does not have an email address." });
    }
    const allowed = await consumeRateLimit(
      rateLimitKey(request, "vendor-application-link", user.id),
      3,
      15 * 60,
    );
    if (!allowed) {
      return json(response, 429, { error: "Please wait before requesting another application link." });
    }

    const { url: supabaseUrl, key: serviceRoleKey } = getConfig();

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
          email_redirect_to: `${parsedAppUrl.origin}/account/vendor?vendor_application=1`,
        },
      }),
      signal: AbortSignal.timeout(8000),
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
