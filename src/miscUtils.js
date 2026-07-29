import { derivePageTexts } from './chatUtils';
import { stripPdfExtension } from './agentSources';

export function createChatMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeStableId(prefix, path) {
  let h = 0;
  for (let i = 0; i < path.length; i += 1) {
    h = ((h << 5) - h + path.charCodeAt(i)) | 0;
  }
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

export function hasExtractedPaperText(paper) {
  return derivePageTexts(paper).length > 0;
}

export function isPaperTextCacheValid(cacheEntry, paper) {
  if (!cacheEntry || !paper?.id) return false;
  return (
    cacheEntry.paperId === paper.id &&
    cacheEntry.fileSize === paper.fileSize &&
    cacheEntry.fileLastModified === paper.fileLastModified &&
    Array.isArray(cacheEntry.pageTexts) &&
    Number.isFinite(cacheEntry.totalPages)
  );
}

export function sanitizeFileStem(value) {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned || "Imported paper";
}

export function ensurePdfFileName(value) {
  const stem = sanitizeFileStem(stripPdfExtension(value));
  return `${stem}.pdf`;
}

export function buildFolderPath(rootName, relativePath = "") {
  const normalizedRelative = String(relativePath || "")
    .split("/")
    .filter(Boolean)
    .join("/");
  return normalizedRelative ? `/${rootName}/${normalizedRelative}` : `/${rootName}`;
}

export function getRootFolderNameFromPath(folderPath) {
  return String(folderPath || "").split("/").filter(Boolean)[0] || "";
}

export function mergeFoldersByRoot(prevFolders, nextFolders, rootFolderId) {
  if (!rootFolderId) return [...prevFolders];
  const firstIndex = prevFolders.findIndex((folder) => folder.rootFolderId === rootFolderId);
  const remaining = prevFolders.filter((folder) => folder.rootFolderId !== rootFolderId);
  const insertIndex = firstIndex === -1 ? remaining.length : Math.min(firstIndex, remaining.length);
  const merged = [...remaining];
  merged.splice(insertIndex, 0, ...nextFolders);
  return merged;
}

export function createStoppedError(message = "Request stopped.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function isAbortLikeError(error) {
  return error?.name === "AbortError" || /aborted|aborterror|request stopped/i.test(String(error?.message || ""));
}
