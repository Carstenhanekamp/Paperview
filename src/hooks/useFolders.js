import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadAllChats,
  loadAllAgentChats,
  saveChat,
  saveAgentChat,
  deleteAgentChat,
  deleteChatsByPaperIds,
  saveFolderHandle,
  loadFolderHandles,
  clearFolderHandles,
  saveAnnotation,
  loadAllAnnotations,
  deleteAnnotationsByPaperIds,
  deletePaperCachesByPaperIds,
  saveUploadedPdf,
} from '../db';
import { validatePdfBytes } from '../pdfUtils';
import { AGENT_IMPORTS_FOLDER_NAME, UPLOADS_FOLDER_ID, UPLOADS_FOLDER_NAME } from '../constants';
import { fetchWithCorsProxy } from '../openaiResponseParsing';
import {
  stripPdfExtension,
  normalizeAgentSourceUrl,
  buildAgentImportKey,
  isManualPdfFetchError,
  buildManualPdfFetchMessage,
} from '../agentSources';
import {
  makeStableId,
  ensurePdfFileName,
  buildFolderPath,
  mergeFoldersByRoot,
} from '../miscUtils';

export function useFolders({
  folders,
  setFolders,
  selectedFolderId,
  setSelectedFolderId,
  setOpenTabs,
  setActiveTabId,
  activeTabId,
  setCurrentView,
  setChatThreads,
  setAgentThreads,
  agentThreadsRef,
  activeAgentChat,
  setActiveAgentChatId,
  setAgentInput,
  setSelectedAgentPaperIds,
  setAnnotations,
  evictPaperPayload,
  setAgentImportStates,
  selectedRootFolderId,
  hasWritableAgentContext,
  openAgentPaper,
  setUpFolder,
}) {
  const [newFolder, setNewFolder] = useState(false);
  const [nfName, setNfName] = useState("");
  const [folderError, setFolderError] = useState("");

  const scanDirHandleRef = useRef(null);
  const folderHandlesMapRef = useRef(new Map()); // folderId → root FileSystemDirectoryHandle
  const foldersRef = useRef([]);
  const syncRootFolderSnapshotRef = useRef(null);
  const folderRefreshStateRef = useRef({ rootFolderId: null, lastRunAt: 0 });

  useEffect(() => { foldersRef.current = folders; }, [folders]);

  const toggleFolder = (id) => setFolders((p) => p.map((f) => (f.id === id ? { ...f, expanded: !f.expanded } : f)));

  const createFolder = () => {
    const name = nfName.trim();
    if (!name) {
      setFolderError("Folder name is required.");
      return;
    }
    if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      setFolderError("A folder with this name already exists.");
      return;
    }

    const newId = `f${Date.now()}`;
    setFolders((p) => [...p, {
      id: newId,
      name,
      expanded: true,
      papers: [],
      depth: 0,
      directoryHandle: null,
      rootHandle: null,
      rootFolderId: newId,
      relativePath: "",
      folderPath: buildFolderPath(name),
    }]);
    setSelectedFolderId(newId);
    setUpFolder(newId);
    setNfName("");
    setFolderError("");
    setNewFolder(false);
  };

  const startNewFolder = () => {
    setNewFolder(true);
    setFolderError("");
    setNfName("");
  };

  const cancelNewFolder = () => {
    setNewFolder(false);
    setFolderError("");
    setNfName("");
  };

  const deletePaper = (folderId, paperId) => {
    const ownerFolder = folders.find((folder) => folder.id === folderId);
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId
          ? { ...f, papers: f.papers.filter((p) => p.id !== paperId) }
          : f
      )
    );
    setOpenTabs((prevTabs) => {
      const nextTabs = prevTabs.filter((t) => t.id !== paperId);
      if (activeTabId === paperId) {
        setActiveTabId(nextTabs[nextTabs.length - 1]?.id || null);
      }
      return nextTabs;
    });
    setChatThreads((prev) => prev.filter((thread) => thread.paperId !== paperId));
    deleteChatsByPaperIds([paperId]).catch(() => {});
    setAnnotations((prev) => prev.filter((a) => a.paperId !== paperId));
    deleteAnnotationsByPaperIds([paperId]).catch(() => {});
    deletePaperCachesByPaperIds([paperId]).catch(() => {});
    evictPaperPayload(paperId);
    if (ownerFolder?.rootFolderId) {
      syncRootFolderSnapshotRef.current?.(ownerFolder.rootFolderId)?.catch(() => {});
    }
  };

  const deleteFolder = (folderId) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    const isRootFolder = folder.rootFolderId === folder.id;
    const foldersToRemove = folders.filter((candidate) => {
      if (candidate.rootFolderId !== folder.rootFolderId) return false;
      if (isRootFolder) return true;
      return candidate.id === folderId || candidate.relativePath.startsWith(`${folder.relativePath}/`);
    });
    const folderIdsToRemove = new Set(foldersToRemove.map((item) => item.id));
    const ids = new Set(foldersToRemove.flatMap((item) => item.papers.map((paper) => paper.id)));
    const remainingFolders = folders.filter((f) => !folderIdsToRemove.has(f.id));
    setFolders(remainingFolders);
    if (selectedFolderId === folderId) {
      const replacementFolder = remainingFolders[0] || null;
      setSelectedFolderId(replacementFolder?.id || null);
      setUpFolder(replacementFolder?.id || "");
    }
    setOpenTabs((prevTabs) => {
      const nextTabs = prevTabs.filter((t) => !ids.has(t.id));
      if (ids.has(activeTabId)) {
        setActiveTabId(nextTabs[nextTabs.length - 1]?.id || null);
      }
      return nextTabs;
    });
    setChatThreads((prev) => prev.filter((thread) => !ids.has(thread.paperId)));
    deleteChatsByPaperIds([...ids]).catch(() => {});
    if (isRootFolder) {
      const threadsToDelete = agentThreadsRef.current.filter((thread) => thread.rootFolderId === folder.rootFolderId);
      setAgentThreads((prev) => prev.filter((thread) => thread.rootFolderId !== folder.rootFolderId));
      threadsToDelete.forEach((thread) => deleteAgentChat(thread.id).catch(() => {}));
      if (activeAgentChat?.rootFolderId === folder.rootFolderId) {
        setActiveAgentChatId(null);
        setAgentInput("");
        setSelectedAgentPaperIds([]);
      }
    }
    setAnnotations((prev) => prev.filter((a) => !ids.has(a.paperId)));
    deleteAnnotationsByPaperIds([...ids]).catch(() => {});
    deletePaperCachesByPaperIds([...ids]).catch(() => {});
    [...ids].forEach((paperId) => evictPaperPayload(paperId));
    if (!remainingFolders.length) clearFolderHandles().catch(() => {});
    if (!isRootFolder && folder.rootFolderId) {
      syncRootFolderSnapshotRef.current?.(folder.rootFolderId)?.catch(() => {});
    }
  };

  const scanDirHandle = async (dirHandle) => {
    const rootFolderPath = buildFolderPath(dirHandle.name);
    const rootFolderId = makeStableId('f', rootFolderPath);

    async function scanDir(handle, relativePath = "", depth = 0) {
      const folderName = relativePath.split("/").filter(Boolean).pop() || handle.name;
      const folderPath = buildFolderPath(dirHandle.name, relativePath);
      const folderId = makeStableId('f', folderPath);
      const folder = {
        id: folderId,
        name: folderName,
        expanded: true,
        papers: [],
        depth,
        directoryHandle: handle,
        rootHandle: dirHandle,
        rootFolderId,
        relativePath,
        folderPath,
      };
      const nested = [];

      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
          folder.papers.push({
            id: makeStableId('p', `${folderPath}/${entry.name}`),
            name: stripPdfExtension(entry.name),
            authors: '',
            year: '',
            pages: null,
            fileSize: null,
            fileLastModified: null,
            textStatus: "idle",
            textProgress: 0,
            textError: null,
            textStatusText: "",
            fileHandle: entry,
            folderId,
            rootFolderId,
          });
        } else if (entry.kind === 'directory') {
          const childRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          const children = await scanDir(entry, childRelativePath, depth + 1);
          if (children.length) nested.push(...children);
        }
      }

      return [folder, ...nested];
    }

    return scanDir(dirHandle, '', 0);
  };
  scanDirHandleRef.current = scanDirHandle;

  // Read .paperview.json from a folder's root directory handle
  const readFolderSnapshot = async (dirHandle) => {
    try {
      const fileHandle = await dirHandle.getFileHandle('.paperview.json');
      const file = await fileHandle.getFile();
      return JSON.parse(await file.text());
    } catch {
      return null;
    }
  };

  // Write .paperview.json to a folder's root directory handle
  const syncRootFolderSnapshot = async (rootFolderId) => {
    if (!rootFolderId) return;
    const rootFolder = foldersRef.current.find((folder) => folder.id === rootFolderId && folder.rootFolderId === rootFolderId);
    const dirHandle = rootFolder?.rootHandle || rootFolder?.directoryHandle;
    if (!dirHandle) return;
    try {
      const paperIds = new Set();
      for (const folder of foldersRef.current) {
        if (folder.rootFolderId === rootFolderId) {
          for (const paper of folder.papers) paperIds.add(paper.id);
        }
      }
      const allChats = await loadAllChats();
      const chats = allChats.filter((t) => paperIds.has(t.paperId));
      const allAgentChats = await loadAllAgentChats();
      const agentChats = allAgentChats.filter((thread) => thread.rootFolderId === rootFolderId);
      const allAnns = await loadAllAnnotations();
      const annotations = allAnns.filter((a) => paperIds.has(a.paperId));
      const fileHandle = await dirHandle.getFileHandle('.paperview.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify({
        version: 2,
        exportedAt: new Date().toISOString(),
        chats,
        agentChats,
        annotations,
      }, null, 2));
      await writable.close();
    } catch (err) {
      console.warn('Paperview: could not write .paperview.json:', err);
    }
  };
  syncRootFolderSnapshotRef.current = syncRootFolderSnapshot;

  // Merge a snapshot's chats and annotations into state + IndexedDB
  const applyFolderSnapshot = async (snapshot) => {
    if (!snapshot) return;
    if (snapshot.chats?.length) {
      for (const chat of snapshot.chats) await saveChat(chat).catch(() => {});
      setChatThreads((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const incoming = snapshot.chats.filter((c) => !existingIds.has(c.id));
        return [...incoming, ...prev].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      });
    }
    if (snapshot.agentChats?.length) {
      for (const thread of snapshot.agentChats) await saveAgentChat(thread).catch(() => {});
      setAgentThreads((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const incoming = snapshot.agentChats.filter((thread) => !existingIds.has(thread.id));
        return [...incoming, ...prev].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      });
    }
    if (snapshot.annotations?.length) {
      // Save to IndexedDB; they'll be loaded per-paper when the paper is opened
      for (const ann of snapshot.annotations) await saveAnnotation(ann).catch(() => {});
    }
  };

  // Restore previously opened folders from IndexedDB (runs after scanDirHandle is defined)
  useEffect(() => {
    if (!scanDirHandleRef.current) return;
    loadFolderHandles().then(async (entries) => {
      if (!entries.length) return;
      const allFolders = [];
      for (const entry of entries) {
        const handle = entry.handle;
        if (!handle) continue;
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const req = await handle.requestPermission({ mode: 'readwrite' });
          if (req !== 'granted') continue;
        }
        try {
          const scanned = await scanDirHandleRef.current(handle);
          for (const f of scanned) folderHandlesMapRef.current.set(f.id, handle);
          const snapshot = await readFolderSnapshot(handle);
          if (snapshot) await applyFolderSnapshot(snapshot);
          allFolders.push(...scanned);
        } catch { /* folder may no longer exist */ }
      }
      if (allFolders.length) {
        setFolders(allFolders);
        setSelectedFolderId(allFolders[0]?.id || null);
        setUpFolder(allFolders[0]?.id || '');
      }
    }).catch(() => {});
  }, []);

  const getAvailablePdfFileName = useCallback(async (dirHandle, desiredFileName) => {
    const safeFileName = ensurePdfFileName(desiredFileName);
    const stem = stripPdfExtension(safeFileName);
    let attempt = 0;

    while (attempt < 1000) {
      const candidate = attempt === 0 ? safeFileName : `${stem} (${attempt}).pdf`;
      try {
        await dirHandle.getFileHandle(candidate);
        attempt += 1;
      } catch {
        return candidate;
      }
    }

    throw new Error("Could not find an available filename for this import.");
  }, []);

  const ensureImportedFolder = useCallback(async (rootFolderId) => {
    const rootFolder = foldersRef.current.find((folder) => folder.id === rootFolderId && folder.rootFolderId === rootFolderId);
    if (!rootFolder?.rootHandle) {
      throw new Error("Open a writable Paperview folder before importing papers.");
    }

    const selectedWritableFolder = foldersRef.current.find(
      (folder) => folder.id === selectedFolderId && folder.rootFolderId === rootFolderId && folder.directoryHandle
    );
    if (selectedWritableFolder) {
      return selectedWritableFolder;
    }

    const existingImportedFolder = foldersRef.current.find(
      (folder) => folder.rootFolderId === rootFolderId && folder.relativePath === AGENT_IMPORTS_FOLDER_NAME
    );
    if (existingImportedFolder?.directoryHandle) {
      return existingImportedFolder;
    }

    const directoryHandle = await rootFolder.rootHandle.getDirectoryHandle(AGENT_IMPORTS_FOLDER_NAME, { create: true });
    const folderPath = buildFolderPath(rootFolder.name, AGENT_IMPORTS_FOLDER_NAME);
    const nextFolder = {
      id: makeStableId('f', folderPath),
      name: AGENT_IMPORTS_FOLDER_NAME,
      expanded: true,
      papers: existingImportedFolder?.papers || [],
      depth: 1,
      directoryHandle,
      rootHandle: rootFolder.rootHandle,
      rootFolderId,
      relativePath: AGENT_IMPORTS_FOLDER_NAME,
      folderPath,
    };

    folderHandlesMapRef.current.set(nextFolder.id, rootFolder.rootHandle);
    setFolders((prev) => {
      const existingIndex = prev.findIndex((folder) => folder.id === nextFolder.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], ...nextFolder };
        return next;
      }
      const rootIndex = prev.findIndex((folder) => folder.id === rootFolderId);
      if (rootIndex === -1) return [...prev, nextFolder];
      const next = [...prev];
      next.splice(rootIndex + 1, 0, nextFolder);
      return next;
    });

    return nextFolder;
  }, [selectedFolderId]);

  const importPaperResult = useCallback(async (result, messageId) => {
    const importKey = buildAgentImportKey(messageId, result);
    setAgentImportStates((prev) => ({ ...prev, [importKey]: { status: "loading", label: "Importing PDF..." } }));

    try {
      const pdfUrl = normalizeAgentSourceUrl(result?.pdfUrl || "");
      if (!pdfUrl) {
        throw new Error("No direct PDF URL is available for this result.");
      }

      const response = await fetchWithCorsProxy(pdfUrl);
      if (!response.ok) {
        throw new Error(`PDF download failed (${response.status}).`);
      }

      const fileBuffer = await response.arrayBuffer();
      const pdfBytes = new Uint8Array(fileBuffer);
      await validatePdfBytes(pdfBytes);

      const rootFolderId = activeAgentChat?.rootFolderId || selectedRootFolderId;
      if (!rootFolderId) {
        throw new Error("Open Agent (or a folder) before importing papers.");
      }

      // Browser / upload-only workspace: keep PDF in IndexedDB and the Uploads folder.
      if (!hasWritableAgentContext || rootFolderId === UPLOADS_FOLDER_ID) {
        const uploadsId = UPLOADS_FOLDER_ID;
        const paperId = `p${Date.now()}`;
        const fileName = ensurePdfFileName(result?.title || "Imported paper");
        await saveUploadedPdf({
          paperId,
          pdfBytes,
          fileSize: pdfBytes.byteLength,
          fileLastModified: Date.now(),
          updatedAt: Date.now(),
        });

        const paper = {
          id: paperId,
          name: stripPdfExtension(fileName),
          authors: Array.isArray(result?.authors) ? result.authors.join(", ") : "",
          year: result?.year || "",
          pages: null,
          size: `${(pdfBytes.byteLength / 1024 / 1024).toFixed(1)} MB`,
          fileSize: pdfBytes.byteLength,
          fileLastModified: Date.now(),
          textStatus: "idle",
          textProgress: 0,
          textError: null,
          textStatusText: "",
          folderId: uploadsId,
          rootFolderId: uploadsId,
        };

        setFolders((prev) => {
          const existing = prev.find((folder) => folder.id === uploadsId);
          if (existing) {
            return prev.map((folder) => (
              folder.id === uploadsId
                ? {
                    ...folder,
                    expanded: true,
                    papers: folder.papers.some((item) => item.id === paper.id)
                      ? folder.papers
                      : [...folder.papers, paper],
                  }
                : folder
            ));
          }
          return [
            ...prev,
            {
              id: uploadsId,
              name: UPLOADS_FOLDER_NAME,
              expanded: true,
              papers: [paper],
              depth: 0,
              directoryHandle: null,
              rootHandle: null,
              rootFolderId: uploadsId,
              relativePath: "",
              folderPath: buildFolderPath(UPLOADS_FOLDER_NAME),
            },
          ];
        });
        setSelectedFolderId(uploadsId);
        setUpFolder(uploadsId);
        setAgentImportStates((prev) => ({
          ...prev,
          [importKey]: { status: "done", label: `Saved to ${UPLOADS_FOLDER_NAME}` },
        }));
        openAgentPaper(paper);
        return;
      }

      const targetFolder = await ensureImportedFolder(rootFolderId);
      const fileName = await getAvailablePdfFileName(targetFolder.directoryHandle, result?.title || "Imported paper");
      const fileHandle = await targetFolder.directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBytes);
      await writable.close();

      const savedFile = await fileHandle.getFile();
      const paper = {
        id: makeStableId('p', `${targetFolder.folderPath}/${fileName}`),
        name: stripPdfExtension(fileName),
        authors: Array.isArray(result?.authors) ? result.authors.join(", ") : "",
        year: result?.year || "",
        pages: null,
        size: `${(savedFile.size / 1024 / 1024).toFixed(1)} MB`,
        fileSize: savedFile.size,
        fileLastModified: savedFile.lastModified,
        textStatus: "idle",
        textProgress: 0,
        textError: null,
        textStatusText: "",
        fileHandle,
        folderId: targetFolder.id,
        rootFolderId,
      };

      setFolders((prev) => prev.map((folder) => (
        folder.id === targetFolder.id
          ? {
              ...folder,
              expanded: true,
              papers: folder.papers.some((existing) => existing.id === paper.id)
                ? folder.papers
                : [...folder.papers, paper],
            }
          : folder
      )));
      setSelectedFolderId(targetFolder.id);
      setUpFolder(targetFolder.id);
      setAgentImportStates((prev) => ({ ...prev, [importKey]: { status: "done", label: `Saved to ${targetFolder.name}` } }));
      openAgentPaper(paper);
    } catch (error) {
      const message = isManualPdfFetchError(error?.message)
        ? buildManualPdfFetchMessage(result?.title || "This paper")
        : (error?.message || "Import failed.");
      setAgentImportStates((prev) => ({
        ...prev,
        [importKey]: { status: "error", label: message },
      }));
    }
  }, [activeAgentChat?.rootFolderId, ensureImportedFolder, getAvailablePdfFileName, hasWritableAgentContext, openAgentPaper, selectedRootFolderId, setAgentImportStates, setSelectedFolderId, setUpFolder]);

  const refreshRootFolderContents = useCallback(async (rootFolderId) => {
    if (!rootFolderId || !scanDirHandleRef.current) {
      throw new Error("Open a writable Paperview folder first.");
    }

    const rootFolder = foldersRef.current.find((folder) => folder.id === rootFolderId && folder.rootFolderId === rootFolderId);
    const dirHandle = rootFolder?.rootHandle || rootFolder?.directoryHandle;
    if (!dirHandle) {
      throw new Error("This workspace folder is not currently available.");
    }

    const scannedFolders = await scanDirHandleRef.current(dirHandle);
    for (const folder of scannedFolders) {
      folderHandlesMapRef.current.set(folder.id, dirHandle);
    }
    const snapshot = await readFolderSnapshot(dirHandle);
    if (snapshot) await applyFolderSnapshot(snapshot);

    setFolders((prev) => mergeFoldersByRoot(prev, scannedFolders, rootFolderId));

    const selectedInRoot = foldersRef.current.find((folder) => folder.id === selectedFolderId)?.rootFolderId === rootFolderId
      ? selectedFolderId
      : null;
    const nextSelectedFolder = scannedFolders.find((folder) => folder.id === selectedInRoot) || scannedFolders[0] || null;
    setSelectedFolderId(nextSelectedFolder?.id || null);
    setUpFolder(nextSelectedFolder?.id || "");
    return scannedFolders;
  }, [selectedFolderId]);

  useEffect(() => {
    if (!selectedRootFolderId || !hasWritableAgentContext) return undefined;

    const maybeRefresh = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      const lastRun = folderRefreshStateRef.current;
      if (lastRun.rootFolderId === selectedRootFolderId && now - lastRun.lastRunAt < 2500) return;
      folderRefreshStateRef.current = { rootFolderId: selectedRootFolderId, lastRunAt: now };
      refreshRootFolderContents(selectedRootFolderId).catch(() => {});
    };

    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [hasWritableAgentContext, refreshRootFolderContents, selectedRootFolderId]);

  const handleOpenFolder = async () => {
    if (typeof window.showDirectoryPicker !== 'function') return;
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const flatFolders = await scanDirHandle(dirHandle);
      const rootFolderId = flatFolders[0]?.rootFolderId || null;
      for (const f of flatFolders) folderHandlesMapRef.current.set(f.id, dirHandle);
      const snapshot = await readFolderSnapshot(dirHandle);
      if (snapshot) await applyFolderSnapshot(snapshot);
      setFolders((prev) => (
        rootFolderId ? mergeFoldersByRoot(prev, flatFolders, rootFolderId) : prev
      ));
      setSelectedFolderId(flatFolders[0]?.id || null);
      setUpFolder(flatFolders[0]?.id || '');
      setCurrentView('library');
      saveFolderHandle(dirHandle).catch(() => {});
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Open folder failed:', err);
    }
  };

  return {
    folders,
    setFolders,
    foldersRef,
    selectedFolderId,
    setSelectedFolderId,
    newFolder,
    nfName,
    setNfName,
    folderError,
    setFolderError,
    folderHandlesMapRef,
    scanDirHandleRef,
    syncRootFolderSnapshotRef,
    toggleFolder,
    createFolder,
    startNewFolder,
    cancelNewFolder,
    deletePaper,
    deleteFolder,
    scanDirHandle,
    readFolderSnapshot,
    syncRootFolderSnapshot,
    applyFolderSnapshot,
    refreshRootFolderContents,
    getAvailablePdfFileName,
    ensureImportedFolder,
    importPaperResult,
    handleOpenFolder,
  };
}
