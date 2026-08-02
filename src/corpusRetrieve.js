/**
 * Resolve which papers to hydrate for a chat send given scope + corpus ranking.
 * Keeps eager extraction bounded to top-K (+ pinned attaches).
 */

export const CORPUS_TOP_K = 8;

export function collectPapersInScope({
  scopeMode,
  activePaper,
  activeFolderPapers = [],
  allPapers = [],
  selectedPaperIds = [],
} = {}) {
  if (scopeMode === 'manual') {
    const byId = new Map(allPapers.map((p) => [p.id, p]));
    const selected = selectedPaperIds.map((id) => byId.get(id)).filter(Boolean);
    return selected.length ? selected : activePaper ? [activePaper] : [];
  }
  if (scopeMode === 'folder') {
    return activeFolderPapers.length ? activeFolderPapers : activePaper ? [activePaper] : [];
  }
  if (scopeMode === 'library') {
    return allPapers.length ? allPapers : activePaper ? [activePaper] : [];
  }
  // auto / active
  return activePaper ? [activePaper] : [];
}

/**
 * @param {object} args
 * @param {string} args.query
 * @param {string} args.scopeMode
 * @param {Function} [args.searchCorpus] async (query, { paperIds, limit }) => hits
 * @param {object[]} args.candidatePapers
 * @param {object[]} [args.pinnedPapers] always include
 * @param {number} [args.limit]
 */
export async function resolveContextPapersForQuery({
  query,
  scopeMode,
  searchCorpus,
  candidatePapers = [],
  pinnedPapers = [],
  limit = CORPUS_TOP_K,
} = {}) {
  const pinned = (pinnedPapers || []).filter(Boolean);
  const pinnedIds = new Set(pinned.map((p) => p.id));

  // Active / small manual sets: use as-is (existing behavior)
  if (scopeMode === 'auto' || (scopeMode === 'manual' && candidatePapers.length <= limit)) {
    const merged = [...pinned];
    for (const paper of candidatePapers) {
      if (!pinnedIds.has(paper.id)) merged.push(paper);
    }
    return merged;
  }

  if (typeof searchCorpus !== 'function' || !candidatePapers.length) {
    return [...pinned, ...candidatePapers.filter((p) => !pinnedIds.has(p.id))].slice(0, limit + pinned.length);
  }

  const hits = await searchCorpus(query, {
    paperIds: candidatePapers.map((p) => p.id),
    limit,
  });

  const byId = new Map(candidatePapers.map((p) => [p.id, p]));
  const ranked = [];
  for (const hit of hits || []) {
    const paper = byId.get(hit.paperId) || hit.paper;
    if (!paper || pinnedIds.has(paper.id)) continue;
    ranked.push(paper);
  }

  // If index is empty, fall back to first K candidates (still bounded)
  if (!ranked.length) {
    return [...pinned, ...candidatePapers.filter((p) => !pinnedIds.has(p.id)).slice(0, limit)];
  }

  return [...pinned, ...ranked].slice(0, limit + pinned.length);
}

/** Normalize citation file name → paperId using library papers. */
export function mapCitationFileToPaper(fileName, papers = []) {
  const needle = String(fileName || '').trim().toLowerCase();
  if (!needle) return null;
  const exact = papers.find((p) => String(p.name || '').toLowerCase() === needle);
  if (exact) return exact;
  const withPdf = papers.find((p) => `${String(p.name || '').toLowerCase()}.pdf` === needle);
  if (withPdf) return withPdf;
  return papers.find((p) => needle.includes(String(p.name || '').toLowerCase())) || null;
}
