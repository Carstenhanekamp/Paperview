import { loadOcrPage, saveOcrPage, savePaperTextCache } from "./db";

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.Tesseract;
}

let _tesseractWorker = null;
let _tesseractWorkerBusy = 0;
let _tesseractWorkerTerminateTimer = null;
const _ocrPageMemoryCache = new Map();
const _ocrPagePromiseCache = new Map();

async function getTesseractWorker() {
  const Tesseract = await loadTesseract();
  if (!_tesseractWorker) {
    _tesseractWorker = await Tesseract.createWorker("eng", 1, { logger: () => {} });
  }
  _tesseractWorkerBusy++;
  if (_tesseractWorkerTerminateTimer) {
    clearTimeout(_tesseractWorkerTerminateTimer);
    _tesseractWorkerTerminateTimer = null;
  }
  return _tesseractWorker;
}

function releaseTesseractWorker() {
  _tesseractWorkerBusy = Math.max(0, _tesseractWorkerBusy - 1);
  if (_tesseractWorkerBusy === 0) {
    _tesseractWorkerTerminateTimer = setTimeout(async () => {
      if (_tesseractWorker && _tesseractWorkerBusy === 0) {
        try { await _tesseractWorker.terminate(); } catch { /* ignore */ }
        _tesseractWorker = null;
      }
    }, 30000);
  }
}

export async function terminateTesseractWorkerNow() {
  if (_tesseractWorkerTerminateTimer) {
    clearTimeout(_tesseractWorkerTerminateTimer);
    _tesseractWorkerTerminateTimer = null;
  }
  if (_tesseractWorker) {
    try { await _tesseractWorker.terminate(); } catch { /* ignore */ }
    _tesseractWorker = null;
    _tesseractWorkerBusy = 0;
  }
}

function splitOcrWordsIntoSegments(words) {
  if (!words.length) return [];

  const heights = words
    .map((word) => Math.max(0, word.bbox.y1 - word.bbox.y0))
    .filter((height) => height > 0)
    .sort((left, right) => left - right);
  const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
  const positiveGaps = [];
  for (let index = 1; index < words.length; index += 1) {
    const prev = words[index - 1];
    const currentWord = words[index];
    const gap = currentWord.bbox.x0 - prev.bbox.x1;
    if (gap > 0) positiveGaps.push(gap);
  }
  positiveGaps.sort((left, right) => left - right);
  const medianGap = positiveGaps.length ? positiveGaps[Math.floor(positiveGaps.length / 2)] : 0;
  const segments = [];
  let current = [];

  const flush = () => {
    if (!current.length) return;
    const bbox = current.reduce(
      (acc, word) => ({
        x0: Math.min(acc.x0, word.bbox.x0),
        y0: Math.min(acc.y0, word.bbox.y0),
        x1: Math.max(acc.x1, word.bbox.x1),
        y1: Math.max(acc.y1, word.bbox.y1),
      }),
      {
        x0: Number.POSITIVE_INFINITY,
        y0: Number.POSITIVE_INFINITY,
        x1: Number.NEGATIVE_INFINITY,
        y1: Number.NEGATIVE_INFINITY,
      }
    );
    segments.push({ bbox, words: current });
    current = [];
  };

  words.forEach((word) => {
    const isSeparatorToken = !/[A-Za-z0-9]/.test(word.text) && word.text.length <= 3;
    if (isSeparatorToken) {
      flush();
      return;
    }

    if (!current.length) {
      current.push(word);
      return;
    }

    const prev = current[current.length - 1];
    const prevHeight = Math.max(1, prev.bbox.y1 - prev.bbox.y0);
    const wordHeight = Math.max(1, word.bbox.y1 - word.bbox.y0);
    const baseHeight = Math.max(1, Math.min(prevHeight, wordHeight, medianHeight || Math.min(prevHeight, wordHeight)));
    const gap = word.bbox.x0 - prev.bbox.x1;
    const verticalShift = Math.abs(word.bbox.y0 - prev.bbox.y0);
    const gapThreshold = Math.max(18, medianGap * 2.2, baseHeight * 1.9);
    const startsNewSegment = (gap > gapThreshold && gap - medianGap > 12) || verticalShift > Math.max(12, baseHeight * 1.35);

    if (startsNewSegment) flush();
    current.push(word);
  });

  flush();
  return segments;
}

function makeOcrCacheKey({ paperId, pageNum, scale, fileSize, fileLastModified }) {
  return [paperId || "paper", pageNum || "page", scale || "scale", fileSize || "size", fileLastModified || "mtime"].join(":");
}

function isOcrRecordValid(record, fileSize, fileLastModified) {
  if (!record) return false;
  return record.fileSize === fileSize && record.fileLastModified === fileLastModified;
}

function buildPageTextFromSegments(segments) {
  return (segments || [])
    .map((line) => (line.words || []).map((word) => word.text).join(" "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function runOcrPageWithTesseract(page, scale = 2) {
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const worker = await getTesseractWorker();
  let result;
  try {
    result = await worker.recognize(canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    releaseTesseractWorker();
  }

  return (result?.data?.lines || [])
    .flatMap((line) => {
      const words = (line.words || [])
        .filter((word) => String(word.text || "").trim())
        .map((word) => ({
          text: String(word.text || "").trim(),
          bbox: {
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1,
          },
        }));

      return splitOcrWordsIntoSegments(words);
    })
    .filter((line) => line.words.length);
}

async function getCachedOcrPage({ paperId, pageNum, scale, fileSize, fileLastModified }) {
  if (!paperId || !Number.isFinite(pageNum)) return null;
  const cacheKey = makeOcrCacheKey({ paperId, pageNum, scale, fileSize, fileLastModified });
  const memoryHit = _ocrPageMemoryCache.get(cacheKey);
  if (isOcrRecordValid(memoryHit, fileSize, fileLastModified)) return memoryHit;

  const stored = await loadOcrPage({ paperId, pageNum, scale });
  if (!isOcrRecordValid(stored, fileSize, fileLastModified)) return null;
  _ocrPageMemoryCache.set(cacheKey, stored);
  return stored;
}

export async function getOcrPageData(page, options = {}) {
  const {
    paperId,
    pageNum,
    scale = 2,
    fileSize = null,
    fileLastModified = null,
  } = options;

  if (!page) return null;

  const cached = await getCachedOcrPage({ paperId, pageNum, scale, fileSize, fileLastModified });
  if (cached) return cached;

  const promiseKey = makeOcrCacheKey({ paperId, pageNum, scale, fileSize, fileLastModified });
  const existingPromise = _ocrPagePromiseCache.get(promiseKey);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    const segments = await runOcrPageWithTesseract(page, scale);
    const record = {
      paperId,
      pageNum,
      scale,
      fileSize,
      fileLastModified,
      segments,
      pageText: buildPageTextFromSegments(segments),
      updatedAt: Date.now(),
    };

    if (paperId && Number.isFinite(pageNum)) {
      await saveOcrPage(record);
    }

    _ocrPageMemoryCache.set(promiseKey, record);
    return record;
  })().finally(() => {
    _ocrPagePromiseCache.delete(promiseKey);
  });

  _ocrPagePromiseCache.set(promiseKey, promise);
  return promise;
}

export async function extractPdfText(pdfBytes, options = {}) {
  const {
    paperId = null,
    fileSize = null,
    fileLastModified = null,
    enableOcrFallback = false,
    onProgress,
  } = options;
  const lib = await loadPdfJs();
  const loadingTask = lib.getDocument({ data: pdfBytes.slice(0), stopAtErrors: false });
  const pdf = await loadingTask.promise;
  const pageTexts = [];
  const fullTextParts = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    let pageText = "";

    try {
      const textContent = await page.getTextContent({ includeMarkedContent: true });
      pageText = (textContent.items || [])
        .map((item) => String(item?.str || ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      pageText = "";
    }

    if (!pageText && enableOcrFallback) {
      try {
        const ocrData = await getOcrPageData(page, {
          paperId,
          pageNum,
          scale: 2,
          fileSize,
          fileLastModified,
        });
        pageText = ocrData?.pageText || "";
      } catch {
        pageText = "";
      }
    }

    const finalText = pageText || "[No extractable text on this page]";
    pageTexts.push({ page: pageNum, text: finalText });
    fullTextParts.push(`--- Page ${pageNum} ---\n${finalText}`);
    onProgress?.(pageNum, pdf.numPages);
  }

  const result = {
    totalPages: pdf.numPages,
    pageTexts,
    fullText: fullTextParts.join("\n\n"),
  };

  if (paperId) {
    await savePaperTextCache({
      paperId,
      fileSize,
      fileLastModified,
      totalPages: result.totalPages,
      pageTexts: result.pageTexts,
      fullText: result.fullText,
      updatedAt: Date.now(),
    });
  }

  return result;
}

export { loadPdfJs };
