export function isTauri() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export function isMacDesktop() {
  return isTauri() && (
    import.meta.env.TAURI_ENV_PLATFORM === "darwin"
    || navigator.userAgent.includes("Macintosh")
  );
}
