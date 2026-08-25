import { stripPdfExtension } from "../../agentSources";
import { buildFolderPath, makeStableId } from "../../miscUtils";

export function normalizeRelativePath(value = "") {
  const segments = String(value)
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === ".." || segment.includes("\0"))) {
    throw new Error("Invalid relative file path.");
  }
  return segments.join("/");
}

export function joinRelativePath(...parts) {
  return normalizeRelativePath(parts.filter(Boolean).join("/"));
}

export function createFolderDescriptor({
  rootName,
  relativePath = "",
  depth = 0,
  directoryRef,
  rootRef,
  papers = [],
}) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const folderPath = buildFolderPath(rootName, normalizedPath);
  const rootFolderId = makeStableId("f", buildFolderPath(rootName));
  return {
    id: makeStableId("f", folderPath),
    name: normalizedPath.split("/").filter(Boolean).pop() || rootName,
    expanded: true,
    papers,
    depth,
    directoryRef,
    rootRef,
    rootFolderId,
    relativePath: normalizedPath,
    folderPath,
  };
}

export function createPaperDescriptor({ fileName, folder, fileRef }) {
  return {
    id: makeStableId("p", `${folder.folderPath}/${fileName}`),
    name: stripPdfExtension(fileName),
    authors: "",
    year: "",
    pages: null,
    fileSize: null,
    fileLastModified: null,
    textStatus: "idle",
    textProgress: 0,
    textError: null,
    textStatusText: "",
    fileRef,
    folderId: folder.id,
    rootFolderId: folder.rootFolderId,
  };
}

export function serializeDesktopRoot(rootRef) {
  if (rootRef?.kind !== "tauri" || !rootRef.path || !rootRef.name) return null;
  return {
    id: makeStableId("root", rootRef.path),
    kind: "tauri",
    path: rootRef.path,
    name: rootRef.name,
    updatedAt: Date.now(),
  };
}
