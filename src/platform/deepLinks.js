import { safeNextPath } from "../profileOnboarding";

export const DESKTOP_AUTH_CALLBACK = "paperview://auth/callback";

export function buildDesktopAuthRedirect({ intent, next } = {}) {
  const url = new URL(DESKTOP_AUTH_CALLBACK);
  if (intent === "founding") url.searchParams.set("intent", "founding");
  const safe = next ? safeNextPath(next, "") : "";
  if (safe) url.searchParams.set("next", safe);
  return url.toString();
}

export function parseDesktopAuthCallback(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "paperview:" || url.hostname !== "auth" || url.pathname !== "/callback") {
      return null;
    }
    const code = url.searchParams.get("code");
    if (!code) return null;
    return {
      code,
      intent: url.searchParams.get("intent") === "founding" ? "founding" : "",
      next: safeNextPath(url.searchParams.get("next"), "/app"),
    };
  } catch {
    return null;
  }
}
