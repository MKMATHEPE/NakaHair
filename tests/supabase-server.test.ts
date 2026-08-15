import { describe, expect, it } from "vitest";

import { serviceHeaders } from "../lib/supabase-server";

describe("Supabase server headers", () => {
  it("sends modern secret keys only through the apikey header", () => {
    expect(serviceHeaders("sb_secret_test")).toEqual({
      apikey: "sb_secret_test",
      "Content-Type": "application/json",
    });
  });

  it("keeps bearer authorization for legacy service-role keys", () => {
    expect(serviceHeaders("legacy-service-role-key")).toEqual({
      apikey: "legacy-service-role-key",
      Authorization: "Bearer legacy-service-role-key",
      "Content-Type": "application/json",
    });
  });
});
