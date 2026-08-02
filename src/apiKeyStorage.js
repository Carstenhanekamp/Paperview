import {
  LEGACY_STORAGE_NAME,
  REMEMBERED_STORAGE_NAME,
  KDF_ITERATION_COUNT,
} from './constants';

export function getRememberedApiKeyRecord() {
  try {
    const raw = localStorage.getItem(REMEMBERED_STORAGE_NAME);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.version !== 1 ||
      parsed?.algorithm !== "AES-GCM" ||
      parsed?.kdf !== "PBKDF2-SHA-256" ||
      !parsed?.salt ||
      !parsed?.iv ||
      !parsed?.ciphertext
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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

export function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
}

export function base64ToBytes(value) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveApiKeyStorageKey(passphrase, salt) {
  const cryptoApi = window.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error("Encrypted key storage requires Web Crypto support.");
  }
  const encoder = new TextEncoder();
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: KDF_ITERATION_COUNT,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function rememberApiKeyEncrypted(valueToEncrypt, passphrase) {
  const cryptoApi = window.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error("Encrypted key storage requires Web Crypto support.");
  }
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveApiKeyStorageKey(passphrase, salt);
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(valueToEncrypt),
  );
  const record = {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: KDF_ITERATION_COUNT,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  // This persists only encrypted ciphertext plus non-secret decryption metadata.
  localStorage.setItem(REMEMBERED_STORAGE_NAME, JSON.stringify(record));
  clearLegacyStoredApiKey();
}

export async function unlockRememberedApiKey(passphrase) {
  const record = getRememberedApiKeyRecord();
  if (!record) {
    throw new Error("No remembered API key was found on this device.");
  }
  const salt = base64ToBytes(record.salt);
  const iv = base64ToBytes(record.iv);
  const key = await deriveApiKeyStorageKey(passphrase, salt);
  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64ToBytes(record.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}
