import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { derivePageTexts } from "../chatUtils";

export function useViewerSearch({ activePaper, currentPage, goToPage, resetKey, enabled = true }) {
  const [viewerSearchOpen, setViewerSearchOpen] = useState(false);
  const [viewerSearchQuery, setViewerSearchQuery] = useState("");
  const [viewerSearchStatus, setViewerSearchStatus] = useState("");
  const [viewerSearchMatches, setViewerSearchMatches] = useState([]);
  const [viewerSearchIndex, setViewerSearchIndex] = useState(-1);
  const viewerSearchInputRef = useRef(null);
  const runViewerSearchRef = useRef(null);

  const searchablePageTexts = useMemo(() => derivePageTexts(activePaper), [activePaper]);
  const canRunViewerSearch = Boolean(viewerSearchQuery.trim()) && searchablePageTexts.length > 0;
  const hasViewerSearchResults = viewerSearchMatches.length > 0;

  const clearResults = useCallback(() => {
    setViewerSearchStatus("");
    setViewerSearchMatches([]);
    setViewerSearchIndex(-1);
  }, []);

  const closeViewerSearch = useCallback(() => {
    setViewerSearchOpen(false);
    setViewerSearchQuery("");
    clearResults();
    viewerSearchInputRef.current?.blur();
  }, [clearResults]);

  const openViewerSearch = useCallback(() => {
    setViewerSearchOpen(true);
    requestAnimationFrame(() => {
      const el = viewerSearchInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, []);

  useEffect(() => {
    clearResults();
  }, [resetKey, clearResults]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (e) => {
      const key = e.key?.toLowerCase?.() || "";
      const mod = e.metaKey || e.ctrlKey;

      if (mod && key === "f") {
        e.preventDefault();
        openViewerSearch();
        return;
      }

      if (mod && key === "g") {
        if (!viewerSearchOpen) return;
        e.preventDefault();
        runViewerSearchRef.current?.(e.shiftKey ? -1 : 1);
        return;
      }

      if (key === "escape" && viewerSearchOpen) {
        e.preventDefault();
        closeViewerSearch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, viewerSearchOpen, closeViewerSearch, openViewerSearch]);

  const buildViewerSearchMatches = useCallback((rawQuery) => {
    const q = String(rawQuery || "").trim();
    if (!q || !searchablePageTexts.length) return [];

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isSingleWord = q.split(/\s+/).filter(Boolean).length === 1;
    const pattern = isSingleWord ? `\\b${escaped}\\b` : escaped;
    const re = new RegExp(pattern, "gi");
    const found = [];

    searchablePageTexts.forEach((entry) => {
      const page = Number(entry?.page);
      const text = String(entry?.text || "");
      if (!Number.isFinite(page) || page <= 0 || !text) return;

      let perPageIndex = 0;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        found.push({ page, occurrenceIndex: perPageIndex });
        perPageIndex += 1;
        if (!m[0]?.length) re.lastIndex += 1;
      }
    });

    return found;
  }, [searchablePageTexts]);

  const runViewerSearch = useCallback((direction = 1) => {
    const q = viewerSearchQuery.trim();
    if (!q || !searchablePageTexts.length) {
      setViewerSearchStatus(q ? "No searchable text" : "");
      setViewerSearchMatches([]);
      setViewerSearchIndex(-1);
      return;
    }

    const matches = buildViewerSearchMatches(q);
    setViewerSearchMatches(matches);

    if (!matches.length) {
      setViewerSearchStatus("No matches");
      setViewerSearchIndex(-1);
      return;
    }

    let nextIndex = -1;
    if (viewerSearchIndex >= 0 && viewerSearchIndex < matches.length) {
      const step = direction < 0 ? -1 : 1;
      nextIndex = (viewerSearchIndex + step + matches.length) % matches.length;
    } else if (direction < 0) {
      nextIndex = matches.map((m, idx) => ({ ...m, idx })).reverse().find((m) => m.page <= currentPage)?.idx ?? (matches.length - 1);
    } else {
      nextIndex = matches.findIndex((m) => m.page >= currentPage);
      if (nextIndex === -1) nextIndex = 0;
    }

    const nextMatch = matches[nextIndex];
    setViewerSearchIndex(nextIndex);
    setViewerSearchStatus(`${nextIndex + 1}/${matches.length}`);
    goToPage(nextMatch.page, q, nextMatch.occurrenceIndex);
  }, [viewerSearchQuery, searchablePageTexts, buildViewerSearchMatches, currentPage, viewerSearchIndex, goToPage]);

  useEffect(() => {
    runViewerSearchRef.current = runViewerSearch;
  }, [runViewerSearch]);

  const handleSearchClick = () => {
    if (!viewerSearchOpen) {
      setViewerSearchOpen(true);
      return;
    }
    runViewerSearch(1);
  };

  const setQuery = useCallback((value) => {
    setViewerSearchQuery(value);
    clearResults();
  }, [clearResults]);

  return {
    viewerSearchOpen,
    setViewerSearchOpen,
    openViewerSearch,
    closeViewerSearch,
    viewerSearchQuery,
    setViewerSearchQuery: setQuery,
    viewerSearchStatus,
    setViewerSearchStatus,
    viewerSearchMatches,
    setViewerSearchMatches,
    viewerSearchIndex,
    setViewerSearchIndex,
    viewerSearchInputRef,
    canRunViewerSearch,
    hasViewerSearchResults,
    buildViewerSearchMatches,
    runViewerSearch,
    handleSearchClick,
  };
}
