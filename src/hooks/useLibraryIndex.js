import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadAllPaperChunks,
  replacePaperChunks,
  deletePaperChunks,
} from '../db';
import {
  buildChunkRecords,
  chunkPageTexts,
  embedTexts,
  searchLibraryIndex,
} from '../libraryIndex';
import { derivePageTexts } from '../chatUtils';

export function useLibraryIndex({
  folders,
  metaById,
  apiKey,
  activePaper,
  getPaperPayload,
}) {
  const [chunks, setChunks] = useState([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const indexJobsRef = useRef(new Map());
  const chunksRef = useRef([]);

  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  useEffect(() => {
    loadAllPaperChunks()
      .then((rows) => setChunks(rows || []))
      .catch(() => {});
  }, []);

  const papersById = useMemo(() => {
    const map = {};
    for (const folder of folders || []) {
      for (const paper of folder.papers || []) {
        map[paper.id] = { ...paper, folderId: paper.folderId || folder.id };
      }
    }
    return map;
  }, [folders]);

  const foldersById = useMemo(() => {
    const map = {};
    for (const folder of folders || []) map[folder.id] = folder;
    return map;
  }, [folders]);

  const indexPaper = useCallback(
    async (paper, { force = false } = {}) => {
      if (!paper?.id) return;
      if (!force && chunksRef.current.some((c) => c.paperId === paper.id && c.embedding?.length)) {
        return;
      }
      if (indexJobsRef.current.has(paper.id)) return indexJobsRef.current.get(paper.id);

      const payload = getPaperPayload?.(paper.id);
      const pageTexts = derivePageTexts({ ...paper, ...(payload || {}) });
      if (!pageTexts.length) return;

      const job = (async () => {
        try {
          const textChunks = chunkPageTexts(pageTexts);
          let embeddings = [];
          if (apiKey || import.meta.env.VITE_OPENAI_API_KEY) {
            try {
              embeddings = await embedTexts(
                apiKey,
                textChunks.map((c) => c.text)
              );
            } catch {
              embeddings = [];
            }
          }
          const records = buildChunkRecords({
            paperId: paper.id,
            folderId: paper.folderId || '',
            pageTexts,
            embeddings,
          });
          await replacePaperChunks(paper.id, records);
          setChunks((prev) => [...prev.filter((c) => c.paperId !== paper.id), ...records]);
        } finally {
          indexJobsRef.current.delete(paper.id);
        }
      })();

      indexJobsRef.current.set(paper.id, job);
      return job;
    },
    [apiKey, getPaperPayload]
  );

  useEffect(() => {
    if (!activePaper?.id) return;
    const payload = getPaperPayload?.(activePaper.id);
    const pageTexts = derivePageTexts({ ...activePaper, ...(payload || {}) });
    if (!pageTexts.length) return;
    indexPaper(activePaper).catch(() => {});
  }, [activePaper?.id, activePaper?.pageTexts, activePaper?.fullText, getPaperPayload, indexPaper]);

  const removePaperFromIndex = useCallback(async (paperId) => {
    if (!paperId) return;
    await deletePaperChunks(paperId).catch(() => {});
    setChunks((prev) => prev.filter((c) => c.paperId !== paperId));
  }, []);

  const searchResults = useMemo(() => {
    if (!librarySearch.trim()) return [];
    return searchLibraryIndex({
      query: librarySearch,
      chunks,
      papersById,
      metaById: metaById || {},
      foldersById,
      limit: 12,
    });
  }, [librarySearch, chunks, papersById, metaById, foldersById]);

  const searchCorpus = useCallback(
    async (query, { paperIds = null, limit = 8 } = {}) => {
      let queryEmbedding = null;
      if (apiKey || import.meta.env.VITE_OPENAI_API_KEY) {
        try {
          const [emb] = await embedTexts(apiKey, [query]);
          queryEmbedding = emb || null;
        } catch {
          queryEmbedding = null;
        }
      }
      return searchLibraryIndex({
        query,
        chunks: paperIds ? chunks.filter((c) => paperIds.includes(c.paperId)) : chunks,
        papersById,
        metaById: metaById || {},
        foldersById,
        queryEmbedding,
        limit,
      });
    },
    [apiKey, chunks, papersById, metaById, foldersById]
  );

  return {
    chunks,
    librarySearch,
    setLibrarySearch,
    searchResults,
    indexPaper,
    removePaperFromIndex,
    searchCorpus,
    papersById,
  };
}
