import { describe, expect, it } from "vitest";
import {
  createFolderDescriptor,
  createPaperDescriptor,
  joinRelativePath,
  normalizeRelativePath,
  serializeDesktopRoot,
} from "./common";

describe("platform file references", () => {
  it("normalizes safe relative paths and rejects traversal", () => {
    expect(normalizeRelativePath("\\Papers//2026/")).toBe("Papers/2026");
    expect(joinRelativePath("Papers", "Imported", "paper.pdf")).toBe("Papers/Imported/paper.pdf");
    expect(() => normalizeRelativePath("../Secrets")).toThrow("Invalid relative file path");
  });

  it("creates stable folder and paper descriptors across platforms", () => {
    const rootRef = { kind: "tauri", path: "/Users/test/Papers", name: "Papers" };
    const folder = createFolderDescriptor({
      rootName: "Papers",
      relativePath: "Topic",
      depth: 1,
      directoryRef: { kind: "tauri", path: "/Users/test/Papers/Topic" },
      rootRef,
    });
    const paper = createPaperDescriptor({
      fileName: "Example.pdf",
      folder,
      fileRef: { kind: "tauri", path: "/Users/test/Papers/Topic/Example.pdf" },
    });

    expect(folder.folderPath).toBe("/Papers/Topic");
    expect(paper.name).toBe("Example");
    expect(paper.folderId).toBe(folder.id);
    expect(paper.rootFolderId).toBe(folder.rootFolderId);
  });

  it("serializes only desktop roots", () => {
    const record = serializeDesktopRoot({
      kind: "tauri",
      path: "/Users/test/Papers",
      name: "Papers",
    });
    expect(record).toMatchObject({
      kind: "tauri",
      path: "/Users/test/Papers",
      name: "Papers",
    });
    expect(record.id).toMatch(/^root-/);
    expect(serializeDesktopRoot({ kind: "web", name: "Papers" })).toBeNull();
  });
});
