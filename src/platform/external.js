import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "./runtime";

export async function openExternalUrl(value) {
  const url = String(value || "").trim();
  if (!/^https?:\/\//i.test(url)) return;
  if (isTauri()) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
