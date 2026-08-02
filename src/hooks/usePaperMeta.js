import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAllPaperMeta, loadPaperTextCache, savePaperMeta } from '../db';
import { OPENAI_MODEL } from '../constants';
import {
  displayPaperTitle,
  extractArxivIdFromFilename,
  extractMetaWithAI,
  enrichPaperMetaFromText,
  exportPapersBibtex,
  fetchCrossrefByDoi,
  formatAuthorsLine,
} from '../biblioUtils';
import { derivePageTexts } from '../chatUtils';
import {
  extractResponseOutputText,
  requestOpenAIResponse,
  sanitizeJsonNewlines,
} from '../openaiResponseParsing';
import { hasExtractedPaperText } from '../miscUtils';

export function usePaperMeta({
  folders,
  activePaper,
  getPaperPayload,
  apiKey,
  selectedModel,
  openSettingsModal,
  startPaperTextExtraction,
}) {
  const [metaById, setMetaById] = useState({});
  const enrichJobsRef = useRef(new Map());
  const aiJobsRef = useRef(new Map());
  const metaByIdRef = useRef({});

  useEffect(() => {
    metaByIdRef.current = metaById;
  }, [metaById]);

  useEffect(() => {
    loadAllPaperMeta()
      .then((rows) => {
        const next = {};
        for (const row of rows || []) {
          if (row?.paperId) next[row.paperId] = row;
        }
        setMetaById(next);
      })
      .catch(() => {});
  }, []);

  const upsertMeta = useCallback((entry) => {
    if (!entry?.paperId) return;
    setMetaById((prev) => ({ ...prev, [entry.paperId]: entry }));
    savePaperMeta(entry).catch(() => {});
  }, []);

  const resolvePageTexts = useCallback(
    async (paper) => {
      const payload = getPaperPayload?.(paper.id);
      let pageTexts = derivePageTexts({ ...paper, ...(payload || {}) });
      if (pageTexts.length) return { paper: { ...paper, ...(payload || {}), pageTexts }, pageTexts };

      const cached = await loadPaperTextCache(paper.id).catch(() => null);
      if (cached?.pageTexts?.length) {
        return { paper: { ...paper, pageTexts: cached.pageTexts }, pageTexts: cached.pageTexts };
      }

      if (typeof startPaperTextExtraction === 'function') {
        const ready = await startPaperTextExtraction(paper);
        pageTexts = derivePageTexts(ready);
        return { paper: ready, pageTexts };
      }

      return { paper, pageTexts: [] };
    },
    [getPaperPayload, startPaperTextExtraction]
  );

  /** Cheap local/CrossRef pass — only when user asks via button, not on open. */
  const enrichPaper = useCallback(
    async (paper) => {
      if (!paper?.id) return null;
      const existing = metaByIdRef.current[paper.id];
      if (existing?.source === 'crossref' && existing?.title) return existing;
      if (enrichJobsRef.current.has(paper.id)) return enrichJobsRef.current.get(paper.id);

      const job = (async () => {
        try {
          const { pageTexts } = await resolvePageTexts(paper);
          if (!pageTexts.length) {
            const arxivId = extractArxivIdFromFilename(paper.name);
            const placeholder = {
              paperId: paper.id,
              title: String(paper.name || '').replace(/\.pdf$/i, ''),
              authors: [],
              year: '',
              doi: '',
              venue: '',
              arxivId,
              source: 'filename',
              updatedAt: Date.now(),
            };
            upsertMeta(placeholder);
            return placeholder;
          }
          const entry = await enrichPaperMetaFromText({
            paperId: paper.id,
            fileName: paper.name,
            pageTexts,
          });
          upsertMeta(entry);
          return entry;
        } catch {
          return metaByIdRef.current[paper.id] || null;
        } finally {
          enrichJobsRef.current.delete(paper.id);
        }
      })();

      enrichJobsRef.current.set(paper.id, job);
      return job;
    },
    [resolvePageTexts, upsertMeta]
  );

  const extractPaperMetaWithAI = useCallback(
    async (paper) => {
      if (!paper?.id) return null;
      if (!apiKey && !import.meta.env.VITE_OPENAI_API_KEY) {
        openSettingsModal?.('');
        throw new Error('Add an OpenAI API key in Settings to extract metadata.');
      }
      if (aiJobsRef.current.has(paper.id)) return aiJobsRef.current.get(paper.id);

      const job = (async () => {
        try {
          let working = paper;
          if (!hasExtractedPaperText(paper) && typeof startPaperTextExtraction === 'function') {
            working = await startPaperTextExtraction(paper);
          }
          const { pageTexts } = await resolvePageTexts(working);
          const extracted = await extractMetaWithAI({
            apiKey,
            model: selectedModel || OPENAI_MODEL,
            fileName: paper.name,
            pageTexts,
            requestOpenAIResponse,
            extractResponseOutputText,
            sanitizeJsonNewlines,
          });

          // Prefer CrossRef when AI found a DOI
          let entry = {
            paperId: paper.id,
            ...extracted,
            updatedAt: Date.now(),
          };
          if (extracted.doi) {
            try {
              const cr = await fetchCrossrefByDoi(extracted.doi);
              if (cr?.title) {
                entry = {
                  ...entry,
                  title: cr.title || entry.title,
                  authors: cr.authors?.length ? cr.authors : entry.authors,
                  year: cr.year || entry.year,
                  venue: cr.venue || entry.venue,
                  doi: cr.doi || entry.doi,
                  source: 'ai+crossref',
                };
              }
            } catch {
              // keep AI result
            }
          }

          upsertMeta(entry);
          return entry;
        } finally {
          aiJobsRef.current.delete(paper.id);
        }
      })();

      aiJobsRef.current.set(paper.id, job);
      return job;
    },
    [apiKey, selectedModel, openSettingsModal, startPaperTextExtraction, resolvePageTexts, upsertMeta]
  );

  const getMeta = useCallback((paperId) => metaById[paperId] || null, [metaById]);

  const getTitle = useCallback(
    (paper) => displayPaperTitle(paper, paper?.id ? metaById[paper.id] : null),
    [metaById]
  );

  const getAuthorsLine = useCallback(
    (paper) => {
      const meta = paper?.id ? metaById[paper.id] : null;
      if (meta?.authors?.length) return formatAuthorsLine(meta.authors);
      const fromPaper = formatAuthorsLine(paper?.authors);
      if (!fromPaper || fromPaper.toLowerCase() === 'uploaded') return '';
      return fromPaper;
    },
    [metaById]
  );

  const exportFolderBibtex = useCallback(
    (folder) => {
      const papers = folder?.papers || [];
      return exportPapersBibtex(papers, metaById);
    },
    [metaById]
  );

  const exportLibraryBibtex = useCallback(() => {
    const papers = (folders || []).flatMap((f) => f.papers || []);
    return exportPapersBibtex(papers, metaById);
  }, [folders, metaById]);

  return {
    metaById,
    getMeta,
    getTitle,
    getAuthorsLine,
    enrichPaper,
    extractPaperMetaWithAI,
    exportFolderBibtex,
    exportLibraryBibtex,
  };
}
