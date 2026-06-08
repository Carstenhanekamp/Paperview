// Encrypted API key storage using Web Crypto (PBKDF2 + AES-GCM).
// Extracted from PaperviewApp.jsx so SettingsModal can import it independently.

const LEGACY_STORAGE_NAME = "pv-api-key";
const REMEMBERED_STORAGE_NAME = "pv-api-key-v2";
const KDF_ITERATION_COUNT = 250000;

function getRememberedApiKeyRecord() {
  try {
    const raw = localStorage.getItem(REMEMBERED_STORAGE_NAME);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.version !== 1 ||
      parsed?.algorithm !== "AES-GCM" ||
      parsed?.kdf !== "PBKDF2-SHA-256" ||
      !parsed?.salt || !parsed?.iv || !parsed?.ciphertext
    ) return null;
    return parsed;
  } catch { return null; }
}

export function hasRememberedApiKey() {
  return Boolean(getRememberedApiKeyRecord());
}

export function clearLegacyStoredApiKey() {
  try { localStorage.removeItem(LEGACY_STORAGE_NAME); } catch { /* ignore */ }
}

export function clearRememberedApiKey() {
  try { localStorage.removeItem(REMEMBERED_STORAGE_NAME); } catch { /* ignore */ }
  clearLegacyStoredApiKey();
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
}

function base64ToBytes(value) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase, salt) {
  const subtle = window.crypto?.subtle;
  if (!subtle) throw new Error("Encrypted key storage requires Web Crypto support.");
  const keyMaterial = await subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: KDF_ITERATION_COUNT, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function rememberApiKeyEncrypted(value, passphrase) {
  const crypto = window.crypto;
  if (!crypto?.subtle) throw new Error("Encrypted key storage requires Web Crypto support.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  const record = {
    version: 1, algorithm: "AES-GCM", kdf: "PBKDF2-SHA-256",
    iterations: KDF_ITERATION_COUNT,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  localStorage.setItem(REMEMBERED_STORAGE_NAME, JSON.stringify(record));
  clearLegacyStoredApiKey();
}

export async function unlockRememberedApiKey(passphrase) {
  const record = getRememberedApiKeyRecord();
  if (!record) throw new Error("No remembered API key was found on this device.");
  const salt = base64ToBytes(record.salt);
  const iv = base64ToBytes(record.iv);
  const key = await deriveKey(passphrase, salt);
  const plaintext = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBytes(record.ciphertext));
  return new TextDecoder().decode(plaintext);
}
