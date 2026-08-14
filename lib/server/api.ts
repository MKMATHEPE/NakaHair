import "server-only";

import { randomUUID } from "node:crypto";

const DEFAULT_BODY_LIMIT = 64 * 1024;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "request_failed",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function readJsonObject(
  request: Request,
  maxBytes = DEFAULT_BODY_LIMIT,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType !== "application/json") {
    throw new ApiError(415, "Send this request as JSON.", "unsupported_media_type");
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) {
    throw new ApiError(413, "The request is too large.", "payload_too_large");
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new ApiError(413, "The request is too large.", "payload_too_large");
  }

  try {
    const body: unknown = text ? JSON.parse(text) : {};
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Expected an object");
    }
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "The request body is not valid JSON.", "invalid_json");
  }
}

export function requiredString(
  value: unknown,
  label: string,
  maxLength: number,
) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new ApiError(400, `${label} is required.`, "validation_error");
  }
  if (normalized.length > maxLength) {
    throw new ApiError(400, `${label} is too long.`, "validation_error");
  }
  return normalized;
}

export function optionalString(value: unknown, label: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maxLength) {
    throw new ApiError(400, `${label} is too long.`, "validation_error");
  }
  return normalized;
}

export function normalizedEmail(value: unknown) {
  const email = requiredString(value, "Email address", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "Enter a valid email address.", "validation_error");
  }
  return email;
}

type ApiHandler = (request: Request, requestId: string) => Promise<Response>;

export function withApiHandler(handler: ApiHandler): (request: Request) => Promise<Response> {
  return async (request) => {
    const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
    const startedAt = performance.now();

    try {
      const response = await handler(request, requestId);
      response.headers.set("x-request-id", requestId);
      response.headers.set("x-content-type-options", "nosniff");
      if (!response.headers.has("cache-control")) {
        response.headers.set("cache-control", "no-store");
      }
      return response;
    } catch (reason) {
      const error = reason instanceof ApiError
        ? reason
        : new ApiError(500, "The request could not be completed.", "internal_error");

      console.error(JSON.stringify({
        event: "api_request_failed",
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status: error.status,
        code: error.code,
        durationMs: Math.round(performance.now() - startedAt),
        error: reason instanceof Error ? reason.message : String(reason),
      }));

      const response = jsonResponse(
        { error: error.message, code: error.code, requestId },
        error.status,
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }
  };
}
