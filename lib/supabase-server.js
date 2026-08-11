const getConfig = () => {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase server configuration.");
  return { url, key };
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
  });
  if (!result.ok) return null;
  return result.json();
};

const supabaseRest = async (path, options = {}) => {
  const { url, key } = getConfig();
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: serviceHeaders(key, options.headers || {}),
  });
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
  getAccessToken,
  getApprovedVendor,
  getAuthenticatedUser,
  getConfig,
  json,
  serviceHeaders,
  supabaseRest,
};
