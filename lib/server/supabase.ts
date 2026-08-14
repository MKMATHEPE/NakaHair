import "server-only";

import { createHash } from "node:crypto";

import { ApiError } from "./api";

const UPSTREAM_TIMEOUT_MS = 8_000;

type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type ServerConfig = {
  url: string;
  key: string;
};

let cachedConfig: ServerConfig | undefined;

function serverConfig(): ServerConfig {
  if (cachedConfig) return cachedConfig;

  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "",
  );

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("SUPABASE_URL is not configured correctly.");
  }
  if (parsedUrl.protocol !== "https:" || !key) {
    throw new Error("Supabase server credentials are missing or invalid.");
  }

  cachedConfig = { url, key };
  return cachedConfig;
}

async function upstreamFetch(path: string, init: RequestInit = {}) {
  const { url, key } = serverConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(`${url}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (reason) {
    throw new ApiError(
      503,
      "The data service is temporarily unavailable.",
      reason instanceof DOMException && reason.name === "TimeoutError"
        ? "upstream_timeout"
        : "upstream_unavailable",
    );
  }
}

export async function serviceRequest(path: string, init: RequestInit = {}) {
  const response = await upstreamFetch(`/rest/v1/${path}`, init);
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1_000);
    console.error(JSON.stringify({
      event: "supabase_request_failed",
      path: path.split("?", 1)[0],
      status: response.status,
      detail,
    }));
    throw new ApiError(502, "The data service could not complete the request.", "upstream_error");
  }
  return response;
}

export async function serviceJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await serviceRequest(path, init);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function accessToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || "";
}

export async function requireUser(request: Request): Promise<SupabaseUser> {
  const token = accessToken(request);
  if (!token) {
    throw new ApiError(401, "Please sign in to continue.", "authentication_required");
  }

  const { url, key } = serverConfig();
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(503, "Authentication is temporarily unavailable.", "auth_unavailable");
  }

  if (!response.ok) {
    throw new ApiError(401, "Your session has expired. Please sign in again.", "invalid_session");
  }
  return response.json() as Promise<SupabaseUser>;
}

export async function updateAuthUser(userId: string, attributes: Record<string, unknown>) {
  const response = await upstreamFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify(attributes),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ event: "supabase_auth_update_failed", status: response.status }));
    throw new ApiError(502, "The account could not be updated.", "auth_update_failed");
  }
}

export function rateLimitKey(request: Request, scope: string, identity = "") {
  const { key } = serverConfig();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  const fingerprint = `${scope}|${address}|${identity.toLowerCase()}|${key}`;
  return createHash("sha256").update(fingerprint).digest("hex");
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const response = await upstreamFetch("/rest/v1/rpc/consume_api_rate_limit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_key: key, p_limit: limit, p_window_seconds: windowSeconds }),
  });
  if (response.status === 429) {
    throw new ApiError(429, "Too many requests. Please try again later.", "rate_limited");
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1_000);
    console.error(JSON.stringify({ event: "rate_limit_failed", status: response.status, detail }));
    throw new ApiError(503, "The request cannot be processed right now.", "rate_limit_unavailable");
  }
}
