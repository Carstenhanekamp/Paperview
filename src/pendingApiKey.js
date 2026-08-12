/**
 * In-memory handoff for an OpenAI key pasted on /welcome and picked up by the
 * app route on the next client-side navigation.
 *
 * Deliberately NOT sessionStorage: apiKeyStorage.js keeps keys encrypted at
 * rest behind a passphrase, and clearLegacyStoredApiKey() exists specifically
 * to purge plaintext keys from web storage. A key parked in sessionStorage is
 * readable by any script on the origin — including the PDF.js and Tesseract.js
 * bundles we load from a CDN — for the life of the tab.
 *
 * Module state lives as long as the JS context, which covers the SPA navigation
 * from /welcome to /app. A full reload drops it, which is the safe failure:
 * the user is prompted for the key again rather than it lingering at rest.
 */

let pendingApiKey = '';

export function setPendingApiKey(key) {
  pendingApiKey = String(key || '').trim();
}

/** Read and clear. */
export function takePendingApiKey() {
  const key = pendingApiKey;
  pendingApiKey = '';
  return key;
}
