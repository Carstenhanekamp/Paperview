import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { isTauri } from "./runtime";

const configuredApiBase = String(import.meta.env.VITE_PAPERVIEW_API_BASE_URL || "").trim();

export function resolveApiEndpoint(endpoint, options = {}) {
  const desktop = options.desktop ?? isTauri();
  const apiBase = String(options.apiBase ?? configuredApiBase).trim().replace(/\/+$/, "");
  if (!desktop) return endpoint;
  if (!apiBase) {
    throw new Error(
      "This desktop build has no hosted API origin. Set VITE_PAPERVIEW_API_BASE_URL when building Paperview."
    );
  }
  return new URL(endpoint, `${apiBase}/`).toString();
}

export function fetchExternal(input, init) {
  return isTauri() ? tauriFetch(input, init) : globalThis.fetch(input, init);
}

export function fetchHostedApi(endpoint, init) {
  const resolved = resolveApiEndpoint(endpoint);
  return isTauri() ? tauriFetch(resolved, init) : globalThis.fetch(resolved, init);
}
