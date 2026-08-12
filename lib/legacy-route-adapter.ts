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

async function requestBody(request: NextRequest) {
  if (["GET", "HEAD"].includes(request.method)) return undefined;
  const text = await request.text();
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
  await handler(
    {
      method: request.method,
      headers,
      body: await requestBody(request),
      query,
    },
    response,
  );

  return new Response(response.body, {
    status: response.statusCode,
    headers: response.headers,
  });
}
