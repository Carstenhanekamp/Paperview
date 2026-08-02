const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/gi;
const ARXIV_RE = /\barXiv:\s*(\d{4}\.\d{4,5})(?:v\d+)?\b/i;
const CROSSREF_UA = 'Paperview/0.1 (mailto:paperview@localhost; local-first PDF reader)';

export function extractDoiFromText(text) {
  const matches = String(text || '').match(DOI_RE);
  if (!matches?.length) return '';
  return matches[0].replace(/[.,;:]+$/, '').toLowerCase();
}

export function extractArxivIdFromText(text) {
  const m = String(text || '').match(ARXIV_RE);
  return m ? m[1] : '';
}

/** Parse arXiv ids from filenames like 2506.08872v2.pdf */
export function extractArxivIdFromFilename(fileName) {
  const stem = String(fileName || '').replace(/\.pdf$/i, '').trim();
  const m = stem.match(/^(\d{4}\.\d{4,5})(v\d+)?$/i);
  if (!m) return '';
  return m[1];
}

/** Heuristic title from the first non-empty lines of page 1. */
export function extractTitleCandidate(pageTexts = [], fileName = '') {
  const firstPage = Array.isArray(pageTexts)
    ? String(pageTexts.find((p) => Number(p?.page) === 1)?.text || pageTexts[0]?.text || '')
    : '';
  const lines = firstPage
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 8 && l.length <= 220)
    .filter((l) => !/^(abstract|introduction|contents|doi:|arxiv)/i.test(l))
    .filter((l) => !extractDoiFromText(l));

  if (lines[0]) return lines[0];
  return String(fileName || '')
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

export function authorsToArray(authors) {
  if (Array.isArray(authors)) {
    return authors.map((a) => String(a || '').trim()).filter(Boolean);
  }
  const raw = String(authors || '').trim();
  if (!raw) return [];
  return raw
    .split(/\s+and\s+|;\s*|,\s*(?=[A-Z])/g)
    .map((a) => a.trim())
    .filter(Boolean);
}

export function formatAuthorsLine(authors, max = 3) {
  const list = authorsToArray(authors);
  if (!list.length) return '';
  if (list.length <= max) return list.join(', ');
  return `${list.slice(0, max).join(', ')} et al.`;
}

export function isPlaceholderAuthor(authors) {
  const line = formatAuthorsLine(authors).toLowerCase();
  return !line || line === 'uploaded' || line === 'unknown';
}

export function displayPaperTitle(paper, meta) {
  const title = String(meta?.title || paper?.title || '').trim();
  if (title) return title;
  return String(paper?.name || 'Untitled').trim();
}

function mapCrossrefWork(work) {
  if (!work) return null;
  const title = Array.isArray(work.title) ? work.title[0] : work.title;
  const authors = (work.author || [])
    .map((a) => [a.given, a.family].filter(Boolean).join(' ').trim() || a.name || '')
    .filter(Boolean);
  const year =
    work.published?.['date-parts']?.[0]?.[0] ||
    work['published-print']?.['date-parts']?.[0]?.[0] ||
    work['published-online']?.['date-parts']?.[0]?.[0] ||
    work.created?.['date-parts']?.[0]?.[0] ||
    '';
  const venue = Array.isArray(work['container-title'])
    ? work['container-title'][0]
    : work['container-title'] || '';
  const doi = String(work.DOI || work.doi || '').toLowerCase();
  return {
    title: String(title || '').trim(),
    authors,
    year: year ? String(year) : '',
    doi,
    venue: String(venue || '').trim(),
    source: 'crossref',
  };
}

export async function fetchCrossrefByDoi(doi, { signal } = {}) {
  const cleaned = String(doi || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  if (!cleaned) return null;
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleaned)}`, {
    headers: { Accept: 'application/json', 'User-Agent': CROSSREF_UA },
    signal,
  });
  if (!res.ok) return null;
  const json = await res.json();
  return mapCrossrefWork(json?.message);
}

export async function fetchCrossrefByQuery(query, { signal } = {}) {
  const q = String(query || '').trim();
  if (q.length < 8) return null;
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=1`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': CROSSREF_UA },
    signal,
  });
  if (!res.ok) return null;
  const json = await res.json();
  const work = json?.message?.items?.[0];
  return mapCrossrefWork(work);
}

/**
 * Build enriched meta from page text + optional CrossRef.
 * Always returns at least a filename-based title.
 */
export async function enrichPaperMetaFromText({
  paperId,
  fileName,
  pageTexts,
  signal,
} = {}) {
  const sample = (pageTexts || [])
    .slice(0, 2)
    .map((p) => p?.text || '')
    .join('\n');
  const doi = extractDoiFromText(sample);
  const arxivId = extractArxivIdFromText(sample);
  const titleCandidate = extractTitleCandidate(pageTexts, fileName);

  let enriched = null;
  if (doi) {
    try {
      enriched = await fetchCrossrefByDoi(doi, { signal });
    } catch {
      enriched = null;
    }
  }
  if (!enriched && titleCandidate) {
    try {
      enriched = await fetchCrossrefByQuery(titleCandidate, { signal });
    } catch {
      enriched = null;
    }
  }

  if (enriched?.title) {
    return {
      paperId,
      title: enriched.title,
      authors: enriched.authors || [],
      year: enriched.year || '',
      doi: enriched.doi || doi || '',
      venue: enriched.venue || '',
      arxivId: arxivId || '',
      source: 'crossref',
      updatedAt: Date.now(),
    };
  }

  return {
    paperId,
    title: titleCandidate || String(fileName || '').replace(/\.pdf$/i, ''),
    authors: [],
    year: '',
    doi: doi || '',
    venue: '',
    arxivId: arxivId || '',
    source: doi || arxivId ? 'filename' : 'filename',
    updatedAt: Date.now(),
  };
}

function escapeBibtex(value) {
  return String(value || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[{}]/g, (c) => `\\${c}`);
}

function bibtexKey(meta, paper) {
  const author = authorsToArray(meta?.authors)[0] || 'anon';
  const last = author.split(/\s+/).pop().replace(/[^A-Za-z]/g, '') || 'anon';
  const year = meta?.year || 'nd';
  const titleWord = String(meta?.title || paper?.name || 'paper')
    .split(/\s+/)
    .find((w) => w.length > 3)
    ?.replace(/[^A-Za-z]/g, '')
    ?.toLowerCase() || 'paper';
  return `${last.toLowerCase()}${year}${titleWord}`;
}

export function toBibtexEntry(meta, paper) {
  const title = displayPaperTitle(paper, meta);
  const authors = authorsToArray(meta?.authors);
  const authorField = authors.length ? authors.join(' and ') : 'Unknown';
  const year = meta?.year || '';
  const doi = meta?.doi || '';
  const venue = meta?.venue || '';
  const key = bibtexKey(meta, paper);
  const type = doi || venue ? 'article' : 'misc';
  const lines = [
    `@${type}{${key},`,
    `  title = {${escapeBibtex(title)}},`,
    `  author = {${escapeBibtex(authorField)}},`,
  ];
  if (year) lines.push(`  year = {${escapeBibtex(year)}},`);
  if (venue) lines.push(`  journal = {${escapeBibtex(venue)}},`);
  if (doi) lines.push(`  doi = {${escapeBibtex(doi)}},`);
  lines.push(`  note = {${escapeBibtex(paper?.name || '')}}`);
  lines.push('}');
  return lines.join('\n');
}

export function exportPapersBibtex(papers, metaById) {
  return papers
    .map((paper) => toBibtexEntry(metaById?.[paper.id] || null, paper))
    .join('\n\n');
}

const META_AI_SCHEMA_HINT = `{
  "title": "string",
  "authors": ["string"],
  "year": "string or empty",
  "doi": "string or empty",
  "venue": "journal or conference or empty",
  "arxivId": "string like 2506.08872 or empty",
  "abstract": "short abstract or empty"
}`;

/**
 * Ask the model to extract bibliographic fields from the first pages of a paper.
 */
export async function extractMetaWithAI({
  apiKey,
  model,
  fileName,
  pageTexts,
  requestOpenAIResponse,
  extractResponseOutputText,
  sanitizeJsonNewlines,
  signal,
} = {}) {
  const sample = (pageTexts || [])
    .slice(0, 3)
    .map((p) => `--- Page ${p.page || ''} ---\n${String(p.text || '').slice(0, 4500)}`)
    .join('\n\n')
    .slice(0, 14000);

  if (!sample.trim()) {
    throw new Error('No extracted text available yet. Open the PDF once so Paperview can scan it, then try again.');
  }

  const data = await requestOpenAIResponse(
    apiKey,
    {
      model,
      max_output_tokens: 900,
      text: { format: { type: 'json_object' } },
      instructions: `You extract bibliographic metadata from academic PDF text.
Return ONLY a JSON object matching this schema:
${META_AI_SCHEMA_HINT}
Rules:
- Prefer the paper's real title over the filename.
- Authors should be full names when present.
- doi should be bare (no https://doi.org/).
- arxivId should be like 2506.08872 without the arXiv: prefix when present.
- Use empty string / [] when unknown. Do not invent DOIs or venues.`,
      input: [
        {
          role: 'user',
          content: `Extract bibliographic metadata as a JSON object for this paper.

Filename: ${fileName || 'unknown.pdf'}

Paper text (first pages):
${sample}`,
        },
      ],
    },
    { signal }
  );

  const raw = extractResponseOutputText(data) || '';
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      parsed = JSON.parse(sanitizeJsonNewlines(raw));
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI did not return usable metadata JSON.');
  }

  const arxivFromName = extractArxivIdFromFilename(fileName);
  const doi = String(parsed.doi || extractDoiFromText(sample) || '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim();
  const arxivId =
    String(parsed.arxivId || '')
      .replace(/^arxiv:/i, '')
      .trim() ||
    extractArxivIdFromText(sample) ||
    arxivFromName;

  return {
    title: String(parsed.title || '').trim() || extractTitleCandidate(pageTexts, fileName),
    authors: authorsToArray(parsed.authors),
    year: String(parsed.year || '').trim(),
    doi,
    venue: String(parsed.venue || '').trim(),
    arxivId,
    abstract: String(parsed.abstract || '').trim(),
    source: 'ai',
  };
}

