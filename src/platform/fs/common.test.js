import { describe, expect, it } from "vitest";
import {
  buildFileNameCandidate,
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

  it("keeps same-named native roots and their papers distinct", () => {
    const makeFolder = (rootIdentity) => createFolderDescriptor({
      rootName: "Papers",
      rootIdentity,
      directoryRef: { kind: "tauri", path: rootIdentity },
      rootRef: { kind: "tauri", path: rootIdentity, name: "Papers" },
    });
    const first = makeFolder("/Users/alice/Papers");
    const second = makeFolder("/Volumes/archive/Papers");

    expect(first.id).not.toBe(second.id);
    expect(first.rootFolderId).not.toBe(second.rootFolderId);
    expect(createPaperDescriptor({
      fileName: "Shared.pdf",
      folder: first,
      fileRef: {},
    }).id).not.toBe(createPaperDescriptor({
      fileName: "Shared.pdf",
      folder: second,
      fileRef: {},
    }).id);
  });

  it("builds collision-safe filename candidates", () => {
    expect(buildFileNameCandidate("Paper.pdf", 0)).toBe("Paper.pdf");
    expect(buildFileNameCandidate("Paper.pdf", 2)).toBe("Paper (2).pdf");
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
