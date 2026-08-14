const { createHash } = require("node:crypto");

const UPSTREAM_TIMEOUT_MS = 8000;
let cachedConfig = null;

const getConfig = () => {
  if (cachedConfig) return cachedConfig;
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase server configuration.");
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:") throw new Error("SUPABASE_URL must use HTTPS.");
  cachedConfig = { url, key };
  return cachedConfig;
};

const json = (response, status, body) => {
  response.status(status).setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
};

const serviceHeaders = (key, extra = {}) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  ...extra,
});

const getAccessToken = (request) => {
  const authorization = request.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  return token && token !== authorization ? token : "";
};

const getAuthenticatedUser = async (request) => {
  const token = getAccessToken(request);
  if (!token) return null;
  const { url, key } = getConfig();
  const result = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!result.ok) return null;
  return result.json();
};

const supabaseRest = async (path, options = {}) => {
  const { url, key } = getConfig();
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: serviceHeaders(key, options.headers || {}),
    cache: "no-store",
    signal: options.signal || AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
};

const rateLimitKey = (request, scope, identity = "") => {
  const { key } = getConfig();
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",", 1)[0].trim();
  const address = forwarded || request.headers["x-real-ip"] || "unknown";
  return createHash("sha256")
    .update(`${scope}|${address}|${String(identity).toLowerCase()}|${key}`)
    .digest("hex");
};

const consumeRateLimit = async (key, limit, windowSeconds) => {
  const result = await supabaseRest("rpc/consume_api_rate_limit", {
    method: "POST",
    body: JSON.stringify({
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    }),
  });
  if (result.status === 429) return false;
  if (!result.ok) throw new Error(`Unable to enforce the request limit (${result.status}).`);
  return true;
};

const getApprovedVendor = async (request) => {
  const user = await getAuthenticatedUser(request);
  if (!user?.id) return null;
  const result = await supabaseRest(
    `vendor_requests?select=user_id,business_name,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.approved&limit=1`,
  );
  if (!result.ok) throw new Error(`Unable to verify vendor access (${result.status}).`);
  const rows = await result.json();
  if (!rows[0]) return null;
  return { user, vendor: rows[0] };
};

module.exports = {
  consumeRateLimit,
  getAccessToken,
  getApprovedVendor,
  getAuthenticatedUser,
  getConfig,
  json,
  rateLimitKey,
  serviceHeaders,
  supabaseRest,
};
