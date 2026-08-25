import { useState, useEffect, useCallback, useRef } from 'react';
import { clearOcrMemoryCache, extractPdfText } from '../pdfUtils';
import { loadPaperTextCache, loadUploadedPdf } from '../db';
import { mergePaperWithPayload, stripPaperPayload } from '../paperPayloadUtils';
import { hasExtractedPaperText, isPaperTextCacheValid } from '../miscUtils';
import { materializeFullText } from '../chatUtils';
import { readPaperFile } from '../platform/fs';

export function usePaperPayloads({
  setFolders,
  setOpenTabs,
  activePaperDescriptor,
  activePaperId,
}) {
  const [paperPayloads, setPaperPayloads] = useState({});
  const [paperScanStates, setPaperScanStates] = useState({});
  const paperPayloadsRef = useRef({});
  const paperTextJobsRef = useRef(new Map());

  useEffect(() => { paperPayloadsRef.current = paperPayloads; }, [paperPayloads]);

  const getPaperPayload = useCallback((paperId) => {
    if (!paperId) return null;
    return paperPayloadsRef.current[paperId] || null;
  }, []);

  const updatePaperPayload = useCallback((paperId, updater) => {
    if (!paperId) return;
    setPaperPayloads((prev) => {
      const current = prev[paperId] || null;
      const nextValue = typeof updater === "function" ? updater(current) : updater;
      if (!nextValue) {
        if (!(paperId in prev)) return prev;
        const next = { ...prev };
        delete next[paperId];
        return next;
      }
      return { ...prev, [paperId]: { ...(current || {}), ...nextValue } };
    });
  }, []);

  const mergePaperRecord = useCallback((paper) => mergePaperWithPayload(paper, paper?.id ? paperPayloads[paper.id] : null), [paperPayloads]);

  const evictPaperPayload = useCallback((paperId) => {
    if (!paperId) return;
    clearOcrMemoryCache(paperId);
    setPaperPayloads((prev) => {
      if (!(paperId in prev)) return prev;
      const next = { ...prev };
      delete next[paperId];
      return next;
    });
  }, []);

  const updatePaperEverywhere = useCallback((paperId, transform) => {
    const applyTransform = (paper) => {
      if (paper.id !== paperId) return paper;
      const nextPaper = transform(mergePaperWithPayload(paper, getPaperPayload(paper.id)));
      return stripPaperPayload(nextPaper || paper);
    };
    setFolders((prev) =>
      prev.map((folder) => ({
        ...folder,
        papers: folder.papers.map(applyTransform),
      }))
    );
    setOpenTabs((prev) => prev.map(applyTransform));
  }, [getPaperPayload, setFolders, setOpenTabs]);

  const updatePaperScanState = useCallback((paperId, nextState) => {
    if (!paperId) return;
    setPaperScanStates((prev) => ({
      ...prev,
      [paperId]: {
        ...(prev[paperId] || {}),
        ...nextState,
      },
    }));
  }, []);

  const handlePdfDocumentLoad = useCallback(
    ({ totalPages }) => {
      if (!activePaperId || !Number.isFinite(totalPages) || totalPages <= 0) return;
      updatePaperEverywhere(activePaperId, (current) =>
        current.pages === totalPages ? current : { ...current, pages: totalPages }
      );
    },
    [activePaperId, updatePaperEverywhere]
  );

  const ensurePaperPdfBytes = useCallback(
    async (paper) => {
      const hydrated = mergePaperWithPayload(paper, getPaperPayload(paper?.id));
      if (hydrated?.pdfBytes?.length && Number.isFinite(hydrated?.fileSize) && Number.isFinite(hydrated?.fileLastModified)) {
        return hydrated;
      }

      let uint8 = null;
      let nextFileSize = hydrated?.fileSize ?? null;
      let nextFileLastModified = hydrated?.fileLastModified ?? null;

      if (paper?.fileRef || paper?.fileHandle) {
        const file = await readPaperFile(paper);
        uint8 = file.bytes;
        nextFileSize = file.size;
        nextFileLastModified = file.lastModified;
      } else {
        const storedUpload = await loadUploadedPdf(paper?.id).catch(() => null);
        if (!storedUpload?.pdfBytes?.length) {
          throw new Error(`Could not load "${paper?.name || "paper"}".`);
        }
        uint8 = storedUpload.pdfBytes;
        nextFileSize = storedUpload.fileSize ?? nextFileSize ?? uint8.byteLength;
        nextFileLastModified = storedUpload.fileLastModified ?? nextFileLastModified ?? storedUpload.updatedAt ?? Date.now();
      }

      updatePaperPayload(paper.id, {
        pdfBytes: uint8,
        fileSize: nextFileSize,
        fileLastModified: nextFileLastModified,
      });
      updatePaperEverywhere(paper.id, (current) => ({
        ...current,
        fileSize: nextFileSize,
        fileLastModified: nextFileLastModified,
      }));

      return {
        ...paper,
        pdfBytes: uint8,
        fileSize: nextFileSize,
        fileLastModified: nextFileLastModified,
      };
    },
    [getPaperPayload, updatePaperEverywhere, updatePaperPayload]
  );

  const startPaperTextExtraction = useCallback(
    async (paper) => {
      if (!paper?.id) throw new Error("No paper selected for scanning.");
      const mergedPaper = mergePaperWithPayload(paper, getPaperPayload(paper.id));
      if (hasExtractedPaperText(mergedPaper)) return mergedPaper;

      const existingJob = paperTextJobsRef.current.get(paper.id);
      if (existingJob) return existingJob;

      const job = (async () => {
        const hydratedPaper = await ensurePaperPdfBytes(paper);

        const cachedText = await loadPaperTextCache(paper.id).catch(() => null);
        if (isPaperTextCacheValid(cachedText, hydratedPaper)) {
          const readyPayload = {
            pageTexts: cachedText.pageTexts,
            pages: cachedText.totalPages,
          };
          updatePaperPayload(paper.id, readyPayload);
          updatePaperEverywhere(paper.id, (current) => ({
            ...current,
            pages: cachedText.totalPages,
            textStatus: "ready",
            textProgress: 1,
            textError: null,
            textStatusText: "",
          }));
          updatePaperScanState(paper.id, {
            status: "ready",
            progress: 1,
            currentPage: cachedText.totalPages,
            totalPages: cachedText.totalPages,
            label: "",
          });
          return {
            ...hydratedPaper,
            ...readyPayload,
            fullText: cachedText.fullText || materializeFullText(cachedText.pageTexts),
          };
        }

        updatePaperEverywhere(paper.id, (current) =>
          hasExtractedPaperText(current)
            ? { ...current, textStatus: current.textStatus || "ready", textProgress: 1, textError: null, textStatusText: "" }
            : {
                ...current,
                textStatus: "scanning",
                textProgress: 0,
                textError: null,
                textStatusText: "Scanning paper...",
              }
        );
        updatePaperScanState(paper.id, {
          status: "scanning",
          progress: 0,
          label: "Scanning paper...",
        });

        const { pageTexts, totalPages } = await extractPdfText(hydratedPaper.pdfBytes, {
          paperId: paper.id,
          fileSize: hydratedPaper.fileSize,
          fileLastModified: hydratedPaper.fileLastModified,
          enableOcrFallback: true,
          onProgress: (pageNum, total) => {
            updatePaperEverywhere(paper.id, (current) => ({
              ...current,
              textStatus: "scanning",
              textProgress: total ? pageNum / total : 0,
              textError: null,
              textStatusText: total ? `Scanned ${pageNum}/${total} pages` : "Scanning paper...",
            }));
            updatePaperScanState(paper.id, {
              status: "scanning",
              progress: total ? pageNum / total : 0,
              currentPage: pageNum,
              totalPages: total,
              label: total ? `Scanned ${pageNum}/${total} pages` : "Scanning paper...",
            });
          },
        });

        const readyPayload = {
          pageTexts,
          pages: totalPages,
        };
        updatePaperPayload(paper.id, readyPayload);
        updatePaperEverywhere(paper.id, (current) => ({
          ...current,
          pages: totalPages,
          textStatus: "ready",
          textProgress: 1,
          textError: null,
          textStatusText: "",
        }));
        updatePaperScanState(paper.id, {
          status: "ready",
          progress: 1,
          currentPage: totalPages,
          totalPages,
          label: "",
        });
        return { ...hydratedPaper, ...readyPayload };
      })()
        .catch((error) => {
          updatePaperEverywhere(paper.id, (current) => ({
            ...current,
            textStatus: "error",
            textProgress: 0,
            textError: error?.message || String(error),
            textStatusText: "Scanning failed",
          }));
          updatePaperScanState(paper.id, {
            status: "error",
            progress: 0,
            label: "Scanning failed",
            error: error?.message || String(error),
          });
          throw error;
        })
        .finally(() => {
          paperTextJobsRef.current.delete(paper.id);
        });

      paperTextJobsRef.current.set(paper.id, job);
      return job;
    },
    [ensurePaperPdfBytes, getPaperPayload, updatePaperEverywhere, updatePaperPayload, updatePaperScanState]
  );

  useEffect(() => {
    if (!activePaperDescriptor?.id) return;
    const currentPaper = mergePaperWithPayload(activePaperDescriptor, getPaperPayload(activePaperDescriptor.id));

    if (!currentPaper?.pdfBytes?.length) {
      ensurePaperPdfBytes(activePaperDescriptor).catch((error) => {
        console.error('Failed to hydrate active paper:', error);
      });
    }

    if (!hasExtractedPaperText(currentPaper)) {
      startPaperTextExtraction(activePaperDescriptor).catch(() => {});
    }
  }, [activePaperDescriptor, ensurePaperPdfBytes, getPaperPayload, startPaperTextExtraction]);

  return {
    paperPayloads,
    setPaperPayloads,
    paperPayloadsRef,
    paperScanStates,
    setPaperScanStates,
    paperTextJobsRef,
    getPaperPayload,
    updatePaperPayload,
    mergePaperRecord,
    evictPaperPayload,
    updatePaperEverywhere,
    updatePaperScanState,
    handlePdfDocumentLoad,
    ensurePaperPdfBytes,
    startPaperTextExtraction,
  };
}
