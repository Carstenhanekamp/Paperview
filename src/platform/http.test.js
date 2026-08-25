import { describe, expect, it } from "vitest";
import { resolveApiEndpoint } from "./http";

describe("desktop API endpoint selection", () => {
  it("keeps relative endpoints on the web", () => {
    expect(resolveApiEndpoint("/api/openai-response", { desktop: false })).toBe("/api/openai-response");
  });

  it("resolves desktop requests against the configured hosted origin", () => {
    expect(resolveApiEndpoint("/api/fetch-pdf?url=x", {
      desktop: true,
      apiBase: "https://paperview.example/",
    })).toBe("https://paperview.example/api/fetch-pdf?url=x");
  });

  it("fails closed when a desktop wallet endpoint is not configured", () => {
    expect(() => resolveApiEndpoint("/api/openai-response", {
      desktop: true,
      apiBase: "",
    })).toThrow("VITE_PAPERVIEW_API_BASE_URL");
  });
});
