import type { NextRequest } from "next/server";

type LegacyRequest = {
  method: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
};

type LegacyResponse = {
  statusCode: number;
  headers: Headers;
  body: string;
  status(code: number): LegacyResponse;
  setHeader(name: string, value: string): LegacyResponse;
  end(body?: string): void;
};

type LegacyHandler = (request: LegacyRequest, response: LegacyResponse) => unknown;

const MAX_LEGACY_BODY_BYTES = 3 * 1024 * 1024;

async function requestBody(request: NextRequest) {
  if (["GET", "HEAD"].includes(request.method)) return undefined;
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!contentType && contentLength === 0) return undefined;
  if (contentType !== "application/json") {
    throw new Error("UNSUPPORTED_MEDIA_TYPE");
  }
  if (contentLength > MAX_LEGACY_BODY_BYTES) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_LEGACY_BODY_BYTES) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function runLegacyHandler(request: NextRequest, handler: LegacyHandler) {
  const response: LegacyResponse = {
    statusCode: 200,
    headers: new Headers(),
    body: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers.set(name, value);
      return this;
    },
    end(body = "") {
      this.body = body;
    },
  };

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const headers = Object.fromEntries(request.headers.entries());
  try {
    await handler(
      {
        method: request.method,
        headers,
        body: await requestBody(request),
        query,
      },
      response,
    );
  } catch (reason) {
    if (reason instanceof Error && reason.message === "UNSUPPORTED_MEDIA_TYPE") {
      return Response.json(
        { error: "Send this request as JSON.", code: "unsupported_media_type" },
        { status: 415, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (reason instanceof Error && reason.message === "PAYLOAD_TOO_LARGE") {
      return Response.json(
        { error: "The request is too large.", code: "payload_too_large" },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error(JSON.stringify({
      event: "legacy_api_unhandled_error",
      method: request.method,
      path: request.nextUrl.pathname,
      error: reason instanceof Error ? reason.message : String(reason),
    }));
    return Response.json(
      { error: "The request could not be completed.", code: "internal_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");

  return new Response(response.body, {
    status: response.statusCode,
    headers: response.headers,
  });
}
