import { AGENT_WEB_SEARCH_DOMAINS, MAX_FOUND_SOURCES_SHOWN } from './constants';

export function stripPdfExtension(name) {
  return String(name || "").replace(/\.pdf$/i, "");
}

export function isPdfUrl(url) {
  return /\.pdf(?:[?#].*)?$/i.test(String(url || ""));
}

export function normalizeAgentSourceUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function getUrlHost(url) {
  try {
    return new URL(normalizeAgentSourceUrl(url)).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function buildAgentImportKey(messageId, result) {
  return `${messageId}:${result?.id || result?.sourceUrl || result?.title || "result"}`;
}

export function normalizeLookupValue(value) {
  return String(value || "").trim().toLowerCase();
}

export function summarizeToWordLimit(value, maxWords = 20) {
  const words = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return "";
  return words.slice(0, maxWords).join(" ");
}

export function formatSourceAuthors(authors) {
  if (!Array.isArray(authors) || !authors.length) return "";
  if (authors.length <= 4) return authors.join(", ");
  return `${authors.slice(0, 4).join(", ")}, and ${authors.length - 4} more`;
}

export function buildRemotePaperKey(value) {
  const doi = normalizeLookupValue(value?.doi);
  if (doi) return `doi:${doi}`;
  const pdfUrl = normalizeLookupValue(normalizeAgentSourceUrl(value?.pdfUrl || value?.pdf_url || ""));
  if (pdfUrl) return `pdf:${pdfUrl}`;
  const sourceUrl = normalizeLookupValue(normalizeAgentSourceUrl(value?.sourceUrl || value?.source_url || value?.url || ""));
  if (sourceUrl) return `src:${sourceUrl}`;
  const title = normalizeLookupValue(value?.title);
  return title ? `title:${title}` : "";
}

export function getFoundSourceDedupeKey(value) {
  const doi = normalizeLookupValue(value?.doi);
  if (doi) return `doi:${doi}`;
  const pdfUrl = normalizeLookupValue(normalizeAgentSourceUrl(value?.pdfUrl || ""));
  if (pdfUrl) return `pdf:${pdfUrl}`;
  const sourceUrl = normalizeLookupValue(normalizeAgentSourceUrl(value?.sourceUrl || ""));
  if (sourceUrl) return `src:${sourceUrl}`;
  const title = normalizeLookupValue(value?.title);
  return title ? `title:${title}` : "";
}

export function isScholarlyHost(host) {
  const normalizedHost = normalizeLookupValue(host);
  if (!normalizedHost) return false;
  return AGENT_WEB_SEARCH_DOMAINS.some((domain) => (
    normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
  ));
}

export function buildFoundSources({ paperResults = [], webSources = [], remotePapers = [] }) {
  const candidates = [];
  const remoteByKey = new Map(
    remotePapers.map((paper) => [buildRemotePaperKey(paper), paper]).filter(([key]) => key)
  );

  paperResults.forEach((result, index) => {
    const sourceUrl = normalizeAgentSourceUrl(result?.sourceUrl || result?.source_url || result?.url || "");
    const pdfUrl = normalizeAgentSourceUrl(result?.pdfUrl || result?.pdf_url || "");
    const key = buildRemotePaperKey({
      title: result?.title,
      sourceUrl,
      pdfUrl,
      doi: result?.doi,
    });
    const remotePaper = key ? remoteByKey.get(key) : null;
    candidates.push({
      id: result?.id || `found-source-model-${index}`,
      title: String(result?.title || "").trim(),
      authors: Array.isArray(result?.authors) ? result.authors.filter(Boolean) : [],
      year: String(result?.year || "").trim(),
      venue: String(result?.venue || "").trim(),
      summary: summarizeToWordLimit(result?.summary || result?.abstract || ""),
      sourceUrl,
      pdfUrl: isPdfUrl(pdfUrl) ? pdfUrl : "",
      doi: String(result?.doi || "").trim(),
      sourceHost: getUrlHost(sourceUrl || pdfUrl),
      remotePaperId: remotePaper?.id || null,
      hydrationStatus: remotePaper?.hydrationStatus || (pdfUrl ? "available" : "source_only"),
      hydrationError: remotePaper?.hydrationError || "",
      hasPdf: Boolean(pdfUrl),
      modelRank: index,
      sourceRank: Number.POSITIVE_INFINITY,
    });
  });

  webSources.forEach((source, index) => {
    const sourceUrl = normalizeAgentSourceUrl(source?.url || source?.site || "");
    const pdfUrl = normalizeAgentSourceUrl(source?.pdf_url || source?.pdfUrl || "");
    const key = buildRemotePaperKey({
      title: source?.title,
      sourceUrl,
      pdfUrl,
      doi: source?.doi,
    });
    const remotePaper = key ? remoteByKey.get(key) : null;
    candidates.push({
      id: `found-source-web-${index}`,
      title: String(source?.title || "").trim(),
      authors: [],
      year: "",
      venue: "",
      summary: summarizeToWordLimit(source?.summary || source?.snippet || source?.description || ""),
      sourceUrl,
      pdfUrl: isPdfUrl(pdfUrl) ? pdfUrl : "",
      doi: String(source?.doi || "").trim(),
      sourceHost: getUrlHost(sourceUrl || pdfUrl),
      remotePaperId: remotePaper?.id || null,
      hydrationStatus: remotePaper?.hydrationStatus || (pdfUrl ? "available" : "source_only"),
      hydrationError: remotePaper?.hydrationError || "",
      hasPdf: Boolean(pdfUrl),
      modelRank: Number.POSITIVE_INFINITY,
      sourceRank: index,
    });
  });

  const deduped = [];
  const seen = new Set();
  candidates.forEach((candidate) => {
    const key = getFoundSourceDedupeKey(candidate);
    if (!candidate.title && !candidate.sourceUrl) return;
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    deduped.push(candidate);
  });

  deduped.sort((a, b) => {
    if (a.modelRank !== b.modelRank) return a.modelRank - b.modelRank;
    const aScore = (a.hasPdf ? 4 : 0) + (a.doi ? 3 : 0) + (a.venue ? 2 : 0) + (a.year ? 1 : 0) + (isScholarlyHost(a.sourceHost) ? 2 : 0);
    const bScore = (b.hasPdf ? 4 : 0) + (b.doi ? 3 : 0) + (b.venue ? 2 : 0) + (b.year ? 1 : 0) + (isScholarlyHost(b.sourceHost) ? 2 : 0);
    if (aScore !== bScore) return bScore - aScore;
    if (a.sourceRank !== b.sourceRank) return a.sourceRank - b.sourceRank;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });

  return {
    total: deduped.length,
    shown: deduped.slice(0, MAX_FOUND_SOURCES_SHOWN),
    all: deduped,
  };
}

export function normalizeFoundSourceRecord(source, index = 0, remotePapers = []) {
  const sourceUrl = normalizeAgentSourceUrl(source?.sourceUrl || source?.source_url || source?.url || "");
  const pdfUrl = normalizeAgentSourceUrl(source?.pdfUrl || source?.pdf_url || "");
  const remoteKey = buildRemotePaperKey({
    title: source?.title,
    sourceUrl,
    pdfUrl,
    doi: source?.doi,
  });
  const remotePaper = remoteKey
    ? remotePapers.find((paper) => buildRemotePaperKey(paper) === remoteKey) || null
    : null;

  return {
    id: source?.id || `found-source-${index}`,
    title: String(source?.title || "").trim(),
    authors: Array.isArray(source?.authors) ? source.authors.filter(Boolean) : [],
    year: String(source?.year || "").trim(),
    venue: String(source?.venue || "").trim(),
    summary: summarizeToWordLimit(source?.summary || source?.abstract || source?.snippet || ""),
    sourceUrl,
    pdfUrl: isPdfUrl(pdfUrl) ? pdfUrl : "",
    doi: String(source?.doi || "").trim(),
    sourceHost: String(source?.sourceHost || getUrlHost(sourceUrl || pdfUrl)).trim(),
    remotePaperId: source?.remotePaperId || remotePaper?.id || null,
    hydrationStatus: source?.hydrationStatus || remotePaper?.hydrationStatus || (pdfUrl ? "available" : "source_only"),
    hydrationError: source?.hydrationError || remotePaper?.hydrationError || "",
    hasPdf: Boolean(source?.hasPdf || pdfUrl),
  };
}

export function getMessageFoundSources(message, remotePapers = []) {
  if (Array.isArray(message?.foundSources) && message.foundSources.length) {
    const normalized = message.foundSources
      .map((source, index) => normalizeFoundSourceRecord(source, index, remotePapers))
      .filter((source) => source.title || source.sourceUrl);
    const shownCount = Number.isFinite(message?.foundSourcesShown)
      ? Math.max(0, Math.min(normalized.length, Number(message.foundSourcesShown)))
      : Math.min(normalized.length, MAX_FOUND_SOURCES_SHOWN);
    return {
      total: Number.isFinite(message?.foundSourcesTotal) ? Number(message.foundSourcesTotal) : normalized.length,
      shown: normalized.slice(0, shownCount),
      all: normalized,
    };
  }

  const citationWebSources = Array.isArray(message?.citations)
    ? message.citations
        .filter((citation) => citation?.kind === "web" || citation?.url)
        .map((citation) => ({
          title: citation?.title || citation?.source || "",
          url: citation?.url || "",
          pdf_url: citation?.pdfUrl || citation?.pdf_url || "",
          summary: citation?.note || citation?.text || "",
        }))
    : [];

  return buildFoundSources({
    paperResults: message?.paperResults || [],
    webSources: citationWebSources,
    remotePapers,
  });
}

export function findMatchingRemotePaper(remotePapers, descriptor) {
  if (!Array.isArray(remotePapers) || !remotePapers.length) return null;
  const remoteKey = buildRemotePaperKey(descriptor);
  if (remoteKey) {
    const exact = remotePapers.find((paper) => buildRemotePaperKey(paper) === remoteKey);
    if (exact) return exact;
  }
  const targetId = String(descriptor?.remotePaperId || "").trim();
  if (targetId) {
    const byId = remotePapers.find((paper) => paper.id === targetId);
    if (byId) return byId;
  }
  const title = normalizeLookupValue(descriptor?.title);
  if (title) {
    return remotePapers.find((paper) => normalizeLookupValue(paper?.title || paper?.name) === title) || null;
  }
  return null;
}

export function findPaperByName(papers, requestedName) {
  const exact = papers.find((paper) => paper.name === requestedName);
  if (exact) return exact;
  const normalized = normalizeLookupValue(requestedName);
  if (!normalized) return null;
  return papers.find((paper) => normalizeLookupValue(paper.name) === normalized) || null;
}

export function getUrlFileStem(url) {
  try {
    const normalized = normalizeAgentSourceUrl(url);
    const pathname = new URL(normalized).pathname || "";
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
    return stripPdfExtension(decodeURIComponent(lastSegment));
  } catch {
    return "";
  }
}

export function isLikelySamePaperTitle(left, right) {
  const a = normalizeLookupValue(left);
  const b = normalizeLookupValue(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 14) return false;
  return a.includes(b) || b.includes(a);
}

export function isLikelySamePaperFile(paperName, source) {
  const normalizedPaperName = normalizeLookupValue(stripPdfExtension(paperName));
  const pdfStem = normalizeLookupValue(getUrlFileStem(source?.pdfUrl || source?.sourceUrl || ""));
  if (!normalizedPaperName || !pdfStem) return false;
  return normalizedPaperName === pdfStem || (pdfStem.length > 10 && normalizedPaperName.includes(pdfStem));
}

export function findWorkspacePaperForSource(papers, source) {
  if (!Array.isArray(papers) || !papers.length || !source) return null;
  const exactTitle = papers.find((paper) => isLikelySamePaperTitle(paper?.name, source?.title));
  if (exactTitle) return exactTitle;
  const pdfStemMatch = papers.find((paper) => isLikelySamePaperFile(paper?.name, source));
  if (pdfStemMatch) return pdfStemMatch;
  return null;
}

export function isManualPdfFetchError(message) {
  return /invalid pdf structure|did not look like a pdf|server-side requests are not allowed|publisher blocked automated pdf|automated pdf fetch|forbidden/i.test(String(message || ""));
}

export function buildManualPdfFetchMessage(title = "This paper") {
  return `${title} blocked automated PDF fetch. Open the direct PDF in a browser tab, then download and import it manually.`;
}
