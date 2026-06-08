// Pure utility functions extracted from doSendAgent in PaperviewApp.jsx.
// These accept all their dependencies as arguments and hold no component state.

import { extractResponseOutputText } from './llmProvider';

function sanitizeJsonNewlines(str) {
  // Remove literal newlines inside JSON string values to fix truncated model output.
  return str.replace(/"(?:[^"\\]|\\.)*"/g, (m) => m.replace(/\n/g, "\\n").replace(/\r/g, "\\r"));
}

// Parse and normalise a raw agent JSON response.
// Returns { parsed, parsedJson, raw }.
export function normalizeParsedAgentResponse(responseData) {
  const raw = extractResponseOutputText(responseData);

  const tryParseJson = (str) => {
    try { const p = JSON.parse(str); if (p?.answer) return p; } catch {}
    try { const p = JSON.parse(sanitizeJsonNewlines(str)); if (p?.answer) return p; } catch {}
    return null;
  };

  // Scan all { positions from right to left.
  // The greedy /\{[\s\S]*\}/ fails when the model prefixes the JSON with prose
  // containing curly braces (e.g. "{EEG markers}"), so we try each { position.
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace !== -1) {
    let pos = raw.indexOf('{');
    const starts = [];
    while (pos !== -1 && pos <= lastBrace) { starts.push(pos); pos = raw.indexOf('{', pos + 1); }
    for (let i = starts.length - 1; i >= 0; i--) {
      const result = tryParseJson(raw.slice(starts[i], lastBrace + 1));
      if (result) return { parsed: result, parsedJson: true, raw };
    }
  }

  return {
    parsed: { answer: raw.replace(/```json|```/g, "").trim(), citations: [], paper_results: [] },
    parsedJson: false,
    raw,
  };
}

// Normalise the paper_results array from an agent JSON response.
// normalizeUrl, summarize, and isPdf are passed in to avoid coupling to
// PaperviewApp.jsx's module-level utilities.
export function normalizePaperResults(paperResults = [], { targetChatId, normalizeUrl, summarize, isPdf }) {
  return (paperResults || [])
    .map((result, index) => {
      const sourceUrl = normalizeUrl(result?.source_url || result?.sourceUrl || result?.url || result?.landing_url || "");
      const pdfUrl = normalizeUrl(result?.pdf_url || result?.pdfUrl || "");
      return {
        id: result?.id || `paper-result-${targetChatId}-${Date.now()}-${index}`,
        title: String(result?.title || `Paper ${index + 1}`),
        authors: Array.isArray(result?.authors)
          ? result.authors.map((a) => String(a || "").trim()).filter(Boolean)
          : String(result?.authors || "").split(/,\s*/).filter(Boolean),
        year: result?.year ? String(result.year) : "",
        venue: String(result?.venue || result?.journal || result?.source || ""),
        abstract: String(result?.abstract || ""),
        summary: summarize(result?.summary || result?.abstract || ""),
        sourceUrl,
        pdfUrl: isPdf(pdfUrl) ? pdfUrl : "",
        doi: String(result?.doi || ""),
      };
    })
    .filter((r) => r.title || r.sourceUrl);
}

// Format a list of searchable papers into a comma-separated string for prompts.
export function formatAvailableDocuments(papers) {
  return papers?.length
    ? papers.map((p) => `"${p.name}"`).join(", ")
    : "none";
}
