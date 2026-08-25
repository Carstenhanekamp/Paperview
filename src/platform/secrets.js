import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./runtime";

export function usesNativeKeychain() {
  return isTauri();
}

export async function loadNativeApiKey() {
  if (!usesNativeKeychain()) return null;
  return invoke("keychain_get");
}

export async function saveNativeApiKey(value) {
  if (!usesNativeKeychain()) return;
  await invoke("keychain_set", { value });
}

export async function deleteNativeApiKey() {
  if (!usesNativeKeychain()) return;
  await invoke("keychain_delete");
}
