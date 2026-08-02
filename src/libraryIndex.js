const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do',
  'that','this','these','those','from','into','about','than','then','also',
]);

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function chunkPageTexts(pageTexts = [], { maxChars = 1200 } = {}) {
  const chunks = [];
  for (const entry of pageTexts || []) {
    const pageNum = Number(entry?.page) || 1;
    const text = String(entry?.text || '').trim();
    if (!text) continue;
    if (text.length <= maxChars) {
      chunks.push({ pageNum, text });
      continue;
    }
    let start = 0;
    while (start < text.length) {
      const end = Math.min(text.length, start + maxChars);
      chunks.push({ pageNum, text: text.slice(start, end).trim() });
      start = end;
    }
  }
  return chunks;
}

export function cosineSimilarity(a = [], b = []) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function lexicalScore(queryTokens, text) {
  if (!queryTokens.length) return 0;
  const hay = new Set(tokenize(text));
  let hits = 0;
  for (const t of queryTokens) {
    if (hay.has(t)) hits += 1;
  }
  return hits / queryTokens.length;
}

export async function embedTexts(apiKey, texts, { signal } = {}) {
  const inputs = (texts || []).map((t) => String(t || '').slice(0, 6000)).filter(Boolean);
  if (!inputs.length) return [];

  const body = {
    model: 'text-embedding-3-small',
    input: inputs,
  };

  const tryProxy = async () => {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['x-openai-api-key'] = apiKey;
    const res = await fetch('/api/openai-embeddings', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    const raw = await res.text();
    const looksLikeAppShell = contentType.includes('text/html') && /<!doctype html|<html/i.test(raw);
    if (res.ok && !looksLikeAppShell) {
      const json = JSON.parse(raw);
      return (json?.data || []).map((d) => d.embedding);
    }
    if (!looksLikeAppShell && !apiKey) {
      throw new Error(raw || 'Embedding request failed');
    }
    return null;
  };

  try {
    const proxied = await tryProxy();
    if (proxied) return proxied;
  } catch (err) {
    if (!apiKey) throw err;
  }

  if (!apiKey) {
    throw new Error('No OpenAI API key is configured for embeddings.');
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const json = await res.json();
  return (json?.data || []).map((d) => d.embedding);
}

export function buildChunkRecords({
  paperId,
  folderId,
  pageTexts,
  embeddings = [],
}) {
  const chunks = chunkPageTexts(pageTexts);
  return chunks.map((chunk, index) => ({
    id: `${paperId}:${chunk.pageNum}:${index}`,
    paperId,
    folderId: folderId || '',
    pageNum: chunk.pageNum,
    text: chunk.text,
    embedding: embeddings[index] || null,
    updatedAt: Date.now(),
  }));
}

/**
 * Rank papers/chunks for a library query.
 * Combines embedding cosine (when available) with lexical overlap on title/authors/text.
 */
export function searchLibraryIndex({
  query,
  chunks = [],
  papersById = {},
  metaById = {},
  foldersById = {},
  queryEmbedding = null,
  limit = 12,
} = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const queryTokens = tokenize(q);
  const byPaper = new Map();

  for (const chunk of chunks) {
    const paper = papersById[chunk.paperId];
    if (!paper) continue;
    const meta = metaById[chunk.paperId];
    const title = meta?.title || paper.name || '';
    const authors = Array.isArray(meta?.authors) ? meta.authors.join(' ') : String(paper.authors || '');
    const lexical =
      lexicalScore(queryTokens, chunk.text) * 0.7 +
      lexicalScore(queryTokens, `${title} ${authors}`) * 1.2;
    let semantic = 0;
    if (queryEmbedding && Array.isArray(chunk.embedding) && chunk.embedding.length) {
      semantic = cosineSimilarity(queryEmbedding, chunk.embedding);
    }
    const score = semantic * 0.75 + lexical * 0.55;
    if (score <= 0.05 && lexical <= 0) continue;

    const prev = byPaper.get(chunk.paperId);
    if (!prev || score > prev.score) {
      const folder = foldersById[chunk.folderId] || foldersById[paper.folderId];
      byPaper.set(chunk.paperId, {
        paperId: chunk.paperId,
        paper,
        folderId: paper.folderId || chunk.folderId,
        folderName: folder?.name || '',
        pageNum: chunk.pageNum,
        snippet: chunk.text.slice(0, 220),
        score,
      });
    }
  }

  // Also score papers that only have biblio meta (no chunks yet)
  for (const paper of Object.values(papersById)) {
    if (byPaper.has(paper.id)) continue;
    const meta = metaById[paper.id];
    const title = meta?.title || paper.name || '';
    const authors = Array.isArray(meta?.authors) ? meta.authors.join(' ') : String(paper.authors || '');
    const score = lexicalScore(queryTokens, `${title} ${authors} ${meta?.doi || ''}`);
    if (score <= 0) continue;
    const folder = foldersById[paper.folderId];
    byPaper.set(paper.id, {
      paperId: paper.id,
      paper,
      folderId: paper.folderId,
      folderName: folder?.name || '',
      pageNum: null,
      snippet: title,
      score: score * 0.8,
    });
  }

  return [...byPaper.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Rank paper IDs for corpus pre-retrieval (cross-paper Q&A). */
export function rankPapersForQuery({
  query,
  chunks,
  papersById,
  metaById,
  foldersById,
  queryEmbedding,
  paperIds = null,
  limit = 8,
} = {}) {
  const allowed = paperIds ? new Set(paperIds) : null;
  const hits = searchLibraryIndex({
    query,
    chunks: allowed ? chunks.filter((c) => allowed.has(c.paperId)) : chunks,
    papersById,
    metaById,
    foldersById,
    queryEmbedding,
    limit: limit * 2,
  });
  const filtered = allowed ? hits.filter((h) => allowed.has(h.paperId)) : hits;
  return filtered.slice(0, limit);
}
