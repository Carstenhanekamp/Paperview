import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./runtime";

const OPENAI_ACCOUNT = "openai-api-key";

export function usesNativeKeychain() {
  return isTauri();
}

export async function loadNativeApiKey() {
  if (!usesNativeKeychain()) return null;
  return invoke("keychain_get", { account: OPENAI_ACCOUNT });
}

export async function saveNativeApiKey(value) {
  if (!usesNativeKeychain()) return;
  await invoke("keychain_set", { account: OPENAI_ACCOUNT, value });
}

export async function deleteNativeApiKey() {
  if (!usesNativeKeychain()) return;
  await invoke("keychain_delete", { account: OPENAI_ACCOUNT });
}
