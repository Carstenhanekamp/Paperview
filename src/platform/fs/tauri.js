import { basename, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  stat,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import {
  buildFileNameCandidate,
  createFolderDescriptor,
  createPaperDescriptor,
  joinRelativePath,
} from "./common";

async function wrapRoot(path, knownName = "") {
  return {
    kind: "tauri",
    path,
    name: knownName || await basename(path),
  };
}

async function scanDirectory(rootRef, directoryPath, relativePath = "", depth = 0) {
  const directoryRef = {
    kind: "tauri",
    path: directoryPath,
    name: relativePath.split("/").filter(Boolean).pop() || rootRef.name,
    relativePath,
  };
  const folder = createFolderDescriptor({
    rootName: rootRef.name,
    rootIdentity: rootRef.path,
    relativePath,
    depth,
    directoryRef,
    rootRef,
  });
  const nested = [];
  const entries = await readDir(directoryPath);

  for (const entry of entries) {
    if (entry.isSymlink) continue;
    const entryPath = await join(directoryPath, entry.name);
    if (entry.isFile && entry.name.toLowerCase().endsWith(".pdf")) {
      folder.papers.push(createPaperDescriptor({
        fileName: entry.name,
        folder,
        fileRef: { kind: "tauri", path: entryPath, name: entry.name },
      }));
    } else if (entry.isDirectory) {
      const childPath = joinRelativePath(relativePath, entry.name);
      nested.push(...await scanDirectory(rootRef, entryPath, childPath, depth + 1));
    }
  }

  return [folder, ...nested];
}

export const tauriFileSystem = {
  kind: "tauri",

  canPickFolder() {
    return true;
  },

  async pickRoot() {
    const selected = await open({
      title: "Open a Paperview folder",
      directory: true,
      multiple: false,
      recursive: true,
      canCreateDirectories: true,
      fileAccessMode: "scoped",
    });
    if (!selected || Array.isArray(selected)) return null;
    return wrapRoot(selected);
  },

  async restoreRoot(record) {
    if (!record?.path || !await exists(record.path)) return null;
    return wrapRoot(record.path, record.name);
  },

  scanRoot(rootRef) {
    return scanDirectory(rootRef, rootRef.path);
  },

  async readText(rootRef, relativePath) {
    return readTextFile(await join(rootRef.path, joinRelativePath(relativePath)));
  },

  async writeText(rootRef, relativePath, value) {
    await writeTextFile(await join(rootRef.path, joinRelativePath(relativePath)), value);
  },

  async ensureDirectory(rootRef, relativePath) {
    const normalizedPath = joinRelativePath(relativePath);
    const path = await join(rootRef.path, normalizedPath);
    await mkdir(path, { recursive: true });
    return {
      kind: "tauri",
      path,
      name: normalizedPath.split("/").pop(),
      relativePath: normalizedPath,
    };
  },

  async fileExists(directoryRef, fileName) {
    return exists(await join(directoryRef.path, fileName));
  },

  async writeFile(directoryRef, fileName, bytes) {
    const path = await join(directoryRef.path, fileName);
    await writeFile(path, bytes);
    const info = await stat(path);
    return {
      fileRef: { kind: "tauri", path, name: fileName },
      size: info.size,
      lastModified: info.mtime?.getTime() ?? Date.now(),
    };
  },

  async writeUniqueFile(directoryRef, desiredFileName, bytes) {
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const fileName = buildFileNameCandidate(desiredFileName, attempt);
      const path = await join(directoryRef.path, fileName);
      if (await exists(path)) continue;
      try {
        await writeFile(path, bytes, { createNew: true });
        const info = await stat(path);
        return {
          fileName,
          fileRef: { kind: "tauri", path, name: fileName },
          size: info.size,
          lastModified: info.mtime?.getTime() ?? Date.now(),
        };
      } catch (error) {
        if (/already exists|file exists|os error 17/i.test(String(error?.message || error))) {
          continue;
        }
        throw error;
      }
    }
    throw new Error("Could not find an available filename for this import.");
  },

  async readFile(fileRef) {
    const [bytes, info] = await Promise.all([readFile(fileRef.path), stat(fileRef.path)]);
    return {
      bytes,
      size: info.size,
      lastModified: info.mtime?.getTime() ?? Date.now(),
    };
  },
};
