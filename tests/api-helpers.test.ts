import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ApiError,
  normalizedEmail,
  readJsonObject,
  requiredString,
} from "../lib/server/api";

describe("server API helpers", () => {
  it("accepts a bounded JSON object", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ name: "NAKA" }),
    });

    await expect(readJsonObject(request)).resolves.toEqual({ name: "NAKA" });
  });

  it("rejects non-JSON and oversized bodies", async () => {
    await expect(readJsonObject(new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    }))).rejects.toMatchObject({ status: 415, code: "unsupported_media_type" });

    await expect(readJsonObject(new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "too long" }),
    }), 8)).rejects.toMatchObject({ status: 413, code: "payload_too_large" });
  });

  it("normalizes validated values without leaking implementation errors", () => {
    expect(normalizedEmail(" Person@Example.COM ")).toBe("person@example.com");
    expect(requiredString("  Premium Hair  ", "Name", 30)).toBe("Premium Hair");
    expect(() => requiredString("", "Name", 30)).toThrow(ApiError);
  });
});
