import { isTauri } from "../runtime";
import { tauriFileSystem } from "./tauri";
import { webFileSystem } from "./web";

export function getFileSystem() {
  return isTauri() ? tauriFileSystem : webFileSystem;
}

export async function readPaperFile(paper) {
  const fileRef = paper?.fileRef
    || (paper?.fileHandle ? { kind: "web", handle: paper.fileHandle, name: paper.fileHandle.name } : null);
  if (!fileRef) return null;
  return (fileRef.kind === "tauri" ? tauriFileSystem : webFileSystem).readFile(fileRef);
}

export { serializeDesktopRoot } from "./common";
