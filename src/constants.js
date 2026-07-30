export const ENV_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
export const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-5.4-mini";
export const OPENAI_MODELS = (import.meta.env.VITE_OPENAI_MODELS || "gpt-5.4-nano,gpt-5.4-mini,gpt-5.4")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export const AGENT_IMPORTS_FOLDER_NAME = "Imported Papers";
export const UPLOADS_FOLDER_ID = "f-uploads";
export const UPLOADS_FOLDER_NAME = "Uploads";
export const OPENAI_PROXY_ENDPOINT = "/api/openai-response";
export const REMOTE_PDF_PROXY_ENDPOINT = "/api/fetch-pdf";
export const LEGACY_STORAGE_NAME = "pv-api-key";
export const REMEMBERED_STORAGE_NAME = "pv-api-key-v2";
export const KDF_ITERATION_COUNT = 250000;
export const AGENT_WEB_SEARCH_DOMAINS = [
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

export const CHAT_SYSTEM_PROMPT = `You are an expert research assistant analyzing one or more academic PDFs.

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

export const SEARCH_DOCUMENT_TOOL = {
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

export const FETCH_REMOTE_PAPER_TOOL = {
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

export const AGENT_WEB_SEARCH_TOOL = {
  type: "web_search",
  filters: {
    allowed_domains: AGENT_WEB_SEARCH_DOMAINS,
  },
  external_web_access: true,
};

export const AGENT_SYSTEM_PROMPT = `You are Paperview Agent, a research assistant that helps users discover papers online and connect them with papers already stored in Paperview.

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

export const MAX_SEARCH_TOOL_ROUNDS = 20;
export const MAX_AGENT_RESEARCH_PASSES = 3;
export const TARGET_FOUND_SOURCES = 24;
export const MAX_FOUND_SOURCES_SHOWN = 8;
export const AGENT_MAX_OUTPUT_TOKENS = 8192;
export const AGENT_FINALIZE_MAX_OUTPUT_TOKENS = 6000;
