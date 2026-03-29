const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall',
  'that','this','these','those','it','its','i','you','he','she','we',
  'they','what','which','who','how','when','where','why','not','by',
  'from','up','about','into','through','than','more','also','can','if',
  'no','so','as','all','just','each','both','any','such','very','then',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function trimExcerpt(text, maxChars, focusIndex = -1) {
  const source = String(text || '').trim();
  if (!source) return '';
  if (source.length <= maxChars) return source;

  if (!Number.isFinite(focusIndex) || focusIndex < 0 || focusIndex >= source.length) {
    return `${source.slice(0, maxChars).trimEnd()} ...`;
  }

  const idealStart = Math.max(0, focusIndex - Math.floor(maxChars * 0.35));
  let start = idealStart;
  let end = Math.min(source.length, start + maxChars);
  if (end - start < maxChars) {
    start = Math.max(0, end - maxChars);
  }

  const prefix = start > 0 ? '... ' : '';
  const suffix = end < source.length ? ' ...' : '';
  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}

function splitIntoCandidatePassages(text, maxChars) {
  const cleaned = String(text || '').replace(/\r/g, '').trim();
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!paragraphs.length) return [cleaned];

  const candidates = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars * 1.35) {
      candidates.push(paragraph);
      continue;
    }

    const sentences = paragraph
      .match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
      ?.map((part) => part.trim())
      .filter(Boolean) || [paragraph];

    let current = '';
    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence}` : sentence;
      if (next.length > maxChars * 1.25 && current) {
        candidates.push(current);
        current = sentence;
      } else {
        current = next;
      }
    }
    if (current) candidates.push(current);
  }

  return candidates.length ? candidates : [cleaned];
}

function scoreTokenOverlap(queryTokens, text) {
  if (!queryTokens.length) return { score: 0, firstHitIndex: -1 };

  const haystack = String(text || '').toLowerCase();
  const tokens = tokenize(text);
  if (!tokens.length) return { score: 0, firstHitIndex: -1 };

  const tokenSet = new Set(tokens);
  let overlap = 0;
  let firstHitIndex = -1;

  for (const token of queryTokens) {
    if (tokenSet.has(token)) {
      overlap += 1;
      const idx = haystack.indexOf(token.toLowerCase());
      if (idx !== -1 && (firstHitIndex === -1 || idx < firstHitIndex)) {
        firstHitIndex = idx;
      }
    }
  }

  return {
    score: overlap / queryTokens.length,
    firstHitIndex,
  };
}

function extractRelevantExcerpt(query, text, maxChars) {
  const source = String(text || '').trim();
  if (!source) return '';

  const queryTokens = tokenize(query);
  if (!queryTokens.length) return trimExcerpt(source, maxChars);

  const candidates = splitIntoCandidatePassages(source, maxChars);
  let bestText = source;
  let bestScore = -1;
  let bestHitIndex = -1;

  for (const candidate of candidates) {
    const { score, firstHitIndex } = scoreTokenOverlap(queryTokens, candidate);
    const lengthPenalty = Math.min(candidate.length / Math.max(maxChars, 1), 1.5) * 0.05;
    const totalScore = score - lengthPenalty;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestText = candidate;
      bestHitIndex = firstHitIndex;
    }
  }

  return trimExcerpt(bestText, maxChars, bestHitIndex);
}

/**
 * Select the most relevant pages from a paper's pageTexts for a given query
 * using TF-IDF keyword overlap scoring.
 *
 * @param {string} query
 * @param {Array<{page: number, text: string}>} pageTexts
 * @param {{ topN?: number, minScore?: number, maxChars?: number }} opts
 * @returns {Array<{page: number, text: string}>} Selected pages in original page order.
 */
export function selectRelevantPages(query, pageTexts, opts = {}) {
  const { topN = 6, minScore = 0.01, maxChars = 30000, pageHint = null } = opts;

  if (!pageTexts?.length) return [];

  const queryTokens = tokenize(query);
  if (!queryTokens.length) {
    // No signal from the query — return first topN pages (abstract/intro)
    return pageTexts.slice(0, topN);
  }

  const queryTermSet = new Set(queryTokens);
  const totalPages = pageTexts.length;

  // Count how many pages contain each query term (for IDF)
  const docFreq = new Map();
  for (const term of queryTermSet) {
    let df = 0;
    for (const { text } of pageTexts) {
      if (tokenize(text).includes(term)) df++;
    }
    docFreq.set(term, df);
  }

  // Score each page with TF-IDF
  const scored = pageTexts.map(({ page, text }) => {
    const tokens = tokenize(text);
    const tfMap = new Map();
    for (const t of tokens) {
      if (queryTermSet.has(t)) tfMap.set(t, (tfMap.get(t) || 0) + 1);
    }
    let score = 0;
    for (const [term, tf] of tfMap) {
      const df = docFreq.get(term) || 0;
      const idf = Math.log((totalPages + 1) / (df + 1));
      score += (tf / Math.max(tokens.length, 1)) * idf;
    }
    if (Number.isFinite(pageHint)) {
      score += 0.15 / (Math.abs(Number(page) - Number(pageHint)) + 1);
    }
    return { page, text, score };
  });

  // Sort by score descending, keep pages above threshold
  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.filter((p) => p.score >= minScore).slice(0, topN);

  // Fallback: if nothing scored well, return first topN pages
  const selected = candidates.length ? candidates : pageTexts.slice(0, topN);

  // Restore original page order so --- Page N --- markers are sequential
  selected.sort((a, b) => a.page - b.page);

  // Apply character budget
  const result = [];
  let chars = 0;
  for (const p of selected) {
    if (chars + p.text.length > maxChars) break;
    result.push(p);
    chars += p.text.length;
  }
  return result;
}

export function selectRelevantPassages(query, pageTexts, opts = {}) {
  const {
    topN = 4,
    minScore = 0.01,
    maxChars = 12000,
    maxExcerptChars = 1200,
    pageHint = null,
  } = opts;

  const candidatePages = selectRelevantPages(query, pageTexts, {
    topN: Math.max(topN * 2, topN),
    minScore,
    maxChars: Number.MAX_SAFE_INTEGER,
    pageHint,
  });

  const result = [];
  let usedChars = 0;

  for (const page of candidatePages) {
    if (result.length >= topN || usedChars >= maxChars) break;
    const excerptBudget = Math.min(maxExcerptChars, Math.max(maxChars - usedChars, 400));
    const excerpt = extractRelevantExcerpt(query, page.text, excerptBudget);
    if (!excerpt) continue;
    result.push({ page: page.page, text: excerpt });
    usedChars += excerpt.length;
  }

  return result;
}
