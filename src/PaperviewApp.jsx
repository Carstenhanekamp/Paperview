import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  loadAllChats,
  loadAllAgentChats,
  saveChat,
  saveAgentChat,
  deleteChat,
  deleteAgentChat,
  deleteChatsByPaperIds,
  saveFolderHandle,
  loadFolderHandles,
  clearFolderHandles,
  saveAnnotation,
  loadAnnotations,
  deleteAnnotation,
  deleteAnnotationsByPaperIds,
  loadAllAnnotations,
  loadPaperTextCache,
  deletePaperCachesByPaperIds,
  loadUploadedPdf,
  saveUploadedPdf,
} from './db';
import { clearOcrMemoryCache, extractPdfText, terminateTesseractWorkerNow, validatePdfBytes } from './pdfUtils';
import { IFolder, IFolderOpen, IFile, IPlus, ISearch, IUpload, IClose, ICopy, IZoomIn, IZoomOut, IPanel, IGrid, IChat, IMore, ILeft, IRight, ISpark, IPaperclip, IChevronDown, IArrowUp, IArrowDown, IChevronLeftDouble, IChevronRightDouble, ITrash, IGear, IHighlight, INotes } from './icons';
import { CSS } from './styles';
import { CHAT_TITLE_FALLBACK, createAgentChatThreadRecord, createChatThreadRecord, deriveChatTitle, formatChatTimestamp, formatChatMessageCount, derivePageTexts, materializeFullText } from './chatUtils';
import TextFallback from './TextFallback';
import InlineCitedAnswer from './InlineCitedAnswer';
import PdfViewer from './PdfViewer';
import { selectRelevantPassages } from './ragUtils';
import { addUsageTotals, createUsageTotals, getUsageBreakdown, formatTokenCount, formatUsd } from './openaiPricing';
import { evictUnpinnedPayloads, mergePaperWithPayload, pickPaperPayload, stripPaperPayload } from './paperPayloadUtils';

const ENV_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-5.4-mini";
const OPENAI_MODELS = (import.meta.env.VITE_OPENAI_MODELS || "gpt-5.4-nano,gpt-5.4-mini,gpt-5.4")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const AGENT_IMPORTS_FOLDER_NAME = "Imported Papers";
const OPENAI_PROXY_ENDPOINT = "/api/openai-response";
const REMOTE_PDF_PROXY_ENDPOINT = "/api/fetch-pdf";
const LEGACY_STORAGE_NAME = "pv-api-key";
const REMEMBERED_STORAGE_NAME = "pv-api-key-v2";
const KDF_ITERATION_COUNT = 250000;
const AGENT_WEB_SEARCH_DOMAINS = [
  "arxiv.org",
  "biorxiv.org",
  "doi.org",
  "europepmc.org",
  "frontiersin.org",
  "jamanetwork.com",
  "link.springer.com",
  "medrxiv.org",
  "nature.com",
  "nejm.org",
  "onlinelibrary.wiley.com",
  "openalex.org",
  "paperswithcode.com",
  "pmc.ncbi.nlm.nih.gov",
  "proceedings.mlr.press",
  "pubmed.ncbi.nlm.nih.gov",
  "sciencedirect.com",
  "science.org",
  "semanticscholar.org",
  "thelancet.com",
];

const CHAT_SYSTEM_PROMPT = `You are an expert research assistant analyzing one or more academic PDFs.

The document text you receive contains "--- Page N ---" markers that indicate where each page begins.

## Retrieval workflow
- You have access to a search_document tool for searching the available PDFs.
- Before answering substantive questions about a paper, call search_document at least once to retrieve evidence.
- You may call search_document multiple times with refined queries or different documents.
- Base your answer and citations only on text that was actually retrieved through the tool.
- If a citation is not found in the retrieved text, but the context clearly comes from the paper. Add the citation but without direct position information. Add for example "From paragraph ...". Also do not fabricate citations to fit an answer. Only cite what you can support with the retrieved text.
- If you cannot find supporting evidence after searching, say that clearly instead of guessing.

## Response format
Respond ONLY with a raw JSON object (no markdown fences, no extra text) using this exact schema:
{
  "answer": "your detailed answer here",
  "citations": [
    {
      "file": "exact document name as provided",
      "page": <integer page number>,
      "section": "section name if identifiable",
      "text": "verbatim quote from the paper"
    }
  ]
}

## Answer guidelines
- Write thorough, detailed answers in an academic style. Explain concepts fully rather than giving brief summaries.
- Use **bold** to highlight key terms and findings.
- Make sure that every claim you make is supported by a citation from the retrieved text. Do not make unsupported claims.
- Every claim in bold must have a corresponding citation that supports it. If you cannot find a citation to support a claim, do not make that claim.
- When comparing multiple papers, structure your answer with clear paragraphs for each perspective.
- Always ask yourself "How do I know this?" and "Where in the paper does it say this?" and "is this backed by the paper" for every claim you make.

## Citation guidelines
- Every factual claim in your answer MUST be backed by a citation. Do not make unsupported claims.
- Include as many citations as needed to fully support your answer (typically 2-6).
- "file" must EXACTLY match one of the provided document names (case-sensitive, including extension).
- "page" MUST be the integer from the nearest "--- Page N ---" marker that appears BEFORE the quoted text in that document. Count carefully — do not guess or approximate.
- "text" must be a VERBATIM quote copied exactly from the document (one or two sentences). Do not paraphrase.
- "section" should be the heading of the section where the quote appears, or "" if unclear.
- If multiple documents are provided, cite from whichever ones are most relevant.`;

const SEARCH_DOCUMENT_TOOL = {
  type: "function",
  name: "search_document",
  description: "Search the currently available local or hydrated remote academic PDFs for passages relevant to a query before answering.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Keywords, a short question, or a refined search query to look up in the document.",
      },
      document_name: {
        type: "string",
        description: "Exact document name from the provided available documents list.",
      },
      page_hint: {
        type: ["integer", "null"],
        description: "Optional page number to prioritize if the answer may be near a known page.",
      },
    },
    required: ["query", "document_name", "page_hint"],
    additionalProperties: false,
  },
  strict: true,
};

const FETCH_REMOTE_PAPER_TOOL = {
  type: "function",
  name: "fetch_remote_paper",
  description: "Fetch and hydrate a remote paper PDF into a transient searchable document for this Agent thread. Use this before citing a found paper when a direct PDF URL is available.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Paper title.",
      },
      source_url: {
        type: "string",
        description: "Landing or source URL for the paper.",
      },
      pdf_url: {
        type: "string",
        description: "Direct PDF URL for the paper.",
      },
      doi: {
        type: "string",
        description: "Optional DOI if known.",
      },
    },
    required: ["title", "source_url", "pdf_url", "doi"],
    additionalProperties: false,
  },
  strict: true,
};

const AGENT_WEB_SEARCH_TOOL = {
  type: "web_search",
  filters: {
    allowed_domains: AGENT_WEB_SEARCH_DOMAINS,
  },
  external_web_access: true,
};

const AGENT_SYSTEM_PROMPT = `You are Paperview Agent, a research assistant that helps users discover papers online and connect them with papers already stored in Paperview.

## Available tools
- You can use the built-in web_search tool to find papers and recent research sources online.
- You can use the fetch_remote_paper tool to hydrate a discovered paper PDF into a transient searchable document for this thread.
- You can use the search_document tool to search locally attached PDFs and hydrated remote PDFs from the user's workspace.

## Core behavior
- Use web_search whenever the user asks to find papers, discover literature, compare external work, or answer questions that need current web information.
- Use fetch_remote_paper for a found paper before relying on it in the answer when a direct PDF URL is available.
- Use search_document when the user explicitly attached local PDFs or when local workspace papers are relevant to the question.
- You may combine both tools in the same answer.
- Never invent papers, URLs, DOIs, authors, years, or PDFs.
- If a direct PDF URL is unavailable, leave it empty instead of guessing.

## Response format
Respond ONLY with a raw JSON object using this schema:
{
  "answer": "Markdown answer with inline citation markers like [1] or [2].",
  "citations": [
    {
      "kind": "web" | "local",
      "title": "source title",
      "url": "https://example.com",
      "pdf_url": "https://example.com/paper.pdf",
      "source": "journal, website, or publisher",
      "file": "exact local document name when kind is local",
      "page": 1,
      "section": "section name",
      "text": "verbatim local quote or short supporting snippet",
      "note": "optional short explanation"
    }
  ],
  "paper_results": [
    {
      "title": "paper title",
      "authors": ["Author One", "Author Two"],
      "year": 2025,
      "venue": "journal or conference",
      "abstract": "short abstract or summary snippet",
      "source_url": "https://landing-page",
      "pdf_url": "https://direct-pdf-link",
      "doi": "10.xxxx/xxxxx"
    }
  ]
}

## Citation rules
- Every substantive claim in "answer" must include at least one marker like [1].
- Citation markers must map to the 1-based index of the item in the citations array.
- For web citations, include a real URL and title.
- For web citations grounded in a fetched PDF, include the page number and short supporting snippet from that paper.
- For local citations, include the exact local file name and the best page number you can support.
- Prefer 2-8 citations total. Reuse citation numbers instead of duplicating the same source.

## Paper result rules
- Return up to 6 highly relevant papers when the user is searching for papers.
- Include paper_results only when the user is looking for papers or when discovered papers materially help the answer.
- Use empty strings or empty arrays for unknown fields; do not fabricate.
- Prefer direct PDF links in pdf_url only when you are confident the URL points to a PDF.
- Include a one-sentence summary in abstract or summary form so the client can render a short subtitle.

## Answer style
- Be concise but useful.
- When local PDFs were attached, explicitly connect external findings back to the local workspace where relevant.
- When a found paper has a usable PDF URL and you want to rely on it, fetch it and search it before citing it.`;

const MAX_SEARCH_TOOL_ROUNDS = 20;
const MAX_AGENT_RESEARCH_PASSES = 3;
const TARGET_FOUND_SOURCES = 24;
const MAX_FOUND_SOURCES_SHOWN = 8;
const AGENT_MAX_OUTPUT_TOKENS = 8192;
const AGENT_FINALIZE_MAX_OUTPUT_TOKENS = 6000;

function createChatMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeStableId(prefix, path) {
  let h = 0;
  for (let i = 0; i < path.length; i += 1) {
    h = ((h << 5) - h + path.charCodeAt(i)) | 0;
  }
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

function hasExtractedPaperText(paper) {
  return derivePageTexts(paper).length > 0;
}

function isPaperTextCacheValid(cacheEntry, paper) {
  if (!cacheEntry || !paper?.id) return false;
  return (
    cacheEntry.paperId === paper.id &&
    cacheEntry.fileSize === paper.fileSize &&
    cacheEntry.fileLastModified === paper.fileLastModified &&
    Array.isArray(cacheEntry.pageTexts) &&
    Number.isFinite(cacheEntry.totalPages)
  );
}

function getRememberedApiKeyRecord() {
  try {
    const raw = localStorage.getItem(REMEMBERED_STORAGE_NAME);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.version !== 1 ||
      parsed?.algorithm !== "AES-GCM" ||
      parsed?.kdf !== "PBKDF2-SHA-256" ||
      !parsed?.salt ||
      !parsed?.iv ||
      !parsed?.ciphertext
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function hasRememberedApiKey() {
  return Boolean(getRememberedApiKeyRecord());
}

function clearLegacyStoredApiKey() {
  try { localStorage.removeItem(LEGACY_STORAGE_NAME); } catch { /* ignore */ }
}

function clearRememberedApiKey() {
  try { localStorage.removeItem(REMEMBERED_STORAGE_NAME); } catch { /* ignore */ }
  clearLegacyStoredApiKey();
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
}

function base64ToBytes(value) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveApiKeyStorageKey(passphrase, salt) {
  const cryptoApi = window.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error("Encrypted key storage requires Web Crypto support.");
  }
  const encoder = new TextEncoder();
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: KDF_ITERATION_COUNT,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function rememberApiKeyEncrypted(valueToEncrypt, passphrase) {
  const cryptoApi = window.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error("Encrypted key storage requires Web Crypto support.");
  }
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveApiKeyStorageKey(passphrase, salt);
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(valueToEncrypt),
  );
  const record = {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: KDF_ITERATION_COUNT,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  // This persists only encrypted ciphertext plus non-secret decryption metadata.
  localStorage.setItem(REMEMBERED_STORAGE_NAME, JSON.stringify(record));
  clearLegacyStoredApiKey();
}

async function unlockRememberedApiKey(passphrase) {
  const record = getRememberedApiKeyRecord();
  if (!record) {
    throw new Error("No remembered API key was found on this device.");
  }
  const salt = base64ToBytes(record.salt);
  const iv = base64ToBytes(record.iv);
  const key = await deriveApiKeyStorageKey(passphrase, salt);
  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64ToBytes(record.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

function stripPdfExtension(name) {
  return String(name || "").replace(/\.pdf$/i, "");
}

function sanitizeFileStem(value) {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned || "Imported paper";
}

function ensurePdfFileName(value) {
  const stem = sanitizeFileStem(stripPdfExtension(value));
  return `${stem}.pdf`;
}

function buildFolderPath(rootName, relativePath = "") {
  const normalizedRelative = String(relativePath || "")
    .split("/")
    .filter(Boolean)
    .join("/");
  return normalizedRelative ? `/${rootName}/${normalizedRelative}` : `/${rootName}`;
}

function getRootFolderNameFromPath(folderPath) {
  return String(folderPath || "").split("/").filter(Boolean)[0] || "";
}

function isPdfUrl(url) {
  return /\.pdf(?:[?#].*)?$/i.test(String(url || ""));
}

function normalizeAgentSourceUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function getUrlHost(url) {
  try {
    return new URL(normalizeAgentSourceUrl(url)).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function buildAgentImportKey(messageId, result) {
  return `${messageId}:${result?.id || result?.sourceUrl || result?.title || "result"}`;
}

function normalizeLookupValue(value) {
  return String(value || "").trim().toLowerCase();
}

function summarizeToWordLimit(value, maxWords = 20) {
  const words = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return "";
  return words.slice(0, maxWords).join(" ");
}

function formatSourceAuthors(authors) {
  if (!Array.isArray(authors) || !authors.length) return "";
  if (authors.length <= 4) return authors.join(", ");
  return `${authors.slice(0, 4).join(", ")}, and ${authors.length - 4} more`;
}

function buildRemotePaperKey(value) {
  const doi = normalizeLookupValue(value?.doi);
  if (doi) return `doi:${doi}`;
  const pdfUrl = normalizeLookupValue(normalizeAgentSourceUrl(value?.pdfUrl || value?.pdf_url || ""));
  if (pdfUrl) return `pdf:${pdfUrl}`;
  const sourceUrl = normalizeLookupValue(normalizeAgentSourceUrl(value?.sourceUrl || value?.source_url || value?.url || ""));
  if (sourceUrl) return `src:${sourceUrl}`;
  const title = normalizeLookupValue(value?.title);
  return title ? `title:${title}` : "";
}

function getFoundSourceDedupeKey(value) {
  const doi = normalizeLookupValue(value?.doi);
  if (doi) return `doi:${doi}`;
  const pdfUrl = normalizeLookupValue(normalizeAgentSourceUrl(value?.pdfUrl || ""));
  if (pdfUrl) return `pdf:${pdfUrl}`;
  const sourceUrl = normalizeLookupValue(normalizeAgentSourceUrl(value?.sourceUrl || ""));
  if (sourceUrl) return `src:${sourceUrl}`;
  const title = normalizeLookupValue(value?.title);
  return title ? `title:${title}` : "";
}

function isScholarlyHost(host) {
  const normalizedHost = normalizeLookupValue(host);
  if (!normalizedHost) return false;
  return AGENT_WEB_SEARCH_DOMAINS.some((domain) => (
    normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
  ));
}

function buildFoundSources({ paperResults = [], webSources = [], remotePapers = [] }) {
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

function normalizeFoundSourceRecord(source, index = 0, remotePapers = []) {
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

function getMessageFoundSources(message, remotePapers = []) {
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

function findMatchingRemotePaper(remotePapers, descriptor) {
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

function findPaperByName(papers, requestedName) {
  const exact = papers.find((paper) => paper.name === requestedName);
  if (exact) return exact;
  const normalized = normalizeLookupValue(requestedName);
  if (!normalized) return null;
  return papers.find((paper) => normalizeLookupValue(paper.name) === normalized) || null;
}

// Escape literal newlines/carriage-returns that appear inside JSON string values.
// Models sometimes output unescaped newlines inside strings, making the JSON invalid.
function sanitizeJsonNewlines(str) {
  let inString = false;
  let escaped = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escaped) { result += c; escaped = false; continue; }
    if (c === '\\' && inString) { result += c; escaped = true; continue; }
    if (c === '"') { inString = !inString; result += c; continue; }
    if (inString && c === '\n') { result += '\\n'; continue; }
    if (inString && c === '\r') { result += '\\r'; continue; }
    result += c;
  }
  return result;
}

// Fetch a URL, preferring the app backend and falling back to browser fetches when needed.
async function fetchWithCorsProxy(url) {
  try {
    const proxyResponse = await fetch(`${REMOTE_PDF_PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`, {
      headers: {
        Accept: "application/pdf",
      },
    });
    const proxyContentType = String(proxyResponse.headers.get("content-type") || "").toLowerCase();
    if (proxyResponse.ok && !proxyContentType.includes("text/html")) return proxyResponse;

    const proxyText = await proxyResponse.text();
    const looksLikeAppShell = proxyContentType.includes("text/html") && /<!doctype html|<html/i.test(proxyText);
    if (proxyResponse.ok || !looksLikeAppShell) {
      // Fall through to browser-based fetches if the backend proxy is unavailable or the remote fetch failed.
    }
  } catch {
    // Fall back to browser-based fetches below.
  }

  let directError = null;
  try {
    const res = await fetch(url);
    if (res.ok) return res;
    // Non-2xx but not a CORS block — throw so the proxy isn't used needlessly
    directError = new Error(`Remote PDF download failed (${res.status}).`);
  } catch (err) {
    // TypeError ("Failed to fetch") is how browsers surface CORS blocks
    directError = err;
  }
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw directError || new Error(`Remote PDF download failed (${res.status}).`);
  return res;
}

function extractOutputTextPart(part) {
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text.trim();
  if (typeof part.value === "string") return part.value.trim();
  if (typeof part?.text?.value === "string") return part.text.value.trim();
  if (typeof part?.value?.text === "string") return part.value.text.trim();
  return "";
}

function extractResponseOutputText(data) {
  const chunks = [];
  const seen = new Set();

  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    const text = data.output_text.trim();
    chunks.push(text);
    seen.add(text);
  }

  for (const item of data?.output || []) {
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if ((part?.type === "output_text" || part?.type === "text") && extractOutputTextPart(part)) {
        const text = extractOutputTextPart(part);
        if (!seen.has(text)) {
          chunks.push(text);
          seen.add(text);
        }
      }
    }
  }

  return chunks.join("\n").trim();
}

function extractFunctionCalls(data) {
  return (data?.output || []).filter((item) => item?.type === "function_call" && item?.name);
}

function formatSearchToolResult(paper, query, passages) {
  if (!passages.length) {
    return [
      `Document: "${paper.name}"`,
      `Search query: "${query}"`,
      "No relevant passages were found for this query.",
    ].join("\n");
  }

  return [
    `Document: "${paper.name}"`,
    `Search query: "${query}"`,
    "Retrieved passages:",
    ...passages.map(({ page, text }) => `--- Page ${page} ---\n${text}`),
  ].join("\n\n");
}

function extractWebSearchSources(data) {
  const sources = [];
  for (const item of data?.output || []) {
    if (item?.type !== "web_search_call") continue;
    const nextSources = item?.action?.sources;
    if (Array.isArray(nextSources)) {
      sources.push(...nextSources);
    }
  }
  return sources;
}

function extractReasoningSummary(data) {
  const texts = [];
  for (const item of data?.output || []) {
    if (item?.type === "reasoning" && Array.isArray(item.summary)) {
      for (const s of item.summary) {
        if (s?.type === "summary_text" && typeof s.text === "string" && s.text.trim()) {
          texts.push(s.text.trim());
        }
      }
    }
  }
  return texts.join("\n\n").trim();
}

function isResponseIncompleteForMaxOutput(data) {
  return data?.status === "incomplete" && data?.incomplete_details?.reason === "max_output_tokens";
}

function getUrlFileStem(url) {
  try {
    const normalized = normalizeAgentSourceUrl(url);
    const pathname = new URL(normalized).pathname || "";
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
    return stripPdfExtension(decodeURIComponent(lastSegment));
  } catch {
    return "";
  }
}

function isLikelySamePaperTitle(left, right) {
  const a = normalizeLookupValue(left);
  const b = normalizeLookupValue(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 14) return false;
  return a.includes(b) || b.includes(a);
}

function isLikelySamePaperFile(paperName, source) {
  const normalizedPaperName = normalizeLookupValue(stripPdfExtension(paperName));
  const pdfStem = normalizeLookupValue(getUrlFileStem(source?.pdfUrl || source?.sourceUrl || ""));
  if (!normalizedPaperName || !pdfStem) return false;
  return normalizedPaperName === pdfStem || (pdfStem.length > 10 && normalizedPaperName.includes(pdfStem));
}

function findWorkspacePaperForSource(papers, source) {
  if (!Array.isArray(papers) || !papers.length || !source) return null;
  const exactTitle = papers.find((paper) => isLikelySamePaperTitle(paper?.name, source?.title));
  if (exactTitle) return exactTitle;
  const pdfStemMatch = papers.find((paper) => isLikelySamePaperFile(paper?.name, source));
  if (pdfStemMatch) return pdfStemMatch;
  return null;
}

function isManualPdfFetchError(message) {
  return /invalid pdf structure|did not look like a pdf|server-side requests are not allowed|publisher blocked automated pdf|automated pdf fetch|forbidden/i.test(String(message || ""));
}

function buildManualPdfFetchMessage(title = "This paper") {
  return `${title} blocked automated PDF fetch. Open the direct PDF in a browser tab, then download and import it manually.`;
}

function mergeFoldersByRoot(prevFolders, nextFolders, rootFolderId) {
  if (!rootFolderId) return [...prevFolders];
  const firstIndex = prevFolders.findIndex((folder) => folder.rootFolderId === rootFolderId);
  const remaining = prevFolders.filter((folder) => folder.rootFolderId !== rootFolderId);
  const insertIndex = firstIndex === -1 ? remaining.length : Math.min(firstIndex, remaining.length);
  const merged = [...remaining];
  merged.splice(insertIndex, 0, ...nextFolders);
  return merged;
}

async function requestOpenAIResponse(apiKey, payload, options = {}) {
  const { signal } = options;
  try {
    const proxyHeaders = {
      "Content-Type": "application/json",
    };
    if (apiKey) proxyHeaders["x-openai-api-key"] = apiKey;

    const proxyResponse = await fetch(OPENAI_PROXY_ENDPOINT, {
      method: "POST",
      headers: proxyHeaders,
      body: JSON.stringify(payload),
      signal,
    });
    const proxyContentType = String(proxyResponse.headers.get("content-type") || "").toLowerCase();
    const proxyBody = await proxyResponse.text();
    const looksLikeAppShell = proxyContentType.includes("text/html") && /<!doctype html|<html/i.test(proxyBody);

    if (proxyResponse.ok && !looksLikeAppShell) {
      return JSON.parse(proxyBody);
    }

    if (!looksLikeAppShell) {
      if (!apiKey) {
        throw new Error(proxyBody || "OpenAI request failed");
      }
    }
  } catch (err) {
    if (!apiKey) {
      if (err instanceof TypeError) {
        throw new Error("No OpenAI API key is configured. Add one in Settings or set OPENAI_API_KEY on the backend.");
      }
      throw err;
    }
  }

  if (!apiKey) {
    throw new Error("No OpenAI API key is configured. Add one in Settings or set OPENAI_API_KEY on the backend.");
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "OpenAI request failed");
  }

  return res.json();
}

function createStoppedError(message = "Request stopped.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function isAbortLikeError(error) {
  return error?.name === "AbortError" || /aborted|aborterror|request stopped/i.test(String(error?.message || ""));
}

function ThinkingTrace({ steps, isLive, expanded, onToggle }) {
  if (!steps?.length) return null;
  const searchCount = steps.filter(s => s.type === "search").length;
  const icons = { reasoning: "o", search: ">", result: "+" };
  const panelRef = React.useRef(null);

  React.useEffect(() => {
    if (!isLive || !panelRef.current) return;
    panelRef.current.scrollTop = panelRef.current.scrollHeight;
  }, [isLive, steps]);

  const stepsEl = (
    <div className="thinking-trace-panel">
      <div ref={panelRef} className="thinking-trace-panel-scroll">
        <div className="thinking-trace-steps">
          {steps.map(s => (
            <div key={s.id} className={`thinking-step thinking-step-${s.type}`}>
              <div className="thinking-step-header">
                <span className="thinking-step-icon">{icons[s.type] || "-"}</span>
                <span className="thinking-step-label">{s.label}</span>
              </div>
              {s.body && (
                <div className="thinking-step-body">{s.body}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isLive) {
    return (
      <div className="thinking-trace thinking-trace-live">
        <div className="thinking-trace-summary">
          <span className="thinking-trace-summary-icon">*</span>
          <span className="thinking-trace-summary-label">Thinking</span>
          {searchCount > 0 && (
            <span className="thinking-trace-toggle-count">{searchCount} search{searchCount !== 1 ? "es" : ""}</span>
          )}
        </div>
        {stepsEl}
      </div>
    );
  }

  return (
    <div className="thinking-trace">
      <button className="thinking-trace-toggle" type="button" onClick={onToggle}>
        <span className="thinking-trace-toggle-icon">*</span>
        <span className="thinking-trace-toggle-label">Thinking</span>
        {searchCount > 0 && (
          <span className="thinking-trace-toggle-count">{searchCount} search{searchCount !== 1 ? "es" : ""}</span>
        )}
        <span className="thinking-trace-chevron">{expanded ? "^" : "v"}</span>
      </button>
      {expanded && stepsEl}
    </div>
  );
}

export default function PaperviewApp() {
  const [folders, setFolders] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [paperPayloads, setPaperPayloads] = useState({});
  const [activeTabId, setActiveTabId] = useState(null);
  const [chatThreads, setChatThreads] = useState([]);
  const [agentThreads, setAgentThreads] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeAgentChatId, setActiveAgentChatId] = useState(null);
  const [input, setInput] = useState("");
  const [agentInput, setAgentInput] = useState("");
  const [chatLoadingState, setChatLoadingState] = useState(null);
  const [agentLoadingState, setAgentLoadingState] = useState(null);
  const [thinkingSteps, setThinkingSteps] = useState([]);
  const thinkingStepsRef = React.useRef([]);
  const [agentThinkingSteps, setAgentThinkingSteps] = useState([]);
  const agentThinkingStepsRef = React.useRef([]);
  const [agentRemotePapersByThread, setAgentRemotePapersByThread] = useState({});
  const [thinkingExpanded, setThinkingExpanded] = useState({});
  const [agentThinkingExpanded, setAgentThinkingExpanded] = useState({});
  const [paperScanStates, setPaperScanStates] = useState({});
  const [popup, setPopup] = useState(null);
  const [chip, setChip] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [upFolder, setUpFolder] = useState("");
  const [upStatus, setUpStatus] = useState(null);
  const [upStatusText, setUpStatusText] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [newFolder, setNewFolder] = useState(false);
  const [nfName, setNfName] = useState("");
  const [folderError, setFolderError] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [agentSidebarOpen, setAgentSidebarOpen] = useState(true);
  const [chatPaneMode, setChatPaneMode] = useState("chat");
  const [currentView, setCurrentView] = useState("library");
  const [selectedModel, setSelectedModel] = useState(OPENAI_MODEL);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [agentAttachMenuOpen, setAgentAttachMenuOpen] = useState(false);
  const [agentToolMenuOpen, setAgentToolMenuOpen] = useState(false);
  const [selectedAgentToolId, setSelectedAgentToolId] = useState(null);
  const [selectedChatPaperIds, setSelectedChatPaperIds] = useState([]);
  const [chatContextMode, setChatContextMode] = useState("auto");
  const [selectedAgentPaperIds, setSelectedAgentPaperIds] = useState([]);
  const [agentImportStates, setAgentImportStates] = useState({});
  const [agentPreviewState, setAgentPreviewState] = useState(null);
  const [agentPreviewScale, setAgentPreviewScale] = useState(1.05);
  const [agentPreviewPage, setAgentPreviewPage] = useState(1);
  const [agentPreviewWidth, setAgentPreviewWidth] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewerSearchOpen, setViewerSearchOpen] = useState(false);
  const [viewerSearchQuery, setViewerSearchQuery] = useState("");
  const [viewerSearchStatus, setViewerSearchStatus] = useState("");
  const [viewerSearchMatches, setViewerSearchMatches] = useState([]);
  const [viewerSearchIndex, setViewerSearchIndex] = useState(-1);
  const [scale, setScale] = useState(1.4);
  const [chatWidth, setChatWidth] = useState(480);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [apiKey, setApiKey] = useState(() => ENV_API_KEY);
  const [apiKeySource, setApiKeySource] = useState(() => (ENV_API_KEY ? "env" : "none"));
  const [rememberedApiKeyAvailable, setRememberedApiKeyAvailable] = useState(() => hasRememberedApiKey());
  const [privacyAccepted, setPrivacyAccepted] = useState(() => !!localStorage.getItem('pv-privacy-ok'));
  const [showFolderPermModal, setShowFolderPermModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsKey, setSettingsKey] = useState('');
  const [settingsKeyVisible, setSettingsKeyVisible] = useState(false);
  const [rememberApiKey, setRememberApiKey] = useState(false);
  const [settingsPassphrase, setSettingsPassphrase] = useState('');
  const [settingsPassphraseVisible, setSettingsPassphraseVisible] = useState(false);
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [unlockPassphraseVisible, setUnlockPassphraseVisible] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [edgeToast, setEdgeToast] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [annPopover, setAnnPopover] = useState(null);
  const [annComment, setAnnComment] = useState('');
  const [debugCitations] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has("debugCitations");
    } catch {
      return false;
    }
  });
  const [agentFolderCheckStates, setAgentFolderCheckStates] = useState({});

  const endRef = useRef(null);
  const taRef = useRef(null);
  const agentEndRef = useRef(null);
  const agentTaRef = useRef(null);
  const agentPreviewScrollFnRef = useRef(null);
  const agentPreviewPaneRef = useRef(null);
  const fileRef = useRef(null);
  const scrollFnRef = useRef(null);
  const modelMenuRef = useRef(null);
  const attachMenuRef = useRef(null);
  const agentAttachMenuRef = useRef(null);
  const agentToolMenuRef = useRef(null);
  const viewerSearchInputRef = useRef(null);
  const chatResizeRef = useRef({ active: false, startX: 0, startWidth: 480 });
  const sbResizeRef = useRef({ active: false, startX: 0, startWidth: 260 });
  const agentPreviewResizeRef = useRef({ active: false, startX: 0, startWidth: 0 });
  const scanDirHandleRef = useRef(null);
  const folderHandlesMapRef = useRef(new Map()); // folderId → root FileSystemDirectoryHandle
  const foldersRef = useRef([]);
  const paperPayloadsRef = useRef({});
  const chatThreadsRef = useRef([]);
  const agentThreadsRef = useRef([]);
  const agentRemotePaperJobsRef = useRef(new Map());
  const paperTextJobsRef = useRef(new Map());
  const folderRefreshStateRef = useRef({ rootFolderId: null, lastRunAt: 0 });
  const chatRequestRef = useRef({ controller: null, token: 0, chatId: null });
  const agentRequestRef = useRef({ controller: null, token: 0, chatId: null });

  useEffect(() => {
    loadAllChats().then((saved) => {
      if (saved.length) {
        setChatThreads(saved);
        setActiveChatId(saved[0]?.id || null);
      }
    }).catch(() => {});

    loadAllAgentChats().then((saved) => {
      if (saved.length) {
        setAgentThreads(saved);
        setActiveAgentChatId(saved[0]?.id || null);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { foldersRef.current = folders; }, [folders]);
  useEffect(() => { paperPayloadsRef.current = paperPayloads; }, [paperPayloads]);
  useEffect(() => { chatThreadsRef.current = chatThreads; }, [chatThreads]);
  useEffect(() => { agentThreadsRef.current = agentThreads; }, [agentThreads]);
  useEffect(() => () => { terminateTesseractWorkerNow().catch(() => {}); }, []);
  useEffect(() => () => {
    chatRequestRef.current.controller?.abort();
    agentRequestRef.current.controller?.abort();
  }, []);
  useEffect(() => {
    clearLegacyStoredApiKey();
    setRememberedApiKeyAvailable(hasRememberedApiKey());
  }, []);

  const resetSettingsInputs = useCallback(() => {
    setSettingsKey("");
    setSettingsKeyVisible(false);
    setRememberApiKey(false);
    setSettingsPassphrase("");
    setSettingsPassphraseVisible(false);
    setUnlockPassphrase("");
    setUnlockPassphraseVisible(false);
    setSettingsError("");
  }, []);

  const openSettingsModal = useCallback((prefill = "") => {
    resetSettingsInputs();
    setSettingsKey(prefill);
    setShowSettings(true);
  }, [resetSettingsInputs]);

  const closeSettingsModal = useCallback(() => {
    if (settingsBusy) return;
    setShowSettings(false);
    resetSettingsInputs();
  }, [resetSettingsInputs, settingsBusy]);

  const handleRemoveApiKey = useCallback(() => {
    setApiKey("");
    setApiKeySource("none");
    clearRememberedApiKey();
    setRememberedApiKeyAvailable(false);
    resetSettingsInputs();
  }, [resetSettingsInputs]);

  const handleUnlockRememberedApiKey = useCallback(async () => {
    const passphrase = unlockPassphrase.trim();
    if (!passphrase) {
      setSettingsError("Enter the passphrase used to remember this key.");
      return;
    }
    setSettingsBusy(true);
    setSettingsError("");
    try {
      const unlocked = await unlockRememberedApiKey(passphrase);
      setApiKey(unlocked);
      setApiKeySource("remembered");
      setShowSettings(false);
      resetSettingsInputs();
    } catch {
      setSettingsError("Could not unlock the remembered key. Check the passphrase and try again.");
    } finally {
      setSettingsBusy(false);
    }
  }, [resetSettingsInputs, unlockPassphrase]);

  const handleSaveSettingsApiKey = useCallback(async () => {
    const trimmed = settingsKey.trim();
    const passphrase = settingsPassphrase.trim();
    if (!trimmed) {
      setSettingsError("Enter an OpenAI API key first.");
      return;
    }
    if (rememberApiKey && passphrase.length < 8) {
      setSettingsError("Use at least 8 characters for the encryption passphrase.");
      return;
    }
    setSettingsBusy(true);
    setSettingsError("");
    try {
      if (rememberApiKey) {
        await rememberApiKeyEncrypted(trimmed, passphrase);
        setRememberedApiKeyAvailable(true);
        setApiKeySource("remembered");
      } else {
        clearRememberedApiKey();
        setRememberedApiKeyAvailable(false);
        setApiKeySource("memory");
      }
      setApiKey(trimmed);
      setShowSettings(false);
      resetSettingsInputs();
    } catch (error) {
      setSettingsError(error?.message || "Could not save this API key securely.");
    } finally {
      setSettingsBusy(false);
    }
  }, [rememberApiKey, resetSettingsInputs, settingsKey, settingsPassphrase]);

  // Restore previously opened folders from IndexedDB (runs after scanDirHandle is defined)
  useEffect(() => {
    if (!scanDirHandleRef.current) return;
    loadFolderHandles().then(async (entries) => {
      if (!entries.length) return;
      const allFolders = [];
      for (const entry of entries) {
        const handle = entry.handle;
        if (!handle) continue;
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const req = await handle.requestPermission({ mode: 'readwrite' });
          if (req !== 'granted') continue;
        }
        try {
          const scanned = await scanDirHandleRef.current(handle);
          for (const f of scanned) folderHandlesMapRef.current.set(f.id, handle);
          const snapshot = await readFolderSnapshot(handle);
          if (snapshot) await applyFolderSnapshot(snapshot);
          allFolders.push(...scanned);
        } catch { /* folder may no longer exist */ }
      }
      if (allFolders.length) {
        setFolders(allFolders);
        setSelectedFolderId(allFolders[0]?.id || null);
        setUpFolder(allFolders[0]?.id || '');
      }
    }).catch(() => {});
  }, []);

  // Show one-time toast for Edge users about mini menu
  useEffect(() => {
    const isEdge = /Edg\//i.test(navigator.userAgent);
    if (isEdge && !localStorage.getItem('pv-edge-toast-dismissed')) {
      setEdgeToast(true);
    }
  }, []);

  const handlePdfReady = useCallback((fn) => {
    scrollFnRef.current = fn;
  }, []);

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

  const activePaperDescriptor = openTabs.find((t) => t.id === activeTabId) || null;
  const activePaper = useMemo(() => mergePaperRecord(activePaperDescriptor), [activePaperDescriptor, mergePaperRecord]);
  const selectedFolder = folders.find((f) => f.id === selectedFolderId) || null;

  // Load annotations for active paper
  useEffect(() => {
    if (!activePaper?.id) { setAnnotations([]); return; }
    loadAnnotations(activePaper.id).then((anns) => setAnnotations(anns || [])).catch(() => setAnnotations([]));
  }, [activePaper?.id]);

  const activeFolder =
    folders.find((f) => f.papers.some((p) => p.id === activeTabId)) ||
    selectedFolder ||
    null;
  const activeFolderPapers = activeFolder?.papers || [];
  const totalPaperCount = folders.reduce((sum, folder) => sum + folder.papers.length, 0);
  const selectedRootFolderId = selectedFolder?.rootFolderId || null;
  const selectedRootFolder = folders.find((folder) => folder.id === selectedRootFolderId) || null;
  const hasWritableAgentContext = Boolean(selectedRootFolder?.directoryHandle && selectedRootFolder?.rootHandle);
  const agentWorkspacePapers = useMemo(
    () =>
      selectedRootFolderId
        ? folders
            .filter((folder) => folder.rootFolderId === selectedRootFolderId)
            .flatMap((folder) => folder.papers.map((paper) => mergePaperRecord({ ...paper, folderId: folder.id })))
        : [],
    [folders, mergePaperRecord, selectedRootFolderId]
  );
  const searchablePageTexts = useMemo(() => derivePageTexts(activePaper), [activePaper]);
  const activePaperTotalPages = Math.max(1, Number(activePaper?.pages) || searchablePageTexts.length || 1);
  const activePaperScanState = activePaper?.id ? paperScanStates[activePaper.id] : null;
  const activePaperScanProgress = Math.max(
    0,
    Math.min(1, Number(activePaperScanState?.progress ?? activePaper?.textProgress) || 0)
  );
  const activePaperScanPercent = Math.round(activePaperScanProgress * 100);
  const isActivePaperScanning = (activePaperScanState?.status || activePaper?.textStatus) === "scanning";
  const activePaperScanLabel = activePaperScanState?.label || activePaper?.textStatusText || "Scanning paper...";
  const canRunViewerSearch = Boolean(viewerSearchQuery.trim()) && searchablePageTexts.length > 0;
  const hasViewerSearchResults = viewerSearchMatches.length > 0;
  const activeChat = useMemo(
    () => chatThreads.find((thread) => thread.id === activeChatId) || null,
    [chatThreads, activeChatId]
  );
  const activeAgentChat = useMemo(
    () => agentThreads.find((thread) => thread.id === activeAgentChatId && thread.rootFolderId === selectedRootFolderId) || null,
    [agentThreads, activeAgentChatId, selectedRootFolderId]
  );
  const activeAgentRemotePapers = useMemo(
    () => (agentRemotePapersByThread[activeAgentChatId] || []).map((paper) => mergePaperRecord(paper)),
    [agentRemotePapersByThread, activeAgentChatId, mergePaperRecord]
  );
  const activeAgentPreviewPaper = useMemo(
    () =>
      activeAgentRemotePapers.find((paper) => paper.id === agentPreviewState?.paperId) ||
      agentWorkspacePapers.find((paper) => paper.id === agentPreviewState?.paperId) ||
      null,
    [activeAgentRemotePapers, agentPreviewState?.paperId, agentWorkspacePapers]
  );
  const hasAgentPreview = Boolean(agentPreviewState && activeAgentPreviewPaper?.pdfBytes?.length);
  const currentMessages = activeChat?.messages || [];
  const currentAgentMessages = activeAgentChat?.messages || [];
  const activePaperThreads = useMemo(() => {
    if (!activePaper?.id) return [];
    return chatThreads
      .filter((thread) => thread.paperId === activePaper.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [chatThreads, activePaper?.id]);
  const selectedRootAgentThreads = useMemo(() => {
    if (!selectedRootFolderId) return [];
    return agentThreads
      .filter((thread) => thread.rootFolderId === selectedRootFolderId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [agentThreads, selectedRootFolderId]);

  const chatContextPapers = useMemo(() => {
    const paperPool = (activeFolderPapers.length ? activeFolderPapers : openTabs).filter(Boolean);
    const byId = new Map(paperPool.map((paper) => [paper.id, paper]));
    const explicitlySelected = selectedChatPaperIds.map((id) => byId.get(id)).filter(Boolean);
    if (chatContextMode === "manual") {
      return explicitlySelected.length ? explicitlySelected : (activePaper ? [activePaper] : []);
    }
    return activePaper ? [activePaper] : explicitlySelected;
  }, [activeFolderPapers, openTabs, selectedChatPaperIds, activePaper, chatContextMode]);
  const agentContextPapers = useMemo(() => {
    const byId = new Map(agentWorkspacePapers.map((paper) => [paper.id, paper]));
    return selectedAgentPaperIds.map((id) => byId.get(id)).filter(Boolean);
  }, [agentWorkspacePapers, selectedAgentPaperIds]);
  const activePaperMessageCount = useMemo(
    () => activePaperThreads.reduce((sum, thread) => sum + thread.messages.length, 0),
    [activePaperThreads]
  );
  const savedPaperThreads = useMemo(
    () => activePaperThreads.filter((thread) => thread.id !== activeChatId),
    [activePaperThreads, activeChatId]
  );
  const savedAgentThreads = useMemo(
    () => selectedRootAgentThreads.filter((thread) => thread.id !== activeAgentChatId),
    [selectedRootAgentThreads, activeAgentChatId]
  );
  const lastActiveMessage = currentMessages[currentMessages.length - 1] || null;
  const lastActiveAgentMessage = currentAgentMessages[currentAgentMessages.length - 1] || null;
  const activeChatLoadingState =
    chatLoadingState?.chatId === activeChatId && lastActiveMessage?.role === "user"
      ? chatLoadingState
      : null;
  const activeAgentLoadingState =
    agentLoadingState?.chatId === activeAgentChatId && lastActiveAgentMessage?.role === "user"
      ? agentLoadingState
      : null;
  const isChatLoading = Boolean(activeChatLoadingState);
  const isAgentLoading = Boolean(activeAgentLoadingState);
  const chatLoadingLabel =
    activeChatLoadingState?.phase === "scanning" && isActivePaperScanning
      ? `${activePaperScanLabel} (${activePaperScanPercent}%)`
      : activeChatLoadingState?.label || "Analysing...";
  const agentLoadingLabel = activeAgentLoadingState?.label || "Researching...";
  const activeChatSummary = activeChat ? `${formatChatMessageCount(currentMessages.length)} · ${formatChatTimestamp(activeChat.updatedAt)}` : "No active chat";
  const activeAgentSummary = activeAgentChat ? `${formatChatMessageCount(currentAgentMessages.length)} · ${formatChatTimestamp(activeAgentChat.updatedAt)}` : "No active agent chat";
  const chatQuickActions = [
    {
      title: "Summarize the paper's main claim",
      meta: "Fast overview",
      prompt: "Summarize the paper's main claim",
      icon: <ISpark size={13} />,
    },
    {
      title: "What methodology does this paper use?",
      meta: "Methods and design",
      prompt: "What methodology does this paper use?",
      icon: <ISearch size={13} />,
    },
    {
      title: "List the strongest limitations",
      meta: "Critical reading",
      prompt: "List the strongest limitations",
      icon: <IChat size={13} />,
    },
  ];
  const agentTools = [
    {
      id: "research",
      title: "Research",
      meta: "Deep web + library synthesis",
      placeholder: "Ask Paperview Agent to research a topic using the web and any selected local papers...",
      allowWebSearch: true,
      allowLocalSearch: true,
      reasoningEffort: "medium",
      reasoningEffortWithLocal: "high",
      instruction: "Selected Agent tool: Research. Perform a deeper research pass that synthesizes evidence across web_search and any attached local PDFs. Use web_search for discovery, use search_document for attached local papers, compare findings carefully, and surface nuanced agreements, disagreements, and evidence gaps.",
      icon: <ISpark size={13} />,
    },
    {
      id: "search-papers",
      title: "Search for papers",
      meta: "Discover literature",
      placeholder: "Ask Paperview Agent to find papers on a topic...",
      allowWebSearch: true,
      allowLocalSearch: true,
      reasoningEffort: "low",
      instruction: "Selected Agent tool: Search for papers. Prioritize web_search to find relevant literature and return paper_results when useful. Use local PDFs only when they materially help the answer.",
      icon: <ISearch size={13} />,
    },
    {
      id: "outline-review",
      title: "Outline literature review",
      meta: "Structure a review",
      placeholder: "Describe the topic you want a literature review outline for...",
      allowWebSearch: true,
      allowLocalSearch: true,
      reasoningEffort: "medium",
      instruction: "Selected Agent tool: Outline literature review. Produce a concise but well-structured review outline with themes, subtopics, and key papers. Use web_search for discovery and weave in attached local PDFs when relevant.",
      icon: <ISpark size={13} />,
    },
    {
      id: "compare-library",
      title: "Compare with my library",
      meta: "Web + local context",
      placeholder: "Ask for a comparison between current literature and your attached local papers...",
      allowWebSearch: true,
      allowLocalSearch: true,
      reasoningEffort: "medium",
      instruction: "Selected Agent tool: Compare with my library. Compare discovered web sources with the attached local PDFs. If no local PDFs are attached for this turn, say that clearly and continue with web evidence only.",
      icon: <IChat size={13} />,
    },
    {
      id: "search-workspace",
      title: "Search workspace",
      meta: "Use local PDFs only",
      placeholder: "Ask Paperview Agent to search only the attached local workspace papers...",
      allowWebSearch: false,
      allowLocalSearch: true,
      reasoningEffort: "low",
      instruction: "Selected Agent tool: Search workspace. Do not use web_search. Use only attached local PDFs through search_document. If no local PDFs are attached for this turn, say that clearly and ask the user to attach local papers.",
      icon: <IFolder size={13} />,
    },
  ];

  const selectedAgentTool = useMemo(
    () => agentTools.find((tool) => tool.id === selectedAgentToolId) || null,
    [agentTools, selectedAgentToolId]
  );

  const focusAgentComposer = useCallback(() => {
    requestAnimationFrame(() => {
      const textarea = agentTaRef.current;
      if (!textarea) return;
      textarea.focus();
      const caret = textarea.value.length;
      try {
        textarea.setSelectionRange(caret, caret);
      } catch {
        // Some browsers do not expose setSelectionRange for every textarea state.
      }
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, []);

  const selectAgentTool = useCallback((toolId) => {
    setSelectedAgentToolId(toolId);
    setAgentToolMenuOpen(false);
    focusAgentComposer();
  }, [focusAgentComposer]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, activeChatId]);

  useEffect(() => {
    agentEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentAgentMessages, activeAgentChatId]);

  useEffect(() => {
    if (!agentPreviewState) return;
    if (agentPreviewState.chatId !== activeAgentChatId) {
      setAgentPreviewState(null);
      agentPreviewScrollFnRef.current = null;
      return;
    }
    if (agentPreviewState.paperId && !activeAgentPreviewPaper) {
      setAgentPreviewState(null);
      agentPreviewScrollFnRef.current = null;
    }
  }, [agentPreviewState, activeAgentChatId, activeAgentPreviewPaper]);

  useEffect(() => {
    const pinnedIds = new Set([activeTabId, agentPreviewState?.paperId].filter(Boolean));
    const evictedIds = Object.keys(paperPayloads).filter((paperId) => !pinnedIds.has(paperId));
    if (!evictedIds.length) return;
    evictedIds.forEach((paperId) => clearOcrMemoryCache(paperId));
    setPaperPayloads((prev) => evictUnpinnedPayloads(prev, pinnedIds));
  }, [activeTabId, agentPreviewState?.paperId, paperPayloads]);

  useEffect(() => {
    if (chatLoadingState?.chatId !== activeChatId) return;
    if (!lastActiveMessage || lastActiveMessage.role !== "user") {
      setChatLoadingState(null);
    }
  }, [activeChatId, chatLoadingState, lastActiveMessage]);

  useEffect(() => {
    if (agentLoadingState?.chatId !== activeAgentChatId) return;
    if (!lastActiveAgentMessage || lastActiveAgentMessage.role !== "user") {
      setAgentLoadingState(null);
    }
  }, [activeAgentChatId, agentLoadingState, lastActiveAgentMessage]);

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
  }, [getPaperPayload]);

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
      if (!activePaper?.id || !Number.isFinite(totalPages) || totalPages <= 0) return;
      updatePaperEverywhere(activePaper.id, (current) =>
        current.pages === totalPages ? current : { ...current, pages: totalPages }
      );
    },
    [activePaper?.id, updatePaperEverywhere]
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

      if (paper?.fileHandle) {
        const file = await paper.fileHandle.getFile();
        uint8 = new Uint8Array(await file.arrayBuffer());
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

  const activateReaderTab = useCallback((tabId) => {
    const descriptor = openTabs.find((tab) => tab.id === tabId);
    if (!descriptor) return;

    setActiveTabId(tabId);
    setCurrentView("reader");
    scrollFnRef.current = null;

    ensurePaperPdfBytes(descriptor)
      .then((hydratedPaper) => {
        if (!hasExtractedPaperText(hydratedPaper)) {
          startPaperTextExtraction(descriptor).catch(() => {});
        }
      })
      .catch((error) => {
        console.error('Failed to activate tab paper:', error);
      });
  }, [ensurePaperPdfBytes, openTabs, startPaperTextExtraction]);

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

  useEffect(() => {
    if (!activePaper?.id) {
      setActiveChatId(null);
      return;
    }

    const paperThreads = chatThreads
      .filter((thread) => thread.paperId === activePaper.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (paperThreads.length) {
      const alreadyActive = paperThreads.some((thread) => thread.id === activeChatId);
      if (!alreadyActive) {
        setActiveChatId(paperThreads[0].id);
      }
      return;
    }

    const thread = createChatThreadRecord(activePaper.id);
    setChatThreads((prev) => [thread, ...prev]);
    saveChat(thread).catch(() => {});
    syncFolderForPaper(thread.paperId);
    setActiveChatId(thread.id);
  }, [activePaper?.id]);

  useEffect(() => {
    if (!selectedRootFolderId || !hasWritableAgentContext) {
      setActiveAgentChatId(null);
      return;
    }

    const rootThreads = agentThreads
      .filter((thread) => thread.rootFolderId === selectedRootFolderId)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (rootThreads.some((thread) => thread.id === activeAgentChatId)) {
      return;
    }

    if (rootThreads.length) {
      setActiveAgentChatId(rootThreads[0].id);
      return;
    }

    const thread = createAgentChatThreadRecord(selectedRootFolderId);
    setAgentThreads((prev) => [thread, ...prev]);
    saveAgentChat(thread)
      .then(() => syncRootFolderSnapshot(selectedRootFolderId))
      .catch(() => {});
    setActiveAgentChatId(thread.id);
  }, [selectedRootFolderId, hasWritableAgentContext, activeAgentChatId, agentThreads]);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!chatResizeRef.current.active) return;
      const delta = chatResizeRef.current.startX - event.clientX;
      const nextWidth = Math.max(340, Math.min(760, chatResizeRef.current.startWidth + delta));
      setChatWidth(nextWidth);
    };

    const onMouseUp = () => {
      if (!chatResizeRef.current.active) return;
      chatResizeRef.current.active = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!sbResizeRef.current.active) return;
      const delta = event.clientX - sbResizeRef.current.startX;
      const nextWidth = Math.max(180, Math.min(520, sbResizeRef.current.startWidth + delta));
      setSidebarWidth(nextWidth);
    };
    const onMouseUp = () => {
      if (!sbResizeRef.current.active) return;
      sbResizeRef.current.active = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!agentPreviewResizeRef.current.active) return;
      const delta = agentPreviewResizeRef.current.startX - event.clientX;
      const nextWidth = Math.max(300, Math.min(900, agentPreviewResizeRef.current.startWidth + delta));
      setAgentPreviewWidth(nextWidth);
    };

    const onMouseUp = () => {
      if (!agentPreviewResizeRef.current.active) return;
      agentPreviewResizeRef.current.active = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setViewerSearchStatus("");
    setViewerSearchMatches([]);
    setViewerSearchIndex(-1);
  }, [activeTabId]);

  useEffect(() => {
    if (viewerSearchOpen) {
      setTimeout(() => viewerSearchInputRef.current?.focus(), 0);
    }
  }, [viewerSearchOpen]);

  useEffect(() => {
    const availableIds = new Set(activeFolderPapers.map((p) => p.id));
    const next = selectedChatPaperIds.filter((id) => availableIds.has(id));

    if (chatContextMode === "auto") {
      const desired = activePaper && availableIds.has(activePaper.id) ? [activePaper.id] : next;
      const unchanged =
        desired.length === selectedChatPaperIds.length &&
        desired.every((id, index) => selectedChatPaperIds[index] === id);
      if (!unchanged) {
        setSelectedChatPaperIds(desired);
      }
      return;
    }

    if (!next.length && activePaper && availableIds.has(activePaper.id)) {
      setChatContextMode("auto");
      setSelectedChatPaperIds([activePaper.id]);
      return;
    }

    if (
      next.length !== selectedChatPaperIds.length ||
      next.some((id, index) => selectedChatPaperIds[index] !== id)
    ) {
      setSelectedChatPaperIds(next);
    }
  }, [activeFolderPapers, activePaper, selectedChatPaperIds, chatContextMode]);

  useEffect(() => {
    const availableIds = new Set(agentWorkspacePapers.map((p) => p.id));
    const next = selectedAgentPaperIds.filter((id) => availableIds.has(id));
    if (next.length !== selectedAgentPaperIds.length) {
      setSelectedAgentPaperIds(next);
    }
  }, [agentWorkspacePapers, selectedAgentPaperIds]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!modelMenuRef.current?.contains(e.target)) {
        setModelMenuOpen(false);
      }
      if (!attachMenuRef.current?.contains(e.target)) {
        setAttachMenuOpen(false);
      }
      if (!agentAttachMenuRef.current?.contains(e.target)) {
        setAgentAttachMenuOpen(false);
      }
      if (!agentToolMenuRef.current?.contains(e.target)) {
        setAgentToolMenuOpen(false);
      }
      // Dismiss citation highlights on any click (unless clicking a source card)
      if (!e.target.closest(".source-card")) {
        document.querySelectorAll(".cit-svg").forEach((s) => s.remove());
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (!text || text.length < 3) {
          setPopup(null);
          return;
        }
        try {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          const viewer = document.querySelector(".viewer");
          if (!viewer) return;
          const vr = viewer.getBoundingClientRect();
          if (rect.right < vr.left || rect.left > vr.right) return;
          setPopup({ text, x: rect.left + rect.width / 2, y: rect.top });
        } catch {
          // ignore
        }
      }, 50);
    };
    document.addEventListener("mouseup", handler);
    // Suppress Edge mini menu on text selection
    document.addEventListener("mscontrolselect", (e) => e.preventDefault());
    return () => document.removeEventListener("mouseup", handler);
  }, []);

  const appendMessageToChat = useCallback((chatId, message, options = {}) => {
    const paperId = chatThreadsRef.current.find((t) => t.id === chatId)?.paperId;
    setChatThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== chatId) return thread;
        const shouldRename = options.renameFromUser && (thread.title === CHAT_TITLE_FALLBACK || thread.messages.length === 0);
        return {
          ...thread,
          title: shouldRename ? deriveChatTitle(options.renameFromUser) : thread.title,
          messages: [...thread.messages, message],
          updatedAt: Date.now(),
        };
      });
      const updated = next.find((t) => t.id === chatId);
      if (updated) saveChat(updated).catch(() => {});
      return next;
    });
    if (paperId) syncFolderForPaper(paperId);
  }, []);

  const updateMessageInChat = useCallback((chatId, messageId, updater) => {
    if (!chatId || !messageId || typeof updater !== "function") return;
    const paperId = chatThreadsRef.current.find((t) => t.id === chatId)?.paperId;
    setChatThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== chatId) return thread;
        let changed = false;
        const messages = thread.messages.map((message) => {
          if (message?.id !== messageId) return message;
          const updatedMessage = updater(message);
          if (updatedMessage === message) return message;
          changed = true;
          return updatedMessage;
        });
        return changed
          ? {
              ...thread,
              messages,
              updatedAt: Date.now(),
            }
          : thread;
      });
      const updated = next.find((t) => t.id === chatId);
      if (updated) saveChat(updated).catch(() => {});
      return next;
    });
    if (paperId) syncFolderForPaper(paperId);
  }, []);

  const startNewChat = useCallback(() => {
    if (!activePaper?.id) return;
    if (chatLoadingState) stopChatRun();
    const thread = createChatThreadRecord(activePaper.id);
    setChatThreads((prev) => [thread, ...prev]);
    saveChat(thread).catch(() => {});
    syncFolderForPaper(thread.paperId);
    setActiveChatId(thread.id);
    setChatPaneMode("chat");
    setInput("");
    setChip(null);
  }, [activePaper?.id, chatLoadingState, stopChatRun]);

  const openChatThread = useCallback((threadId) => {
    if (chatLoadingState) stopChatRun();
    setActiveChatId(threadId);
    setChatPaneMode("chat");
  }, [chatLoadingState, stopChatRun]);

  const resetActiveChatHistory = useCallback(() => {
    if (!activeChatId) return;
    const paperId = chatThreadsRef.current.find((t) => t.id === activeChatId)?.paperId;
    setChatThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === activeChatId
          ? { ...thread, title: CHAT_TITLE_FALLBACK, messages: [], updatedAt: Date.now() }
          : thread
      );
      const updated = next.find((t) => t.id === activeChatId);
      if (updated) saveChat(updated).catch(() => {});
      return next;
    });
    if (paperId) syncFolderForPaper(paperId);
    if (chatLoadingState?.chatId === activeChatId) stopChatRun();
    setInput("");
    setChip(null);
  }, [activeChatId, chatLoadingState, stopChatRun]);

  const resetChatThreadById = useCallback(
    (threadId) => {
      const paperId = chatThreadsRef.current.find((t) => t.id === threadId)?.paperId;
      setChatThreads((prev) => {
        const next = prev.map((thread) =>
          thread.id === threadId
            ? { ...thread, title: CHAT_TITLE_FALLBACK, messages: [], updatedAt: Date.now() }
            : thread
        );
        const updated = next.find((t) => t.id === threadId);
        if (updated) saveChat(updated).catch(() => {});
        return next;
      });
      if (paperId) syncFolderForPaper(paperId);
      if (chatLoadingState?.chatId === threadId) stopChatRun();
      if (activeChatId === threadId) {
        setInput("");
        setChip(null);
      }
    },
    [activeChatId, chatLoadingState, stopChatRun]
  );

  const deleteChatThread = useCallback(
    (threadId) => {
      setChatThreads((prev) => prev.filter((thread) => thread.id !== threadId));
      deleteChat(threadId).catch(() => {});
      if (activeChatId === threadId) {
        setActiveChatId(null);
        setInput("");
        setChip(null);
      }
      if (chatLoadingState?.chatId === threadId) stopChatRun();
    },
    [activeChatId, chatLoadingState, stopChatRun]
  );

  const appendMessageToAgentChat = useCallback((chatId, message, options = {}) => {
    const rootFolderId = agentThreadsRef.current.find((thread) => thread.id === chatId)?.rootFolderId;
    setAgentThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== chatId) return thread;
        const shouldRename = options.renameFromUser && (thread.title === CHAT_TITLE_FALLBACK || thread.messages.length === 0);
        return {
          ...thread,
          title: shouldRename ? deriveChatTitle(options.renameFromUser) : thread.title,
          messages: [...thread.messages, message],
          updatedAt: Date.now(),
        };
      });
      const updated = next.find((thread) => thread.id === chatId);
      if (updated) {
        saveAgentChat(updated)
          .then(() => {
            if (rootFolderId) syncRootFolderSnapshot(rootFolderId).catch(() => {});
          })
          .catch(() => {});
      }
      return next;
    });
  }, []);

  const updateMessageInAgentChat = useCallback((chatId, messageId, updater) => {
    if (!chatId || !messageId || typeof updater !== "function") return;
    const rootFolderId = agentThreadsRef.current.find((thread) => thread.id === chatId)?.rootFolderId;
    setAgentThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== chatId) return thread;
        let changed = false;
        const messages = thread.messages.map((message) => {
          if (message?.id !== messageId) return message;
          const updatedMessage = updater(message);
          if (updatedMessage === message) return message;
          changed = true;
          return updatedMessage;
        });
        return changed ? { ...thread, messages, updatedAt: Date.now() } : thread;
      });
      const updated = next.find((thread) => thread.id === chatId);
      if (updated) {
        saveAgentChat(updated)
          .then(() => {
            if (rootFolderId) syncRootFolderSnapshot(rootFolderId).catch(() => {});
          })
          .catch(() => {});
      }
      return next;
    });
  }, []);

  const clearAgentRemotePapersForThread = useCallback((chatId) => {
    if (!chatId) return;
    const remotePapers = agentRemotePapersByThread[chatId] || [];
    remotePapers.forEach((paper) => {
      if (paper?.id && paper.id !== activeTabId && paper.id !== agentPreviewState?.paperId) {
        evictPaperPayload(paper.id);
      }
    });
    setAgentRemotePapersByThread((prev) => {
      if (!prev[chatId]) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    for (const key of [...agentRemotePaperJobsRef.current.keys()]) {
      if (key.startsWith(`${chatId}:`)) {
        agentRemotePaperJobsRef.current.delete(key);
      }
    }
  }, [activeTabId, agentPreviewState?.paperId, agentRemotePapersByThread, evictPaperPayload]);

  const startNewAgentChat = useCallback(() => {
    if (!selectedRootFolderId || !hasWritableAgentContext) return;
    if (agentLoadingState) stopAgentRun();
    const thread = createAgentChatThreadRecord(selectedRootFolderId);
    setAgentThreads((prev) => [thread, ...prev]);
    saveAgentChat(thread)
      .then(() => syncRootFolderSnapshot(selectedRootFolderId))
      .catch(() => {});
    setActiveAgentChatId(thread.id);
    setAgentInput("");
    setSelectedAgentPaperIds([]);
    setAgentPreviewState(null);
    agentPreviewScrollFnRef.current = null;
  }, [selectedRootFolderId, hasWritableAgentContext, agentLoadingState, stopAgentRun]);

  const openAgentThread = useCallback((threadId) => {
    if (agentLoadingState) stopAgentRun();
    setActiveAgentChatId(threadId);
    setAgentInput("");
  }, [agentLoadingState, stopAgentRun]);

  const resetActiveAgentHistory = useCallback(() => {
    if (!activeAgentChatId) return;
    const rootFolderId = agentThreadsRef.current.find((thread) => thread.id === activeAgentChatId)?.rootFolderId;
    setAgentThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === activeAgentChatId
          ? { ...thread, title: CHAT_TITLE_FALLBACK, messages: [], updatedAt: Date.now() }
          : thread
      );
      const updated = next.find((thread) => thread.id === activeAgentChatId);
      if (updated) {
        saveAgentChat(updated)
          .then(() => {
            if (rootFolderId) syncRootFolderSnapshot(rootFolderId).catch(() => {});
          })
          .catch(() => {});
      }
      return next;
    });
    if (agentLoadingState?.chatId === activeAgentChatId) stopAgentRun();
    setAgentInput("");
    setSelectedAgentPaperIds([]);
    clearAgentRemotePapersForThread(activeAgentChatId);
    setAgentPreviewState(null);
    agentPreviewScrollFnRef.current = null;
  }, [activeAgentChatId, agentLoadingState, clearAgentRemotePapersForThread, stopAgentRun]);

  const resetAgentThreadById = useCallback((threadId) => {
    const rootFolderId = agentThreadsRef.current.find((thread) => thread.id === threadId)?.rootFolderId;
    setAgentThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === threadId
          ? { ...thread, title: CHAT_TITLE_FALLBACK, messages: [], updatedAt: Date.now() }
          : thread
      );
      const updated = next.find((thread) => thread.id === threadId);
      if (updated) {
        saveAgentChat(updated)
          .then(() => {
            if (rootFolderId) syncRootFolderSnapshot(rootFolderId).catch(() => {});
          })
          .catch(() => {});
      }
      return next;
    });
    if (agentLoadingState?.chatId === threadId) stopAgentRun();
    if (activeAgentChatId === threadId) {
      setAgentInput("");
      setSelectedAgentPaperIds([]);
      setAgentPreviewState(null);
      agentPreviewScrollFnRef.current = null;
    }
    clearAgentRemotePapersForThread(threadId);
  }, [activeAgentChatId, agentLoadingState, clearAgentRemotePapersForThread, stopAgentRun]);

  const deleteAgentThread = useCallback((threadId) => {
    const rootFolderId = agentThreadsRef.current.find((thread) => thread.id === threadId)?.rootFolderId;
    setAgentThreads((prev) => prev.filter((thread) => thread.id !== threadId));
    deleteAgentChat(threadId)
      .then(() => {
        if (rootFolderId) syncRootFolderSnapshot(rootFolderId).catch(() => {});
      })
      .catch(() => {});
    if (activeAgentChatId === threadId) {
      setActiveAgentChatId(null);
      setAgentInput("");
      setSelectedAgentPaperIds([]);
      setAgentPreviewState(null);
      agentPreviewScrollFnRef.current = null;
    }
    if (agentLoadingState?.chatId === threadId) stopAgentRun();
    clearAgentRemotePapersForThread(threadId);
  }, [activeAgentChatId, agentLoadingState, clearAgentRemotePapersForThread, stopAgentRun]);

  const upsertAgentRemotePaper = useCallback((chatId, nextPaper) => {
    if (!chatId || !nextPaper?.id) return;
    const payload = pickPaperPayload(nextPaper);
    if (payload) {
      updatePaperPayload(nextPaper.id, payload);
    }
    const nextDescriptor = stripPaperPayload(nextPaper);
    setAgentRemotePapersByThread((prev) => {
      const existing = prev[chatId] || [];
      const nextList = existing.some((paper) => paper.id === nextDescriptor.id)
        ? existing.map((paper) => (paper.id === nextDescriptor.id ? { ...paper, ...nextDescriptor } : paper))
        : [...existing, nextDescriptor];
      return { ...prev, [chatId]: nextList };
    });
  }, [updatePaperPayload]);

  const hydrateRemotePaperForAgent = useCallback(async (chatId, descriptor, options = {}) => {
    if (!chatId) throw new Error("No active Agent thread is available.");
    const title = String(descriptor?.title || "").trim() || "Remote paper";
    const sourceUrl = normalizeAgentSourceUrl(descriptor?.sourceUrl || descriptor?.source_url || descriptor?.url || "");
    const pdfUrl = normalizeAgentSourceUrl(descriptor?.pdfUrl || descriptor?.pdf_url || "");
    if (!pdfUrl || !isPdfUrl(pdfUrl)) {
      throw new Error(`No direct PDF URL is available for "${title}".`);
    }

    const remoteKey = buildRemotePaperKey({ title, sourceUrl, pdfUrl, doi: descriptor?.doi });
    const jobKey = `${chatId}:${remoteKey}`;
    const existing = (agentRemotePapersByThread[chatId] || []).find((paper) => buildRemotePaperKey(paper) === remoteKey);
    const existingPayload = existing?.id ? getPaperPayload(existing.id) : null;
    if ((existing?.hydrationStatus === "ready" || existing?.hydrationStatus === "preview_only") && existingPayload?.pdfBytes?.length) {
      return mergePaperWithPayload(existing, existingPayload);
    }
    if (agentRemotePaperJobsRef.current.has(jobKey)) {
      return agentRemotePaperJobsRef.current.get(jobKey);
    }

    const remotePaperId = existing?.id || makeStableId("rp", `${chatId}:${remoteKey}`);
    const basePaper = {
      id: remotePaperId,
      name: title,
      title,
      sourceUrl,
      pdfUrl,
      doi: String(descriptor?.doi || "").trim(),
      authors: Array.isArray(descriptor?.authors) ? descriptor.authors.filter(Boolean) : [],
      year: String(descriptor?.year || "").trim(),
      venue: String(descriptor?.venue || "").trim(),
      summary: summarizeToWordLimit(descriptor?.summary || descriptor?.abstract || descriptor?.note || ""),
      sourceHost: getUrlHost(sourceUrl || pdfUrl),
      pages: existing?.pages || null,
      fileSize: existing?.fileSize || null,
      fileLastModified: existing?.fileLastModified || null,
      hydrationStatus: "loading",
      hydrationError: "",
    };
    upsertAgentRemotePaper(chatId, basePaper);
    if (options.traceLabel) {
      pushAgentThinkingStep({
        id: `ats-${Date.now()}-fetch-${remotePaperId}`,
        chatId,
        type: "search",
        label: options.traceLabel,
      });
    }

    const job = (async () => {
      try {
        const response = await fetchWithCorsProxy(pdfUrl);
        if (!response.ok) {
          throw new Error(`Remote PDF download failed (${response.status}).`);
        }
        const fileBuffer = await response.arrayBuffer();
        const pdfBytes = new Uint8Array(fileBuffer);
        const validation = await validatePdfBytes(pdfBytes);
        let hydratedPaper = {
          ...basePaper,
          pdfBytes,
          fileSize: pdfBytes.byteLength,
          fileLastModified: Date.now(),
          pages: validation.totalPages || basePaper.pages,
          hydrationStatus: "preview_only",
        };
        upsertAgentRemotePaper(chatId, hydratedPaper);

        try {
          const { pageTexts, totalPages } = await extractPdfText(pdfBytes);
          hydratedPaper = {
            ...hydratedPaper,
            pageTexts,
            pages: totalPages,
            hydrationStatus: "ready",
            hydrationError: "",
          };
          upsertAgentRemotePaper(chatId, hydratedPaper);
          if (options.resultLabel) {
            pushAgentThinkingStep({
              id: `ats-${Date.now()}-fetched-${remotePaperId}`,
              chatId,
              type: "result",
              label: options.resultLabel,
            });
          }
        } catch (extractError) {
          hydratedPaper = {
            ...hydratedPaper,
            hydrationStatus: "preview_only",
            hydrationError: extractError?.message || "Could not extract text from this PDF.",
          };
          upsertAgentRemotePaper(chatId, hydratedPaper);
          if (options.errorLabel) {
            pushAgentThinkingStep({
              id: `ats-${Date.now()}-fetcherr-${remotePaperId}`,
              chatId,
              type: "result",
              label: options.errorLabel,
              body: hydratedPaper.hydrationError,
            });
          }
        }

        return hydratedPaper;
      } catch (fetchError) {
        const friendlyHydrationError = isManualPdfFetchError(fetchError?.message)
          ? buildManualPdfFetchMessage(title)
          : (fetchError?.message || "Could not fetch this PDF.");
        const failedPaper = {
          ...basePaper,
          hydrationStatus: "manual_required",
          hydrationError: friendlyHydrationError,
        };
        upsertAgentRemotePaper(chatId, failedPaper);
        if (options.errorLabel) {
          pushAgentThinkingStep({
            id: `ats-${Date.now()}-fetchfail-${remotePaperId}`,
            chatId,
            type: "result",
            label: options.errorLabel,
            body: friendlyHydrationError,
          });
        }
        throw new Error(friendlyHydrationError);
      } finally {
        agentRemotePaperJobsRef.current.delete(jobKey);
      }
    })();

    agentRemotePaperJobsRef.current.set(jobKey, job);
    return job;
  }, [agentRemotePapersByThread, getPaperPayload, upsertAgentRemotePaper]);

  const handleAgentPreviewReady = useCallback((fn) => {
    agentPreviewScrollFnRef.current = fn;
  }, []);

  const jumpAgentPreviewToLocation = useCallback((page, searchText = "") => {
    const jump = (tries = 18) => {
      if (agentPreviewScrollFnRef.current) {
        agentPreviewScrollFnRef.current(Number(page) || 1, searchText || "");
        return;
      }
      if (tries > 0) setTimeout(() => jump(tries - 1), 120);
    };
    jump();
  }, []);

  const openAgentPreviewPaper = useCallback(async (descriptor, options = {}) => {
    const targetChatId = options.chatId || activeAgentChatId;
    if (!targetChatId) return;
    try {
      const remotePaper = await hydrateRemotePaperForAgent(targetChatId, descriptor);
      setAgentPreviewWidth(null);
      setAgentPreviewState({
        chatId: targetChatId,
        paperId: remotePaper.id,
        page: Number(options.page) || 1,
        searchText: options.searchText || "",
      });
      setAgentPreviewPage(Number(options.page) || 1);
      agentPreviewScrollFnRef.current = null;
      setTimeout(() => {
        if (options.page || options.searchText) {
          jumpAgentPreviewToLocation(options.page || 1, options.searchText || "");
        }
      }, 120);
    } catch (error) {
      const fallbackUrl = normalizeAgentSourceUrl(
        descriptor?.pdfUrl || descriptor?.pdf_url || descriptor?.sourceUrl || descriptor?.source_url || descriptor?.url || ""
      );
      if (fallbackUrl) {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      } else {
        throw error;
      }
    }
  }, [activeAgentChatId, hydrateRemotePaperForAgent, jumpAgentPreviewToLocation]);

  const startChatResize = useCallback(
    (event) => {
      if (!chatOpen) return;
      chatResizeRef.current = {
        active: true,
        startX: event.clientX,
        startWidth: chatWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [chatOpen, chatWidth]
  );

  const startSbResize = useCallback(
    (event) => {
      if (!sidebarOpen) return;
      sbResizeRef.current = {
        active: true,
        startX: event.clientX,
        startWidth: sidebarWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarOpen, sidebarWidth]
  );

  const startAgentPreviewResize = useCallback(
    (event) => {
      if (!hasAgentPreview) return;
      const currentWidth = agentPreviewPaneRef.current?.offsetWidth || 420;
      agentPreviewResizeRef.current = {
        active: true,
        startX: event.clientX,
        startWidth: currentWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [hasAgentPreview]
  );

  const openPaper = async (paper, folderId) => {
    const ownerFolder =
      folders.find((f) => f.id === folderId) ||
      folders.find((f) => f.papers.some((p) => p.id === paper.id));
    if (ownerFolder) {
      setSelectedFolderId(ownerFolder.id);
      setFolders((prev) => prev.map((f) => (f.id === ownerFolder.id ? { ...f, expanded: true } : f)));
    }

    let readyPaper = paper;
    try {
      readyPaper = await ensurePaperPdfBytes(paper);
    } catch (err) {
      console.error('Failed to load PDF:', err);
      alert(`Could not open "${paper.name}".\n\n${err?.message || String(err)}`);
      return;
    }

    const readyDescriptor = stripPaperPayload(readyPaper);
    if (!openTabs.find((t) => t.id === readyDescriptor.id)) setOpenTabs((p) => [...p, readyDescriptor]);
    else setOpenTabs((p) => p.map((t) => t.id === readyDescriptor.id ? readyDescriptor : t));
    setActiveTabId(readyPaper.id);
    setCurrentView("reader");
    scrollFnRef.current = null;

    if (!hasExtractedPaperText(readyPaper)) {
      startPaperTextExtraction(readyDescriptor).catch(() => {});
    }
  };

  const openAgentPaper = useCallback(async (paper, options = {}) => {
    if (!paper) return;
    const ownerFolder =
      foldersRef.current.find((folder) => folder.id === paper.folderId) ||
      foldersRef.current.find((folder) => folder.papers.some((candidate) => candidate.id === paper.id));
    if (!ownerFolder) return;

    try {
      const readyPaper = await ensurePaperPdfBytes(paper);
      setSelectedFolderId(ownerFolder.id);
      setUpFolder(ownerFolder.id);
      setCurrentView("agent");
      setFolders((prev) => prev.map((folder) => (
        folder.id === ownerFolder.id || folder.id === ownerFolder.rootFolderId
          ? { ...folder, expanded: true }
          : folder
      )));
      setAgentPreviewWidth(null);
      setAgentPreviewState({
        chatId: activeAgentChatId,
        paperId: readyPaper.id,
        page: Number(options.page) || 1,
        searchText: options.searchText || "",
      });
      setAgentPreviewPage(Number(options.page) || 1);
      agentPreviewScrollFnRef.current = null;
      if (!hasExtractedPaperText(readyPaper)) {
        startPaperTextExtraction(readyPaper).catch(() => {});
      }
      setTimeout(() => {
        if (options.page || options.searchText) {
          jumpAgentPreviewToLocation(options.page || 1, options.searchText || "");
        }
      }, 120);
    } catch (err) {
      console.error('Failed to open paper in agent mode:', err);
      alert(`Could not open "${paper.name}".\n\n${err?.message || String(err)}`);
    }
  }, [activeAgentChatId, ensurePaperPdfBytes, jumpAgentPreviewToLocation, startPaperTextExtraction]);

  const openFolderTabs = (folderId, options = {}) => {
    const { forceReader = true } = options;
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    setSelectedFolderId(folderId);
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, expanded: true } : f)));
    if (forceReader) setCurrentView("reader");
    scrollFnRef.current = null;
  };

  const openAllPapersInFolder = useCallback(async (folderId, options = {}) => {
    const { forceReader = true } = options;
    const folder = foldersRef.current.find((item) => item.id === folderId);
    if (!folder) return;
    if (folder.papers.length > 4 && !window.confirm(`Open all ${folder.papers.length} papers in "${folder.name}"? This may still use more memory than opening one paper at a time.`)) {
      return;
    }

    setSelectedFolderId(folderId);
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, expanded: true } : f)));
    setOpenTabs(folder.papers.map((paper) => stripPaperPayload(paper)));
    setActiveTabId((prev) => (folder.papers.some((paper) => paper.id === prev) ? prev : folder.papers[0]?.id || null));
    if (forceReader) setCurrentView("reader");
    scrollFnRef.current = null;

    if (folder.papers[0]) {
      ensurePaperPdfBytes(folder.papers[0]).catch(() => {});
    }
  }, [ensurePaperPdfBytes]);

  const closeTab = (e, id) => {
    e.stopPropagation();
    const remaining = openTabs.filter((t) => t.id !== id);
    setOpenTabs(remaining);
    if (agentPreviewState?.paperId !== id) {
      evictPaperPayload(id);
    }
    if (activeTabId === id) {
      setActiveTabId(remaining[remaining.length - 1]?.id || null);
    }
    if (remaining.length === 0) {
      terminateTesseractWorkerNow().catch(() => {});
    }
  };

  const addToChat = () => {
    setChip(popup.text);
    setPopup(null);
    window.getSelection()?.removeAllRanges();
    taRef.current?.focus();
  };

  const handleHighlight = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !popup) return;
    const range = sel.getRangeAt(0);
    const viewer = document.querySelector('.viewer');
    if (!viewer) return;

    // Find the page wrapper containing the selection
    let pageWrap = range.startContainer.nodeType === 3
      ? range.startContainer.parentElement?.closest('[data-page]')
      : range.startContainer.closest?.('[data-page]');
    if (!pageWrap) return;

    const pageNum = parseInt(pageWrap.dataset.page, 10);
    const tl = pageWrap.querySelector('.textLayer');
    if (!tl) return;

    const spans = Array.from(tl.querySelectorAll('span'));
    if (!spans.length) return;

    // Build character offset from text layer spans
    let charPos = 0;
    let startOffset = -1;
    let endOffset = -1;

    for (const span of spans) {
      const text = span.textContent || '';
      const spanStart = charPos;
      const spanEnd = charPos + text.length;

      if (range.intersectsNode(span)) {
        // Compute where selection starts/ends within this span
        let relStart = 0;
        let relEnd = text.length;

        if (span.contains(range.startContainer) || span === range.startContainer) {
          relStart = range.startContainer.nodeType === 3
            ? range.startOffset
            : 0;
        }
        if (span.contains(range.endContainer) || span === range.endContainer) {
          relEnd = range.endContainer.nodeType === 3
            ? range.endOffset
            : text.length;
        }

        const absStart = spanStart + relStart;
        const absEnd = spanStart + relEnd;

        if (startOffset === -1 || absStart < startOffset) startOffset = absStart;
        if (absEnd > endOffset) endOffset = absEnd;
      }
      charPos += text.length;
    }

    if (startOffset === -1 || endOffset === -1 || startOffset >= endOffset) return;

    const selectedText = popup.text;
    const newAnn = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paperId: activePaper?.id,
      pageNum,
      selectedText,
      comment: '',
      color: 'rgba(255,213,79,.4)',
      startOffset,
      endOffset,
      createdAt: Date.now(),
    };

    setAnnotations((prev) => [...prev, newAnn]);
    saveAnnotation(newAnn).catch(() => {});
    syncFolderForPaper(newAnn.paperId);
    setPopup(null);
    window.getSelection()?.removeAllRanges();

    // Show popover for comment entry
    const rect = range.getBoundingClientRect();
    setAnnPopover({ ann: newAnn, x: rect.left + rect.width / 2, y: rect.bottom + 4, isNew: true });
    setAnnComment('');
  };

  const handleAnnotationClick = useCallback((ann, pos) => {
    setAnnPopover({ ann, x: pos.x, y: pos.y, isNew: false });
    setAnnComment(ann.comment || '');
    setPopup(null);
  }, []);

  const saveAnnotationComment = () => {
    if (!annPopover) return;
    const updated = { ...annPopover.ann, comment: annComment };
    setAnnotations((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    saveAnnotation(updated).catch(() => {});
    syncFolderForPaper(updated.paperId);
    setAnnPopover(null);
  };

  const deleteAnnotationById = (annId) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annId));
    deleteAnnotation(annId).catch(() => {});
    setAnnPopover(null);
  };

  const goToPage = useCallback(
    (requestedPage, searchText = "", occurrenceIndex) => {
      const total = activePaperTotalPages;
      const page = Math.max(1, Math.min(total, Number(requestedPage) || 1));
      setCurrentPage(page);
      if (scrollFnRef.current) scrollFnRef.current(page, searchText, occurrenceIndex);
    },
    [activePaperTotalPages]
  );

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

  const handleSearchClick = () => {
    if (!viewerSearchOpen) {
      setViewerSearchOpen(true);
      return;
    }
    runViewerSearch(1);
  };

  const pushThinkingStep = (step) => {
    setThinkingSteps(prev => {
      const next = [...prev, step];
      thinkingStepsRef.current = next;
      return next;
    });
  };

  const clearThinkingSteps = (chatId) => {
    setThinkingSteps(prev => {
      const next = prev.filter(s => s.chatId !== chatId);
      thinkingStepsRef.current = next;
      return next;
    });
  };

  const pushAgentThinkingStep = (step) => {
    setAgentThinkingSteps((prev) => {
      const next = [...prev, step];
      agentThinkingStepsRef.current = next;
      return next;
    });
  };

  const clearAgentThinkingSteps = (chatId) => {
    setAgentThinkingSteps((prev) => {
      const next = prev.filter((step) => step.chatId !== chatId);
      agentThinkingStepsRef.current = next;
      return next;
    });
  };

  const beginRequestRun = useCallback((requestRef, chatId) => {
    requestRef.current.controller?.abort();
    const controller = new AbortController();
    const token = Date.now() + Math.random();
    requestRef.current = { controller, token, chatId };
    return { controller, token };
  }, []);

  const ensureRequestRunActive = useCallback((requestRef, token) => {
    if (requestRef.current.token !== token) {
      throw createStoppedError();
    }
  }, []);

  const finishRequestRun = useCallback((requestRef, token) => {
    if (requestRef.current.token === token) {
      requestRef.current = { controller: null, token: 0, chatId: null };
    }
  }, []);

  function stopChatRun() {
    const activeRun = chatRequestRef.current;
    activeRun.controller?.abort();
    chatRequestRef.current = { controller: null, token: 0, chatId: null };
    if (activeRun.chatId) clearThinkingSteps(activeRun.chatId);
    setChatLoadingState(null);
  }

  function stopAgentRun() {
    const activeRun = agentRequestRef.current;
    activeRun.controller?.abort();
    agentRequestRef.current = { controller: null, token: 0, chatId: null };
    if (activeRun.chatId) clearAgentThinkingSteps(activeRun.chatId);
    setAgentLoadingState(null);
  }

  const doSend = async (override) => {
    const text = override || (chip ? `[Regarding: "${chip.substring(0, 80)}..."]\n${input}` : input);
    if (!text.trim() || !activeChatId || chatLoadingState) return;
    const targetChatId = activeChatId;
    const { controller, token } = beginRequestRun(chatRequestRef, targetChatId);
    const userMessage = { id: createChatMessageId(), role: "user", content: text };
    appendMessageToChat(targetChatId, userMessage, { renameFromUser: text });
    setInput("");
    setChip(null);
    setChatLoadingState({ chatId: targetChatId, phase: "preparing", label: "Preparing chat..." });
    clearThinkingSteps(targetChatId);

    try {
      const usageTotals = createUsageTotals();
      const conversationHistory = currentMessages.slice(-8);
      const contextPapers = chatContextPapers;
      if (!contextPapers.length) {
        throw new Error("No document is currently selected. Open or attach a PDF before asking a question.");
      }

      const readyContextPapers = [];
      if (contextPapers.some((paper) => !hasExtractedPaperText(paper))) {
        setChatLoadingState({
          chatId: targetChatId,
          phase: "scanning",
          label:
            contextPapers.length === 1
              ? `Scanning ${contextPapers[0].name} for chat...`
              : `Scanning ${contextPapers.length} papers for chat...`,
        });
      }
      for (const paper of contextPapers) {
        readyContextPapers.push(hasExtractedPaperText(paper) ? paper : await startPaperTextExtraction(paper));
        ensureRequestRunActive(chatRequestRef, token);
      }

      setChatLoadingState({ chatId: targetChatId, phase: "thinking", label: "Analysing..." });

      const availableDocumentNames = readyContextPapers.map((paper) => `"${paper.name}"`).join(", ");
      const basePayload = {
        model: selectedModel,
        max_output_tokens: 4096,
        text: { format: { type: "json_object" } },
        instructions: CHAT_SYSTEM_PROMPT,
        tools: [SEARCH_DOCUMENT_TOOL],
        reasoning: { effort: "low", summary: "detailed" },
      };

      let data = await requestOpenAIResponse(apiKey, {
        ...basePayload,
        input: [
          ...conversationHistory.map((message) => ({
            role: message.role === "ai" ? "assistant" : message.role,
            content: message.content,
          })),
          {
            role: "user",
            content: `Available documents: ${availableDocumentNames}\n\nQuestion: ${text}\n\nUse the search_document tool to retrieve evidence before answering. Respond in JSON format.`,
          },
        ],
      }, { signal: controller.signal });
      ensureRequestRunActive(chatRequestRef, token);
      addUsageTotals(usageTotals, data?.usage);
      console.log("[reasoning debug] first response output:", JSON.stringify(data?.output?.map(o => ({ type: o.type, summary: o.summary })), null, 2));
      const reasoning1 = extractReasoningSummary(data);
      if (reasoning1) pushThinkingStep({ id: `ts-${Date.now()}-r1`, chatId: targetChatId, type: "reasoning", label: "Reasoning", body: reasoning1 });

      let rounds = 0;
      while (rounds < MAX_SEARCH_TOOL_ROUNDS) {
        ensureRequestRunActive(chatRequestRef, token);
        const toolCalls = extractFunctionCalls(data);
        if (!toolCalls.length) break;

        rounds += 1;
        for (const call of toolCalls) {
          let args = {};
          try { args = JSON.parse(call.arguments || "{}"); } catch {}
          const q = String(args.query || "").trim();
          const doc = String(args.document_name || "").trim();
          pushThinkingStep({ id: `ts-${Date.now()}-s${rounds}-${call.call_id}`, chatId: targetChatId, type: "search", label: `Searching "${doc}" for "${q.length > 60 ? q.slice(0, 60) + "…" : q}"...` });
        }

        const richOutputs = toolCalls.map((call) => {
          let args = {};
          if (typeof call.arguments === "string") {
            try {
              args = JSON.parse(call.arguments || "{}");
            } catch {
              args = {};
            }
          } else if (call.arguments && typeof call.arguments === "object") {
            args = call.arguments;
          }

          const requestedQuery = String(args.query || "").trim() || text;
          const paper = findPaperByName(readyContextPapers, args.document_name);

          if (!paper) {
            return {
              toolOutput: {
                type: "function_call_output",
                call_id: call.call_id,
                output: `Document "${String(args.document_name || "").trim()}" was not found. Available documents: ${availableDocumentNames}`,
              },
              paperName: String(args.document_name || "").trim(),
              passageCount: 0,
              notFound: true,
            };
          }

          const pageTexts = Array.isArray(paper.pageTexts) && paper.pageTexts.length
            ? paper.pageTexts
            : derivePageTexts(paper);
          const passages = selectRelevantPassages(requestedQuery, pageTexts, {
            topN: 4,
            minScore: 0.01,
            maxChars: 12000,
            maxExcerptChars: 1200,
            pageHint: Number.isFinite(args.page_hint) ? args.page_hint : null,
          });

          return {
            toolOutput: {
              type: "function_call_output",
              call_id: call.call_id,
              output: formatSearchToolResult(paper, requestedQuery, passages),
            },
            paperName: paper.name,
            passageCount: passages.length,
            notFound: false,
          };
        });
        const toolOutputs = richOutputs.map(r => r.toolOutput);
        for (const r of richOutputs) {
          pushThinkingStep({ id: `ts-${Date.now()}-r${rounds}-${r.paperName}`, chatId: targetChatId, type: "result", label: r.notFound ? `Document not found: "${r.paperName}"` : `Found ${r.passageCount} passage${r.passageCount !== 1 ? "s" : ""} in "${r.paperName}"` });
        }

        data = await requestOpenAIResponse(apiKey, {
          ...basePayload,
          previous_response_id: data.id,
          input: toolOutputs,
        }, { signal: controller.signal });
        ensureRequestRunActive(chatRequestRef, token);
        addUsageTotals(usageTotals, data?.usage);
        const reasoningN = extractReasoningSummary(data);
        if (reasoningN) pushThinkingStep({ id: `ts-${Date.now()}-rn${rounds}`, chatId: targetChatId, type: "reasoning", label: "Continued reasoning", body: reasoningN });
      }

      // If still tool calls after max rounds, proceed anyway with the last response that has text

      const raw = extractResponseOutputText(data);
      let parsed;
      {
        const tryParseJson = (str) => { try { const p = JSON.parse(str); if (p?.answer) return p; } catch {} try { const p = JSON.parse(sanitizeJsonNewlines(str)); if (p?.answer) return p; } catch {} return null; };
        const lastBrace = raw.lastIndexOf('}');
        let found = null;
        if (lastBrace !== -1) {
          let pos = raw.indexOf('{');
          const starts = [];
          while (pos !== -1 && pos <= lastBrace) { starts.push(pos); pos = raw.indexOf('{', pos + 1); }
          for (let i = starts.length - 1; i >= 0; i--) { found = tryParseJson(raw.slice(starts[i], lastBrace + 1)); if (found) break; }
        }
        parsed = found || { answer: raw.replace(/```json|```/g, "").trim(), citations: [] };
      }

      const allPapers = folders.flatMap((folder) =>
        folder.papers.map((paper) => ({ ...paper, folderId: folder.id }))
      );
      const norm = (v) => String(v || "").trim().toLowerCase();
      const normalizedCitations = (parsed.citations || []).map((c) => {
        const requestedName = String(c.file || c.fileName || c.document || "").trim();
        const match = requestedName
          ? allPapers.find((paper) => norm(paper.name) === norm(requestedName))
          : null;
        return {
          ...c,
          fileName: match?.name || requestedName || activePaper?.name || "Unknown file",
          paperId: match?.id || activePaper?.id || null,
          folderId: match?.folderId || null,
        };
      });

      const usageBreakdown = getUsageBreakdown(selectedModel, usageTotals);
      const usageMeta = {
        model: usageBreakdown.model,
        pricingModel: usageBreakdown.pricingModel,
        inputTokens: usageBreakdown.inputTokens,
        cachedInputTokens: usageBreakdown.cachedInputTokens,
        uncachedInputTokens: usageBreakdown.uncachedInputTokens,
        outputTokens: usageBreakdown.outputTokens,
        reasoningTokens: usageBreakdown.reasoningTokens,
        totalTokens: usageBreakdown.totalTokens,
        inputCost: usageBreakdown.inputCost,
        outputCost: usageBreakdown.outputCost,
        totalCost: usageBreakdown.totalCost,
      };

      ensureRequestRunActive(chatRequestRef, token);
      updateMessageInChat(targetChatId, userMessage.id, (message) => ({
        ...message,
        usage: usageMeta,
      }));
      const capturedTrace = thinkingStepsRef.current.filter(s => s.chatId === targetChatId);
      appendMessageToChat(targetChatId, {
        id: createChatMessageId(),
        role: "ai",
        content: String(parsed.answer).replace(/^[,\s]+/, ""),
        citations: normalizedCitations,
        usage: usageMeta,
        thinkingTrace: capturedTrace,
      });
      clearThinkingSteps(targetChatId);
    } catch (e) {
      if (isAbortLikeError(e)) {
        clearThinkingSteps(targetChatId);
        return;
      }
      if (/No OpenAI API key is configured/i.test(e?.message || "")) {
        openSettingsModal("");
      }
      appendMessageToChat(targetChatId, {
        id: createChatMessageId(),
        role: "ai",
        content: `Could not prepare this chat request: ${e?.message || String(e)}`,
        citations: [],
      });
    } finally {
      finishRequestRun(chatRequestRef, token);
      setChatLoadingState(null);
    }
  };

  const doSendAgent = async (override) => {
    const text = override || agentInput;
    if (!text.trim() || !activeAgentChatId || agentLoadingState || !selectedRootFolderId) return;
    const targetChatId = activeAgentChatId;
    const { controller, token } = beginRequestRun(agentRequestRef, targetChatId);
    const activeTool = selectedAgentTool;
    const userMessage = {
      id: createChatMessageId(),
      role: "user",
      content: text,
      agentToolId: activeTool?.id || null,
      agentToolTitle: activeTool?.title || "",
    };
    appendMessageToAgentChat(targetChatId, userMessage, { renameFromUser: text });
    setAgentInput("");
    setAgentLoadingState({
      chatId: targetChatId,
      phase: "preparing",
      label: activeTool ? `${activeTool.title}...` : "Preparing research...",
    });
    clearAgentThinkingSteps(targetChatId);

    try {
      const usageTotals = createUsageTotals();
      const conversationHistory = currentAgentMessages.slice(-8);
      const contextPapers = agentContextPapers;
      const readyContextPapers = [];
      let threadRemotePapers = (agentRemotePapersByThread[targetChatId] || []).map((paper) => mergePaperWithPayload(paper, getPaperPayload(paper.id)));

      if (contextPapers.some((paper) => !hasExtractedPaperText(paper))) {
        setAgentLoadingState({
          chatId: targetChatId,
          phase: "scanning",
          label:
            contextPapers.length === 1
              ? `Scanning ${contextPapers[0].name} for local context...`
              : `Scanning ${contextPapers.length} papers for local context...`,
        });
      }

      for (const paper of contextPapers) {
        readyContextPapers.push(hasExtractedPaperText(paper) ? paper : await startPaperTextExtraction(paper));
        ensureRequestRunActive(agentRequestRef, token);
      }

      setAgentLoadingState({
        chatId: targetChatId,
        phase: "thinking",
        label:
          activeTool?.id === "search-workspace"
            ? "Searching workspace..."
            : activeTool?.id === "research"
              ? (readyContextPapers.length ? "Researching across web and local papers..." : "Researching across the web...")
              : "Searching papers...",
      });

      pushAgentThinkingStep({
        id: `ats-${Date.now()}-boot-reason`,
        chatId: targetChatId,
        type: "reasoning",
        label:
          activeTool?.id === "research"
            ? "Planning a deeper research strategy..."
            : activeTool?.id === "outline-review"
              ? "Planning the review structure and evidence needs..."
              : "Planning the search strategy...",
      });
      if (activeTool?.allowWebSearch !== false) {
        pushAgentThinkingStep({
          id: `ats-${Date.now()}-boot-web`,
          chatId: targetChatId,
          type: "search",
          label:
            activeTool?.id === "research"
              ? "Searching the web for relevant scholarly sources..."
              : "Preparing web source discovery...",
        });
      }
      if ((activeTool?.allowLocalSearch ?? true) && readyContextPapers.length) {
        pushAgentThinkingStep({
          id: `ats-${Date.now()}-boot-local`,
          chatId: targetChatId,
          type: "search",
          label:
            readyContextPapers.length === 1
              ? `Reviewing the attached local paper "${readyContextPapers[0].name}"...`
              : `Reviewing ${readyContextPapers.length} attached local papers...`,
        });
      }

      const availableDocumentNames = readyContextPapers.map((paper) => `"${paper.name}"`).join(", ");
      const modeInstruction = activeTool?.instruction || "No Agent tool is selected. Use the available tools that best fit the user's request.";
      const localContextInstruction = readyContextPapers.length
        ? `Attached local documents for this turn: ${availableDocumentNames}. If you cite a local document, call search_document before citing it.`
        : "No local PDFs are attached for this turn.";
      const enabledTools = [];
      if (activeTool?.allowWebSearch !== false) {
        enabledTools.push(AGENT_WEB_SEARCH_TOOL);
        enabledTools.push(FETCH_REMOTE_PAPER_TOOL);
      }
      if (activeTool?.allowLocalSearch ?? true) {
        enabledTools.push(SEARCH_DOCUMENT_TOOL);
      }
      const reasoningEffort =
        readyContextPapers.length > 0 && activeTool?.reasoningEffortWithLocal
          ? activeTool.reasoningEffortWithLocal
          : activeTool?.reasoningEffort || "low";
      const basePayload = {
        model: selectedModel,
        max_output_tokens: AGENT_MAX_OUTPUT_TOKENS,
        instructions: [AGENT_SYSTEM_PROMPT, modeInstruction, localContextInstruction].filter(Boolean).join("\n\n"),
        include: ["web_search_call.action.sources"],
        reasoning: { effort: reasoningEffort, summary: "detailed" },
        ...(enabledTools.length ? { tools: enabledTools, tool_choice: "auto" } : {}),
      };
      const normalizeParsedAgentResponse = (responseData) => {
        const raw = extractResponseOutputText(responseData);
        const tryParseJson = (str) => {
          try {
            const parsed = JSON.parse(str);
            if (parsed?.answer) return parsed;
          } catch {}
          try {
            const parsed = JSON.parse(sanitizeJsonNewlines(str));
            if (parsed?.answer) return parsed;
          } catch {}
          return null;
        };
        // Find the { that begins the actual JSON response object by scanning all { positions.
        // The greedy /\{[\s\S]*\}/ fails when the model prefixes the JSON with prose containing
        // curly braces (e.g. "{EEG markers}"), so we try each { from last to first.
        const lastBrace = raw.lastIndexOf('}');
        if (lastBrace !== -1) {
          let pos = raw.indexOf('{');
          const starts = [];
          while (pos !== -1 && pos <= lastBrace) {
            starts.push(pos);
            pos = raw.indexOf('{', pos + 1);
          }
          for (let i = starts.length - 1; i >= 0; i--) {
            const result = tryParseJson(raw.slice(starts[i], lastBrace + 1));
            if (result) {
              return {
                parsed: result,
                parsedJson: true,
                raw,
              };
            }
          }
        }
        return {
          parsed: { answer: raw.replace(/```json|```/g, "").trim(), citations: [], paper_results: [] },
          parsedJson: false,
          raw,
        };
      };

      const normalizePaperResults = (paperResults = []) =>
        paperResults
          .map((result, index) => {
            const sourceUrl = normalizeAgentSourceUrl(result?.source_url || result?.sourceUrl || result?.url || result?.landing_url || "");
            const pdfUrl = normalizeAgentSourceUrl(result?.pdf_url || result?.pdfUrl || "");
            return {
              id: result?.id || `paper-result-${targetChatId}-${Date.now()}-${index}`,
              title: String(result?.title || `Paper ${index + 1}`),
              authors: Array.isArray(result?.authors)
                ? result.authors.map((author) => String(author || "").trim()).filter(Boolean)
                : String(result?.authors || "").split(/,\s*/).filter(Boolean),
              year: result?.year ? String(result.year) : "",
              venue: String(result?.venue || result?.journal || result?.source || ""),
              abstract: String(result?.abstract || ""),
              summary: summarizeToWordLimit(result?.summary || result?.abstract || ""),
              sourceUrl,
              pdfUrl: isPdfUrl(pdfUrl) ? pdfUrl : "",
              doi: String(result?.doi || ""),
            };
          })
          .filter((result) => result.title || result.sourceUrl);

      const collectWebSources = (responseData, label, type = "search") => {
        const passSources = extractWebSearchSources(responseData);
        if (passSources.length) {
          collectedWebSources.push(...passSources);
          pushAgentThinkingStep({
            id: `ats-${Date.now()}-web-${Math.random().toString(36).slice(2, 7)}`,
            chatId: targetChatId,
            type,
            label,
          });
        }
        return passSources;
      };

      const upsertThreadRemotePaper = (nextPaper) => {
        if (!nextPaper?.id) return;
        threadRemotePapers = threadRemotePapers.some((paper) => paper.id === nextPaper.id)
          ? threadRemotePapers.map((paper) => (paper.id === nextPaper.id ? { ...paper, ...nextPaper } : paper))
          : [...threadRemotePapers, nextPaper];
      };

      const getSearchableDocuments = () => [
        ...readyContextPapers,
        ...threadRemotePapers.filter((paper) => hasExtractedPaperText(paper)),
      ];

      const formatAvailableDocuments = () => {
        const documents = getSearchableDocuments();
        return documents.length
          ? documents.map((paper) => `"${paper.name}"`).join(", ")
          : "none";
      };

      const finalizeAgentJsonResponse = async (responseData) => {
        let current = responseData;
        let parseResult = normalizeParsedAgentResponse(current);

        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (parseResult.parsedJson && !isResponseIncompleteForMaxOutput(current)) {
            return { responseData: current, parseResult };
          }

          pushAgentThinkingStep({
            id: `ats-${Date.now()}-finalize-${attempt + 1}`,
            chatId: targetChatId,
            type: "reasoning",
            label: attempt === 0 ? "Finalizing the answer cleanly..." : "Retrying final answer formatting...",
          });

          current = await requestOpenAIResponse(apiKey, {
            model: selectedModel,
            previous_response_id: current.id,
            max_output_tokens: AGENT_FINALIZE_MAX_OUTPUT_TOKENS,
            instructions: [
              AGENT_SYSTEM_PROMPT,
              "Return the final answer again from scratch as one complete JSON object using the required schema.",
              "Do not call tools. Do not continue a partial JSON object. Rewrite the full final answer compactly enough to fit within this response.",
              "Preserve the complete citations array and paper_results before expanding the answer prose. If needed, shorten the answer slightly rather than dropping citations.",
            ].join("\n\n"),
            reasoning: { effort: "low", summary: "detailed" },
            input: [
              {
                role: "user",
                content: "Return the final answer again from scratch as one complete JSON object only. Keep the citations and paper_results complete, and if you need to save tokens, compress the answer wording before omitting citations. Do not call any more tools.",
              },
            ],
          }, { signal: controller.signal });
          ensureRequestRunActive(agentRequestRef, token);
          addUsageTotals(usageTotals, current?.usage);
          const finalReasoning = extractReasoningSummary(current);
          if (finalReasoning) {
            pushAgentThinkingStep({
              id: `ats-${Date.now()}-finalize-reason-${attempt + 1}`,
              chatId: targetChatId,
              type: "reasoning",
              label: "Final answer reasoning",
              body: finalReasoning,
            });
          }
          parseResult = normalizeParsedAgentResponse(current);
        }

        return { responseData: current, parseResult };
      };

      const runAgentPass = async ({ input: passInput, previousResponseId = null, passNumber = 1 }) => {
        let responseData = await requestOpenAIResponse(apiKey, {
          ...basePayload,
          ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
          input: passInput,
        }, { signal: controller.signal });
        ensureRequestRunActive(agentRequestRef, token);
        addUsageTotals(usageTotals, responseData?.usage);
        collectWebSources(
          responseData,
          passNumber === 1
            ? `Web search discovered ${extractWebSearchSources(responseData).length} candidate source${extractWebSearchSources(responseData).length === 1 ? "" : "s"}.`
            : `Research pass ${passNumber} discovered ${extractWebSearchSources(responseData).length} more candidate source${extractWebSearchSources(responseData).length === 1 ? "" : "s"}.`
        );
        const initialReasoning = extractReasoningSummary(responseData);
        if (initialReasoning) {
          pushAgentThinkingStep({
            id: `ats-${Date.now()}-reason-${passNumber}`,
            chatId: targetChatId,
            type: "reasoning",
            label: passNumber === 1 ? "Reasoning" : `Reasoning pass ${passNumber}`,
            body: initialReasoning,
          });
        }

        let toolCycles = 0;
        while (toolCycles < MAX_SEARCH_TOOL_ROUNDS) {
          ensureRequestRunActive(agentRequestRef, token);
          const toolCalls = extractFunctionCalls(responseData);
          if (!toolCalls.length) break;
          toolCycles += 1;

          const toolOutputs = [];
          for (const call of toolCalls) {
            let args = {};
            if (typeof call.arguments === "string") {
              try {
                args = JSON.parse(call.arguments || "{}");
              } catch {
                args = {};
              }
            } else if (call.arguments && typeof call.arguments === "object") {
              args = call.arguments;
            }

            if (call.name === FETCH_REMOTE_PAPER_TOOL.name) {
              ensureRequestRunActive(agentRequestRef, token);
              const descriptor = {
                title: String(args.title || "").trim(),
                sourceUrl: String(args.source_url || "").trim(),
                pdfUrl: String(args.pdf_url || "").trim(),
                doi: String(args.doi || "").trim(),
              };
              try {
                const remotePaper = await hydrateRemotePaperForAgent(targetChatId, descriptor, {
                  traceLabel: `Fetching remote PDF for "${descriptor.title || "paper"}"...`,
                  resultLabel: `Hydrated "${descriptor.title || "paper"}" for grounded citation search.`,
                  errorLabel: `Fetched "${descriptor.title || "paper"}", but text extraction was incomplete.`,
                });
                ensureRequestRunActive(agentRequestRef, token);
                upsertThreadRemotePaper(remotePaper);
                toolOutputs.push({
                  type: "function_call_output",
                  call_id: call.call_id,
                  output: [
                    `Hydrated remote paper: "${remotePaper.name}"`,
                    remotePaper.hydrationStatus === "ready"
                      ? `The paper is now searchable with search_document under the exact document name "${remotePaper.name}".`
                      : "The PDF is available for preview, but text extraction did not complete, so search_document may not find passages.",
                    `Available searchable documents: ${formatAvailableDocuments()}.`,
                  ].join("\n"),
                });
              } catch (fetchError) {
                pushAgentThinkingStep({
                  id: `ats-${Date.now()}-fetch-fail-${call.call_id}`,
                  chatId: targetChatId,
                  type: "result",
                  label: `Could not hydrate "${descriptor.title || "remote paper"}"`,
                  body: fetchError?.message || String(fetchError),
                });
                toolOutputs.push({
                  type: "function_call_output",
                  call_id: call.call_id,
                  output: `Remote paper hydration failed for "${descriptor.title || "paper"}": ${fetchError?.message || String(fetchError)}`,
                });
              }
              continue;
            }

            if (call.name !== SEARCH_DOCUMENT_TOOL.name) {
              toolOutputs.push({
                type: "function_call_output",
                call_id: call.call_id,
                output: `Unsupported tool call "${call.name}".`,
              });
              continue;
            }

            const requestedQuery = String(args.query || "").trim() || text;
            const requestedDocument = String(args.document_name || "").trim();
            pushAgentThinkingStep({
              id: `ats-${Date.now()}-search-${toolCycles}-${call.call_id}`,
              chatId: targetChatId,
              type: "search",
              label: `Searching "${requestedDocument}" for "${requestedQuery.length > 60 ? `${requestedQuery.slice(0, 60)}...` : requestedQuery}"...`,
            });

            const paper = findPaperByName(getSearchableDocuments(), requestedDocument);
            if (!paper) {
              pushAgentThinkingStep({
                id: `ats-${Date.now()}-search-miss-${toolCycles}-${call.call_id}`,
                chatId: targetChatId,
                type: "result",
                label: `Document not available: "${requestedDocument || "unknown"}"`,
                body: `Available searchable documents: ${formatAvailableDocuments()}.`,
              });
              toolOutputs.push({
                type: "function_call_output",
                call_id: call.call_id,
                output: `Document "${requestedDocument}" was not found. Available searchable documents: ${formatAvailableDocuments()}.`,
              });
              continue;
            }

            const pageTexts = Array.isArray(paper.pageTexts) && paper.pageTexts.length
              ? paper.pageTexts
              : derivePageTexts(paper);
            const passages = selectRelevantPassages(requestedQuery, pageTexts, {
              topN: 4,
              minScore: 0.01,
              maxChars: 12000,
              maxExcerptChars: 1200,
              pageHint: Number.isFinite(args.page_hint) ? args.page_hint : null,
            });

            pushAgentThinkingStep({
              id: `ats-${Date.now()}-search-hit-${toolCycles}-${call.call_id}`,
              chatId: targetChatId,
              type: "result",
              label: passages.length
                ? `Found ${passages.length} passage${passages.length === 1 ? "" : "s"} in "${paper.name}".`
                : `No direct passages found in "${paper.name}".`,
            });
            toolOutputs.push({
              type: "function_call_output",
              call_id: call.call_id,
              output: formatSearchToolResult(paper, requestedQuery, passages),
            });
          }

          responseData = await requestOpenAIResponse(apiKey, {
            ...basePayload,
            previous_response_id: responseData.id,
            input: toolOutputs,
          }, { signal: controller.signal });
          ensureRequestRunActive(agentRequestRef, token);
          addUsageTotals(usageTotals, responseData?.usage);
          collectWebSources(
            responseData,
            `Web search now has ${extractWebSearchSources(responseData).length} consulted source${extractWebSearchSources(responseData).length === 1 ? "" : "s"} in play.`,
            "result"
          );
          const continuedReasoning = extractReasoningSummary(responseData);
          if (continuedReasoning) {
            pushAgentThinkingStep({
              id: `ats-${Date.now()}-reason-next-${toolCycles}`,
              chatId: targetChatId,
              type: "reasoning",
              label: "Continued reasoning",
              body: continuedReasoning,
            });
          }
        }

        return responseData;
      };

      const collectedWebSources = [];
      let collectedPaperResults = [];
      let passNumber = 1;
      let data = await runAgentPass({
        passNumber,
        input: [
          ...conversationHistory.map((message) => ({
            role: message.role === "ai" ? "assistant" : message.role,
            content: message.content,
          })),
          {
            role: "user",
            content: text,
          },
        ],
      });

      let parseResult = normalizeParsedAgentResponse(data);
      let parsed = parseResult.parsed;
      collectedPaperResults = normalizePaperResults(parsed.paper_results || []);
      let foundSourcesMeta = buildFoundSources({
        paperResults: collectedPaperResults,
        webSources: collectedWebSources,
        remotePapers: threadRemotePapers,
      });

      while (
        activeTool?.id === "research" &&
        passNumber < MAX_AGENT_RESEARCH_PASSES &&
        foundSourcesMeta.total < TARGET_FOUND_SOURCES
      ) {
        const beforeTotal = foundSourcesMeta.total;
        const nextPassNumber = passNumber + 1;
        pushAgentThinkingStep({
          id: `ats-${Date.now()}-deepen-${nextPassNumber}`,
          chatId: targetChatId,
          type: "search",
          label: `Research pass ${nextPassNumber}: broadening for more distinct scholarly sources...`,
        });
        data = await runAgentPass({
          passNumber: nextPassNumber,
          previousResponseId: data.id,
          input: [
            {
              role: "user",
              content: "Continue searching for additional distinct scholarly sources. Broaden and refine the search, fetch and ground any high-value PDFs you rely on, then return an updated final JSON answer using the same schema.",
            },
          ],
        });
        parseResult = normalizeParsedAgentResponse(data);
        parsed = parseResult.parsed;
        collectedPaperResults = [
          ...collectedPaperResults,
          ...normalizePaperResults(parsed.paper_results || []),
        ];
        foundSourcesMeta = buildFoundSources({
          paperResults: collectedPaperResults,
          webSources: collectedWebSources,
          remotePapers: threadRemotePapers,
        });
        if (foundSourcesMeta.total <= beforeTotal) {
          pushAgentThinkingStep({
            id: `ats-${Date.now()}-deepen-stop-${nextPassNumber}`,
            chatId: targetChatId,
            type: "result",
            label: `Research pass ${nextPassNumber} did not add new distinct sources.`,
          });
          passNumber = nextPassNumber;
          break;
        }
        pushAgentThinkingStep({
          id: `ats-${Date.now()}-deepen-done-${nextPassNumber}`,
          chatId: targetChatId,
          type: "result",
          label: `Research pass ${nextPassNumber} expanded the source set to ${foundSourcesMeta.total}.`,
        });
        passNumber = nextPassNumber;
      }

      const finalized = await finalizeAgentJsonResponse(data);
      data = finalized.responseData;
      parseResult = finalized.parseResult;
      parsed = parseResult.parsed;
      collectedPaperResults = [
        ...collectedPaperResults,
        ...normalizePaperResults(parsed.paper_results || []),
      ];
      foundSourcesMeta = buildFoundSources({
        paperResults: collectedPaperResults,
        webSources: collectedWebSources,
        remotePapers: threadRemotePapers,
      });

      const allPapers = folders.flatMap((folder) =>
        folder.papers.map((paper) => ({ ...paper, folderId: folder.id }))
      );
      const norm = (value) => String(value || "").trim().toLowerCase();
      const foundSourceMap = new Map(
        foundSourcesMeta.all
          .map((source) => [buildRemotePaperKey(source), source])
          .filter(([key]) => key)
      );
      const normalizedCitations = (parsed.citations || [])
        .map((citation, index) => {
          const kind = String(citation?.kind || (citation?.file ? "local" : "web")).toLowerCase();
          if (kind === "local") {
            const requestedName = String(citation.file || citation.fileName || citation.document || "").trim();
            const matchPaper = requestedName
              ? allPapers.find((paper) => norm(paper.name) === norm(requestedName))
              : null;
            return {
              kind: "local",
              ...citation,
              fileName: matchPaper?.name || requestedName || "Unknown file",
              paperId: matchPaper?.id || null,
              folderId: matchPaper?.folderId || null,
              page: Number.isFinite(Number(citation?.page)) ? Number(citation.page) : null,
              section: String(citation?.section || ""),
              text: String(citation?.text || citation?.note || ""),
              title: String(citation?.title || matchPaper?.name || requestedName || `Local source ${index + 1}`),
            };
          }

          const url = normalizeAgentSourceUrl(citation?.url || citation?.source_url || "");
          const pdfUrl = normalizeAgentSourceUrl(citation?.pdf_url || citation?.pdfUrl || "");
          const matchedSource = foundSourceMap.get(buildRemotePaperKey({
            title: citation?.title,
            sourceUrl: url,
            pdfUrl,
            doi: citation?.doi,
          })) || null;
          const remotePaper = findMatchingRemotePaper(threadRemotePapers, {
            remotePaperId: matchedSource?.remotePaperId,
            title: citation?.title,
            sourceUrl: url,
            pdfUrl,
            doi: citation?.doi,
          });
          if (!url && !pdfUrl && !remotePaper?.pdfUrl) return null;
          return {
            kind: "web",
            title: String(citation?.title || matchedSource?.title || citation?.source || `Web source ${index + 1}`),
            url: url || matchedSource?.sourceUrl || remotePaper?.sourceUrl || remotePaper?.pdfUrl || "",
            pdfUrl: pdfUrl || matchedSource?.pdfUrl || remotePaper?.pdfUrl || "",
            source: String(citation?.source || matchedSource?.venue || matchedSource?.sourceHost || remotePaper?.sourceHost || getUrlHost(url || pdfUrl)),
            text: String(citation?.text || citation?.note || ""),
            note: String(citation?.note || ""),
            page: Number.isFinite(Number(citation?.page)) ? Number(citation.page) : null,
            section: String(citation?.section || ""),
            remotePaperId: remotePaper?.id || matchedSource?.remotePaperId || null,
          };
        })
        .filter(Boolean);

      if (!normalizedCitations.length && collectedWebSources.length) {
        normalizedCitations.push(
          ...foundSourcesMeta.shown.slice(0, 6).map((source, index) => ({
            kind: "web",
            title: String(source?.title || `Web source ${index + 1}`),
            url: source?.sourceUrl || source?.pdfUrl || "",
            pdfUrl: source?.pdfUrl || "",
            source: String(source?.venue || source?.sourceHost || getUrlHost(source?.sourceUrl || source?.pdfUrl || "")),
            text: "",
            note: "",
            page: null,
            section: "",
            remotePaperId: source?.remotePaperId || null,
          })).filter((source) => source.url)
        );
      }

      if (!collectedPaperResults.length && collectedWebSources.length) {
        collectedPaperResults = foundSourcesMeta.shown.map((source, index) => ({
          id: source.id || `paper-result-${targetChatId}-fallback-${index}`,
          title: source.title || `Result ${index + 1}`,
          authors: source.authors || [],
          year: source.year || "",
          venue: source.venue || source.sourceHost || "",
          abstract: source.summary || "",
          summary: source.summary || "",
          sourceUrl: source.sourceUrl || "",
          pdfUrl: source.pdfUrl || "",
          doi: source.doi || "",
        }));
      }

      const usageBreakdown = getUsageBreakdown(selectedModel, usageTotals);
      const usageMeta = {
        model: usageBreakdown.model,
        pricingModel: usageBreakdown.pricingModel,
        inputTokens: usageBreakdown.inputTokens,
        cachedInputTokens: usageBreakdown.cachedInputTokens,
        uncachedInputTokens: usageBreakdown.uncachedInputTokens,
        outputTokens: usageBreakdown.outputTokens,
        reasoningTokens: usageBreakdown.reasoningTokens,
        totalTokens: usageBreakdown.totalTokens,
        inputCost: usageBreakdown.inputCost,
        outputCost: usageBreakdown.outputCost,
        totalCost: usageBreakdown.totalCost,
      };

      ensureRequestRunActive(agentRequestRef, token);
      updateMessageInAgentChat(targetChatId, userMessage.id, (message) => ({
        ...message,
        usage: usageMeta,
      }));

      const capturedTrace = agentThinkingStepsRef.current.filter((step) => step.chatId === targetChatId);
      appendMessageToAgentChat(targetChatId, {
        id: createChatMessageId(),
        role: "ai",
        content: String(parsed.answer || "").replace(/^[,\s]+/, ""),
        citations: normalizedCitations,
        foundSources: foundSourcesMeta.all,
        foundSourcesShown: foundSourcesMeta.shown.length,
        foundSourcesTotal: foundSourcesMeta.total,
        paperResults: collectedPaperResults,
        usage: usageMeta,
        thinkingTrace: capturedTrace,
      });
      clearAgentThinkingSteps(targetChatId);
    } catch (error) {
      if (isAbortLikeError(error)) {
        clearAgentThinkingSteps(targetChatId);
        return;
      }
      const rawMessage = error?.message || String(error);
      if (/No OpenAI API key is configured/i.test(rawMessage)) {
        openSettingsModal("");
      }
      const friendlyMessage = /web_search|unsupported|not supported/i.test(rawMessage)
        ? `The selected model (${selectedModel}) could not use web search. Choose a model with tool support and try again.`
        : rawMessage;
      appendMessageToAgentChat(targetChatId, {
        id: createChatMessageId(),
        role: "ai",
        content: `Could not prepare this agent request: ${friendlyMessage}`,
        citations: [],
        foundSources: [],
        foundSourcesShown: 0,
        foundSourcesTotal: 0,
        paperResults: [],
      });
    } finally {
      finishRequestRun(agentRequestRef, token);
      setAgentLoadingState(null);
    }
  };

  const askAI = async () => {
    const t = popup.text;
    setPopup(null);
    window.getSelection()?.removeAllRanges();
    await doSend(`Explain this passage: "${t.substring(0, 200)}${t.length > 200 ? "..." : ""}"`);
  };

  const handleCitationClick = (citation) => {
    if (citation?.kind === "web" || citation?.url) {
      const remotePaper = findMatchingRemotePaper(activeAgentRemotePapers, {
        remotePaperId: citation?.remotePaperId,
        title: citation?.title,
        sourceUrl: citation?.url,
        pdfUrl: citation?.pdfUrl,
      });
      const pdfUrl = normalizeAgentSourceUrl(citation?.pdfUrl || remotePaper?.pdfUrl || "");
      const sourceUrl = normalizeAgentSourceUrl(citation?.url || remotePaper?.sourceUrl || "");
      const localPaper = findWorkspacePaperForSource(agentWorkspacePapers, {
        title: citation?.title || remotePaper?.title || remotePaper?.name || "",
        sourceUrl,
        pdfUrl,
        doi: citation?.doi || remotePaper?.doi || "",
      });
      if (localPaper && currentView === "agent") {
        openAgentPaper(localPaper, {
          page: Number(citation?.page) || 1,
          searchText: citation?.text || citation?.note || "",
        });
        return;
      }
      if ((pdfUrl || remotePaper?.id) && currentView === "agent" && activeAgentChatId) {
        openAgentPreviewPaper({
          remotePaperId: remotePaper?.id || citation?.remotePaperId || null,
          title: citation?.title || remotePaper?.title || remotePaper?.name || "Remote paper",
          sourceUrl,
          pdfUrl,
          doi: citation?.doi || remotePaper?.doi || "",
        }, {
          chatId: activeAgentChatId,
          page: Number(citation?.page) || 1,
          searchText: citation?.text || citation?.note || "",
        }).catch(() => {});
        return;
      }
      if (sourceUrl) window.open(sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const targetPaperId = citation?.paperId || activePaper?.id;
    const owner = folders.find((f) => f.papers.some((p) => p.id === targetPaperId));
    const targetPaper = owner?.papers.find((p) => p.id === targetPaperId) || activePaper;

    const jump = (tries = 18) => {
      if (scrollFnRef.current) {
        scrollFnRef.current(Number(citation?.page) || 1, citation?.text || "");
        return;
      }
      if (tries > 0) setTimeout(() => jump(tries - 1), 120);
    };

    if (targetPaper && targetPaper.id !== activeTabId) {
      if (owner?.id) {
        openPaper(targetPaper, owner.id).then(() => {
          setTimeout(() => jump(), 220);
        }).catch(() => {});
      } else {
        setCurrentView("reader");
        setActiveTabId(targetPaper.id);
        scrollFnRef.current = null;
        setTimeout(() => jump(), 220);
      }
      return;
    }
    jump();
  };

  const renderUsageMeta = useCallback((message) => {
    const usage = message?.usage;
    if (!usage?.model) return null;

    if (message.role === "user" && usage.inputTokens > 0) {
      const details = [
        usage.model,
        `${formatTokenCount(usage.inputTokens)} input tok`,
      ];
      if (usage.cachedInputTokens > 0) {
        details.push(`${formatTokenCount(usage.cachedInputTokens)} cached`);
      }
      const formattedCost = formatUsd(usage.inputCost);
      if (formattedCost) details.push(formattedCost);
      return <div className="chat-usage-meta">{details.join(" | ")}</div>;
    }

    if (message.role === "ai" && usage.outputTokens > 0) {
      const details = [
        usage.model,
        `${formatTokenCount(usage.outputTokens)} output tok`,
      ];
      if (usage.reasoningTokens > 0) {
        details.push(`${formatTokenCount(usage.reasoningTokens)} reasoning`);
      }
      const formattedCost = formatUsd(usage.outputCost);
      if (formattedCost) details.push(formattedCost);
      return <div className="chat-usage-meta">{details.join(" | ")}</div>;
    }

    return null;
  }, []);

  const renderAgentPreviewDrawer = useCallback(() => {
    if (!agentPreviewState || !activeAgentPreviewPaper?.pdfBytes?.length) return null;
    const previewSourceUrl = normalizeAgentSourceUrl(activeAgentPreviewPaper.sourceUrl || activeAgentPreviewPaper.pdfUrl || "");
    const previewSubtitle = activeAgentPreviewPaper.venue
      || activeAgentPreviewPaper.sourceHost
      || activeAgentPreviewPaper.authors
      || "Workspace PDF";
    return (
      <aside className="agent-preview-drawer" ref={agentPreviewPaneRef}>
        <div className="agent-preview-head">
          <div className="agent-preview-copy">
            <div className="agent-empty-eyebrow">In-chat PDF preview</div>
            <div className="agent-preview-title">{activeAgentPreviewPaper.title || activeAgentPreviewPaper.name || "Remote paper"}</div>
            <div className="agent-preview-subtitle">
              {previewSubtitle}
            </div>
          </div>
          <button
            className="chat-topbar-btn"
            type="button"
            onClick={() => {
              setAgentPreviewWidth(null);
              setAgentPreviewState(null);
              agentPreviewScrollFnRef.current = null;
            }}
            title="Close preview"
          >
            <IClose size={14} />
          </button>
        </div>

        <div className="agent-preview-toolbar">
          <div className="agent-preview-toolbar-meta">Page {Math.max(1, Number(agentPreviewPage) || 1)}</div>
          <div className="agent-preview-toolbar-actions">
            <button
              className="chat-topbar-btn"
              type="button"
              onClick={() => setAgentPreviewScale((value) => Math.max(0.7, Number((value - 0.1).toFixed(2))))}
              title="Zoom out"
            >
              <IZoomOut size={14} />
            </button>
            <button
              className="chat-topbar-btn"
              type="button"
              onClick={() => setAgentPreviewScale((value) => Math.min(1.8, Number((value + 0.1).toFixed(2))))}
              title="Zoom in"
            >
              <IZoomIn size={14} />
            </button>
            {previewSourceUrl ? (
              <button
                className="chat-history-btn"
                type="button"
                onClick={() => window.open(previewSourceUrl, "_blank", "noopener,noreferrer")}
              >
                Open source
              </button>
            ) : null}
          </div>
        </div>

        {activeAgentPreviewPaper.hydrationError ? (
          <div className="agent-preview-note">{activeAgentPreviewPaper.hydrationError}</div>
        ) : null}

        <div className="agent-preview-viewer">
          <div className="pdf-scroll">
            <PdfViewer
              pdfBytes={activeAgentPreviewPaper.pdfBytes}
              paperId={activeAgentPreviewPaper.id}
              fileSize={activeAgentPreviewPaper.fileSize}
              fileLastModified={activeAgentPreviewPaper.fileLastModified}
              scale={agentPreviewScale}
              onReady={handleAgentPreviewReady}
              onPageChange={setAgentPreviewPage}
            />
          </div>
        </div>
      </aside>
    );
  }, [
    activeAgentPreviewPaper,
    agentPreviewPage,
    agentPreviewScale,
    agentPreviewState,
    handleAgentPreviewReady,
  ]);

  const getAvailablePdfFileName = useCallback(async (dirHandle, desiredFileName) => {
    const safeFileName = ensurePdfFileName(desiredFileName);
    const stem = stripPdfExtension(safeFileName);
    let attempt = 0;

    while (attempt < 1000) {
      const candidate = attempt === 0 ? safeFileName : `${stem} (${attempt}).pdf`;
      try {
        await dirHandle.getFileHandle(candidate);
        attempt += 1;
      } catch {
        return candidate;
      }
    }

    throw new Error("Could not find an available filename for this import.");
  }, []);

  const ensureImportedFolder = useCallback(async (rootFolderId) => {
    const rootFolder = foldersRef.current.find((folder) => folder.id === rootFolderId && folder.rootFolderId === rootFolderId);
    if (!rootFolder?.rootHandle) {
      throw new Error("Open a writable Paperview folder before importing papers.");
    }

    const selectedWritableFolder = foldersRef.current.find(
      (folder) => folder.id === selectedFolderId && folder.rootFolderId === rootFolderId && folder.directoryHandle
    );
    if (selectedWritableFolder) {
      return selectedWritableFolder;
    }

    const existingImportedFolder = foldersRef.current.find(
      (folder) => folder.rootFolderId === rootFolderId && folder.relativePath === AGENT_IMPORTS_FOLDER_NAME
    );
    if (existingImportedFolder?.directoryHandle) {
      return existingImportedFolder;
    }

    const directoryHandle = await rootFolder.rootHandle.getDirectoryHandle(AGENT_IMPORTS_FOLDER_NAME, { create: true });
    const folderPath = buildFolderPath(rootFolder.name, AGENT_IMPORTS_FOLDER_NAME);
    const nextFolder = {
      id: makeStableId('f', folderPath),
      name: AGENT_IMPORTS_FOLDER_NAME,
      expanded: true,
      papers: existingImportedFolder?.papers || [],
      depth: 1,
      directoryHandle,
      rootHandle: rootFolder.rootHandle,
      rootFolderId,
      relativePath: AGENT_IMPORTS_FOLDER_NAME,
      folderPath,
    };

    folderHandlesMapRef.current.set(nextFolder.id, rootFolder.rootHandle);
    setFolders((prev) => {
      const existingIndex = prev.findIndex((folder) => folder.id === nextFolder.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], ...nextFolder };
        return next;
      }
      const rootIndex = prev.findIndex((folder) => folder.id === rootFolderId);
      if (rootIndex === -1) return [...prev, nextFolder];
      const next = [...prev];
      next.splice(rootIndex + 1, 0, nextFolder);
      return next;
    });

    return nextFolder;
  }, [selectedFolderId]);

  const importPaperResult = useCallback(async (result, messageId) => {
    const importKey = buildAgentImportKey(messageId, result);
    setAgentImportStates((prev) => ({ ...prev, [importKey]: { status: "loading", label: "Importing PDF..." } }));

    try {
      const rootFolderId = activeAgentChat?.rootFolderId || selectedRootFolderId;
      if (!rootFolderId || !hasWritableAgentContext) {
        throw new Error("Open a writable Paperview folder before importing papers.");
      }

      const pdfUrl = normalizeAgentSourceUrl(result?.pdfUrl || "");
      if (!pdfUrl) {
        throw new Error("No direct PDF URL is available for this result.");
      }

      const targetFolder = await ensureImportedFolder(rootFolderId);
      const response = await fetchWithCorsProxy(pdfUrl);
      if (!response.ok) {
        throw new Error(`PDF download failed (${response.status}).`);
      }

      const fileBuffer = await response.arrayBuffer();
      const pdfBytes = new Uint8Array(fileBuffer);
      await validatePdfBytes(pdfBytes);
      const fileName = await getAvailablePdfFileName(targetFolder.directoryHandle, result?.title || "Imported paper");
      const fileHandle = await targetFolder.directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBytes);
      await writable.close();

      const savedFile = await fileHandle.getFile();
      const paper = {
        id: makeStableId('p', `${targetFolder.folderPath}/${fileName}`),
        name: stripPdfExtension(fileName),
        authors: Array.isArray(result?.authors) ? result.authors.join(", ") : "",
        year: result?.year || "",
        pages: null,
        size: `${(savedFile.size / 1024 / 1024).toFixed(1)} MB`,
        fileSize: savedFile.size,
        fileLastModified: savedFile.lastModified,
        textStatus: "idle",
        textProgress: 0,
        textError: null,
        textStatusText: "",
        fileHandle,
        folderId: targetFolder.id,
        rootFolderId,
      };

      setFolders((prev) => prev.map((folder) => (
        folder.id === targetFolder.id
          ? {
              ...folder,
              expanded: true,
              papers: folder.papers.some((existing) => existing.id === paper.id)
                ? folder.papers
                : [...folder.papers, paper],
            }
          : folder
      )));
      setSelectedFolderId(targetFolder.id);
      setUpFolder(targetFolder.id);
      setAgentImportStates((prev) => ({ ...prev, [importKey]: { status: "done", label: `Saved to ${targetFolder.name}` } }));
      openAgentPaper(paper);
    } catch (error) {
      const message = isManualPdfFetchError(error?.message)
        ? buildManualPdfFetchMessage(result?.title || "This paper")
        : (error?.message || "Import failed.");
      setAgentImportStates((prev) => ({
        ...prev,
        [importKey]: { status: "error", label: message },
      }));
    }
  }, [activeAgentChat?.rootFolderId, ensureImportedFolder, getAvailablePdfFileName, hasWritableAgentContext, openAgentPaper, selectedRootFolderId]);

  const toggleFolder = (id) => setFolders((p) => p.map((f) => (f.id === id ? { ...f, expanded: !f.expanded } : f)));

  const createFolder = () => {
    const name = nfName.trim();
    if (!name) {
      setFolderError("Folder name is required.");
      return;
    }
    if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      setFolderError("A folder with this name already exists.");
      return;
    }

    const newId = `f${Date.now()}`;
    setFolders((p) => [...p, {
      id: newId,
      name,
      expanded: true,
      papers: [],
      depth: 0,
      directoryHandle: null,
      rootHandle: null,
      rootFolderId: newId,
      relativePath: "",
      folderPath: buildFolderPath(name),
    }]);
    setSelectedFolderId(newId);
    setUpFolder(newId);
    setNfName("");
    setFolderError("");
    setNewFolder(false);
  };

  const startNewFolder = () => {
    setNewFolder(true);
    setFolderError("");
    setNfName("");
  };

  const cancelNewFolder = () => {
    setNewFolder(false);
    setFolderError("");
    setNfName("");
  };

  const deletePaper = (folderId, paperId) => {
    const ownerFolder = folders.find((folder) => folder.id === folderId);
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId
          ? { ...f, papers: f.papers.filter((p) => p.id !== paperId) }
          : f
      )
    );
    setOpenTabs((prevTabs) => {
      const nextTabs = prevTabs.filter((t) => t.id !== paperId);
      if (activeTabId === paperId) {
        setActiveTabId(nextTabs[nextTabs.length - 1]?.id || null);
      }
      return nextTabs;
    });
    setChatThreads((prev) => prev.filter((thread) => thread.paperId !== paperId));
    deleteChatsByPaperIds([paperId]).catch(() => {});
    setAnnotations((prev) => prev.filter((a) => a.paperId !== paperId));
    deleteAnnotationsByPaperIds([paperId]).catch(() => {});
    deletePaperCachesByPaperIds([paperId]).catch(() => {});
    evictPaperPayload(paperId);
    if (ownerFolder?.rootFolderId) {
      syncRootFolderSnapshot(ownerFolder.rootFolderId).catch(() => {});
    }
  };

  const deleteFolder = (folderId) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    const isRootFolder = folder.rootFolderId === folder.id;
    const foldersToRemove = folders.filter((candidate) => {
      if (candidate.rootFolderId !== folder.rootFolderId) return false;
      if (isRootFolder) return true;
      return candidate.id === folderId || candidate.relativePath.startsWith(`${folder.relativePath}/`);
    });
    const folderIdsToRemove = new Set(foldersToRemove.map((item) => item.id));
    const ids = new Set(foldersToRemove.flatMap((item) => item.papers.map((paper) => paper.id)));
    const remainingFolders = folders.filter((f) => !folderIdsToRemove.has(f.id));
    setFolders(remainingFolders);
    if (selectedFolderId === folderId) {
      const replacementFolder = remainingFolders[0] || null;
      setSelectedFolderId(replacementFolder?.id || null);
      setUpFolder(replacementFolder?.id || "");
    }
    setOpenTabs((prevTabs) => {
      const nextTabs = prevTabs.filter((t) => !ids.has(t.id));
      if (ids.has(activeTabId)) {
        setActiveTabId(nextTabs[nextTabs.length - 1]?.id || null);
      }
      return nextTabs;
    });
    setChatThreads((prev) => prev.filter((thread) => !ids.has(thread.paperId)));
    deleteChatsByPaperIds([...ids]).catch(() => {});
    if (isRootFolder) {
      const threadsToDelete = agentThreadsRef.current.filter((thread) => thread.rootFolderId === folder.rootFolderId);
      setAgentThreads((prev) => prev.filter((thread) => thread.rootFolderId !== folder.rootFolderId));
      threadsToDelete.forEach((thread) => deleteAgentChat(thread.id).catch(() => {}));
      if (activeAgentChat?.rootFolderId === folder.rootFolderId) {
        setActiveAgentChatId(null);
        setAgentInput("");
        setSelectedAgentPaperIds([]);
      }
    }
    setAnnotations((prev) => prev.filter((a) => !ids.has(a.paperId)));
    deleteAnnotationsByPaperIds([...ids]).catch(() => {});
    deletePaperCachesByPaperIds([...ids]).catch(() => {});
    [...ids].forEach((paperId) => evictPaperPayload(paperId));
    if (!remainingFolders.length) clearFolderHandles().catch(() => {});
    if (!isRootFolder && folder.rootFolderId) {
      syncRootFolderSnapshot(folder.rootFolderId).catch(() => {});
    }
  };

  const scanDirHandle = async (dirHandle) => {
    const rootFolderPath = buildFolderPath(dirHandle.name);
    const rootFolderId = makeStableId('f', rootFolderPath);

    async function scanDir(handle, relativePath = "", depth = 0) {
      const folderName = relativePath.split("/").filter(Boolean).pop() || handle.name;
      const folderPath = buildFolderPath(dirHandle.name, relativePath);
      const folderId = makeStableId('f', folderPath);
      const folder = {
        id: folderId,
        name: folderName,
        expanded: true,
        papers: [],
        depth,
        directoryHandle: handle,
        rootHandle: dirHandle,
        rootFolderId,
        relativePath,
        folderPath,
      };
      const nested = [];

      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
          folder.papers.push({
            id: makeStableId('p', `${folderPath}/${entry.name}`),
            name: stripPdfExtension(entry.name),
            authors: '',
            year: '',
            pages: null,
            fileSize: null,
            fileLastModified: null,
            textStatus: "idle",
            textProgress: 0,
            textError: null,
            textStatusText: "",
            fileHandle: entry,
            folderId,
            rootFolderId,
          });
        } else if (entry.kind === 'directory') {
          const childRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          const children = await scanDir(entry, childRelativePath, depth + 1);
          if (children.length) nested.push(...children);
        }
      }

      return [folder, ...nested];
    }

    return scanDir(dirHandle, '', 0);
  };
  scanDirHandleRef.current = scanDirHandle;

  // Read .paperview.json from a folder's root directory handle
  const readFolderSnapshot = async (dirHandle) => {
    try {
      const fileHandle = await dirHandle.getFileHandle('.paperview.json');
      const file = await fileHandle.getFile();
      return JSON.parse(await file.text());
    } catch {
      return null;
    }
  };

  // Write .paperview.json to a folder's root directory handle
  const syncRootFolderSnapshot = async (rootFolderId) => {
    if (!rootFolderId) return;
    const rootFolder = foldersRef.current.find((folder) => folder.id === rootFolderId && folder.rootFolderId === rootFolderId);
    const dirHandle = rootFolder?.rootHandle || rootFolder?.directoryHandle;
    if (!dirHandle) return;
    try {
      const paperIds = new Set();
      for (const folder of foldersRef.current) {
        if (folder.rootFolderId === rootFolderId) {
          for (const paper of folder.papers) paperIds.add(paper.id);
        }
      }
      const allChats = await loadAllChats();
      const chats = allChats.filter((t) => paperIds.has(t.paperId));
      const allAgentChats = await loadAllAgentChats();
      const agentChats = allAgentChats.filter((thread) => thread.rootFolderId === rootFolderId);
      const allAnns = await loadAllAnnotations();
      const annotations = allAnns.filter((a) => paperIds.has(a.paperId));
      const fileHandle = await dirHandle.getFileHandle('.paperview.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify({
        version: 2,
        exportedAt: new Date().toISOString(),
        chats,
        agentChats,
        annotations,
      }, null, 2));
      await writable.close();
    } catch (err) {
      console.warn('Paperview: could not write .paperview.json:', err);
    }
  };

  // Merge a snapshot's chats and annotations into state + IndexedDB
  const applyFolderSnapshot = async (snapshot) => {
    if (!snapshot) return;
    if (snapshot.chats?.length) {
      for (const chat of snapshot.chats) await saveChat(chat).catch(() => {});
      setChatThreads((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const incoming = snapshot.chats.filter((c) => !existingIds.has(c.id));
        return [...incoming, ...prev].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      });
    }
    if (snapshot.agentChats?.length) {
      for (const thread of snapshot.agentChats) await saveAgentChat(thread).catch(() => {});
      setAgentThreads((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const incoming = snapshot.agentChats.filter((thread) => !existingIds.has(thread.id));
        return [...incoming, ...prev].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      });
    }
    if (snapshot.annotations?.length) {
      // Save to IndexedDB; they'll be loaded per-paper when the paper is opened
      for (const ann of snapshot.annotations) await saveAnnotation(ann).catch(() => {});
    }
  };

  const refreshRootFolderContents = useCallback(async (rootFolderId) => {
    if (!rootFolderId || !scanDirHandleRef.current) {
      throw new Error("Open a writable Paperview folder first.");
    }

    const rootFolder = foldersRef.current.find((folder) => folder.id === rootFolderId && folder.rootFolderId === rootFolderId);
    const dirHandle = rootFolder?.rootHandle || rootFolder?.directoryHandle;
    if (!dirHandle) {
      throw new Error("This workspace folder is not currently available.");
    }

    const scannedFolders = await scanDirHandleRef.current(dirHandle);
    for (const folder of scannedFolders) {
      folderHandlesMapRef.current.set(folder.id, dirHandle);
    }
    const snapshot = await readFolderSnapshot(dirHandle);
    if (snapshot) await applyFolderSnapshot(snapshot);

    setFolders((prev) => mergeFoldersByRoot(prev, scannedFolders, rootFolderId));

    const selectedInRoot = foldersRef.current.find((folder) => folder.id === selectedFolderId)?.rootFolderId === rootFolderId
      ? selectedFolderId
      : null;
    const nextSelectedFolder = scannedFolders.find((folder) => folder.id === selectedInRoot) || scannedFolders[0] || null;
    setSelectedFolderId(nextSelectedFolder?.id || null);
    setUpFolder(nextSelectedFolder?.id || "");
    return scannedFolders;
  }, [selectedFolderId]);

  useEffect(() => {
    if (!selectedRootFolderId || !hasWritableAgentContext) return undefined;

    const maybeRefresh = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      const lastRun = folderRefreshStateRef.current;
      if (lastRun.rootFolderId === selectedRootFolderId && now - lastRun.lastRunAt < 2500) return;
      folderRefreshStateRef.current = { rootFolderId: selectedRootFolderId, lastRunAt: now };
      refreshRootFolderContents(selectedRootFolderId).catch(() => {});
    };

    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [hasWritableAgentContext, refreshRootFolderContents, selectedRootFolderId]);

  const renderFoundSourcesPanel = useCallback((message) => {
    const foundSourcesMeta = getMessageFoundSources(message, activeAgentRemotePapers);
    if (!foundSourcesMeta.shown.length) return null;

    return (
      <section className="agent-found-sources">
        <div className="agent-found-sources-head">
          <div className="agent-found-sources-title">
            Found {foundSourcesMeta.total} source{foundSourcesMeta.total === 1 ? "" : "s"}
          </div>
          <div className="agent-found-sources-subtitle">
            Showing the top {foundSourcesMeta.shown.length} ranked by relevance
          </div>
        </div>

        <div className="agent-found-sources-list">
          {foundSourcesMeta.shown.map((source, index) => {
            const authorLine = formatSourceAuthors(source.authors);
            const venueLine = [source.venue, source.year].filter(Boolean).join(", ");
            const secondaryLine = venueLine || source.sourceHost || "Source";
            const importKey = buildAgentImportKey(message.id, source);
            const folderCheckState = agentFolderCheckStates[importKey] || null;
            const localPaper = findWorkspacePaperForSource(agentWorkspacePapers, source);
            const badgeLabel =
              localPaper
                ? "Found in folder"
                : source.hydrationStatus === "ready"
                  ? "Searchable PDF"
                  : source.hydrationStatus === "preview_only"
                    ? "Previewable PDF"
                    : source.hydrationStatus === "loading"
                      ? "Fetching PDF"
                      : source.hydrationStatus === "manual_required"
                        ? "Open in browser"
                        : source.hasPdf
                          ? "PDF link found"
                          : "";
            const openPdfInBrowser = () => {
              const targetUrl = normalizeAgentSourceUrl(source.pdfUrl || source.sourceUrl || "");
              if (targetUrl) window.open(targetUrl, "_blank", "noopener,noreferrer");
            };
            const checkFolderForPaper = async () => {
              if (!selectedRootFolderId) return;
              setAgentFolderCheckStates((prev) => ({
                ...prev,
                [importKey]: { status: "loading", label: "Checking folder..." },
              }));
              try {
                const refreshedFolders = await refreshRootFolderContents(selectedRootFolderId);
                const refreshedPaper = findWorkspacePaperForSource(
                  refreshedFolders.flatMap((folder) => folder.papers.map((paper) => ({ ...paper, folderId: folder.id }))),
                  source,
                );
                setAgentFolderCheckStates((prev) => ({
                  ...prev,
                  [importKey]: refreshedPaper
                    ? { status: "found", label: "Found in folder" }
                    : { status: "idle", label: "Not found yet" },
                }));
              } catch (error) {
                setAgentFolderCheckStates((prev) => ({
                  ...prev,
                  [importKey]: { status: "error", label: error?.message || "Could not check folder." },
                }));
              }
            };
            return (
              <article key={source.id || `${message.id}-source-${index}`} className="agent-found-source-row">
                <div className="agent-found-source-copy">
                  <div className="agent-found-source-title">{source.title || `Source ${index + 1}`}</div>
                  {authorLine ? (
                    <div className="agent-found-source-authors">{authorLine}</div>
                  ) : null}
                  {secondaryLine ? (
                    <div className="agent-found-source-meta">{secondaryLine}</div>
                  ) : null}
                  {source.summary ? (
                    <div className="agent-found-source-summary">{source.summary}</div>
                  ) : null}
                  {source.hydrationError ? (
                    <div className="agent-found-source-summary" style={{ color: "#9a3412" }}>{source.hydrationError}</div>
                  ) : null}
                  {source.hydrationStatus === "manual_required" && hasWritableAgentContext ? (
                    <div className="agent-found-source-summary">
                      Open the PDF in a browser tab, save it into <b>{selectedRootFolder?.name || "this workspace"}</b>, then click <b>Check folder</b>.
                    </div>
                  ) : null}
                  {folderCheckState?.label ? (
                    <div className="agent-found-source-summary">{folderCheckState.label}</div>
                  ) : null}
                  <div className="agent-found-source-link">{source.sourceUrl || source.pdfUrl || source.sourceHost}</div>
                </div>

                <div className="agent-found-source-actions">
                  {badgeLabel ? (
                    <span className="agent-found-source-badge">{badgeLabel}</span>
                  ) : null}
                  {source.sourceUrl ? (
                    <button
                      className="paper-result-btn"
                      type="button"
                      onClick={() => window.open(source.sourceUrl, "_blank", "noopener,noreferrer")}
                    >
                      Open source
                    </button>
                  ) : null}
                  {localPaper ? (
                    <button
                      className="paper-result-btn"
                      type="button"
                      onClick={() => openAgentPaper(localPaper)}
                    >
                      Open in agent mode
                    </button>
                  ) : null}
                  {!localPaper && source.hydrationStatus === "manual_required" && hasWritableAgentContext ? (
                    <button
                      className="paper-result-btn"
                      type="button"
                      onClick={() => checkFolderForPaper()}
                      disabled={folderCheckState?.status === "loading"}
                    >
                      Check folder
                    </button>
                  ) : null}
                  <button
                    className="paper-result-btn"
                    type="button"
                    disabled={!source.pdfUrl}
                    onClick={() => {
                      if (source.hydrationStatus === "manual_required") {
                        openPdfInBrowser();
                        return;
                      }
                      openAgentPreviewPaper({
                        remotePaperId: source.remotePaperId,
                        title: source.title,
                        sourceUrl: source.sourceUrl,
                        pdfUrl: source.pdfUrl,
                        doi: source.doi,
                      }, { chatId: activeAgentChatId }).catch(() => {});
                    }}
                  >
                    {source.hydrationStatus === "manual_required" ? "Open PDF in browser" : "Open PDF"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }, [activeAgentChatId, activeAgentRemotePapers, agentFolderCheckStates, agentWorkspacePapers, hasWritableAgentContext, openAgentPaper, openAgentPreviewPaper, refreshRootFolderContents, selectedRootFolder?.name, selectedRootFolderId]);

  // Trigger a folder snapshot write for the folder that owns a given paper
  const syncFolderForPaper = (paperId) => {
    if (!paperId) return;
    for (const folder of foldersRef.current) {
      if (folder.papers.some((p) => p.id === paperId)) {
        syncRootFolderSnapshot(folder.rootFolderId).catch(() => {});
        return;
      }
    }
  };

  const handleOpenFolder = async () => {
    if (typeof window.showDirectoryPicker !== 'function') return;
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const flatFolders = await scanDirHandle(dirHandle);
      const rootFolderId = flatFolders[0]?.rootFolderId || null;
      for (const f of flatFolders) folderHandlesMapRef.current.set(f.id, dirHandle);
      const snapshot = await readFolderSnapshot(dirHandle);
      if (snapshot) await applyFolderSnapshot(snapshot);
      setFolders((prev) => (
        rootFolderId ? mergeFoldersByRoot(prev, flatFolders, rootFolderId) : prev
      ));
      setSelectedFolderId(flatFolders[0]?.id || null);
      setUpFolder(flatFolders[0]?.id || '');
      setCurrentView('library');
      saveFolderHandle(dirHandle).catch(() => {});
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Open folder failed:', err);
    }
  };

  const fileSelected = (f) => {
    if (!f?.name?.toLowerCase().endsWith(".pdf")) {
      setUpStatus("error");
      setUpStatusText("Please choose a file with a .pdf extension.");
      return;
    }
    setPendingFile(f);
    setUpStatus("ready");
    setUpStatusText("");
  };

  const doUpload = async () => {
    if (!pendingFile) return;
    setUpStatus("parsing");
    setUpStatusText("Opening PDF...");
    try {
      const ab = await pendingFile.arrayBuffer();
      const uint8 = new Uint8Array(ab);
      const paperId = `p${Date.now()}`;
      await saveUploadedPdf({
        paperId,
        pdfBytes: uint8,
        fileSize: pendingFile.size,
        fileLastModified: pendingFile.lastModified,
        updatedAt: Date.now(),
      });
      const paper = {
        id: paperId,
        name: stripPdfExtension(pendingFile.name),
        authors: "Uploaded",
        year: new Date().getFullYear(),
        pages: null,
        size: `${(pendingFile.size / 1024 / 1024).toFixed(1)} MB`,
        fileSize: pendingFile.size,
        fileLastModified: pendingFile.lastModified,
        textStatus: "idle",
        textProgress: 0,
        textError: null,
        textStatusText: "",
      };

      const noFolder = !upFolder || !folders.some((f) => f.id === upFolder);
      if (noFolder) {
        // No folder open yet — create an in-memory "Uploads" folder
        const uploadsId = 'f-uploads';
        const existing = folders.find((f) => f.id === uploadsId);
        const readyPaper = {
          ...paper,
          folderId: uploadsId,
          rootFolderId: existing?.rootFolderId || uploadsId,
        };
        if (existing) {
          setFolders((p) => p.map((f) => (f.id === uploadsId ? { ...f, papers: [...f.papers, readyPaper], expanded: true } : f)));
          setUpFolder(uploadsId);
        } else {
          const uploadsFolder = {
            id: uploadsId,
            name: 'Uploads',
            expanded: true,
            papers: [readyPaper],
            depth: 0,
            directoryHandle: null,
            rootHandle: null,
            rootFolderId: uploadsId,
            relativePath: "",
            folderPath: buildFolderPath('Uploads'),
          };
          setFolders([uploadsFolder]);
          setSelectedFolderId(uploadsId);
          setUpFolder(uploadsId);
        }
        setUpStatus("done");
        setTimeout(() => {
          closeModal();
          openPaper(readyPaper, uploadsId);
        }, 600);
      } else {
        const targetFolder = folders.find((f) => f.id === upFolder);
        const readyPaper = {
          ...paper,
          folderId: upFolder,
          rootFolderId: targetFolder?.rootFolderId || upFolder,
        };
        setFolders((p) => p.map((f) => (f.id === upFolder ? { ...f, papers: [...f.papers, readyPaper], expanded: true } : f)));
        setUpStatus("done");
        setTimeout(() => {
          closeModal();
          openPaper(readyPaper, upFolder);
        }, 600);
      }
    } catch (error) {
      setUpStatusText(error?.message || "This PDF could not be parsed.");
      setUpStatus("error");
    }
  };

  const closeModal = () => {
    setShowUpload(false);
    setUpStatus(null);
    setUpStatusText("");
    setPendingFile(null);
  };

  const filtered = folders.map((f) => ({
    ...f,
    visiblePapers: searchQ ? f.papers.filter((p) => p.name.toLowerCase().includes(searchQ.toLowerCase())) : f.papers,
  }));

  useEffect(() => {
    if (!folders.length) {
      setSelectedFolderId(null);
      setUpFolder("");
      return;
    }
    if (!selectedFolderId || !folders.some((f) => f.id === selectedFolderId)) {
      setSelectedFolderId(folders[0].id);
    }
    if (!upFolder || !folders.some((f) => f.id === upFolder)) {
      setUpFolder(folders[0].id);
    }
  }, [folders, selectedFolderId, upFolder]);

  return (
    <>
      <style>{CSS}</style>
      <div className="app" onMouseDown={(e) => { if (!e.target.closest(".sel-pop")) setPopup(null); if (!e.target.closest(".ann-popover") && !e.target.closest("[data-ann-id]")) setAnnPopover(null); }}>
        <div className={`sb ${sidebarOpen ? "" : "closed"}`} style={sidebarOpen ? { width: sidebarWidth, minWidth: sidebarWidth } : undefined}>
          <div className="sb-inner" style={{ width: sidebarWidth }}>
            <div className="sb-user">
              <div className="sb-avatar" style={{background:'#2563eb',color:'#fff',fontWeight:800,fontSize:13}}>P</div>
              <span className="sb-username">Paperview</span>
              <button className="sb-tog" onClick={() => setSidebarOpen(false)} title="Collapse">
                <IChevronLeftDouble size={14} />
              </button>
            </div>

            <div className="sb-nav">
              <button className={`sb-nav-item ${currentView === "reader" ? "active" : ""}`} onClick={() => setCurrentView("reader")}>
                <IGrid size={14} /> Reader
              </button>
              <button className={`sb-nav-item ${currentView === "library" ? "active" : ""}`} onClick={() => setCurrentView("library")}>
                <IFolder size={14} /> Library
              </button>
              <button className={`sb-nav-item ${currentView === "agent" ? "active" : ""}`} onClick={() => setCurrentView("agent")}>
                <ISpark size={14} /> Agent
              </button>
            </div>

            <div className="sb-search-wrap">
              <div className="sb-search-icon"><ISearch size={12} /></div>
              <input
                className="sb-search-input"
                placeholder="Search…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>

            <div className="sb-section">
              <div className="sb-section-label">Folders</div>
              {filtered.map((folder) => (
                <div key={folder.id} className="sb-folder">
                  <div
                    className={`sb-folder-hd ${selectedFolderId === folder.id ? "active" : ""}`}
                    style={folder.depth ? { paddingLeft: 8 + folder.depth * 14 } : undefined}
                    onClick={() => openFolderTabs(folder.id, { forceReader: currentView === "reader" })}
                    title="Select this folder"
                  >
                    <button
                      className="sb-folder-toggle"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolder(folder.id);
                      }}
                      title={folder.expanded ? "Collapse" : "Expand"}
                    >
                      {folder.expanded ? <IChevronDown size={12} /> : <IRight size={12} />}
                    </button>
                    {folder.expanded ? <IFolderOpen size={14} /> : <IFolder size={14} />}
                    <span className="sb-folder-name">{folder.name}</span>
                    <span className="sb-folder-cnt">{folder.papers.length}</span>
                  </div>
                  {folder.expanded && (
                    <div className="sb-papers">
                      {folder.papers.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#999", padding: "4px 8px", fontStyle: "italic" }}>Empty</div>
                      ) : folder.visiblePapers.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#999", padding: "4px 8px", fontStyle: "italic" }}>No matching files</div>
                      ) : (
                        folder.visiblePapers.map((paper) => (
                          <div
                            key={paper.id}
                            className={`sb-paper ${activeTabId === paper.id ? "active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openPaper(paper, folder.id);
                            }}
                          >
                            <span className="sb-paper-icon"><IFile size={12} /></span>
                            <span className="sb-paper-title">{paper.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}

              {newFolder && currentView !== "library" && (
                <div style={{ padding: "4px 0" }}>
                  <input
                    autoFocus
                    className="nf-input"
                    value={nfName}
                    onChange={(e) => {
                      setNfName(e.target.value);
                      if (folderError) setFolderError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createFolder();
                      if (e.key === "Escape") cancelNewFolder();
                    }}
                    placeholder="Folder name…"
                  />
                  {folderError && <div className="nf-error">{folderError}</div>}
                  <div className="nf-ctrl">
                    <button className="lib-btn dark" onClick={createFolder}><IPlus size={12} /> Create</button>
                    <button className="lib-btn" onClick={cancelNewFolder}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="sb-settings-bar">
              <span className="sb-settings-dot" style={{ background: apiKey ? '#22c55e' : rememberedApiKeyAvailable ? '#f59e0b' : '#ef4444' }} />
              <span className="sb-settings-label">{apiKey ? `API key ••••${apiKey.slice(-4)}` : rememberedApiKeyAvailable ? 'API key saved (locked)' : 'No API key'}</span>
              <button className="sb-settings-gear" onClick={() => openSettingsModal(apiKey)} title="Settings"><IGear size={14} /></button>
            </div>

            <div className="sb-footer">
              {typeof window.showDirectoryPicker === 'function' && (
                <button className="sb-upload-btn" onClick={() => setShowFolderPermModal(true)}><IFolder size={13} /> Open Folder</button>
              )}
              <button className={typeof window.showDirectoryPicker === 'function' ? "sb-new-folder" : "sb-upload-btn"} onClick={() => { if (folders.length) setUpFolder(folders[0].id); setShowUpload(true); }}><IUpload size={13} /> Upload PDF</button>
              <button className="sb-new-folder" onClick={startNewFolder}><IPlus size={13} /> New Folder</button>
            </div>
          </div>
        </div>

        {sidebarOpen && (
          <div
            className="sb-resize-handle"
            onMouseDown={startSbResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
          >
            <span className="sb-resize-grip" />
          </div>
        )}

        <div className="main">
          <div className="topbar">
            <div className="topbar-left">
              {!sidebarOpen && (
                <button className="topbar-btn" onClick={() => setSidebarOpen(true)}>
                  <IChevronRightDouble size={14} /> Library
                </button>
              )}
              <IFolder size={15} style={{ color: "#777" }} />
              <div className="topbar-title-stack">
                <span className="topbar-folder-name">
                  {currentView === "library"
                    ? "Library"
                    : currentView === "agent"
                      ? (selectedRootFolder?.name ? `Agent · ${selectedRootFolder.name}` : "Agent")
                      : activeFolder?.name || "Reader"}
                </span>
                <span className="topbar-subtitle">
                  {currentView === "library"
                    ? `${totalPaperCount} paper${totalPaperCount === 1 ? "" : "s"} across ${folders.length} folders`
                    : currentView === "agent"
                      ? (hasWritableAgentContext
                        ? `Research across the web and ${agentWorkspacePapers.length} local paper${agentWorkspacePapers.length === 1 ? "" : "s"} in this workspace`
                        : "Open a writable folder to enable agent search, imports, and synced chats")
                      : activePaper?.pdfBytes
                        ? "Search, annotate, and verify with source-backed answers"
                        : "Reading from extracted text with chat grounded in the document"}
                </span>
              </div>
            </div>

            <div className="topbar-right">
              {openTabs.length > 0 && <span className="topbar-count">{openTabs.length} file{openTabs.length > 1 ? "s" : ""} open</span>}
              {currentView === "agent" && selectedRootFolder && <span className="topbar-mode">{selectedRootAgentThreads.length} thread{selectedRootAgentThreads.length === 1 ? "" : "s"}</span>}
              {currentView === "reader" && activePaper && <span className="topbar-mode">{activePaper.pdfBytes ? "Rendered PDF" : "Text mode"}</span>}
              <div className="tb-divider" />
              {currentView === "reader" && (
                <>
                  <button className={`topbar-btn ${chatOpen ? "active" : ""}`} onClick={() => setChatOpen((v) => !v)}>
                    <IChat size={13} /> Chat
                  </button>
                </>
              )}
            </div>
          </div>

          {currentView === "reader" && openTabs.length > 0 && (
            <div className="tabbar">
              {openTabs.map((tab, idx) => {
                const active = tab.id === activeTabId;
                return (
                <div
                  key={tab.id}
                  className={`tab ${active ? "active" : ""} ${idx === 0 ? "tab-first" : ""} ${idx === openTabs.length - 1 ? "tab-last" : ""}`}
                  style={{ zIndex: active ? openTabs.length + 2 : idx + 1 }}
                  onClick={() => activateReaderTab(tab.id)}
                >
                  <span className="tab-icon"><IFile size={13} /></span>
                  <span className="tab-name">{tab.name}</span>
                  <button className="tab-close" onClick={(e) => closeTab(e, tab.id)}><IClose size={10} /></button>
                </div>
              );
              })}
              <div className="tabbar-tail" />
            </div>
          )}

          <div className={`content ${currentView === "reader" ? "content-reader" : ""}`}>
            {currentView === "library" ? (
              <div className="library-view">
                <div className="library-head">
                  <div className="library-title">Library</div>
                  <div className="library-actions">
                    {typeof window.showDirectoryPicker === 'function' && (
                      <button className="lib-btn dark" onClick={() => setShowFolderPermModal(true)}><IFolder size={12} /> Open Folder</button>
                    )}
                    <button className="lib-btn" onClick={startNewFolder}><IPlus size={12} /> New Folder</button>
                    <button className="lib-btn dark" onClick={() => setShowUpload(true)}><IUpload size={12} /> Upload PDF</button>
                  </div>
                </div>

                {newFolder && (
                  <div style={{ maxWidth: 420, marginBottom: 12 }}>
                    <input
                      autoFocus
                      className="nf-input"
                      value={nfName}
                      onChange={(e) => {
                        setNfName(e.target.value);
                        if (folderError) setFolderError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createFolder();
                        if (e.key === "Escape") cancelNewFolder();
                      }}
                      placeholder="Folder name…"
                    />
                    {folderError && <div className="nf-error">{folderError}</div>}
                    <div className="nf-ctrl">
                      <button className="lib-btn dark" onClick={createFolder}><IPlus size={12} /> Create</button>
                      <button className="lib-btn" onClick={cancelNewFolder}>Cancel</button>
                    </div>
                  </div>
                )}

                <div className="library-db">
                  <div className="db-head">
                    <div className="db-h">Name</div>
                    <div className="db-h">Type</div>
                    <div className="db-h">Files</div>
                    <div className="db-h">Open Tabs</div>
                    <div className="db-h">Actions</div>
                  </div>

                  {folders.map((folder) => (
                    <React.Fragment key={folder.id}>
                      <div
                        className={`db-row folder ${selectedFolderId === folder.id ? "selected" : ""}`}
                        onClick={() => openFolderTabs(folder.id, { forceReader: false })}
                        title="Select this folder"
                      >
                        <div className="db-cell">
                          <button
                            className="db-toggle"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFolder(folder.id);
                            }}
                            title={folder.expanded ? "Collapse" : "Expand"}
                          >
                            {folder.expanded ? <IChevronDown size={12} /> : <IRight size={12} />}
                          </button>
                          {folder.expanded ? <IFolderOpen size={14} /> : <IFolder size={14} />}
                          <span className="db-title">{folder.name}</span>
                        </div>
                        <div className="db-cell"><span className="db-chip">Folder</span></div>
                        <div className="db-cell">{folder.papers.length}</div>
                        <div className="db-cell">{openTabs.filter((tab) => folder.papers.some((p) => p.id === tab.id)).length}</div>
                        <div className="db-cell">
                          <div className="db-actions">
                            <button
                              className="db-open"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAllPapersInFolder(folder.id, { forceReader: true });
                              }}
                            >
                              Open all
                            </button>
                            <button
                              className="lib-icon-btn"
                              title="Upload file to folder"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUpFolder(folder.id);
                                setShowUpload(true);
                              }}
                            >
                              <IUpload size={13} />
                            </button>
                            <button
                              className="lib-icon-btn"
                              title="Delete folder"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteFolder(folder.id);
                              }}
                            >
                              <ITrash size={13} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {folder.expanded && (
                        <div className="db-folder-files">
                          {folder.papers.length === 0 ? (
                            <div className="db-file-row empty">
                              <div className="db-cell db-file-indent" style={{ gridColumn: "1 / span 5", gap: 10 }}>
                                <span>No files in this folder.</span>
                                <button
                                  className="empty-upload-btn"
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUpFolder(folder.id);
                                    setShowUpload(true);
                                  }}
                                >
                                  <IUpload size={11} /> Upload your first pdf
                                </button>
                              </div>
                            </div>
                          ) : (
                            folder.papers.map((paper) => (
                              <div className="db-file-row" key={paper.id}>
                                <div className="db-cell db-file-indent">
                                  <IFile size={12} />
                                  <span className="db-file-name">{paper.name}</span>
                                </div>
                                <div className="db-cell"><span className="db-chip">PDF</span></div>
                                <div className="db-cell">{paper.pages ?? "-"}</div>
                                <div className="db-cell"><span className="db-meta">{openTabs.some((t) => t.id === paper.id) ? "Open" : "-"}</span></div>
                                <div className="db-cell">
                                  <div className="db-actions">
                                    <button className="db-open" onClick={() => openPaper(paper, folder.id)}>Open</button>
                                    <button className="lib-icon-btn" title="Delete file" onClick={() => deletePaper(folder.id, paper.id)}><ITrash size={13} /></button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : currentView === "agent" ? (
              <div className={`agent-view ${agentSidebarOpen ? "" : "sidebar-collapsed"}`}>
                {!hasWritableAgentContext ? (
                  <div className="agent-gate">
                    <div className="agent-empty-icon"><ISpark size={18} /></div>
                    <div className="agent-gate-copy">
                      <div className="agent-empty-eyebrow">Folder-backed workspace required</div>
                      <h2>Open a writable folder to use Agent</h2>
                      <p>Agent chats sync into that folder&apos;s <code>.paperview.json</code>, and imported PDFs are written back to the same workspace on disk.</p>
                    </div>
                    <div className="agent-gate-actions">
                      {typeof window.showDirectoryPicker === 'function' ? (
                        <button className="lib-btn dark" type="button" onClick={() => setShowFolderPermModal(true)}>
                          <IFolder size={12} /> Open Folder
                        </button>
                      ) : null}
                      <button className="lib-btn" type="button" onClick={() => setCurrentView("library")}>
                        <IGrid size={12} /> Go to Library
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <aside className={`agent-sidebar ${agentSidebarOpen ? "" : "collapsed"}`}>
                      <div className="agent-sidebar-head">
                        <div className="agent-sidebar-topbar">
                          {agentSidebarOpen ? (
                            <div className="agent-sidebar-copy">
                              <div className="agent-empty-eyebrow">Workspace threads</div>
                              <div className="agent-sidebar-title">{selectedRootFolder?.name || "Agent"}</div>
                              <div className="agent-sidebar-subtitle">
                                {agentWorkspacePapers.length} local paper{agentWorkspacePapers.length === 1 ? "" : "s"} available for grounded comparisons.
                              </div>
                            </div>
                          ) : null}
                          <button
                            className="chat-topbar-btn agent-sidebar-toggle"
                            type="button"
                            onClick={() => setAgentSidebarOpen((open) => !open)}
                            title={agentSidebarOpen ? "Collapse threads" : "Expand threads"}
                            aria-label={agentSidebarOpen ? "Collapse threads" : "Expand threads"}
                          >
                            <IPanel size={14} />
                          </button>
                          {!agentSidebarOpen ? (
                            <button
                              className="chat-topbar-btn agent-sidebar-toggle agent-sidebar-chat-icon"
                              type="button"
                              onClick={() => setAgentSidebarOpen(true)}
                              title="Show chats"
                              aria-label="Show chats"
                            >
                              <IChat size={14} />
                            </button>
                          ) : null}
                        </div>
                        {agentSidebarOpen ? (
                          <div className="agent-sidebar-head-actions">
                            <button className="lib-btn dark" type="button" onClick={startNewAgentChat}>
                              <IPlus size={12} /> New thread
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {agentSidebarOpen ? (
                        <>
                          <div className="agent-context-card">
                            <div className="agent-context-row">
                              <span className="agent-root-badge">{selectedRootFolder?.name || "Workspace"}</span>
                              <span className="agent-context-meta">{selectedRootAgentThreads.length} saved thread{selectedRootAgentThreads.length === 1 ? "" : "s"}</span>
                            </div>
                            <p className="agent-context-copy">
                              Web research, local-paper context, and imported PDFs stay anchored to this writable root so the workspace travels with its <code>.paperview.json</code>.
                            </p>
                          </div>

                          <div className="agent-thread-list">
                            {selectedRootAgentThreads.length === 0 ? (
                              <div className="chat-overview-empty-state">
                                <div className="chat-overview-empty-title">No agent threads yet</div>
                                <div className="chat-overview-empty-copy">Start a thread to search the web, compare papers, and save the conversation with this folder.</div>
                              </div>
                            ) : (
                              selectedRootAgentThreads.map((thread) => (
                                <div key={thread.id} className={`agent-thread-row ${thread.id === activeAgentChatId ? "active" : ""}`}>
                                  <button className="agent-thread-main" type="button" onClick={() => openAgentThread(thread.id)}>
                                    <div className="agent-thread-title" title={thread.title}>{thread.title}</div>
                                  </button>
                                  <button
                                    className="thread-compact-delete"
                                    type="button"
                                    onClick={() => deleteAgentThread(thread.id)}
                                    title="Delete agent thread"
                                    aria-label={`Delete ${thread.title}`}
                                  >
                                    <ITrash size={13} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      ) : null}
                    </aside>

                    <section className="agent-main citation-popover-boundary">
                      <div
                        className={`agent-workspace-body ${hasAgentPreview ? "has-preview" : ""}`}
                        style={hasAgentPreview && agentPreviewWidth
                          ? { gridTemplateColumns: `minmax(0,1fr) 5px minmax(300px, ${agentPreviewWidth}px)` }
                          : undefined}
                      >
                        <div className="agent-conversation-pane">
                          <div className="agent-main-head">
                            <div className="agent-main-copy">
                              <div className="agent-empty-eyebrow">Paperview Agent</div>
                              <div className="agent-main-title">{activeAgentChat?.title || "New thread"}</div>
                              <div className="agent-main-subtitle">{activeAgentSummary}</div>
                            </div>
                            <div className="agent-main-actions">
                              <span className="agent-root-badge">{selectedRootFolder?.name || "Workspace"}</span>
                              <button
                                className="chat-history-btn"
                                type="button"
                                onClick={resetActiveAgentHistory}
                                disabled={!currentAgentMessages.length && !agentInput.trim()}
                              >
                                Reset current
                              </button>
                            </div>
                          </div>
                          <div className="agent-msgs">
                            {currentAgentMessages.length === 0 ? (
                              <div className="agent-empty">
                                <div className="agent-empty-hero">
                                  <div className="agent-empty-icon"><ISpark size={18} /></div>
                                  <div className="agent-empty-copy">
                                    <div className="agent-empty-eyebrow">Research across web + local PDFs</div>
                                    <h2>Search for papers, compare them with your library, and import the best ones to disk.</h2>
                                    <p>Select an Agent tool below to attach a mode to the composer without adding extra instruction text to your message.</p>
                                  </div>
                                </div>

                                <div className="agent-quick-grid">
                                  {agentTools.map((item) => (
                                    <button
                                      key={item.title}
                                      className={`agent-quick-chip ${selectedAgentToolId === item.id ? "active" : ""}`}
                                      type="button"
                                      onClick={() => selectAgentTool(item.id)}
                                    >
                                      <span className="chat-suggestion-icon">{item.icon}</span>
                                      <span className="chat-suggestion-text">
                                        <span className="chat-suggestion-title">{item.title}</span>
                                        <span className="chat-suggestion-meta">{item.meta}</span>
                                      </span>
                                    </button>
                                  ))}
                                </div>

                                <div className="agent-empty-block">
                                  <div className="agent-empty-block-title">Local workspace context</div>
                                  <div className="agent-empty-note">
                                    {agentWorkspacePapers.length
                                      ? `${agentWorkspacePapers.length} paper${agentWorkspacePapers.length === 1 ? "" : "s"} are ready in this root. Attach only the ones you want the agent to search locally.`
                                      : "No local PDFs were found in this root yet. You can still use web search, and imported papers will be saved back into this workspace."}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              currentAgentMessages.map((m) => (
                                <div key={m.id}>
                                  {m.role === "user" ? (
                                    <div className="msg-u">
                                      <div className="msg-u-bubble-wrap">
                                        {m.agentToolTitle ? (
                                          <div className="agent-msg-tool">
                                            <span className="agent-msg-tool-chip">{m.agentToolTitle}</span>
                                          </div>
                                        ) : null}
                                        <div className="msg-u-bubble">{m.content}</div>
                                        {renderUsageMeta(m)}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="msg-a">
                                      <div className="msg-a-row">
                                        <div className="msg-a-avatar">A</div>
                                        <div className="msg-a-bubble-wrap">
                                          {m.thinkingTrace?.length > 0 ? (
                                            <ThinkingTrace
                                              steps={m.thinkingTrace}
                                              isLive={false}
                                              expanded={!!agentThinkingExpanded[m.id]}
                                              onToggle={() => setAgentThinkingExpanded((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                                            />
                                          ) : null}
                                          {renderUsageMeta(m)}
                                          {renderFoundSourcesPanel(m)}
                                          {m.content ? (
                                            <div className="msg-a-bubble">
                                              <InlineCitedAnswer
                                                text={m.content}
                                                citations={m.citations || []}
                                                onCitationClick={handleCitationClick}
                                              />
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}

                            {isAgentLoading ? (
                              <div className="chat-thinking">
                                {agentThinkingSteps.filter((step) => step.chatId === activeAgentChatId).length > 0 ? (
                                  <ThinkingTrace
                                    steps={agentThinkingSteps.filter((step) => step.chatId === activeAgentChatId)}
                                    isLive={true}
                                  />
                                ) : (
                                  <>
                                    <div className="typing"><span /><span /><span /></div>
                                    <span style={{ fontSize: 13, color: "#888", marginLeft: 4 }}>{agentLoadingLabel}</span>
                                  </>
                                )}
                              </div>
                            ) : null}
                            <div ref={agentEndRef} />
                          </div>

                          <div className="agent-input-area">
                        {agentWorkspacePapers.length > 0 ? (
                          <div className="attach-picker attach-picker-inline" ref={agentAttachMenuRef}>
                            <div className="composer-context-row">
                              <button
                                className="composer-context-trigger"
                                type="button"
                                onClick={() => setAgentAttachMenuOpen((value) => !value)}
                                title="Review local paper context"
                              >
                                <IPaperclip size={12} />
                                <span>Local papers</span>
                              </button>
                              <div className="composer-context-list">
                                {agentContextPapers.slice(0, 2).map((paper) => (
                                  <button
                                    key={paper.id}
                                    className="composer-context-pill composer-context-pill-btn"
                                    type="button"
                                    title={paper.name}
                                    onClick={() => openAgentPaper(paper)}
                                  >
                                    <IFile size={11} style={{ flexShrink: 0 }} />
                                    <span className="composer-context-pill-text">{paper.name}</span>
                                  </button>
                                ))}
                                {agentContextPapers.length > 2 ? (
                                  <span className="composer-context-pill composer-context-pill-more">
                                    +{agentContextPapers.length - 2} more
                                  </span>
                                ) : null}
                                {agentContextPapers.length === 0 ? (
                                  <span className="composer-context-pill composer-context-pill-more">No local papers attached</span>
                                ) : null}
                              </div>
                            </div>

                            {agentAttachMenuOpen ? (
                              <div className="attach-menu">
                                <div className="attach-head">
                                  <span className="attach-title">Local paper context</span>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button
                                      className="attach-mini-btn"
                                      type="button"
                                      onClick={() => setSelectedAgentPaperIds(agentWorkspacePapers.map((paper) => paper.id))}
                                    >
                                      All
                                    </button>
                                    <button
                                      className="attach-mini-btn"
                                      type="button"
                                      onClick={() => setSelectedAgentPaperIds([])}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>

                                <div className="attach-list">
                                  {agentWorkspacePapers.map((paper) => {
                                    const checked = selectedAgentPaperIds.includes(paper.id);
                                    return (
                                      <label key={paper.id} className="attach-item">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => {
                                            setSelectedAgentPaperIds((prev) =>
                                              prev.includes(paper.id)
                                                ? prev.filter((id) => id !== paper.id)
                                                : [...prev, paper.id]
                                            );
                                          }}
                                        />
                                        <IFile size={12} style={{ color: "#888", flexShrink: 0 }} />
                                        <span className="attach-name">{paper.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="chat-composer agent-composer">
                          <div className="agent-tool-row" ref={agentToolMenuRef}>
                            <button
                              className={`agent-tool-trigger ${agentToolMenuOpen ? "active" : ""}`}
                              type="button"
                              onClick={() => setAgentToolMenuOpen((value) => !value)}
                              title="Select an Agent tool"
                            >
                              <IPlus size={12} />
                              <span>{selectedAgentTool ? "Change tool" : "Add tool"}</span>
                            </button>

                            {selectedAgentTool ? (
                              <span className="agent-tool-chip">
                                <span className="agent-tool-chip-label">
                                  {selectedAgentTool.icon}
                                  <span>{selectedAgentTool.title}</span>
                                </span>
                                <button
                                  className="agent-tool-chip-clear"
                                  type="button"
                                  onClick={() => setSelectedAgentToolId(null)}
                                  title="Remove selected Agent tool"
                                >
                                  <IClose size={11} />
                                </button>
                              </span>
                            ) : (
                              <span className="agent-tool-hint">No Agent tool selected</span>
                            )}

                            {agentToolMenuOpen ? (
                              <div className="agent-tool-menu">
                                <div className="agent-tool-menu-title">Agent tools</div>
                                <div className="agent-tool-menu-list">
                                  {agentTools.map((tool) => (
                                    <button
                                      key={tool.id}
                                      className={`agent-tool-option ${selectedAgentToolId === tool.id ? "active" : ""}`}
                                      type="button"
                                      onClick={() => selectAgentTool(tool.id)}
                                    >
                                      <span className="agent-tool-option-icon">{tool.icon}</span>
                                      <span className="agent-tool-option-copy">
                                        <span className="agent-tool-option-title">{tool.title}</span>
                                        <span className="agent-tool-option-meta">{tool.meta}</span>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <textarea
                            ref={agentTaRef}
                            rows={1}
                            value={agentInput}
                            onChange={(event) => {
                              setAgentInput(event.target.value);
                              event.target.style.height = "auto";
                              event.target.style.height = `${event.target.scrollHeight}px`;
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                doSendAgent();
                              }
                            }}
                            placeholder={selectedAgentTool?.placeholder || "Search for papers, compare them with your workspace, or import a PDF to this folder..."}
                          />

                          <div className="composer-bottom">
                            <div className="composer-tools">
                              <div className="model-picker" ref={modelMenuRef}>
                                <button
                                  className="model-chip"
                                  title="Model"
                                  onClick={() => setModelMenuOpen((value) => !value)}
                                  type="button"
                                >
                                  {selectedModel} <IChevronDown size={12} />
                                </button>
                                {modelMenuOpen ? (
                                  <div className="model-menu">
                                    {OPENAI_MODELS.map((modelName) => (
                                      <button
                                        key={modelName}
                                        className={`model-option ${selectedModel === modelName ? "active" : ""}`}
                                        onClick={() => {
                                          setSelectedModel(modelName);
                                          setModelMenuOpen(false);
                                        }}
                                        type="button"
                                      >
                                        {modelName}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {agentLoadingState ? (
                              <button
                                className="chat-history-btn composer-stop-btn"
                                onClick={stopAgentRun}
                                title="Stop"
                                type="button"
                              >
                                Stop
                              </button>
                            ) : (
                              <button
                                className="icon-btn send-btn"
                                onClick={() => doSendAgent()}
                                disabled={!agentInput.trim()}
                                title="Send"
                                type="button"
                              >
                                <IArrowUp size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                          </div>
                        </div>

                        {hasAgentPreview ? (
                          <div
                            className="agent-preview-resize-handle"
                            onMouseDown={startAgentPreviewResize}
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize in-chat PDF preview"
                          >
                            <span className="agent-preview-resize-grip" />
                          </div>
                        ) : null}

                        {renderAgentPreviewDrawer()}
                      </div>
                    </section>
                  </>
                )}
              </div>
            ) : activePaper ? (
              <>
                <div className="viewer">
                  <div className="viewer-frame">
                    <div className="viewer-toolbar">
                      <div className="vt-left">
                        <button className="vt-btn" onClick={handleSearchClick} title="Search in this PDF">
                          <ISearch />
                        </button>
                        {viewerSearchOpen && (
                          <div className="vt-search-wrap">
                            <input
                              ref={viewerSearchInputRef}
                              className="vt-search-input"
                              value={viewerSearchQuery}
                              onChange={(e) => {
                                setViewerSearchQuery(e.target.value);
                                setViewerSearchStatus("");
                                setViewerSearchIndex(-1);
                                setViewerSearchMatches([]);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") runViewerSearch(e.shiftKey ? -1 : 1);
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  runViewerSearch(1);
                                }
                                if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  runViewerSearch(-1);
                                }
                                if (e.key === "Escape") setViewerSearchOpen(false);
                              }}
                              placeholder="Find text..."
                            />
                            <div className="vt-search-nav">
                              <button
                                className="vt-btn"
                                onClick={() => runViewerSearch(-1)}
                                disabled={!canRunViewerSearch}
                                title="Previous match"
                              >
                                <IArrowUp size={14} />
                              </button>
                              <button
                                className="vt-btn"
                                onClick={() => runViewerSearch(1)}
                                disabled={!canRunViewerSearch}
                                title="Next match"
                              >
                                <IArrowDown size={14} />
                              </button>
                            </div>
                            {viewerSearchStatus && <span className="vt-search-meta">{viewerSearchStatus}</span>}
                            {!viewerSearchStatus && hasViewerSearchResults && (
                              <span className="vt-search-meta">{viewerSearchIndex + 1}/{viewerSearchMatches.length}</span>
                            )}
                          </div>
                        )}
                        <div className="vt-sep" />
                        <div className="vt-zoom">
                          <button className="vt-btn" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))}><IZoomOut /></button>
                          <span className="vt-zoom-val">{Math.round(scale * 100)}%</span>
                          <button className="vt-btn" onClick={() => setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)))}><IZoomIn /></button>
                        </div>
                        </div>
                        <div className="vt-page">
                          <button className="vt-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}><ILeft /></button>
                          <span className="vt-page-total">{currentPage} of {activePaperTotalPages}</span>
                          <button className="vt-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= activePaperTotalPages}><IRight /></button>
                        </div>
                      </div>

                      <div className={`pdf-scroll ${debugCitations ? "debug-text-layer" : ""}`}>
                        {activePaper.pdfBytes ? (
                        <PdfViewer
                            paperId={activePaper.id}
                            pdfBytes={activePaper.pdfBytes}
                            fileSize={activePaper.fileSize}
                            fileLastModified={activePaper.fileLastModified}
                            scale={scale}
                            onReady={handlePdfReady}
                            onDocumentLoad={handlePdfDocumentLoad}
                            onPageChange={setCurrentPage}
                            debugCitations={debugCitations}
                          annotations={annotations}
                          onAnnotationClick={handleAnnotationClick}
                        />
                      ) : (
                        <TextFallback text={materializeFullText(searchablePageTexts)} />
                      )}
                    </div>
                  </div>
                </div>

                {chatOpen && (
                  <>
                  <div
                    className="chat-resize-handle"
                    onMouseDown={startChatResize}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize chat panel"
                  >
                    <span className="chat-resize-grip" />
                  </div>
                  <div className="chat-panel" style={{ width: chatWidth }}>
                    <div className="chat-topbar">
                      <div className="chat-topbar-copy">
                        <span className="chat-topbar-title">{chatPaneMode === "overview" ? "Recent chats" : chatPaneMode === "notes" ? "Notes" : (activeChat?.title || "Chat")}</span>
                        <span className="chat-topbar-subtitle">{chatPaneMode === "overview" ? "Open, reset, or remove saved conversations." : chatPaneMode === "notes" ? `${annotations.length} annotation${annotations.length === 1 ? '' : 's'}` : activeChatSummary}</span>
                      </div>
                      <div className="chat-topbar-actions">
                        {chatPaneMode === "chat" && (
                          <button className="chat-topbar-btn" onClick={startNewChat} title="Start new chat">
                            <IPlus size={14} />
                          </button>
                        )}
                        {chatPaneMode === "chat" ? (
                          <button
                            className="chat-topbar-btn"
                            onClick={resetActiveChatHistory}
                            title="Reset active chat"
                            disabled={!currentMessages.length && !chip && !input}
                          >
                            <ITrash size={14} />
                          </button>
                        ) : null}
                        <button
                          className={`chat-topbar-btn${chatPaneMode === 'notes' ? ' active' : ''}`}
                          onClick={() => setChatPaneMode((mode) => (mode === "notes" ? "chat" : "notes"))}
                          title={chatPaneMode === "notes" ? "Back to chat" : "Notes"}
                        >
                          <INotes size={14} />
                        </button>
                        <button
                          className="chat-topbar-btn chat-topbar-btn-label"
                          onClick={() => setChatPaneMode((mode) => (mode === "chat" ? "overview" : "chat"))}
                          title={chatPaneMode === "overview" ? "Back to chat" : "View chats"}
                        >
                          <IPanel size={14} />
                          <span>{chatPaneMode === "overview" ? "Back to chat" : "View chats"}</span>
                        </button>
                        <button className="chat-topbar-btn" onClick={() => setChatOpen(false)} title="Collapse chat">
                          <IChevronRightDouble size={14} />
                        </button>
                      </div>
                    </div>

                    {chatPaneMode === "chat" && isActivePaperScanning && (
                      <div className="chat-scan-banner">
                        <div className="chat-scan-banner-top">
                          <div className="chat-scan-banner-copy">
                            <span className="chat-scan-banner-title">Scanning paper for chat</span>
                            <span className="chat-scan-banner-meta">{activePaper?.name || "Current paper"}</span>
                          </div>
                          <span className="chat-scan-banner-badge">{activePaperScanPercent}%</span>
                        </div>
                        <div className="chat-scan-banner-status">{activePaperScanLabel}</div>
                        <div className="chat-scan-progress" aria-hidden="true">
                          <span className="chat-scan-progress-bar" style={{ width: `${activePaperScanPercent}%` }} />
                        </div>
                      </div>
                    )}

                    {chatPaneMode === "overview" ? (
                      <div className="chat-history-panel chat-history-standalone">
                        <div className="chat-overview-shell">
                          <div className="chat-overview-hero">
                            <div className="chat-overview-hero-top">
                              <div className="chat-overview-copy">
                                <div className="chat-overview-eyebrow">Current thread</div>
                                <div className="chat-overview-title">{activeChat?.title || "No active chat"}</div>
                                <div className="chat-overview-subtitle">
                                  {activeChat
                                    ? "Keep this thread focused on the paper you are reading, or branch into a fresh conversation when you need a new line of inquiry."
                                    : "Start a conversation to begin asking grounded questions about this paper."}
                                </div>
                              </div>
                              {activeChat ? <span className="chat-overview-badge">Open now</span> : null}
                            </div>

                            <div className="chat-overview-stats">
                              <div className="chat-overview-stat">
                                <span className="chat-overview-stat-value">{activePaperThreads.length}</span>
                                <span className="chat-overview-stat-label">Thread{activePaperThreads.length === 1 ? "" : "s"} for this paper</span>
                              </div>
                              <div className="chat-overview-stat">
                                <span className="chat-overview-stat-value">{activePaperMessageCount}</span>
                                <span className="chat-overview-stat-label">Total saved messages</span>
                              </div>
                            </div>

                            <div className="chat-overview-primary-actions">
                              {activeChat ? <button className="chat-history-btn" onClick={() => setChatPaneMode("chat")}>Resume chat</button> : null}
                              <button className="chat-history-btn" onClick={startNewChat}>New chat</button>
                              {activeChat ? (
                                <button className="chat-history-btn" onClick={resetActiveChatHistory} disabled={!currentMessages.length}>
                                  Reset current
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="chat-overview-section">
                            <div className="chat-overview-section-head">
                              <div className="chat-overview-section-copy">
                                <div className="chat-overview-section-title">Saved chats</div>
                                <div className="chat-overview-section-subtitle">Re-open an older thread or clean it up before you go back to reading.</div>
                              </div>
                              <div className="chat-overview-count">{savedPaperThreads.length}</div>
                            </div>

                            {savedPaperThreads.length ? (
                              <div className="chat-overview-list">
                                {savedPaperThreads.map((thread) => (
                                  <div key={thread.id} className="chat-overview-row">
                                    <button className="chat-overview-row-main" type="button" onClick={() => openChatThread(thread.id)}>
                                      <span className="chat-overview-row-title" title={thread.title}>{thread.title}</span>
                                    </button>
                                    <button
                                      className="thread-compact-delete"
                                      type="button"
                                      onClick={() => deleteChatThread(thread.id)}
                                      title="Delete chat"
                                      aria-label={`Delete ${thread.title}`}
                                    >
                                      <ITrash size={13}/>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="chat-overview-empty-state">
                                <div className="chat-overview-empty-title">No additional chats yet</div>
                                <div className="chat-overview-empty-copy">Create another thread when you want to explore a new question without losing your current conversation.</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : chatPaneMode === "notes" ? (
                      <div className="notes-panel">
                        {annotations.length === 0 ? (
                          <div className="notes-empty">
                            <div className="notes-empty-icon">📝</div>
                            <h3>No annotations yet</h3>
                            <p>Select text in the PDF and click <b>Highlight</b> to add notes.</p>
                          </div>
                        ) : (
                          (() => {
                            const grouped = {};
                            annotations.forEach((a) => {
                              (grouped[a.pageNum] = grouped[a.pageNum] || []).push(a);
                            });
                            return Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).map((pg) => (
                              <div key={pg} className="notes-group">
                                <div className="notes-group-title">Page {pg}</div>
                                {grouped[pg].sort((a, b) => a.startOffset - b.startOffset).map((ann) => (
                                  <div key={ann.id} className="note-card" onClick={() => goToPage(ann.pageNum)}>
                                    <div className="note-card-text">"{ann.selectedText}"</div>
                                    {ann.comment ? (
                                      <div className="note-card-comment">{ann.comment}</div>
                                    ) : (
                                      <div className="note-card-no-comment">No comment</div>
                                    )}
                                    <div className="note-card-footer">
                                      <span className="note-card-page">Page {ann.pageNum}</span>
                                      <button className="note-card-delete" onClick={(e) => { e.stopPropagation(); deleteAnnotationById(ann.id); }} title="Delete annotation">
                                        <ITrash size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="chat-msgs">
                          {currentMessages.length === 0 ? (
                            <div className="chat-empty">
                              <div className="chat-empty-intro">
                                <div className="chat-empty-icon"><ISpark size={14} /></div>
                                <div className="chat-empty-copy">
                                  <h3>Ask anything about this paper</h3>
                                  <p>Use the task list below or select text in the document to send focused context into chat.</p>
                                </div>
                              </div>

                              <div className="chat-empty-sections">
                                <div className="chat-empty-block">
                                  <div className="chat-empty-block-title">Quick actions</div>
                                  <div className="chat-empty-suggestions">
                                    {chatQuickActions.map((item) => (
                                      <button key={item.title} className="chat-suggestion" type="button" onClick={() => doSend(item.prompt)}>
                                        <span className="chat-suggestion-icon">{item.icon}</span>
                                        <span className="chat-suggestion-text">
                                          <span className="chat-suggestion-title">{item.title}</span>
                                          <span className="chat-suggestion-meta">{item.meta}</span>
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="chat-empty-block">
                                  <div className="chat-empty-block-title">Working set</div>
                                  <div className="chat-empty-note">
                                    {activeFolderPapers.length || openTabs.length} file{(activeFolderPapers.length || openTabs.length) === 1 ? " is" : "s are"} available in the current workspace. Answers stay grounded in the documents you attach through the paper picker.
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            currentMessages.map((m, i) => (
                              <div key={i}>
                                {m.role === "user" ? (
                                  <div className="msg-u">
                                    <div className="msg-u-bubble-wrap">
                                      <div className="msg-u-bubble">{m.content}</div>
                                      {renderUsageMeta(m)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="msg-a">
                                    <div className="msg-a-row">
                                      <div className="msg-a-avatar">A</div>
                                      <div className="msg-a-bubble-wrap">
                                        {m.thinkingTrace?.length > 0 && (
                                          <ThinkingTrace
                                            steps={m.thinkingTrace}
                                            isLive={false}
                                            expanded={!!thinkingExpanded[m.id]}
                                            onToggle={() => setThinkingExpanded(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                                          />
                                        )}
                                        <div className="msg-a-bubble">
                                          <InlineCitedAnswer
                                            text={m.content}
                                            citations={m.citations || []}
                                            fileName={activePaper.name}
                                            onCitationClick={handleCitationClick}
                                          />
                                        </div>
                                        {renderUsageMeta(m)}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}

                          {isChatLoading && (
                            <div className="chat-thinking">
                              {thinkingSteps.filter(s => s.chatId === activeChatId).length > 0 ? (
                                <ThinkingTrace
                                  steps={thinkingSteps.filter(s => s.chatId === activeChatId)}
                                  isLive={true}
                                />
                              ) : (
                                <>
                                  <div className="typing"><span /><span /><span /></div>
                                  <span style={{ fontSize: 13, color: "#888", marginLeft: 4 }}>{chatLoadingLabel}</span>
                                </>
                              )}
                            </div>
                          )}
                          <div ref={endRef} />
                        </div>

                        <div className="chat-input-area">
                          {chip && (
                            <div className="ctx-chip">
                              <span style={{ fontSize: 11, fontWeight: 600 }}>Selected text:</span>
                              <span className="ctx-chip-text">"{chip}"</span>
                              <span className="ctx-chip-x" onClick={() => setChip(null)}><IClose size={12} /></span>
                            </div>
                          )}

                          {(chatContextPapers.length > 0 || activeFolderPapers.length > 0) && (
                            <div className="attach-picker attach-picker-inline" ref={attachMenuRef}>
                              <div className="composer-context-row">
                                <button
                                  className="composer-context-trigger"
                                  type="button"
                                  onClick={() => setAttachMenuOpen((v) => !v)}
                                  title="Review chat context PDFs"
                                >
                                  <IPaperclip size={12} />
                                  <span>Context</span>
                                </button>
                                <div className="composer-context-list">
                                  {chatContextPapers.slice(0, 2).map((paper) => (
                                    <span key={paper.id} className="composer-context-pill" title={paper.name}>
                                      <IFile size={11} style={{ flexShrink: 0 }} />
                                      <span className="composer-context-pill-text">{paper.name}</span>
                                    </span>
                                  ))}
                                  {chatContextPapers.length > 2 && (
                                    <span className="composer-context-pill composer-context-pill-more">
                                      +{chatContextPapers.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </div>
                              {attachMenuOpen && (
                                <div className="attach-menu">
                                  <div className="attach-head">
                                    <span className="attach-title">Chat context PDFs</span>
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <button
                                        className="attach-mini-btn"
                                        type="button"
                                        onClick={() => {
                                          setChatContextMode("manual");
                                          setSelectedChatPaperIds(activeFolderPapers.map((p) => p.id));
                                        }}
                                      >
                                        All
                                      </button>
                                      <button
                                        className="attach-mini-btn"
                                        type="button"
                                        onClick={() => {
                                          setChatContextMode("auto");
                                          setSelectedChatPaperIds(activePaper?.id ? [activePaper.id] : []);
                                        }}
                                      >
                                        Active
                                      </button>
                                    </div>
                                  </div>

                                  {activeFolderPapers.length === 0 ? (
                                    <div className="attach-empty">No PDFs in this folder yet.</div>
                                  ) : (
                                    <div className="attach-list">
                                      {activeFolderPapers.map((paper) => {
                                        const checked = chatContextMode === "auto"
                                          ? paper.id === activePaper?.id
                                          : selectedChatPaperIds.includes(paper.id);
                                        return (
                                          <label key={paper.id} className="attach-item">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() => {
                                                setChatContextMode("manual");
                                                setSelectedChatPaperIds((prev) =>
                                                  prev.includes(paper.id)
                                                    ? prev.filter((id) => id !== paper.id)
                                                    : [...prev, paper.id]
                                                );
                                              }}
                                            />
                                            <IFile size={12} style={{ color: "#888", flexShrink: 0 }} />
                                            <span className="attach-name">{paper.name}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="chat-composer">
                            <textarea
                              ref={taRef}
                              rows={1}
                              value={input}
                              onChange={(e) => {
                                setInput(e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  doSend();
                                }
                                }}
                              placeholder="Ask about this PDF..."
                            />

                            <div className="composer-bottom">
                              <div className="composer-tools">
                                <div className="model-picker" ref={modelMenuRef}>
                                  <button
                                    className="model-chip"
                                    title="Model"
                                    onClick={() => setModelMenuOpen((v) => !v)}
                                    type="button"
                                  >
                                    {selectedModel} <IChevronDown size={12} />
                                  </button>
                                  {modelMenuOpen && (
                                    <div className="model-menu">
                                      {OPENAI_MODELS.map((modelName) => (
                                        <button
                                          key={modelName}
                                          className={`model-option ${selectedModel === modelName ? "active" : ""}`}
                                          onClick={() => {
                                            setSelectedModel(modelName);
                                            setModelMenuOpen(false);
                                          }}
                                          type="button"
                                        >
                                          {modelName}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {chatLoadingState ? (
                                <button
                                  className="chat-history-btn composer-stop-btn"
                                  onClick={stopChatRun}
                                  title="Stop"
                                  type="button"
                                >
                                  Stop
                                </button>
                              ) : (
                                <button className="icon-btn send-btn" onClick={() => doSend()} disabled={!input.trim() && !chip} title="Send" type="button">
                                  <IArrowUp size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  </>
                )}
              </>
            ) : (
              <div className="welcome">
                {!sidebarOpen && (
                  <button className="topbar-btn" onClick={() => setSidebarOpen(true)} style={{ marginBottom: 12 }}>
                    <IChevronRightDouble size={14} /> Library
                  </button>
                )}
                <div style={{ fontSize: 40, opacity: 0.15 }}>📄</div>
                <h2 style={{ fontSize: 20, color: "#333", margin: "14px 0 8px" }}>Welcome to Paperview</h2>
                <p style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 380 }}>Open a folder of PDFs or upload individual papers, then chat with AI-powered citations.</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {typeof window.showDirectoryPicker === 'function' && (
                    <button className="welcome-upload" type="button" onClick={() => setShowFolderPermModal(true)}>
                      <IFolder size={12} /> Open Folder
                    </button>
                  )}
                  <button
                    className="welcome-upload"
                    type="button"
                    style={typeof window.showDirectoryPicker === 'function' ? { background: '#fff', color: '#333', border: '1px solid #d5d3cd' } : {}}
                    onClick={() => {
                      if (activeFolder?.id) setUpFolder(activeFolder.id);
                      else if (folders.length) setUpFolder(folders[0].id);
                      setShowUpload(true);
                    }}
                  >
                    <IUpload size={12} /> Upload PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {popup && (
          <div
            className="sel-pop"
            style={{ left: Math.min(Math.max(popup.x - 130, 8), window.innerWidth - 320), top: Math.max(popup.y - 50, 8) }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="sel-btn pri" onClick={askAI}><ISpark size={13} /> Ask AI</button>
            <button className="sel-btn" onClick={addToChat}><IChat size={13} /> Add to chat</button>
            <button className="sel-btn" onClick={handleHighlight}><IHighlight size={13} /> Highlight</button>
            <button className="sel-btn" onClick={() => { navigator.clipboard?.writeText(popup.text); setPopup(null); }}><ICopy size={13} /> Copy</button>
          </div>
        )}

        {annPopover && (
          <div
            className="ann-popover"
            style={{
              left: Math.min(Math.max(annPopover.x - 150, 8), window.innerWidth - 320),
              top: Math.min(annPopover.y, window.innerHeight - 260),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ann-popover-text">"{annPopover.ann.selectedText}"</div>
            <textarea
              value={annComment}
              onChange={(e) => setAnnComment(e.target.value)}
              placeholder="Add a comment..."
              autoFocus
            />
            <div className="ann-popover-actions">
              <button className="ann-popover-btn danger" onClick={() => deleteAnnotationById(annPopover.ann.id)}>Delete</button>
              <button className="ann-popover-btn" onClick={() => setAnnPopover(null)}>Cancel</button>
              <button className="ann-popover-btn primary" onClick={saveAnnotationComment}>Save</button>
            </div>
          </div>
        )}

        {showUpload && (
          <div className="ov" onClick={closeModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="m-hd">
                <span className="m-title">Upload PDF</span>
                <button className="m-x" onClick={closeModal}><IClose /></button>
              </div>

              {upStatus === "parsing" ? (
                <div style={{ textAlign: "center", padding: "36px 24px" }}>
                  <div className="typing" style={{ justifyContent: "center" }}><span /><span /><span /></div>
                  <p style={{ fontSize: 13, color: "#444", marginTop: 12 }}>{upStatusText || "Parsing PDF..."}</p>
                </div>
              ) : upStatus === "done" ? (
                <div style={{ textAlign: "center", padding: "36px 24px" }}>
                  <div style={{ fontSize: 32, color: "#111" }}>✓</div>
                  <p style={{ color: "#111", fontWeight: 600 }}>Uploaded successfully</p>
                </div>
              ) : (
                <>
                  <div
                    className={`dz ${dragOver ? "drag" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); fileSelected(e.dataTransfer.files[0]); }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <div style={{ color: "#666", display: "flex", justifyContent: "center", marginBottom: 10 }}>
                      {pendingFile ? <IFile size={28} /> : <IUpload size={28} />}
                    </div>
                    {pendingFile ? (
                      <>
                        <h3>{pendingFile.name}</h3>
                        <p>{(pendingFile.size / 1024 / 1024).toFixed(1)} MB · click to change</p>
                      </>
                    ) : (
                      <>
                        <h3>Drop PDF here or browse</h3>
                        <p>All pages rendered as real PDF</p>
                      </>
                    )}
                    <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => fileSelected(e.target.files[0])} />
                  </div>

                  {upStatus === "error" && <p style={{ color: "#b91c1c", fontSize: 12, marginTop: 8, textAlign: "center" }}>Please select a valid PDF file.</p>}

                  <div className="fs">
                    <label>Add to folder</label>
                    {folders.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#8a867c', padding: '8px 10px', background: '#fff', borderRadius: 7, border: '1px solid #ececec' }}>
                        Will be added to a new <strong>Uploads</strong> folder
                      </div>
                    ) : (
                      <select value={upFolder} onChange={(e) => setUpFolder(e.target.value)}>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="m-acts">
                    <button className="btn-sec" onClick={closeModal}>Cancel</button>
                    <button className="btn-pri" onClick={doUpload} disabled={!pendingFile}>Upload & Render</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showSettings && (
          <div className="ov" onClick={closeSettingsModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="m-hd">
                <span className="m-title">Settings</span>
                <button className="m-x" onClick={closeSettingsModal}><IClose /></button>
              </div>

              <div className="settings-field">
                <label className="settings-label">OpenAI API Key</label>
                {apiKey ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="settings-input" style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', cursor: 'default', color: 'var(--text2)' }}>
                        {'•'.repeat(Math.min(apiKey.length, 20))}{'…' + apiKey.slice(-4)}
                      </span>
                      <button className="btn-sec" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={handleRemoveApiKey} disabled={settingsBusy}>Remove</button>
                    </div>
                    <p className="settings-info">
                      {apiKeySource === "remembered"
                        ? "This key was unlocked from encrypted browser storage for the current session."
                        : "This key is available in memory for the current browser session."}
                    </p>
                    {apiKeySource !== "remembered" && (
                      <div className="settings-panel">
                        <label className="settings-option">
                          <input
                            type="checkbox"
                            checked={rememberApiKey}
                            onChange={(e) => {
                              setRememberApiKey(e.target.checked);
                              setSettingsError("");
                            }}
                          />
                          <span>Remember this key on this device with passphrase encryption.</span>
                        </label>
                        {rememberApiKey && (
                          <div className="settings-subfield">
                            <label className="settings-label">Encryption passphrase</label>
                            <div className="settings-input-wrap">
                              <input
                                className="settings-input"
                                type={settingsPassphraseVisible ? "text" : "password"}
                                value={settingsPassphrase}
                                onChange={(e) => setSettingsPassphrase(e.target.value)}
                                placeholder="At least 8 characters"
                                autoComplete="new-password"
                              />
                              <button className="settings-toggle-vis" onClick={() => setSettingsPassphraseVisible((v) => !v)} type="button">
                                {settingsPassphraseVisible ? "Hide" : "Show"}
                              </button>
                            </div>
                            <p className="settings-info">The passphrase is not stored. You will need it to unlock this key after reloading Paperview.</p>
                          </div>
                        )}
                        <button className="btn-sec" type="button" disabled={!rememberApiKey || settingsBusy} onClick={handleSaveSettingsApiKey}>
                          {settingsBusy ? "Saving..." : "Remember key"}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {rememberedApiKeyAvailable && (
                      <div className="settings-panel">
                        <div className="settings-panel-title">Encrypted key saved on this device</div>
                        <p className="settings-info">Enter the passphrase you used when saving it. The passphrase is not stored and cannot be recovered.</p>
                        <div className="settings-input-wrap">
                          <input
                            className="settings-input"
                            type={unlockPassphraseVisible ? "text" : "password"}
                            value={unlockPassphrase}
                            onChange={(e) => setUnlockPassphrase(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUnlockRememberedApiKey();
                            }}
                            placeholder="Passphrase"
                            autoComplete="current-password"
                          />
                          <button className="settings-toggle-vis" onClick={() => setUnlockPassphraseVisible((v) => !v)} type="button">
                            {unlockPassphraseVisible ? "Hide" : "Show"}
                          </button>
                        </div>
                        <div className="settings-inline-actions">
                          <button className="btn-sec" type="button" onClick={handleUnlockRememberedApiKey} disabled={settingsBusy}>
                            {settingsBusy ? "Unlocking..." : "Unlock"}
                          </button>
                          <button className="btn-sec" type="button" onClick={() => {
                            clearRememberedApiKey();
                            setRememberedApiKeyAvailable(false);
                            setUnlockPassphrase("");
                            setSettingsError("");
                          }} disabled={settingsBusy}>Forget saved key</button>
                        </div>
                      </div>
                    )}
                    <div className="settings-input-wrap">
                      <input
                        className="settings-input"
                        type={settingsKeyVisible ? "text" : "password"}
                        value={settingsKey}
                        onChange={(e) => setSettingsKey(e.target.value)}
                        placeholder="sk-..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button className="settings-toggle-vis" onClick={() => setSettingsKeyVisible((v) => !v)} type="button">
                        {settingsKeyVisible ? "Hide" : "Show"}
                      </button>
                    </div>
                    <label className="settings-option">
                      <input
                        type="checkbox"
                        checked={rememberApiKey}
                        onChange={(e) => {
                          setRememberApiKey(e.target.checked);
                          setSettingsError("");
                        }}
                      />
                      <span>Remember this key on this device with passphrase encryption.</span>
                    </label>
                    {rememberApiKey && (
                      <div className="settings-subfield">
                        <label className="settings-label">Encryption passphrase</label>
                        <div className="settings-input-wrap">
                          <input
                            className="settings-input"
                            type={settingsPassphraseVisible ? "text" : "password"}
                            value={settingsPassphrase}
                            onChange={(e) => setSettingsPassphrase(e.target.value)}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                          />
                          <button className="settings-toggle-vis" onClick={() => setSettingsPassphraseVisible((v) => !v)} type="button">
                            {settingsPassphraseVisible ? "Hide" : "Show"}
                          </button>
                        </div>
                        <p className="settings-info">The passphrase is not stored. You will need it to unlock this key after reloading Paperview.</p>
                      </div>
                    )}
                  </>
                )}
                <p className="settings-info">To use AI features, add your own OpenAI API key. By default it is kept in memory only. If you choose to remember it, Paperview stores an encrypted copy in this browser and you should only use that on trusted devices. We recommend setting a <a href="https://platform.openai.com/settings/organization/limits" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>spending limit</a> on your key.</p>
                {settingsError && <div className="settings-error">{settingsError}</div>}
              </div>

              <div className="m-acts">
                <button className="btn-sec" onClick={closeSettingsModal} disabled={settingsBusy}>Cancel</button>
                {!apiKey && <button className="btn-pri" onClick={handleSaveSettingsApiKey} disabled={settingsBusy}>
                  {settingsBusy ? "Saving..." : "Save"}
                </button>}
              </div>
            </div>
          </div>
        )}

        {edgeToast && (
          <div className="edge-toast">
            <span>💡 For the best experience, disable Edge's mini menu: <b>Settings → Appearance → Show mini menu when selecting text → Off</b></span>
            <button onClick={() => { setEdgeToast(false); localStorage.setItem('pv-edge-toast-dismissed', '1'); }}>Got it</button>
          </div>
        )}

        {showFolderPermModal && (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }} onClick={() => setShowFolderPermModal(false)}>
            <div style={{ background:'#fff',borderRadius:16,padding:36,maxWidth:420,width:'100%',boxShadow:'0 8px 48px rgba(0,0,0,0.18)' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width:48,height:48,borderRadius:12,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,marginBottom:20 }}>📁</div>
              <div style={{ fontSize:18,fontWeight:800,letterSpacing:'-0.4px',marginBottom:10 }}>Folder access needed</div>
              <p style={{ fontSize:13,color:'#4e4b45',lineHeight:1.7,marginBottom:20,fontWeight:500 }}>
                To open your PDF folder, your browser will ask you to pick a folder and grant Paperview permission to read and write files in it.
              </p>
              <ul style={{ fontSize:13,color:'#4e4b45',lineHeight:1.8,paddingLeft:20,marginBottom:24,fontWeight:500 }}>
                <li>Your PDFs are never uploaded — they stay on your machine.</li>
                <li>Paperview only writes one file: <strong>.paperview.json</strong>, which saves your chat history and annotations so they travel with your papers.</li>
                <li>You can revoke access at any time in your browser settings.</li>
              </ul>
              <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
                <button
                  style={{ background:'none',border:'1.5px solid #ececec',borderRadius:9,padding:'10px 18px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#4e4b45',fontFamily:'inherit' }}
                  onClick={() => setShowFolderPermModal(false)}
                >
                  Cancel
                </button>
                <button
                  style={{ background:'#121212',color:'#fff',border:'none',borderRadius:9,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}
                  onClick={() => { setShowFolderPermModal(false); handleOpenFolder(); }}
                >
                  OK, give access →
                </button>
              </div>
            </div>
          </div>
        )}

        {!privacyAccepted && (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
            <div style={{ background:'#fff',borderRadius:16,padding:36,maxWidth:480,width:'100%',boxShadow:'0 8px 48px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize:20,fontWeight:800,letterSpacing:'-0.4px',marginBottom:8 }}>Before you start</div>
              <p style={{ fontSize:13,color:'#4e4b45',lineHeight:1.6,marginBottom:20,fontWeight:500 }}>
                Paperview runs entirely in your browser — there is no server. Here's what you should know:
              </p>
              <div style={{ display:'flex',flexDirection:'column',gap:10,marginBottom:24 }}>
                {[
                  { green:true,  text:'Your PDF files are processed locally and never uploaded to us.' },
                  { green:true,  text:'Chat history and annotations are saved in your browser and synced to a .paperview.json file inside your folder.' },
                  { green:true,  text:'Your API key is kept in memory by default; remembered keys are encrypted in this browser with your passphrase.' },
                  { green:false, text:'PDF text is sent to OpenAI when you send a message.' },
                  { green:false, text:'Your API key is sent from the browser only when you use a client-side key instead of the backend proxy.' },
                ].map((item, i) => (
                  <div key={i} style={{ display:'flex',gap:10,alignItems:'flex-start' }}>
                    <div style={{ width:8,height:8,borderRadius:'50%',background:item.green?'#16a34a':'#dc2626',marginTop:5,flexShrink:0 }} />
                    <span style={{ fontSize:13,color:'#4e4b45',lineHeight:1.5,fontWeight:500 }}>{item.text}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12,color:'#8a867c',marginBottom:24,lineHeight:1.5,fontWeight:500 }}>
                Green = stays on your device. Red = sent to OpenAI over HTTPS. If you deploy the backend proxy, Paperview sends those requests through your own server route instead of directly from the browser.
              </p>
              <button
                style={{ width:'100%',background:'#121212',color:'#fff',border:'none',borderRadius:10,padding:'12px 0',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}
                onClick={() => { localStorage.setItem('pv-privacy-ok','1'); setPrivacyAccepted(true); }}
              >
                I understand — open the app
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
