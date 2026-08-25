import {
  createFolderDescriptor,
  createPaperDescriptor,
  joinRelativePath,
} from "./common";

function wrapRoot(handle) {
  return { kind: "web", name: handle.name, handle };
}

function wrapDirectory(handle, relativePath) {
  return { kind: "web", name: handle.name, relativePath, handle };
}

function wrapFile(handle) {
  return { kind: "web", name: handle.name, handle };
}

async function scanDirectory(rootRef, handle, relativePath = "", depth = 0) {
  const directoryRef = wrapDirectory(handle, relativePath);
  const folder = createFolderDescriptor({
    rootName: rootRef.name,
    relativePath,
    depth,
    directoryRef,
    rootRef,
  });
  const nested = [];

  for await (const entry of handle.values()) {
    if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".pdf")) {
      folder.papers.push(createPaperDescriptor({
        fileName: entry.name,
        folder,
        fileRef: wrapFile(entry),
      }));
    } else if (entry.kind === "directory") {
      const childPath = joinRelativePath(relativePath, entry.name);
      nested.push(...await scanDirectory(rootRef, entry, childPath, depth + 1));
    }
  }

  return [withLegacyHandles(folder), ...nested];
}

function withLegacyHandles(folder) {
  return {
    ...folder,
    directoryHandle: folder.directoryRef.handle,
    rootHandle: folder.rootRef.handle,
    papers: folder.papers.map((paper) => ({
      ...paper,
      fileHandle: paper.fileRef.handle,
    })),
  };
}

export const webFileSystem = {
  kind: "web",

  canPickFolder() {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
  },

  async pickRoot() {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    return wrapRoot(handle);
  },

  async restoreRoot(handle) {
    if (!handle) return null;
    const permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      const requested = await handle.requestPermission({ mode: "readwrite" });
      if (requested !== "granted") return null;
    }
    return wrapRoot(handle);
  },

  scanRoot(rootRef) {
    return scanDirectory(rootRef, rootRef.handle);
  },

  async readText(rootRef, relativePath) {
    const fileHandle = await rootRef.handle.getFileHandle(relativePath);
    return (await fileHandle.getFile()).text();
  },

  async writeText(rootRef, relativePath, value) {
    const fileHandle = await rootRef.handle.getFileHandle(relativePath, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(value);
    await writable.close();
  },

  async ensureDirectory(rootRef, relativePath) {
    let handle = rootRef.handle;
    for (const segment of joinRelativePath(relativePath).split("/").filter(Boolean)) {
      handle = await handle.getDirectoryHandle(segment, { create: true });
    }
    return wrapDirectory(handle, joinRelativePath(relativePath));
  },

  async fileExists(directoryRef, fileName) {
    try {
      await directoryRef.handle.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  },

  async writeFile(directoryRef, fileName, bytes) {
    const handle = await directoryRef.handle.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
    const file = await handle.getFile();
    return {
      fileRef: wrapFile(handle),
      size: file.size,
      lastModified: file.lastModified,
    };
  },

  async readFile(fileRef) {
    const file = await fileRef.handle.getFile();
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      size: file.size,
      lastModified: file.lastModified,
    };
  },
};
