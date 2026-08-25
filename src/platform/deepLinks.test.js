import { describe, expect, it } from "vitest";
import { buildDesktopAuthRedirect, parseDesktopAuthCallback } from "./deepLinks";

describe("desktop authentication deep links", () => {
  it("builds a custom-scheme callback with a safe next path", () => {
    expect(buildDesktopAuthRedirect({ intent: "founding", next: "/app" }))
      .toBe("paperview://auth/callback?intent=founding&next=%2Fapp");
  });

  it("parses valid callbacks and rejects unrelated or unsafe links", () => {
    expect(parseDesktopAuthCallback(
      "paperview://auth/callback?code=abc&intent=founding&next=%2Fapp"
    )).toEqual({ code: "abc", intent: "founding", next: "/app" });
    expect(parseDesktopAuthCallback("https://example.com/?code=abc")).toBeNull();
    expect(parseDesktopAuthCallback(
      "paperview://auth/callback?code=abc&next=%2F%5Cevil.example"
    )?.next).toBe("/app");
  });
});
