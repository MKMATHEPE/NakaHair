import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { runLegacyHandler } from "../lib/legacy-route-adapter";

function request(url: string, init: RequestInit = {}) {
  const nativeRequest = new Request(url, init);
  return {
    method: nativeRequest.method,
    headers: nativeRequest.headers,
    nextUrl: new URL(nativeRequest.url),
    text: () => nativeRequest.text(),
  } as NextRequest;
}

describe("runLegacyHandler", () => {
  it("adapts JSON bodies, query parameters, headers, and responses", async () => {
    const response = await runLegacyHandler(
      request("https://example.test/api/items?id=42", {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "NAKA" }),
      }),
      async (legacyRequest, legacyResponse) => {
        expect(legacyRequest.method).toBe("POST");
        expect(legacyRequest.query).toEqual({ id: "42" });
        expect(legacyRequest.headers.authorization).toBe("Bearer test-token");
        expect(legacyRequest.body).toEqual({ name: "NAKA" });
        legacyResponse.status(201).setHeader("X-Test", "passed").end('{"ok":true}');
      },
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-test")).toBe("passed");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("does not attempt to parse a GET body", async () => {
    const response = await runLegacyHandler(
      request("https://example.test/api/items"),
      async (legacyRequest, legacyResponse) => {
        expect(legacyRequest.body).toBeUndefined();
        legacyResponse.status(200).end("[]");
      },
    );

    await expect(response.json()).resolves.toEqual([]);
  });

  it("rejects request bodies above the compatibility limit", async () => {
    const response = await runLegacyHandler(
      request("https://example.test/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: "x".repeat(3 * 1024 * 1024) }),
      }),
      async (_legacyRequest, legacyResponse) => {
        legacyResponse.status(200).end("should not run");
      },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: "The request is too large.",
      code: "payload_too_large",
    });
  });

  it("rejects mutable requests that are not JSON", async () => {
    const response = await runLegacyHandler(
      request("https://example.test/api/items", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "unsafe input",
      }),
      async (_legacyRequest, legacyResponse) => {
        legacyResponse.status(200).end("should not run");
      },
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ code: "unsupported_media_type" });
  });
});
