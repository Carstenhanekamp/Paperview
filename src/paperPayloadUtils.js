export function materializeFullText(pageTexts = []) {
  if (!Array.isArray(pageTexts) || !pageTexts.length) return '';
  return pageTexts
    .map((entry, index) => {
      const page = Number(entry?.page) || index + 1;
      const text = String(entry?.text || '').trim() || '[No extractable text on this page]';
      return `--- Page ${page} ---\n${text}`;
    })
    .join('\n\n');
}

export function stripPaperPayload(paper) {
  if (!paper || typeof paper !== 'object') return paper;
  const { pdfBytes, pageTexts, fullText, ...rest } = paper;
  return rest;
}

export function pickPaperPayload(paper) {
  if (!paper || typeof paper !== 'object') return null;
  const payload = {};

  if (paper.pdfBytes?.length) payload.pdfBytes = paper.pdfBytes;
  if (Array.isArray(paper.pageTexts) && paper.pageTexts.length) payload.pageTexts = paper.pageTexts;
  if (typeof paper.fullText === 'string' && paper.fullText) payload.fullText = paper.fullText;
  if (Number.isFinite(paper.fileSize)) payload.fileSize = paper.fileSize;
  if (Number.isFinite(paper.fileLastModified)) payload.fileLastModified = paper.fileLastModified;
  if (Number.isFinite(paper.pages)) payload.pages = paper.pages;

  return Object.keys(payload).length ? payload : null;
}

export function mergePaperWithPayload(paper, payload) {
  if (!paper) return null;
  if (!payload) return paper;
  return { ...paper, ...payload };
}

export function evictUnpinnedPayloads(payloadsById, pinnedIds = []) {
  const pinned = new Set(
    Array.isArray(pinnedIds)
      ? pinnedIds.filter(Boolean)
      : [...pinnedIds].filter(Boolean)
  );
  const next = {};

  Object.entries(payloadsById || {}).forEach(([paperId, payload]) => {
    if (pinned.has(paperId)) next[paperId] = payload;
  });

  return next;
}
