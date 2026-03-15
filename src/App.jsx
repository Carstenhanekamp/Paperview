import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Routes, Route } from "react-router-dom";
import { loadAllChats, saveChat, deleteChat, deleteChatsByPaperIds, saveFolderHandle, loadFolderHandles, clearFolderHandles, saveAnnotation, loadAnnotations, deleteAnnotation, deleteAnnotationsByPaperIds, loadAllAnnotations } from './db';
import LandingPage from './LandingPage';

const ENV_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_MODELS = (import.meta.env.VITE_OPENAI_MODELS || "gpt-4o-mini,gpt-4o,gpt-4.1-mini")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

function getStoredApiKey() {
  try { return localStorage.getItem('pv-api-key') || ''; } catch { return ''; }
}
function setStoredApiKey(key) {
  try { localStorage.setItem('pv-api-key', key); } catch { /* ignore */ }
}

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

async function ocrPageWithTesseract(page, scale = 2) {
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const Tesseract = await loadTesseract();
  const result = await Tesseract.recognize(canvas, "eng", {
    logger: () => {},
  });

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

function PdfViewer({ pdfBytes, scale = 1.4, onReady, onPageChange, debugCitations = false, annotations = [], onAnnotationClick }) {
  const containerRef = useRef(null);
  const pdfRef = useRef(null);
  const wrappersRef = useRef([]);
  const [pdfReady, setPdfReady] = useState(0);
  const tasksRef = useRef([]);
  const observerRef = useRef(null);
  const ocrCacheRef = useRef(new Map());
  const ocrDoneRef = useRef(new Set());
  const ocrInFlightRef = useRef(new Set());
  const onReadyRef = useRef(onReady);
  const onPageChangeRef = useRef(onPageChange);
  const annotationsRef = useRef(annotations);
  const onAnnotationClickRef = useRef(onAnnotationClick);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  useEffect(() => {
    annotationsRef.current = annotations;
    onAnnotationClickRef.current = onAnnotationClick;
  }, [annotations, onAnnotationClick]);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el || !pdfBytes?.length) return undefined;

    let cleanupScrollTracking = () => {};
    el.innerHTML = "";
    wrappersRef.current = [];
    setPdfReady(0);
    tasksRef.current = [];
    ocrDoneRef.current = new Set();
    ocrInFlightRef.current = new Set();
    if (observerRef.current) observerRef.current.disconnect();

    const buildOcrOverlay = async (page, wrap, width, height, pageNum) => {
      // Check if the native text layer already has sufficient text.
      // If so, skip Tesseract OCR entirely — the text layer positions are more accurate.
      const existingTl = wrap.querySelector(".textLayer");
      if (existingTl) {
        const spans = existingTl.querySelectorAll("span");
        const textContent = Array.from(spans).map(s => s.textContent).join("").trim();
        if (textContent.length > 20) {
          // Native text layer has enough content — no OCR needed
          existingTl.style.pointerEvents = "auto";
          return;
        }
      }

      const ocrScale = Math.max(2, scale);
      const cacheKey = `${pageNum}@ocr:${ocrScale}`;
      let data = ocrCacheRef.current.get(cacheKey);
      if (!data) {
        data = await ocrPageWithTesseract(page, ocrScale);
        ocrCacheRef.current.set(cacheKey, data);
      }
      if (!data?.length) return;

      const ocrViewport = page.getViewport({ scale: ocrScale });
      const xScale = ocrViewport.width ? width / ocrViewport.width : 1;
      const yScale = ocrViewport.height ? height / ocrViewport.height : 1;

      wrap.querySelector(".ocrLayer")?.remove();
      const layer = document.createElement("div");
      layer.className = "ocrLayer";
      layer.style.cssText = `position:absolute;top:0;left:0;width:${width}px;height:${height}px;overflow:hidden;line-height:1;pointer-events:auto;`;

      data.forEach((seg) => {
        if (!seg?.bbox || !seg.words?.length) return;
        const lineDiv = document.createElement("div");
        lineDiv.className = "ocr-line";
        const lineWidth = Math.max(1, (seg.bbox.x1 - seg.bbox.x0) * xScale);
        const lineHeight = Math.max(1, (seg.bbox.y1 - seg.bbox.y0) * yScale);
        const left = seg.bbox.x0 * xScale;
        const top = seg.bbox.y0 * yScale;
        lineDiv.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${lineWidth}px;height:${lineHeight}px;line-height:1;pointer-events:none;user-select:none;`;

        seg.words.forEach((w, i) => {
          const span = document.createElement("span");
          span.className = "ocr-word";
          const nextWord = seg.words[i + 1];
          const wordLeft = Math.max(0, (w.bbox.x0 - seg.bbox.x0) * xScale);
          const wordTop = Math.max(0, (w.bbox.y0 - seg.bbox.y0) * yScale);
          const wordHeight = Math.max(1, (w.bbox.y1 - w.bbox.y0) * yScale);
          const wordAdvance = nextWord
            ? Math.max(w.bbox.x1 - w.bbox.x0, nextWord.bbox.x0 - w.bbox.x0)
            : (w.bbox.x1 - w.bbox.x0);
          span.dataset.targetW = String(Math.max(1, wordAdvance * xScale));
          span.style.cssText = `position:absolute;left:${wordLeft}px;top:${wordTop}px;height:${wordHeight}px;font-size:${wordHeight}px;white-space:pre;transform-origin:0 0;`;
          span.textContent = i < seg.words.length - 1 ? `${w.text} ` : w.text;
          lineDiv.appendChild(span);
        });

        layer.appendChild(lineDiv);
      });

      const tl = wrap.querySelector(".textLayer");
      if (tl) tl.style.pointerEvents = "none";
      wrap.appendChild(layer);

      // Post-render: scale each OCR word horizontally so the transparent text
      // aligns to its measured bbox without turning the entire line into one box.
      // Returns a promise so callers can wait for layout to settle.
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          layer.querySelectorAll(".ocr-word").forEach((span) => {
            const targetW = parseFloat(span.dataset.targetW);
            const naturalW = span.scrollWidth;
            if (naturalW > 0 && targetW > 0) {
              const scx = targetW / naturalW;
              if (Math.abs(scx - 1) > 0.01) {
                span.style.transformOrigin = "0 0";
                span.style.transform = `scaleX(${scx.toFixed(4)})`;
              }
            }
          });
          resolve();
        });
      });
    };

    // Helper: force-OCR a specific page (used by citation jump)
    const ensureOcr = async (pageNum) => {
      if (ocrDoneRef.current.has(pageNum)) return;
      const wrap = wrappersRef.current[pageNum - 1];
      if (!wrap || !pdfRef.current) return;
      const page = await pdfRef.current.getPage(pageNum);
      const vp = page.getViewport({ scale });
      try {
        await buildOcrOverlay(page, wrap, vp.width, vp.height, pageNum);
        ocrDoneRef.current.add(pageNum);
      } catch { /* best-effort */ }
    };

    (async () => {
      const lib = await loadPdfJs();
      const pdf = await lib.getDocument({ data: pdfBytes.slice(0) }).promise;
      if (cancelled) return;
      pdfRef.current = pdf;
      const dpr = window.devicePixelRatio || 1;

      // Phase 1: Create all page containers and start canvas renders in parallel batches
      const pageData = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale });
        const W = vp.width;
        const H = vp.height;

        const wrap = document.createElement("div");
        wrap.dataset.page = n;
        wrap.style.cssText = `position:relative;margin:0 auto 12px;width:${W}px;height:${H}px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);border:1px solid #ececec;border-radius:8px;`;
        wrap.style.setProperty("--scale-factor", String(vp.scale));
        wrappersRef.current[n - 1] = wrap;

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(W * dpr);
        canvas.height = Math.ceil(H * dpr);
        canvas.style.cssText = `display:block;width:${W}px;height:${H}px;border-radius:8px;`;

        const tl = document.createElement("div");
        tl.className = "textLayer";
        tl.style.cssText = `position:absolute;top:0;left:0;width:${W}px;height:${H}px;overflow:hidden;line-height:1;user-select:text;`;
        tl.style.setProperty("--scale-factor", String(vp.scale));

        wrap.appendChild(canvas);
        wrap.appendChild(tl);
        el.appendChild(wrap);

        pageData.push({ page, wrap, canvas, tl, W, H, n });
      }

      // Render canvases in parallel (batches of 4 for memory safety)
      const BATCH = 4;
      for (let i = 0; i < pageData.length; i += BATCH) {
        if (cancelled) break;
        const batch = pageData.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async ({ page, canvas, tl, W, H, n }) => {
            if (cancelled) return;
            const vp = page.getViewport({ scale });
            tl.style.setProperty("--scale-factor", String(vp.scale));
            const ctx = canvas.getContext("2d");
            ctx.scale(dpr, dpr);
            const task = page.render({ canvasContext: ctx, viewport: vp });
            tasksRef.current.push(task);
            try {
              await task.promise;
              // Render native text layer (hidden, used as fallback for citations)
              if (!cancelled) {
                const tc = await page.getTextContent({ includeMarkedContent: true });
                try {
                  const tlTask = lib.renderTextLayer({ textContentSource: tc, container: tl, viewport: vp });
                  if (tlTask?.promise) await tlTask.promise;
                } catch {
                  try {
                    const tlTask = lib.renderTextLayer({ textContent: tc, container: tl, viewport: vp, textDivs: [] });
                    if (tlTask?.promise) await tlTask.promise;
                  } catch { /* ignore */ }
                }
              }
            } catch (e) {
              if (e?.name !== "RenderingCancelledException") console.warn(e);
            }
          })
        );
      }

      if (cancelled) return;

      // Signal that text layers are ready for annotation highlighting
      setPdfReady((v) => v + 1);

      // Phase 2: Lazy OCR via IntersectionObserver — only OCR pages near viewport
      const scrollContainer = el.closest(".pdf-scroll");
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const wrap = entry.target;
            const pageNum = parseInt(wrap.dataset.page, 10);
            if (ocrDoneRef.current.has(pageNum) || ocrInFlightRef.current.has(pageNum)) return;
            ocrInFlightRef.current.add(pageNum);
            const pd = pageData.find((p) => p.n === pageNum);
            if (!pd) return;
            buildOcrOverlay(pd.page, pd.wrap, pd.W, pd.H, pageNum)
              .then(() => ocrDoneRef.current.add(pageNum))
              .catch(() => {})
              .finally(() => ocrInFlightRef.current.delete(pageNum));
          });
        },
        { root: scrollContainer, rootMargin: "200% 0px" } // OCR pages 2 viewports ahead
      );
      observerRef.current = observer;
      wrappersRef.current.forEach((w) => { if (w) observer.observe(w); });

      if (scrollContainer) {
        let rafId = null;
        const notifyVisiblePage = () => {
          const wraps = wrappersRef.current.filter(Boolean);
          if (!wraps.length) return;
          const targetY = scrollContainer.scrollTop + scrollContainer.clientHeight * 0.35;
          let bestPage = 1;
          let bestDist = Number.POSITIVE_INFINITY;

          wraps.forEach((w, i) => {
            const dist = Math.abs(w.offsetTop - targetY);
            if (dist < bestDist) {
              bestDist = dist;
              bestPage = i + 1;
            }
          });

          if (onPageChangeRef.current) onPageChangeRef.current(bestPage);
        };

        const onScroll = () => {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(notifyVisiblePage);
        };

        scrollContainer.addEventListener("scroll", onScroll, { passive: true });
        notifyVisiblePage();
        cleanupScrollTracking = () => {
          scrollContainer.removeEventListener("scroll", onScroll);
          if (rafId) cancelAnimationFrame(rafId);
        };
      }

      if (onReadyRef.current) {
        onReadyRef.current((pageNum, searchText, occurrenceIndex) => {
          const wrap = wrappersRef.current[pageNum - 1];
          if (!wrap) return;
          const sc = wrap.closest(".pdf-scroll");
          let off = 0;
          let e = wrap;
          while (e && e !== sc) {
            off += e.offsetTop;
            e = e.offsetParent;
          }
          if (sc) sc.scrollTo({ top: off - 80, behavior: "smooth" });

          const doHighlight = async () => {
            const dbg = (...args) => {
              if (debugCitations) console.info("[citation-debug]", ...args);
            };

            dbg("jump request", { pageNum, searchText });
            // Wait for layout to fully settle
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            // Clear any previous citation highlights across all pages
            wrappersRef.current.forEach((w) => w?.querySelectorAll(".cit-svg").forEach((x) => x.remove()));
            if (!searchText) return;

            const normalizeText = (s) =>
              (s || "")
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[“”]/g, '"')
                .replace(/[‘’]/g, "'")
                .replace(/[^\p{L}\p{N}\s]/gu, " ")
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();

            const q = normalizeText(String(searchText).replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, ""));
            const qWords = q.split(" ").filter(Boolean);
            if (!qWords.length) return;
            const isIndexedSearch = Number.isInteger(occurrenceIndex) && occurrenceIndex >= 0;
            dbg("normalized query", q);

            const makeNgrams = (arr, n) => {
              if (arr.length < n) return [];
              const out = [];
              for (let i = 0; i <= arr.length - n; i++) out.push(arr.slice(i, i + n).join(" "));
              return out;
            };

            // Match only contiguous token windows so highlights stay connected and local.
            const matchContiguousTokens = (elements, getTextFn, options = {}) => {
              const { returnAllExact = false, allowFuzzy = true } = options;
              if (!elements?.length) return null;
              const tokens = [];
              const tokenToEl = [];

              elements.forEach((el, elIdx) => {
                const ws = normalizeText(getTextFn(el)).split(" ").filter(Boolean);
                ws.forEach((w) => {
                  tokens.push(w);
                  tokenToEl.push(elIdx);
                });
              });

              if (!tokens.length) return null;
              const qLen = qWords.length;
              const exactMatches = [];

              // 1) Exact contiguous phrase match
              if (tokens.length >= qLen) {
                for (let start = 0; start <= tokens.length - qLen; start++) {
                  let ok = true;
                  for (let k = 0; k < qLen; k++) {
                    if (tokens[start + k] !== qWords[k]) {
                      ok = false;
                      break;
                    }
                  }
                  if (ok) {
                    const sEl = tokenToEl[start];
                    const eEl = tokenToEl[start + qLen - 1];
                    exactMatches.push({
                      elements: elements.slice(sEl, eEl + 1),
                      score: 1,
                      mode: "exact",
                    });
                  }
                }
              }

              if (returnAllExact) return exactMatches;
              if (exactMatches.length) return exactMatches[0];
              if (!allowFuzzy) return null;

              // 2) Contiguous fuzzy phrase match (adjacency-aware via n-grams)
              const qBi = makeNgrams(qWords, 2);
              const qTri = makeNgrams(qWords, 3);
              const minWin = Math.max(3, qLen - 4);
              const maxWin = Math.min(tokens.length, qLen + 6);
              let best = null;

              for (let start = 0; start < tokens.length; start++) {
                for (let winLen = minWin; winLen <= maxWin; winLen++) {
                  if (start + winLen > tokens.length) break;
                  const cand = tokens.slice(start, start + winLen);
                  const cBi = new Set(makeNgrams(cand, 2));
                  const cTri = new Set(makeNgrams(cand, 3));
                  const cSet = new Set(cand);

                  const biOverlap = qBi.length ? qBi.filter((g) => cBi.has(g)).length / qBi.length : 0;
                  const triOverlap = qTri.length ? qTri.filter((g) => cTri.has(g)).length / qTri.length : 0;
                  const tokOverlap = qWords.filter((w) => cSet.has(w)).length / qLen;
                  const lenPenalty = Math.abs(winLen - qLen) * 0.02;
                  const score = biOverlap * 0.6 + triOverlap * 0.25 + tokOverlap * 0.15 - lenPenalty;

                  const overlapCount = qWords.filter((w) => cSet.has(w)).length;
                  const minOverlap = Math.max(2, Math.ceil(qLen * 0.6));
                  if (overlapCount < minOverlap) continue;

                  if (!best || score > best.score) {
                    const sEl = tokenToEl[start];
                    const eEl = tokenToEl[start + winLen - 1];
                    best = {
                      elements: elements.slice(sEl, eEl + 1),
                      score,
                      mode: "fuzzy-contiguous",
                    };
                  }
                }
              }

              if (best && best.score >= 0.58) return best;
              return null;
            };

            const collectLayerMatches = () => {
              const asList = (v) => {
                if (!v) return [];
                return Array.isArray(v) ? v : [v];
              };

              const out = [];
              const ocrLayer = wrap.querySelector(".ocrLayer");
              const textLayer = wrap.querySelector(".textLayer");

              if (ocrLayer) {
                const wordSpans = Array.from(ocrLayer.querySelectorAll(".ocr-word"));
                dbg("ocr layer words", wordSpans.length);
                const mWords = matchContiguousTokens(wordSpans, (s) => s.textContent, {
                  returnAllExact: isIndexedSearch,
                  allowFuzzy: !isIndexedSearch,
                });
                asList(mWords).forEach((m) => {
                  if (m?.elements?.length) out.push({ ...m, layer: "ocrWords" });
                });

                const lineDivs = Array.from(ocrLayer.querySelectorAll(".ocr-line"));
                dbg("ocr layer lines", lineDivs.length);
                const mLines = matchContiguousTokens(lineDivs, (d) => d.textContent.trim(), {
                  returnAllExact: isIndexedSearch,
                  allowFuzzy: !isIndexedSearch,
                });
                asList(mLines).forEach((m) => {
                  if (m?.elements?.length) out.push({ ...m, layer: "ocrLines" });
                });
              }

              if (textLayer) {
                const spans = Array.from(textLayer.querySelectorAll("span"));
                dbg("text layer spans", spans.length);
                const m = matchContiguousTokens(spans, (s) => s.textContent, {
                  returnAllExact: isIndexedSearch,
                  allowFuzzy: !isIndexedSearch,
                });
                asList(m).forEach((hit) => {
                  if (hit?.elements?.length) out.push({ ...hit, layer: "textLayer" });
                });
              }

              return out;
            };

            if (isIndexedSearch && !ocrDoneRef.current.has(pageNum)) {
              dbg("indexed search requested; ensuring OCR for precise words", { pageNum });
              await ensureOcr(pageNum);
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            }

            // Prefer immediate text-layer highlight; only force OCR if no match found.
            let matches = collectLayerMatches();
            if (!matches.length && !ocrDoneRef.current.has(pageNum)) {
              dbg("no immediate match; forcing OCR fallback", { pageNum });
              await ensureOcr(pageNum);
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
              matches = collectLayerMatches();
            }

            if (!matches.length) {
              dbg("no element match found", { pageNum, q });
              if (debugCitations) {
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("width", wrap.offsetWidth);
                svg.setAttribute("height", wrap.offsetHeight);
                svg.setAttribute("class", "cit-svg");
                svg.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:5;";
                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute("x", "8");
                rect.setAttribute("y", "8");
                rect.setAttribute("width", String(Math.max(10, wrap.offsetWidth - 16)));
                rect.setAttribute("height", String(Math.max(10, wrap.offsetHeight - 16)));
                rect.setAttribute("rx", "8");
                rect.setAttribute("fill", "none");
                rect.setAttribute("stroke", "rgba(220,38,38,.8)");
                rect.setAttribute("stroke-width", "2");
                rect.setAttribute("stroke-dasharray", "6 5");
                svg.appendChild(rect);
                wrap.appendChild(svg);
              }
              return;
            }

            let bestMatch = null;
            if (isIndexedSearch) {
              const byLayer = (name) => matches.filter((m) => m.layer === name);
              const orderedLayers = ["ocrWords", "textLayer", "ocrLines"];
              let chosen = [];
              orderedLayers.some((layerName) => {
                const hits = byLayer(layerName);
                if (hits.length) {
                  chosen = hits;
                  return true;
                }
                return false;
              });
              const idx = chosen.length ? occurrenceIndex % chosen.length : 0;
              bestMatch = chosen[idx] || null;
            }

            if (!bestMatch) {
              const bestByLayer = matches.reduce((acc, m) => {
                if (!acc[m.layer] || m.score > acc[m.layer].score) acc[m.layer] = m;
                return acc;
              }, {});

              const bestOverall = matches.reduce((best, m) => (m.score > best.score ? m : best), matches[0]);
              const bestText = bestByLayer.textLayer || null;
              const OCR_ADVANTAGE_REQUIRED = 0.12;

              // Prefer native text extraction unless OCR is significantly more confident.
              bestMatch =
                bestText && bestOverall.layer !== "textLayer" && bestOverall.score < bestText.score + OCR_ADVANTAGE_REQUIRED
                  ? bestText
                  : bestOverall;
            }

            if (!bestMatch?.elements?.length) {
              dbg("best match could not be resolved", { pageNum, q, isIndexedSearch, occurrenceIndex });
              return;
            }

            const matchedEls = bestMatch.elements;
            const matchedLayer = bestMatch.layer;

            dbg("matched elements", {
              layer: matchedLayer,
              mode: bestMatch.mode,
              score: Number(bestMatch.score.toFixed(3)),
              count: matchedEls.length,
            });

            const pgW = wrap.offsetWidth;
            const pgH = wrap.offsetHeight;
            const wR = wrap.getBoundingClientRect();
            const rows = [];
            matchedEls.forEach((el) => {
              const r = el.getBoundingClientRect();
              if (!r.width || !r.height) return;
              const top = Math.round(r.top - wR.top);
              const ex = rows.find((row) => Math.abs(row.top - top) < 5);
              if (ex) {
                ex.left = Math.min(ex.left, r.left - wR.left);
                ex.right = Math.max(ex.right, r.right - wR.left);
                ex.h = Math.max(ex.h, r.height);
              } else {
                rows.push({ top, left: r.left - wR.left, right: r.right - wR.left, h: r.height });
              }
            });
            if (!rows.length) {
              dbg("matched elements had zero measurable rects");
              return;
            }
            dbg("highlight rows", rows);

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", pgW);
            svg.setAttribute("height", pgH);
            svg.setAttribute("class", "cit-svg");
            svg.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:5;";
            rows.forEach((row) => {
              const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              rect.setAttribute("x", Math.max(0, row.left - 3));
              rect.setAttribute("y", Math.max(0, row.top - 1));
              rect.setAttribute("width", Math.min(pgW, row.right - row.left + 6));
              rect.setAttribute("height", row.h + 2);
              rect.setAttribute("rx", "3");
              rect.setAttribute("fill", "rgba(250,204,21,.4)");
              rect.setAttribute("stroke", "rgba(202,138,4,.55)");
              rect.setAttribute("stroke-width", "1");
              svg.appendChild(rect);
            });
            wrap.appendChild(svg);
            dbg("highlight overlay appended");
          };

          // Small delay for scroll to settle, then highlight
          setTimeout(() => doHighlight().catch((e) => console.warn("Citation highlight failed:", e)), 420);
        });
      }
    })();

    return () => {
      cancelled = true;
      cleanupScrollTracking();
      if (observerRef.current) observerRef.current.disconnect();
      tasksRef.current.forEach((t) => {
        try {
          t.cancel();
        } catch {
          // ignore
        }
      });
    };
  }, [pdfBytes, scale]);

  // Apply annotation highlights whenever annotations change (without full re-render)
  useEffect(() => {
    const wrappers = wrappersRef.current;
    if (!wrappers.length) return;

    // Clear existing annotation highlights — restore original span text
    wrappers.forEach((w) => {
      if (!w) return;
      w.querySelectorAll('[data-ann-split]').forEach((span) => {
        // Restore original text content and remove child nodes
        span.textContent = span.dataset.annOrigText || span.textContent;
        span.removeAttribute('data-ann-split');
        span.removeAttribute('data-ann-orig-text');
      });
      w.querySelectorAll('.ann-hl').forEach((el) => {
        el.classList.remove('ann-hl');
        delete el.dataset.annId;
        el.style.removeProperty('background-color');
      });
    });

    if (!annotations.length) return;

    wrappers.forEach((wrap, idx) => {
      if (!wrap) return;
      const pageNum = idx + 1;
      const pageAnns = annotations.filter((a) => a.pageNum === pageNum);
      if (!pageAnns.length) return;

      const tl = wrap.querySelector('.textLayer');
      if (!tl) return;
      const spans = Array.from(tl.querySelectorAll(':scope > span'));
      if (!spans.length) return;

      // Build character offset map: each span's start offset in the concatenated text
      const spanOffsets = [];
      let charPos = 0;
      for (const span of spans) {
        const text = span.textContent || '';
        spanOffsets.push({ span, start: charPos, end: charPos + text.length, text });
        charPos += text.length;
      }

      // Sort annotations by startOffset so we process them front-to-back
      const sorted = [...pageAnns].sort((a, b) => a.startOffset - b.startOffset);

      for (const ann of sorted) {
        const { startOffset, endOffset, id } = ann;
        const color = ann.color || 'rgba(255,213,79,.4)';

        for (const so of spanOffsets) {
          // Skip spans that don't overlap with this annotation
          if (so.end <= startOffset || so.start >= endOffset) continue;

          const relStart = Math.max(0, startOffset - so.start);
          const relEnd = Math.min(so.text.length, endOffset - so.start);

          if (relStart === 0 && relEnd === so.text.length) {
            // Entire span is highlighted
            so.span.classList.add('ann-hl');
            so.span.dataset.annId = id;
            so.span.style.backgroundColor = color;
          } else {
            // Partial span — replace text content with inline child spans
            // Keep the original absolutely-positioned span as parent
            const before = so.text.substring(0, relStart);
            const highlighted = so.text.substring(relStart, relEnd);
            const after = so.text.substring(relEnd);

            so.span.dataset.annSplit = '1';
            so.span.dataset.annOrigText = so.text;
            so.span.textContent = '';

            if (before) {
              so.span.appendChild(document.createTextNode(before));
            }

            const hSpan = document.createElement('span');
            hSpan.textContent = highlighted;
            hSpan.classList.add('ann-hl');
            hSpan.dataset.annId = id;
            hSpan.style.backgroundColor = color;
            so.span.appendChild(hSpan);

            if (after) {
              so.span.appendChild(document.createTextNode(after));
            }
          }
        }
      }
    });
  }, [annotations, scale, pdfReady]);

  // Click handler for annotation highlights
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      const target = e.target.closest('[data-ann-id]');
      if (!target) return;
      const annId = target.dataset.annId;
      const ann = annotationsRef.current.find((a) => a.id === annId);
      if (ann && onAnnotationClickRef.current) {
        const rect = target.getBoundingClientRect();
        onAnnotationClickRef.current(ann, { x: rect.left + rect.width / 2, y: rect.bottom + 4 });
      }
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, []);

  return <div ref={containerRef} className="pdf-pages" />;
}

async function extractPdfText(pdfBytes, options = {}) {
  const { enableOcrFallback = false, onProgress } = options;
  const lib = await loadPdfJs();
  const loadingTask = lib.getDocument({ data: pdfBytes.slice(0) });
  const pdf = await loadingTask.promise;
  const pageTexts = [];
  const fullTextParts = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    onProgress?.(pageNum, pdf.numPages);
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
        const ocrLines = await ocrPageWithTesseract(page, 2);
        pageText = ocrLines
          .map((line) => line.words.map((word) => word.text).join(" "))
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      } catch {
        pageText = "";
      }
    }

    const finalText = pageText || "[No extractable text on this page]";
    pageTexts.push({ page: pageNum, text: finalText });
    fullTextParts.push(`--- Page ${pageNum} ---\n${finalText}`);
  }

  return {
    totalPages: pdf.numPages,
    pageTexts,
    fullText: fullTextParts.join("\n\n"),
  };
}

const Ic = ({ size = 16, fill = "none", sw = 1.75, vb = "0 0 24 24", style, children }) => (
  <svg
    width={size}
    height={size}
    viewBox={vb}
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    {children}
  </svg>
);

const IFolder = (p) => (
  <Ic {...p}>
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4.2l1.8 2h6.9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z" />
  </Ic>
);
const IFolderOpen = (p) => (
  <Ic {...p}>
    <path d="M3.5 8a2 2 0 0 1 2-2h4.2l1.8 2h7.1a2 2 0 0 1 1.95 2.45l-1.3 6a2 2 0 0 1-1.95 1.55H5.7a2 2 0 0 1-1.95-1.55l-1.1-5A2 2 0 0 1 4.6 9h15.1" />
  </Ic>
);
const IFile = (p) => (
  <Ic {...p}>
    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
    <path d="M14 2v5h5" />
    <path d="M9 13h6M9 17h6" />
  </Ic>
);
const IPlus = (p) => (
  <Ic {...p}>
    <path d="M12 5v14M5 12h14" />
  </Ic>
);
const ISearch = (p) => (
  <Ic {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-3.8-3.8" />
  </Ic>
);
const IUpload = (p) => (
  <Ic {...p}>
    <path d="M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" />
    <path d="M12 4v10" />
    <path d="M8.5 7.5 12 4l3.5 3.5" />
  </Ic>
);
const IClose = (p) => (
  <Ic {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Ic>
);
const ICopy = (p) => (
  <Ic {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </Ic>
);
const IZoomIn = (p) => (
  <Ic {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-3.8-3.8M11 8v6M8 11h6" />
  </Ic>
);
const IZoomOut = (p) => (
  <Ic {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-3.8-3.8M8 11h6" />
  </Ic>
);
const IPanel = (p) => (
  <Ic {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Ic>
);
const IGrid = (p) => (
  <Ic {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Ic>
);
const IFilter = (p) => (
  <Ic {...p}>
    <path d="M4 5h16l-6 7v5l-4 2v-7z" />
  </Ic>
);
const IShare = (p) => (
  <Ic {...p}>
    <path d="M12 16V4" />
    <path d="M8.5 7.5 12 4l3.5 3.5" />
    <path d="M4 14.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3.5" />
  </Ic>
);
const IChat = (p) => (
  <Ic {...p}>
    <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
  </Ic>
);
const IMore = (p) => (
  <Ic {...p} sw={2.6}>
    <circle cx="5" cy="12" r="0.8" />
    <circle cx="12" cy="12" r="0.8" />
    <circle cx="19" cy="12" r="0.8" />
  </Ic>
);
const ILeft = (p) => (
  <Ic {...p}>
    <path d="m15 18-6-6 6-6" />
  </Ic>
);
const IRight = (p) => (
  <Ic {...p}>
    <path d="m9 18 6-6-6-6" />
  </Ic>
);
const ISpark = (p) => (
  <Ic {...p}>
    <path d="m12 3 1.9 4.9L19 10l-5.1 2.1L12 17l-1.9-4.9L5 10l5.1-2.1z" />
  </Ic>
);
const IPaperclip = (p) => (
  <Ic {...p}>
    <path d="M21.4 11.1 13 19.5a5 5 0 0 1-7.1-7.1l8.5-8.5a3 3 0 1 1 4.2 4.2l-8.5 8.5a1 1 0 0 1-1.4-1.4l7.8-7.8" />
  </Ic>
);
const IChevronDown = (p) => (
  <Ic {...p}>
    <path d="m6 9 6 6 6-6" />
  </Ic>
);
const IArrowUp = (p) => (
  <Ic {...p}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </Ic>
);
const IArrowDown = (p) => (
  <Ic {...p}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </Ic>
);
const IChevronLeftDouble = (p) => (
  <Ic {...p}>
    <path d="m13 17-5-5 5-5M19 17l-5-5 5-5" />
  </Ic>
);
const IChevronRightDouble = (p) => (
  <Ic {...p}>
    <path d="m11 17 5-5-5-5M5 17l5-5-5-5" />
  </Ic>
);
const ITrash = (p) => (
  <Ic {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="m6.8 6 1 13a2 2 0 0 0 2 1.8h4.4a2 2 0 0 0 2-1.8l1-13" />
    <path d="M10 10.5v6M14 10.5v6" />
  </Ic>
);
const IGear = (p) => (
  <Ic {...p}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Ic>
);
const IEye = (p) => (
  <Ic {...p}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Ic>
);
const IEyeOff = (p) => (
  <Ic {...p}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </Ic>
);
const IHighlight = (p) => (
  <Ic {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </Ic>
);
const INotes = (p) => (
  <Ic {...p}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </Ic>
);

const CHAT_TITLE_FALLBACK = "New chat";

function createChatThreadRecord(paperId) {
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    paperId,
    title: CHAT_TITLE_FALLBACK,
    messages: [],
    updatedAt: Date.now(),
  };
}

function deriveChatTitle(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return CHAT_TITLE_FALLBACK;
  return cleaned.length > 48 ? `${cleaned.slice(0, 48).trim()}...` : cleaned;
}

function formatChatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatChatMessageCount(count) {
  return `${count} message${count === 1 ? "" : "s"}`;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#ffffff;
  --bg2:#ffffff;
  --surface:#ffffff;
  --surface-strong:#ffffff;
  --surface-soft:#ffffff;
  --border:#ececec;
  --border2:#e3e3e3;
  --text:#121212;
  --text2:#4e4b45;
  --text3:#8a867c;
  --accent:#121212;
  --accent-hover:#000000;
  --chip:#ffffff;
  --shadow:0 10px 28px rgba(15,15,15,.05);
}
html,body,#root{height:100%;}
body{font-family:'Manrope',sans-serif;background:var(--bg);color:var(--text);height:100vh;overflow:hidden;}
.app{display:flex;height:100vh;width:100vw;overflow:hidden;position:relative;background:var(--bg);}
.sb{width:260px;min-width:260px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;overflow:hidden;transition:width .2s,min-width .2s;}
.sb.closed{width:0;min-width:0;border-right:0;}
.sb-inner{width:260px;display:flex;flex-direction:column;height:100vh;overflow:hidden;}
.sb-user{padding:14px 14px 10px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);}
.sb-avatar{width:28px;height:28px;border-radius:999px;background:#f4f6f8;color:#4a4f56;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;}
.sb-username{font-size:14px;font-weight:700;color:#1d1d1b;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-tog{background:#fff;border:1px solid var(--border);color:#53514c;cursor:pointer;padding:6px;border-radius:10px;display:flex;}
.sb-tog:hover{background:#f7f7f7;}
.sb-nav{padding:8px 8px 6px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:2px;}
.sb-nav-item{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;cursor:pointer;color:#47443e;font-size:14px;font-weight:500;border:none;background:none;width:100%;text-align:left;font-family:inherit;transition:background .12s ease,color .12s ease;}
.sb-nav-item:hover{background:#f3f6fb;color:#171715;}
.sb-nav-item.active{background:#e8f2ff;color:#0f4ea6;}
.sb-search-wrap{padding:12px 12px 8px;position:relative;}
.sb-search-icon{position:absolute;left:24px;top:50%;transform:translateY(-35%);color:#8f99a8;pointer-events:none;}
.sb-search-input{width:100%;background:#fff;border:1px solid #d6dbe3;color:#22211f;border-radius:8px;padding:10px 12px 10px 36px;font-size:12px;font-family:inherit;outline:none;}
.sb-search-input::placeholder{color:#939db0;}
.sb-search-input:focus{border-color:#abc7f4;background:#fff;}
.sb-section{padding:6px 10px 10px;flex:1;overflow-y:auto;}
.sb-section-label{font-size:12px;font-weight:600;letter-spacing:0;color:#7f7b73;padding:12px 8px 8px;}
.sb-folder{margin-bottom:2px;}
.sb-folder-hd{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;cursor:pointer;transition:background .12s ease;}
.sb-folder-hd:hover{background:#f3f6fb;}
.sb-folder-hd.active{background:#e8f2ff;color:#111;}
.sb-folder-hd.active .sb-folder-name{color:#161614;}
.sb-folder-hd.active .sb-folder-cnt{background:#d7e7ff;color:#1857b5;}
.sb-folder-toggle{width:18px;height:18px;border-radius:4px;border:none;background:none;color:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.sb-folder-toggle:hover{background:#e8eef7;}
.sb-folder-hd.active .sb-folder-toggle:hover{background:#d7e7ff;}
.sb-folder-name{font-size:13px;color:#35322d;flex:1;font-weight:500;}
.sb-folder-cnt{font-size:10px;color:#666156;padding:1px 6px;border-radius:999px;background:#eef1f5;font-weight:700;}
.sb-papers{padding:2px 0 6px 18px;display:flex;flex-direction:column;gap:1px;}
.sb-paper{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;cursor:pointer;transition:background .12s ease;}
.sb-paper:hover{background:#f4f7fb;}
.sb-paper.active{background:#cfe4ff;color:#111;}
.sb-paper-icon{color:#7e8898;display:flex;}
.sb-paper.active .sb-paper-icon{color:#1959b7;}
.sb-paper-title{font-size:12px;color:#47443e;line-height:1.3;flex:1;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.sb-paper.active .sb-paper-title{color:#181816;}
.empty-upload-btn{height:24px;border-radius:7px;border:1px solid #ddd;background:#fff;color:#111;padding:0 8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:4px;}
.empty-upload-btn:hover{background:#f7f7f7;}
.sb-footer{padding:10px 12px 12px;border-top:1px solid var(--border);background:var(--surface);}
.sb-upload-btn{width:100%;background:#111111;color:#fff;border:1px solid #111111;border-radius:8px;padding:10px 12px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;}
.sb-upload-btn:hover{background:#000;}
.sb-new-folder{width:100%;background:#fff;color:#2e2b26;border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;margin-top:6px;}
.sb-new-folder:hover{background:#fff;}
.nf-input{background:#fff;border:1px solid #111;color:#111;border-radius:8px;padding:6px 10px;font-size:12px;font-family:inherit;outline:none;margin:3px 0;width:100%;display:block;}
.nf-ctrl{display:flex;gap:6px;margin-top:6px;}
.nf-ctrl .lib-btn{flex:1;justify-content:center;}
.nf-error{font-size:11px;color:#b91c1c;padding:2px 2px 0;}
.main{flex:1;display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg);}
.topbar{height:58px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 16px;gap:14px;flex-shrink:0;}
.topbar-left{display:flex;align-items:center;gap:8px;}
.topbar-title-stack{display:flex;flex-direction:column;gap:3px;}
.topbar-folder-name{font-size:15px;font-weight:700;color:var(--text);}
.topbar-subtitle{font-size:12px;color:var(--text3);}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:8px;}
.topbar-count{font-size:12px;color:#3f3c37;background:#fff;border:1px solid var(--border);padding:7px 10px;border-radius:6px;font-weight:600;}
.topbar-mode{font-size:12px;color:#3f3c37;background:#fff;border:1px solid var(--border);padding:7px 10px;border-radius:6px;font-weight:600;}
.topbar-btn{background:#fff;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;}
.topbar-btn.active{background:#111;color:#fff;border-color:#111;}
.tb-divider{width:1px;height:20px;background:var(--border);}
.tabbar{height:42px;background:#fafafa;border-bottom:1px solid var(--border);display:flex;align-items:flex-end;padding:0 10px;overflow-x:auto;overflow-y:hidden;flex-shrink:0;}
.tabbar::-webkit-scrollbar{height:6px;}
.tabbar::-webkit-scrollbar-thumb{background:#d9d9d9;border-radius:999px;}
.tab{position:relative;display:flex;align-items:center;gap:8px;padding:0 10px 0 12px;height:33px;width:208px;min-width:208px;max-width:208px;margin-left:-1px;border:1px solid #e5e5e5;border-bottom:none;border-radius:6px 6px 0 0;cursor:pointer;font-size:13px;color:#676258;white-space:nowrap;background:#f3f3f3;transition:background .15s ease,color .15s ease,border-color .15s ease;}
.tab-first{margin-left:0;}
.tab::after{display:none;}
.tab:hover{background:#fafafa;color:#25231f;}
.tab.active{background:#fff;color:#151513;border-color:#d9d9d9;}
.tab.active::after,.tab:hover::after{opacity:0;}
.tab-icon{display:flex;color:#928d82;flex-shrink:0;}
.tab.active .tab-icon{color:#1e1d1a;}
.tab-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:1;}
.tabbar-tail{flex:1;min-width:20px;margin-left:0;height:1px;background:#d9d9d9;align-self:flex-end;}
.tab-close{display:flex;align-items:center;justify-content:center;width:18px;height:18px;border:none;background:transparent;color:#8f8a80;border-radius:4px;cursor:pointer;opacity:0;flex-shrink:0;transition:opacity .12s ease,background .12s ease,color .12s ease;}
.tab:hover .tab-close,.tab.active .tab-close{opacity:1;}
.tab-close:hover{background:#e7eef9;color:#1857b5;}
.content{flex:1;display:flex;overflow:hidden;}
.content-reader{padding:0;gap:0;background:var(--bg);}
.viewer{flex:1;display:flex;flex-direction:column;min-width:0;gap:0;}
.viewer-frame{flex:1;min-height:0;display:flex;flex-direction:column;border-right:1px solid var(--border);overflow:hidden;background:var(--surface);box-shadow:none;}
.viewer-toolbar{height:42px;background:#fafafa;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 10px;gap:8px;flex-shrink:0;min-width:0;}
.vt-left{display:flex;align-items:center;gap:6px;flex:1;min-width:0;}
.vt-btn{background:none;border:none;color:var(--text3);cursor:pointer;padding:7px 8px;border-radius:4px;display:flex;align-items:center;font-size:12px;gap:4px;}
.vt-btn:hover{background:#e7eef9;color:#1857b5;}
.vt-btn:disabled{opacity:.35;cursor:not-allowed;}
.vt-btn:disabled:hover{background:none;color:var(--text3);}
.vt-search-wrap{display:flex;align-items:center;gap:6px;min-width:0;}
.vt-search-input{height:28px;width:180px;max-width:200px;min-width:72px;border:1px solid #d6dbe3;border-radius:4px;background:#fff;color:#111;padding:0 8px;font-size:12px;font-family:inherit;outline:none;}
.vt-search-nav{display:flex;align-items:center;gap:2px;}
.vt-search-meta{font-size:11px;color:#888277;min-width:40px;white-space:nowrap;font-weight:700;}
.vt-sep{width:1px;height:16px;background:var(--border);}
.vt-zoom{display:flex;align-items:center;gap:4px;}
.vt-zoom-val{font-size:12px;color:var(--text2);min-width:42px;text-align:center;font-weight:800;}
.vt-page{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.vt-page-total{font-size:12px;color:var(--text3);font-weight:700;}
.pdf-scroll{flex:1;overflow:auto;background:#ffffff;padding:14px;position:relative;}
.pdf-pages{display:flex;flex-direction:column;align-items:center;}
.pdf-pages > div{border-radius:4px !important;border:1px solid #d2d2d2 !important;box-shadow:0 6px 18px rgba(15,15,15,.10) !important;}
.textLayer{position:absolute;inset:0;overflow:hidden;line-height:1;-webkit-text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;z-index:2;}
.textLayer{pointer-events:auto;}
.textLayer span,.textLayer br{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0;font-kerning:none;font-variant-ligatures:none;-webkit-user-modify:read-only;}
.textLayer span::selection{background:rgba(59,130,246,.35);color:transparent;}
.textLayer br::selection{background:rgba(59,130,246,.35);}
.textLayer .endOfContent{display:block;position:absolute;left:0;top:100%;right:0;bottom:0;z-index:-1;cursor:default;user-select:none;}
.textLayer .markedContent{top:0;height:0;}
.pdf-scroll.debug-text-layer .textLayer span{outline:1px solid rgba(255,0,0,.25);background:rgba(255,0,0,.08)!important;}
.ocrLayer{user-select:text;-webkit-user-select:text;}
.ocrLayer .ocr-line{pointer-events:none;user-select:none;-webkit-user-select:none;}
.ocrLayer .ocr-word{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0;font-kerning:none;font-variant-ligatures:none;pointer-events:auto;user-select:text;-webkit-user-select:text;}
.ocrLayer .ocr-word::selection{background:rgba(59,130,246,.35);color:transparent;}
.pdf-scroll.debug-text-layer .ocrLayer .ocr-line{outline:1px solid rgba(0,128,0,.35);background:rgba(0,128,0,.06)!important;}
.pdf-scroll.debug-text-layer .ocrLayer .ocr-word{outline:1px dotted rgba(0,200,0,.3);background:rgba(0,200,0,.08)!important;}
.sel-pop{position:fixed;background:white;border:1px solid var(--border);border-radius:14px;padding:6px;display:flex;gap:4px;box-shadow:0 16px 32px rgba(0,0,0,.14);z-index:1000;}
.sel-btn{background:none;border:none;color:var(--text2);padding:6px 10px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:500;font-family:inherit;display:flex;align-items:center;gap:6px;white-space:nowrap;}
.sel-btn.pri{color:#111;}
.sel-btn:hover{background:#f5f5f5;}
.ann-hl{background:rgba(255,213,79,.4)!important;border-radius:2px;cursor:pointer;color:transparent!important;}
.ann-hl::selection{background:rgba(59,130,246,.35);color:transparent;}
.ann-popover{position:fixed;background:white;border:1px solid var(--border);border-radius:14px;padding:14px;box-shadow:0 16px 32px rgba(0,0,0,.14);z-index:1001;width:300px;display:flex;flex-direction:column;gap:10px;}
.ann-popover-text{font-size:12px;color:#555;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;font-style:italic;}
.ann-popover textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;resize:vertical;min-height:60px;outline:none;}
.ann-popover textarea:focus{border-color:#9ebded;}
.ann-popover-actions{display:flex;gap:6px;justify-content:flex-end;}
.ann-popover-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:white;color:#333;font-family:inherit;}
.ann-popover-btn:hover{background:#f5f5f5;}
.ann-popover-btn.primary{background:#111;color:white;border-color:#111;}
.ann-popover-btn.primary:hover{background:#333;}
.ann-popover-btn.danger{color:#dc2626;border-color:#fca5a5;}
.ann-popover-btn.danger:hover{background:#fef2f2;}
.notes-panel{flex:1;overflow-y:auto;padding:16px;}
.notes-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:32px;color:#888;}
.notes-empty-icon{font-size:28px;opacity:.3;margin-bottom:12px;}
.notes-empty h3{font-size:15px;font-weight:600;color:#555;margin:0 0 8px;}
.notes-empty p{font-size:13px;line-height:1.6;max-width:260px;}
.notes-group{margin-bottom:20px;}
.notes-group-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#888;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border);}
.note-card{background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:box-shadow .15s ease;}
.note-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.08);}
.note-card-text{font-size:12px;color:#555;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-style:italic;margin-bottom:4px;}
.note-card-comment{font-size:13px;color:#111;line-height:1.5;margin-bottom:4px;}
.note-card-no-comment{font-size:12px;color:#bbb;font-style:italic;}
.note-card-footer{display:flex;align-items:center;justify-content:space-between;}
.note-card-page{font-size:11px;color:#999;font-weight:500;}
.note-card-delete{background:none;border:none;color:#ccc;cursor:pointer;padding:2px;border-radius:4px;}
.note-card-delete:hover{color:#dc2626;}
.edge-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#e0e0e0;padding:14px 20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:10000;display:flex;align-items:center;gap:12px;max-width:560px;font-size:13px;line-height:1.5;animation:edgeToastIn .3s ease;}
.edge-toast b{color:#fff;}
.edge-toast button{background:rgba(255,255,255,.15);border:none;color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;flex-shrink:0;}
.edge-toast button:hover{background:rgba(255,255,255,.25);}
@keyframes edgeToastIn{from{opacity:0;transform:translateX(-50%) translateY(12px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
.sb-resize-handle{width:5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0;z-index:10;}
.sb-resize-handle:hover .sb-resize-grip,.sb-resize-handle:active .sb-resize-grip{background:#9ebded;}
.sb-resize-grip{position:absolute;top:0;bottom:0;left:1px;width:3px;background:transparent;border-radius:999px;transition:background .12s ease;}
.chat-resize-handle{width:5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0;}
.chat-resize-handle:hover .chat-resize-grip,.chat-resize-handle:active .chat-resize-grip{background:#9ebded;}
.chat-resize-grip{position:absolute;top:0;bottom:0;left:1px;width:3px;background:transparent;border-radius:999px;transition:background .12s ease;}
.chat-panel{width:min(480px,38vw);min-width:380px;background:var(--surface);display:flex;flex-direction:column;height:100%;overflow:hidden;box-shadow:none;}
.chat-topbar{height:46px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 10px;gap:12px;flex-shrink:0;background:#fafafa;}
.chat-topbar-copy{display:flex;flex-direction:column;gap:1px;min-width:0;}
.chat-topbar-title{font-size:13px;font-weight:600;color:#1b1b19;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-topbar-subtitle{font-size:11px;color:#8b867c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-topbar-actions{display:flex;align-items:center;gap:6px;}
.chat-topbar-btn{background:#fff;border:1px solid var(--border);color:#111;cursor:pointer;padding:5px;border-radius:4px;display:flex;}
.chat-topbar-btn-label{padding:5px 8px;gap:6px;align-items:center;font-size:11px;font-weight:600;font-family:inherit;}
.chat-topbar-btn:hover{background:#f3f6fb;color:#1857b5;border-color:#cbdffb;}
.chat-topbar-btn:disabled{opacity:.45;cursor:not-allowed;}
.chat-history-panel{border-bottom:1px solid var(--border);background:#fcfcfc;display:flex;flex-direction:column;max-height:240px;}
.chat-history-panel.chat-history-standalone{flex:1;max-height:none;border-bottom:none;}
.chat-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);background:#fafafa;}
.chat-history-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-history-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7d786f;}
.chat-history-subtitle{font-size:11px;color:#918b82;}
.chat-history-actions{display:flex;align-items:center;gap:6px;}
.chat-history-btn{border:1px solid var(--border);background:#fff;border-radius:4px;padding:5px 8px;font-size:11px;font-weight:600;color:#37342f;cursor:pointer;font-family:inherit;}
.chat-history-btn:hover{background:#f3f6fb;color:#1857b5;border-color:#cbdffb;}
.chat-history-btn:disabled{opacity:.45;cursor:not-allowed;}
.chat-history-empty{padding:10px;font-size:12px;color:#8b867c;}
.chat-overview-shell{flex:1;overflow:auto;padding:12px;background:#fff;display:flex;flex-direction:column;gap:12px;}
.chat-overview-hero{border:1px solid var(--border);border-radius:8px;background:#fff;padding:12px;display:flex;flex-direction:column;gap:12px;box-shadow:0 1px 0 rgba(255,255,255,.75) inset;}
.chat-overview-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.chat-overview-copy{display:flex;flex-direction:column;gap:4px;min-width:0;}
.chat-overview-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7d786f;}
.chat-overview-title{font-size:16px;font-weight:700;color:#1e1c18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-overview-subtitle{font-size:12px;line-height:1.55;color:#696459;max-width:34ch;}
.chat-overview-badge{display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 9px;border-radius:999px;border:1px solid #d8e6fb;background:#eff5ff;color:#2459a8;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;}
.chat-overview-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.chat-overview-stat{border:1px solid var(--border);border-radius:6px;background:#fff;padding:9px 10px;display:flex;flex-direction:column;gap:3px;}
.chat-overview-stat-value{font-size:17px;font-weight:700;color:#1f1d1a;}
.chat-overview-stat-label{font-size:11px;color:#7c766d;}
.chat-overview-primary-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.chat-overview-section{border:1px solid var(--border);border-radius:8px;background:#fff;overflow:hidden;}
.chat-overview-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);background:#fafafa;}
.chat-overview-section-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-overview-section-title{font-size:12px;font-weight:700;color:#22201c;}
.chat-overview-section-subtitle{font-size:11px;color:#8b867c;}
.chat-overview-count{min-width:24px;height:24px;padding:0 8px;border-radius:999px;background:#fff;border:1px solid #ececec;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#5f5a50;}
.chat-overview-list{display:flex;flex-direction:column;}
.chat-overview-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border-top:1px solid var(--border);}
.chat-overview-row:first-child{border-top:none;}
.chat-overview-row-main{border:none;background:none;padding:0;min-width:0;display:flex;flex-direction:column;gap:4px;text-align:left;cursor:pointer;font-family:inherit;}
.chat-overview-row-main:hover .chat-overview-row-title{color:#1857b5;}
.chat-overview-row-top{display:flex;align-items:center;gap:8px;min-width:0;}
.chat-overview-row-title{font-size:13px;font-weight:600;color:#1f1d1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-overview-row-meta{font-size:11px;color:#8b867c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-overview-row-summary{font-size:11px;color:#696459;line-height:1.45;}
.chat-overview-row-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.chat-overview-empty-state{padding:22px 16px;display:flex;flex-direction:column;gap:5px;align-items:flex-start;background:#fff;}
.chat-overview-empty-title{font-size:13px;font-weight:700;color:#1f1d1a;}
.chat-overview-empty-copy{font-size:12px;line-height:1.55;color:#78736a;max-width:34ch;}
.chat-thread-list{display:flex;flex-direction:column;overflow:auto;}
.chat-thread-item{display:flex;align-items:stretch;border-bottom:1px solid var(--border);background:#fff;}
.chat-thread-item:last-child{border-bottom:none;}
.chat-thread-item.active{background:#eef5ff;}
.chat-thread-main{flex:1;min-width:0;border:none;background:none;text-align:left;padding:9px 10px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:2px;}
.chat-thread-main:hover{background:#f5f8fd;}
.chat-thread-item.active .chat-thread-main:hover{background:#e8f2ff;}
.chat-thread-name{font-size:12px;font-weight:600;color:#1f1d1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-thread-meta{font-size:11px;color:#8b867c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-thread-actions{display:flex;align-items:center;gap:4px;padding:0 8px;border-left:1px solid var(--border);background:rgba(255,255,255,.5);}
.chat-thread-row-btn{border:1px solid var(--border);background:#fff;border-radius:4px;padding:4px 7px;font-size:10px;font-weight:600;color:#4a463f;cursor:pointer;font-family:inherit;}
.chat-thread-row-btn:hover{background:#f3f6fb;color:#1857b5;border-color:#cbdffb;}
.chat-thread-delete{width:28px;height:28px;border:1px solid #f0d3d3;border-radius:4px;background:#fff7f7;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#b42318;flex-shrink:0;}
.chat-thread-delete:hover{background:#fff0f0;color:#912018;}
.chat-msgs{flex:1;overflow-y:auto;overflow-x:hidden;padding:18px 16px 16px;display:flex;flex-direction:column;gap:16px;}
.chat-empty{flex:1;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;text-align:left;padding:12px 12px 0;gap:12px;}
.chat-empty-intro{display:flex;gap:10px;align-items:flex-start;padding:4px 2px;}
.chat-empty-icon{width:34px;height:34px;background:#e8f2ff;border:1px solid #cbdffb;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#1857b5;flex-shrink:0;}
.chat-empty-copy h3{font-size:16px;font-weight:700;color:var(--text);line-height:1.25;max-width:none;}
.chat-empty-copy p{font-size:12px;color:var(--text3);line-height:1.55;max-width:none;margin-top:4px;}
.chat-empty-sections{display:flex;flex-direction:column;gap:10px;}
.chat-empty-block{border:1px solid var(--border);border-radius:6px;background:#fff;overflow:hidden;}
.chat-empty-block-title{padding:9px 12px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#78736a;background:#fafafa;}
.chat-empty-suggestions{display:grid;grid-template-columns:1fr;gap:0;width:100%;}
.chat-suggestion{border:none;border-bottom:1px solid var(--border);background:#fff;padding:11px 12px;font-size:12px;font-weight:600;color:#2f2c28;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;}
.chat-suggestion:last-child{border-bottom:none;}
.chat-suggestion:hover{background:#f3f6fb;color:#1857b5;}
.chat-suggestion-icon{width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:#6f7786;flex-shrink:0;}
.chat-suggestion-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-suggestion-title{font-size:12px;font-weight:600;color:inherit;}
.chat-suggestion-meta{font-size:11px;color:#8d877d;}
.chat-empty-note{padding:10px 12px;font-size:12px;line-height:1.55;color:#5f5a50;background:#fff;}
.msg-u{display:flex;justify-content:flex-end;}
.msg-u-bubble{background:#fff;color:#111;border:1px solid var(--border);border-radius:16px 16px 6px 16px;padding:12px 14px;font-size:13px;line-height:1.6;max-width:88%;}
.msg-a{display:flex;flex-direction:column;gap:8px;}
.msg-a-row{display:flex;align-items:flex-start;gap:8px;}
.msg-a-avatar{width:24px;height:24px;border-radius:999px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:4px;}
.msg-a-bubble{background:#fff;border:1px solid var(--border);border-radius:16px 16px 16px 6px;padding:12px 14px;font-size:13px;line-height:1.6;color:#111;max-width:320px;overflow-wrap:anywhere;}
.inline-cit-wrap{display:inline-flex;align-items:center;position:relative;vertical-align:baseline;}
.inline-cit-anchor{margin-left:4px;border:1px solid #d8d8d8;background:#f8f8f8;color:#111;border-radius:999px;font-size:10px;line-height:1;padding:2px 6px;cursor:pointer;font-weight:600;font-family:inherit;}
.inline-cit-anchor:hover{background:#efefef;border-color:#cfcfcf;}
.inline-cit-popover{position:absolute;left:0;top:calc(100% + 6px);z-index:40;min-width:220px;max-width:min(320px,calc(100vw - 80px));box-sizing:border-box;}
.inline-cit-popover .source-card{box-shadow:0 8px 24px rgba(0,0,0,.14);background:#fff;}
.sources-label{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;}
.sources-row{display:flex;flex-direction:column;gap:6px;}
.source-card{background:#fafafa;border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer;}
.source-card-top{display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;}
.source-card-file{font-size:11px;font-weight:600;color:var(--text2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.source-card-page{font-size:10px;color:var(--text3);background:#f0f0f0;padding:1px 6px;border-radius:8px;white-space:nowrap;}
.source-card-jump{font-size:10px;color:#111;font-weight:600;margin-left:auto;white-space:nowrap;}
.source-card-text{font-size:12px;color:var(--text2);line-height:1.5;font-style:italic;}
.chat-thinking{display:flex;align-items:center;gap:8px;padding:8px 0;}
.typing{display:flex;gap:3px;}
.typing span{width:5px;height:5px;background:#8f8f8f;border-radius:50%;animation:bounce 1.2s infinite;}
.typing span:nth-child(2){animation-delay:.2s;} .typing span:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-4px);}}
@keyframes citHighlight{0%{opacity:1;}70%{opacity:1;}100%{opacity:0;}}
.chat-input-area{padding:10px;border-top:1px solid var(--border);background:#fafafa;}
.ctx-chip{background:#fff;border:1px solid var(--border);border-radius:12px;padding:8px 10px;margin-bottom:10px;display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#111;}
.ctx-chip-text{flex:1;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.ctx-chip-x{cursor:pointer;opacity:.6;}
.chat-composer{background:#fff;border:1px solid var(--border);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:10px;}
.chat-composer textarea{background:none;border:none;outline:none;color:#111;font-size:13px;font-family:inherit;resize:none;line-height:1.5;max-height:100px;min-height:22px;}
.chat-composer textarea::placeholder{color:#888;}
.composer-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.composer-tools{display:flex;align-items:center;gap:8px;}
.icon-btn{width:32px;height:32px;border-radius:4px;border:1px solid var(--border);background:#fff;color:#302d28;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.icon-btn:hover{background:#f3f6fb;color:#1857b5;}
.send-btn{background:#111;border-color:#111;color:#fff;}
.send-btn:hover{background:#000;}
.attach-picker{position:relative;}
.attach-menu{position:absolute;left:0;bottom:36px;width:280px;max-height:260px;overflow:auto;background:#fff;border:1px solid var(--border);border-radius:6px;padding:8px;box-shadow:0 10px 22px rgba(0,0,0,.10);z-index:30;}
.attach-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}
.attach-title{font-size:11px;color:#878277;text-transform:uppercase;letter-spacing:.08em;font-weight:700;}
.attach-mini-btn{border:none;background:none;color:#666;font-size:11px;font-weight:600;cursor:pointer;padding:2px 4px;border-radius:6px;}
.attach-mini-btn:hover{background:#f3f3f3;}
.attach-list{display:flex;flex-direction:column;gap:4px;}
.attach-item{display:flex;align-items:center;gap:8px;padding:6px 6px;border-radius:8px;cursor:pointer;}
.attach-item:hover{background:#f6f6f6;}
.attach-item input{accent-color:#111;}
.attach-name{font-size:12px;color:#222;line-height:1.3;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.attach-empty{font-size:12px;color:#888;padding:8px;}
.model-chip{height:32px;border-radius:4px;border:1px solid var(--border);background:#fff;color:#2a2a2a;display:flex;align-items:center;gap:6px;padding:0 10px;font-size:11px;font-weight:700;}
.model-picker{position:relative;}
.model-chip{cursor:pointer;}
.model-menu{position:absolute;left:0;bottom:36px;min-width:190px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:4px;box-shadow:0 10px 22px rgba(0,0,0,.10);z-index:25;}
.model-option{width:100%;text-align:left;background:none;border:none;border-radius:8px;padding:7px 8px;font-size:12px;color:#333;cursor:pointer;font-family:inherit;}
.model-option:hover{background:#f4f4f4;}
.model-option.active{background:#111;color:#fff;}
.library-view{flex:1;overflow:auto;padding:24px;background:var(--surface);}
.library-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;}
.library-title{font-size:22px;font-weight:800;color:#111;letter-spacing:-.02em;}
.library-actions{display:flex;gap:8px;}
.lib-btn{height:36px;border-radius:12px;border:1px solid var(--border);background:#fff;color:#111;padding:0 12px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer;font-family:inherit;}
.lib-btn.dark{background:#111;color:#fff;border-color:#111;}
.library-db{background:#fff;border:1px solid var(--border);border-radius:20px;overflow:hidden;box-shadow:none;}
.db-head,.db-row{display:grid;grid-template-columns:minmax(280px,1.7fr) 90px 90px 120px 140px;align-items:center;}
.db-head{height:40px;background:#fff;border-bottom:1px solid var(--border);}
.db-h{font-size:11px;color:#8c877d;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:0 12px;}
.db-row{min-height:46px;border-bottom:1px solid #f2f2f2;}
.db-row:last-child{border-bottom:none;}
.db-row.folder{background:#fff;cursor:pointer;}
.db-row.folder.selected{background:#fff;}
.db-cell{padding:8px 12px;font-size:12px;color:#3d3d3d;display:flex;align-items:center;gap:8px;min-width:0;}
.db-title{font-size:13px;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;}
.db-meta{font-size:11px;color:#8a857a;font-weight:700;}
.db-toggle{width:20px;height:20px;border:none;background:none;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#666;cursor:pointer;}
.db-toggle:hover{background:#f0f0f0;}
.db-dot{width:7px;height:7px;border-radius:999px;background:#9a9a9a;}
.db-chip{font-size:11px;padding:4px 9px;border-radius:999px;background:#fff;color:#4a463f;font-weight:700;}
.db-actions{display:flex;justify-content:flex-end;gap:6px;width:100%;}
.lib-icon-btn{width:30px;height:30px;border-radius:10px;border:1px solid var(--border);background:#fff;color:#333;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.db-folder-files{background:#fff;border-bottom:1px solid #f2f2f2;}
.db-file-row{display:grid;grid-template-columns:minmax(280px,1.7fr) 90px 90px 120px 140px;min-height:38px;align-items:center;border-top:1px solid #f2f2f2;}
.db-file-row:first-child{border-top:none;}
.db-file-row.empty .db-cell{color:#8f8f8f;font-style:italic;}
.db-file-name{font-size:12px;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.db-file-indent{padding-left:36px;}
.db-open{height:28px;border-radius:9px;border:1px solid var(--border);background:#fff;padding:0 10px;font-size:11px;font-weight:700;cursor:pointer;}
.db-open:hover{background:#f7f7f7;}
@media (max-width:900px){
  .db-head,.db-row,.db-file-row{grid-template-columns:minmax(220px,1.4fr) 72px 72px 92px 120px;}
}
@media (max-width:1200px){
  .chat-panel{width:400px;min-width:340px;}
  .vt-search-input{width:120px;}
  .vt-search-meta{min-width:32px;}
}
@media (max-width:1100px){
  .chat-panel{width:360px;min-width:320px;}
}
@media (max-width:860px){
  .chat-resize-handle{display:none;}
  .chat-panel{display:none;}
  .topbar{padding:0 14px;}
  .topbar-subtitle{display:none;}
  .viewer-paper-title{font-size:22px;}
}
.welcome-upload{margin-top:14px;height:34px;border-radius:9px;border:1px solid #ddd;background:#fff;color:#111;padding:0 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;}
.welcome-upload:hover{background:#f7f7f7;}
.ov{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center;}
.modal{background:white;border-radius:12px;padding:24px;width:460px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.2);} 
.m-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;} 
.m-title{font-size:16px;font-weight:700;} 
.m-x{background:none;border:none;color:var(--text3);cursor:pointer;padding:4px;border-radius:5px;} 
.dz{border:2px dashed var(--border2);border-radius:8px;padding:36px 24px;text-align:center;cursor:pointer;background:#fafafa;} 
.dz.drag{border-color:#111;background:#f0f0f0;} 
.dz h3{font-size:14px;font-weight:600;margin-bottom:4px;} 
.dz p{font-size:12px;color:var(--text3);} 
.fs{margin-top:14px;} .fs label{font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:5px;} 
.fs select{width:100%;background:white;border:1px solid var(--border2);border-radius:7px;padding:7px 10px;font-size:13px;font-family:inherit;outline:none;} 
.m-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;} 
.btn-sec{background:#f2f2f2;border:1px solid var(--border);color:#333;padding:7px 14px;border-radius:7px;font-size:13px;cursor:pointer;font-family:inherit;} 
.btn-pri{background:#111;border:none;color:white;padding:7px 16px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
.settings-field{margin-bottom:16px;}
.settings-label{display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:6px;}
.settings-input-wrap{display:flex;align-items:center;gap:6px;}
.settings-input{flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit;background:#fafafa;color:var(--text);}
.settings-input:focus{outline:none;border-color:#2563eb;background:#fff;}
.settings-toggle-vis{background:none;border:1px solid var(--border);border-radius:5px;padding:5px 8px;cursor:pointer;font-size:11px;color:#666;font-family:inherit;}
.settings-toggle-vis:hover{background:#f5f5f5;}
.settings-info{font-size:11px;color:#888;line-height:1.55;margin-top:6px;}
.settings-select{width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit;background:#fafafa;color:var(--text);cursor:pointer;}
.settings-select:focus{outline:none;border-color:#2563eb;}
.sb-settings-bar{padding:8px 12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:12px;}
.sb-settings-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.sb-settings-label{flex:1;color:#666;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-settings-gear{background:none;border:none;color:#888;cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center;}
.sb-settings-gear:hover{background:#f0f0f0;color:#333;} 
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text3);text-align:center;padding:48px;} 
`;

function TextFallback({ text }) {
  return (
    <div className="text-fallback" style={{ maxWidth: 780, margin: "0 auto" }}>
      {(text || "")
        .split("\n")
        .filter((line) => line.trim())
        .map((line, i) => (
          <p key={i} style={{ marginBottom: 10, color: "#333", lineHeight: 1.7 }}>
            {line}
          </p>
        ))}
    </div>
  );
}

function derivePageTexts(paper) {
  if (!paper) return [];
  if (Array.isArray(paper.pageTexts) && paper.pageTexts.length) return paper.pageTexts;

  const fullText = String(paper.fullText || "");
  const out = [];
  const re = /--- Page\s+(\d+)\s+---\s*([\s\S]*?)(?=(?:--- Page\s+\d+\s+---)|$)/g;
  let m;
  while ((m = re.exec(fullText))) {
    out.push({ page: Number(m[1]), text: String(m[2] || "").trim() });
  }
  return out;
}

function InlineCitedAnswer({ text, citations = [], fileName, onCitationClick }) {
  const [hoveredCitation, setHoveredCitation] = useState(null);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const hideTimerRef = useRef(null);
  const citationWrapRefs = useRef(new Map());

  const normalize = useCallback((s) =>
    (s || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim(), []);

  const segments = useMemo(() => {
    const lines = String(text || "").split("\n");
    const out = [];
    lines.forEach((line, li) => {
      if (!line.trim()) {
        out.push({ type: "br", id: `br-${li}` });
      } else {
        const parts = line.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [line];
        parts.forEach((part, pi) => {
          if (part.trim()) out.push({ type: "sentence", id: `s-${li}-${pi}`, text: part });
        });
      }
      if (li < lines.length - 1) out.push({ type: "br", id: `n-${li}` });
    });
    return out;
  }, [text]);

  const placement = useMemo(() => {
    const sentenceIdxs = [];
    const sentenceNorm = [];
    segments.forEach((seg, idx) => {
      if (seg.type === "sentence") {
        sentenceIdxs.push(idx);
        sentenceNorm.push(normalize(seg.text));
      }
    });

    const map = new Map();
    if (!sentenceIdxs.length) return map;

    const makeNgrams = (arr, n) => {
      const gs = [];
      if (arr.length < n) return gs;
      for (let i = 0; i <= arr.length - n; i++) gs.push(arr.slice(i, i + n).join(" "));
      return gs;
    };

    (citations || []).forEach((c, ci) => {
      const cNorm = normalize(c?.text || "");
      const cWords = cNorm.split(" ").filter(Boolean);
      if (!cWords.length) return;

      let bestPos = 0;
      let bestScore = -1;

      sentenceNorm.forEach((sNorm, si) => {
        const sWords = sNorm.split(" ").filter(Boolean);
        if (!sWords.length) return;

        const sSet = new Set(sWords);
        const overlap = cWords.filter((w) => sSet.has(w)).length / cWords.length;
        const tri = makeNgrams(cWords, Math.min(3, cWords.length));
        const triHit = tri.length ? tri.some((g) => sNorm.includes(g)) : false;
        const fullHit = sNorm.includes(cNorm) ? 1 : 0;
        const score = overlap + (triHit ? 0.45 : 0) + fullHit;

        if (score > bestScore) {
          bestScore = score;
          bestPos = si;
        }
      });

      const segIdx = sentenceIdxs[bestPos] ?? sentenceIdxs[sentenceIdxs.length - 1];
      const arr = map.get(segIdx) || [];
      arr.push(ci);
      map.set(segIdx, arr);
    });

    return map;
  }, [segments, citations, normalize]);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    if (hoveredCitation == null) {
      setPopoverStyle(null);
      return undefined;
    }

    const updatePopoverPosition = () => {
      const wrap = citationWrapRefs.current.get(hoveredCitation);
      const panel = wrap?.closest(".chat-panel");
      if (!wrap || !panel) {
        setPopoverStyle(null);
        return;
      }

      const wrapRect = wrap.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const maxWidth = Math.min(320, Math.max(220, panelRect.width - 28));
      const clampedLeft = Math.min(
        Math.max(panelRect.left + 10, wrapRect.left),
        panelRect.right - maxWidth - 10
      );

      setPopoverStyle({
        left: `${clampedLeft - wrapRect.left}px`,
        width: `${maxWidth}px`,
      });
    };

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    return () => window.removeEventListener("resize", updatePopoverPosition);
  }, [hoveredCitation]);

  const showPopover = (ci) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setHoveredCitation(ci);
  };

  const scheduleHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setHoveredCitation(null), 120);
  };

  const renderRich = (value, keyPrefix) => {
    const parts = String(value || "").split(/\*\*([^*]+)\*\*/g);
    return parts.map((p, j) =>
      j % 2 === 1 ? <strong key={`${keyPrefix}-b-${j}`}>{p}</strong> : <React.Fragment key={`${keyPrefix}-t-${j}`}>{p}</React.Fragment>
    );
  };

  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === "br") return <br key={seg.id} />;
        const attached = placement.get(idx) || [];
        return (
          <React.Fragment key={seg.id}>
            {renderRich(seg.text, seg.id)}
            {attached.map((ci) => {
              const c = citations[ci];
              if (!c) return null;
              return (
                <span
                  key={`cit-${seg.id}-${ci}`}
                  className="inline-cit-wrap"
                  ref={(node) => {
                    if (node) citationWrapRefs.current.set(ci, node);
                    else citationWrapRefs.current.delete(ci);
                  }}
                  onMouseEnter={() => showPopover(ci)}
                  onMouseLeave={scheduleHide}
                >
                  <button
                    className="inline-cit-anchor"
                    type="button"
                    aria-label={`Show citation ${ci + 1}`}
                    onMouseEnter={() => showPopover(ci)}
                  >
                    [{ci + 1}]
                  </button>
                  {hoveredCitation === ci && (
                    <div className="inline-cit-popover" style={popoverStyle || undefined} onMouseEnter={() => showPopover(ci)} onMouseLeave={scheduleHide}>
                      <div className="source-card" onClick={() => onCitationClick?.(c)}>
                        <div className="source-card-top">
                          <IFile size={12} style={{ color: "#999", flexShrink: 0 }} />
                          <span className="source-card-file">{c.fileName || fileName}</span>
                          <span className="source-card-page">p.{c.page}</span>
                          <span className="source-card-jump">↗ Jump</span>
                        </div>
                        {c.section && <div style={{ fontSize: 10, color: "#999", marginBottom: 4 }}>{c.section}</div>}
                        <div className="source-card-text">"{c.text}"</div>
                      </div>
                    </div>
                  )}
                </span>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}

function PaperviewApp() {
  const [folders, setFolders] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [chatThreads, setChatThreads] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState("");
  const [loadingChatId, setLoadingChatId] = useState(null);
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
  const [chatPaneMode, setChatPaneMode] = useState("chat");
  const [currentView, setCurrentView] = useState("library");
  const [selectedModel, setSelectedModel] = useState(OPENAI_MODEL);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [selectedChatPaperIds, setSelectedChatPaperIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewerSearchOpen, setViewerSearchOpen] = useState(false);
  const [viewerSearchQuery, setViewerSearchQuery] = useState("");
  const [viewerSearchStatus, setViewerSearchStatus] = useState("");
  const [viewerSearchMatches, setViewerSearchMatches] = useState([]);
  const [viewerSearchIndex, setViewerSearchIndex] = useState(-1);
  const [scale, setScale] = useState(1.4);
  const [chatWidth, setChatWidth] = useState(480);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [apiKey, setApiKey] = useState(() => getStoredApiKey() || ENV_API_KEY);
  const [privacyAccepted, setPrivacyAccepted] = useState(() => !!localStorage.getItem('pv-privacy-ok'));
  const [showFolderPermModal, setShowFolderPermModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsKey, setSettingsKey] = useState('');
  const [settingsKeyVisible, setSettingsKeyVisible] = useState(false);
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

  const endRef = useRef(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const scrollFnRef = useRef(null);
  const modelMenuRef = useRef(null);
  const attachMenuRef = useRef(null);
  const viewerSearchInputRef = useRef(null);
  const chatResizeRef = useRef({ active: false, startX: 0, startWidth: 480 });
  const sbResizeRef = useRef({ active: false, startX: 0, startWidth: 260 });
  const scanDirHandleRef = useRef(null);
  const folderHandlesMapRef = useRef(new Map()); // folderId → root FileSystemDirectoryHandle
  const foldersRef = useRef([]);
  const chatThreadsRef = useRef([]);

  useEffect(() => {
    loadAllChats().then((saved) => {
      if (saved.length) {
        setChatThreads(saved);
        setActiveChatId(saved[0]?.id || null);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { foldersRef.current = folders; }, [folders]);
  useEffect(() => { chatThreadsRef.current = chatThreads; }, [chatThreads]);

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

  const activePaper = openTabs.find((t) => t.id === activeTabId) || null;

  // Load annotations for active paper
  useEffect(() => {
    if (!activePaper?.id) { setAnnotations([]); return; }
    loadAnnotations(activePaper.id).then((anns) => setAnnotations(anns || [])).catch(() => setAnnotations([]));
  }, [activePaper?.id]);

  const activeFolder =
    folders.find((f) => f.papers.some((p) => p.id === activeTabId)) ||
    folders.find((f) => f.id === selectedFolderId) ||
    null;
  const activeFolderPapers = activeFolder?.papers || [];
  const totalPaperCount = folders.reduce((sum, folder) => sum + folder.papers.length, 0);
  const searchablePageTexts = useMemo(() => derivePageTexts(activePaper), [activePaper]);
  const canRunViewerSearch = Boolean(viewerSearchQuery.trim()) && searchablePageTexts.length > 0;
  const hasViewerSearchResults = viewerSearchMatches.length > 0;
  const activeChat = useMemo(
    () => chatThreads.find((thread) => thread.id === activeChatId) || null,
    [chatThreads, activeChatId]
  );
  const currentMessages = activeChat?.messages || [];
  const activePaperThreads = useMemo(() => {
    if (!activePaper?.id) return [];
    return chatThreads
      .filter((thread) => thread.paperId === activePaper.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [chatThreads, activePaper?.id]);
  const activePaperMessageCount = useMemo(
    () => activePaperThreads.reduce((sum, thread) => sum + thread.messages.length, 0),
    [activePaperThreads]
  );
  const savedPaperThreads = useMemo(
    () => activePaperThreads.filter((thread) => thread.id !== activeChatId),
    [activePaperThreads, activeChatId]
  );
  const lastActiveMessage = currentMessages[currentMessages.length - 1] || null;
  const isChatLoading = loadingChatId === activeChatId && lastActiveMessage?.role === "user";
  const activeChatSummary = activeChat ? `${formatChatMessageCount(currentMessages.length)} · ${formatChatTimestamp(activeChat.updatedAt)}` : "No active chat";
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, activeChatId]);

  useEffect(() => {
    if (loadingChatId !== activeChatId) return;
    if (!lastActiveMessage || lastActiveMessage.role !== "user") {
      setLoadingChatId(null);
    }
  }, [activeChatId, lastActiveMessage, loadingChatId]);

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

    if (!next.length && activePaper && availableIds.has(activePaper.id)) {
      setSelectedChatPaperIds([activePaper.id]);
      return;
    }
    if (next.length !== selectedChatPaperIds.length) {
      setSelectedChatPaperIds(next);
    }
  }, [activeFolderPapers, activePaper, selectedChatPaperIds]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!modelMenuRef.current?.contains(e.target)) {
        setModelMenuOpen(false);
      }
      if (!attachMenuRef.current?.contains(e.target)) {
        setAttachMenuOpen(false);
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

  const startNewChat = useCallback(() => {
    if (!activePaper?.id) return;
    const thread = createChatThreadRecord(activePaper.id);
    setChatThreads((prev) => [thread, ...prev]);
    saveChat(thread).catch(() => {});
    syncFolderForPaper(thread.paperId);
    setActiveChatId(thread.id);
    setChatPaneMode("chat");
    setInput("");
    setChip(null);
  }, [activePaper?.id]);

  const openChatThread = useCallback((threadId) => {
    setActiveChatId(threadId);
    setChatPaneMode("chat");
  }, []);

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
    if (loadingChatId === activeChatId) setLoadingChatId(null);
    setInput("");
    setChip(null);
  }, [activeChatId, loadingChatId]);

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
      if (loadingChatId === threadId) setLoadingChatId(null);
      if (activeChatId === threadId) {
        setInput("");
        setChip(null);
      }
    },
    [activeChatId, loadingChatId]
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
      if (loadingChatId === threadId) setLoadingChatId(null);
    },
    [activeChatId, loadingChatId]
  );

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

  const openPaper = async (paper, folderId) => {
    const ownerFolder =
      folders.find((f) => f.id === folderId) ||
      folders.find((f) => f.papers.some((p) => p.id === paper.id));
    if (ownerFolder) {
      setSelectedFolderId(ownerFolder.id);
      setFolders((prev) => prev.map((f) => (f.id === ownerFolder.id ? { ...f, expanded: true } : f)));
    }

    let readyPaper = paper;
    if (!paper.pdfBytes && paper.fileHandle) {
      try {
        const file = await paper.fileHandle.getFile();
        const ab = await file.arrayBuffer();
        const uint8 = new Uint8Array(ab);
        const { fullText, pageTexts, totalPages } = await extractPdfText(uint8, { enableOcrFallback: true });
        readyPaper = { ...paper, pdfBytes: uint8, fullText, pageTexts, pages: totalPages };
        setFolders((prev) => prev.map((f) => ({
          ...f,
          papers: f.papers.map((p) => p.id === paper.id ? readyPaper : p),
        })));
      } catch (err) {
        console.error('Failed to load PDF:', err);
        return;
      }
    }

    if (!openTabs.find((t) => t.id === readyPaper.id)) setOpenTabs((p) => [...p, readyPaper]);
    else setOpenTabs((p) => p.map((t) => t.id === readyPaper.id ? readyPaper : t));
    setActiveTabId(readyPaper.id);
    setCurrentView("reader");
    scrollFnRef.current = null;
  };

  const openFolderTabs = (folderId, options = {}) => {
    const { forceReader = true } = options;
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    setSelectedFolderId(folderId);
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, expanded: true } : f)));
    setOpenTabs(folder.papers);
    setActiveTabId((prev) => (folder.papers.some((p) => p.id === prev) ? prev : folder.papers[0]?.id || null));
    if (forceReader) setCurrentView("reader");
    scrollFnRef.current = null;
  };

  const closeTab = (e, id) => {
    e.stopPropagation();
    const remaining = openTabs.filter((t) => t.id !== id);
    setOpenTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining[remaining.length - 1]?.id || null);
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
      const total = activePaper?.pages || 1;
      const page = Math.max(1, Math.min(total, Number(requestedPage) || 1));
      setCurrentPage(page);
      if (scrollFnRef.current) scrollFnRef.current(page, searchText, occurrenceIndex);
    },
    [activePaper]
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

  const doSend = async (override) => {
    const text = override || (chip ? `[Regarding: "${chip.substring(0, 80)}..."]\n${input}` : input);
    if (!text.trim() || !activeChatId || loadingChatId) return;
    const targetChatId = activeChatId;
    const userMessage = { role: "user", content: text };
    appendMessageToChat(targetChatId, userMessage, { renameFromUser: text });
    setInput("");
    setChip(null);
    setLoadingChatId(targetChatId);

    if (!apiKey) {
      appendMessageToChat(targetChatId, {
        role: "ai",
        content: "No API key configured. Please open Settings to add your OpenAI API key.",
        citations: [],
      });
      setLoadingChatId(null);
      setShowSettings(true);
      setSettingsKey('');
      setSettingsKeyVisible(false);
      return;
    }

    try {
      const conversationHistory = currentMessages.slice(-8);
      const paperPool = (activeFolderPapers.length ? activeFolderPapers : openTabs).filter(Boolean);
      const byId = new Map(paperPool.map((p) => [p.id, p]));
      const explicitlySelected = selectedChatPaperIds.map((id) => byId.get(id)).filter(Boolean);
      const contextPapers = explicitlySelected.length ? explicitlySelected : (activePaper ? [activePaper] : []);

      const MAX_DOC_CHARS = 50000;
      const MAX_TOTAL_CHARS = 140000;
      let usedChars = 0;
      const contextBlocks = contextPapers
        .map((paper) => {
          const raw = String(paper.fullText || "");
          if (!raw) return null;
          const remaining = MAX_TOTAL_CHARS - usedChars;
          if (remaining <= 0) return null;
          const cap = Math.min(MAX_DOC_CHARS, remaining);
          const clipped = raw.length > cap ? `${raw.slice(0, cap)}\n\n...[truncated]` : raw;
          usedChars += clipped.length;
          return `=== Document: "${paper.name}" (${paper.pages} pages) ===\n${clipped}`;
        })
        .filter(Boolean);

      const ctx = contextBlocks.length
        ? `You are given one or more documents below. Each document contains "--- Page N ---" markers.\n\n${contextBlocks.join("\n\n")}`
        : "";

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 1200,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'You are a research assistant analyzing one or more academic PDFs. Text includes "--- Page N ---" markers.\n\nRespond ONLY with a raw JSON object (no markdown fences) in this exact format:\n{"answer":"your answer here with **bold** for key terms","citations":[{"file":"exact document name","page":NUMBER,"section":"section name","text":"short verbatim quote from paper"}]}\n\nRules:\n- Return 1-4 citations that directly support your answer.\n- If multiple documents are provided, choose citations from the most relevant ones.\n- "file" must exactly match a provided document name.\n- "page" MUST be the actual page number from the nearest "--- Page N ---" marker above the quote in that file.\n- "text" must be a SHORT verbatim quote (one sentence or phrase).\n- "section" should be the section name if identifiable.',
            },
            ...conversationHistory.map((message) => ({
              role: message.role === "ai" ? "assistant" : message.role,
              content: message.content,
            })),
            { role: "user", content: `${ctx}\n\nQuestion: ${text}` },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "OpenAI request failed");
      }

      const data = await res.json();
      const raw = (data.choices?.[0]?.message?.content || "").trim();
      const m = raw.match(/\{[\s\S]*\}/);
      let parsed;
      try {
        parsed = m ? JSON.parse(m[0]) : null;
        if (!parsed?.answer) throw new Error("Invalid");
      } catch {
        parsed = { answer: raw.replace(/```json|```/g, "").trim(), citations: [] };
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

      appendMessageToChat(targetChatId, { role: "ai", content: parsed.answer, citations: normalizedCitations });
    } catch {
      appendMessageToChat(targetChatId, { role: "ai", content: "Could not reach OpenAI. Please check your key/model and try again.", citations: [] });
    }
    setLoadingChatId(null);
  };

  const askAI = async () => {
    const t = popup.text;
    setPopup(null);
    window.getSelection()?.removeAllRanges();
    await doSend(`Explain this passage: "${t.substring(0, 200)}${t.length > 200 ? "..." : ""}"`);
  };

  const handleCitationClick = (citation) => {
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
      if (!openTabs.find((t) => t.id === targetPaper.id)) {
        setOpenTabs((prev) => [...prev, targetPaper]);
      }
      if (owner?.id) {
        setSelectedFolderId(owner.id);
      }
      setCurrentView("reader");
      setActiveTabId(targetPaper.id);
      scrollFnRef.current = null;
      setTimeout(() => jump(), 220);
      return;
    }
    jump();
  };

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
    setFolders((p) => [...p, { id: newId, name, expanded: true, papers: [] }]);
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
  };

  const deleteFolder = (folderId) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    const ids = new Set(folder.papers.map((p) => p.id));
    const remainingFolders = folders.filter((f) => f.id !== folderId);
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
    setAnnotations((prev) => prev.filter((a) => !ids.has(a.paperId)));
    deleteAnnotationsByPaperIds([...ids]).catch(() => {});
    if (!remainingFolders.length) clearFolderHandles().catch(() => {});
  };

  const stableId = (prefix, path) => {
    let h = 0;
    for (let i = 0; i < path.length; i++) { h = ((h << 5) - h + path.charCodeAt(i)) | 0; }
    return `${prefix}-${(h >>> 0).toString(36)}`;
  };

  const scanDirHandle = async (dirHandle) => {
    async function scanDir(handle, parentPath) {
      const folderPath = `${parentPath}/${handle.name}`;
      const folder = { id: stableId('f', folderPath), name: handle.name, expanded: true, papers: [], children: [] };
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
          folder.papers.push({
            id: stableId('p', `${folderPath}/${entry.name}`),
            name: entry.name.replace(/\.pdf$/i, ''),
            authors: '',
            year: '',
            pages: 0,
            pdfBytes: null,
            fullText: '',
            pageTexts: [],
            fileHandle: entry,
          });
        } else if (entry.kind === 'directory') {
          const child = await scanDir(entry, folderPath);
          if (child.papers.length || child.children.length) folder.children.push(child);
        }
      }
      return folder;
    }
    const root = await scanDir(dirHandle, '');
    const flatFolders = [];
    function flatten(node, depth) {
      flatFolders.push({ id: node.id, name: node.name, expanded: node.expanded, papers: node.papers, depth });
      node.children.forEach(c => flatten(c, depth + 1));
    }
    flatten(root, 0);
    return flatFolders;
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
  const writeFolderSnapshot = async (dirHandle) => {
    if (!dirHandle) return;
    try {
      // Find all folder IDs that map to this dirHandle
      const folderIds = new Set();
      for (const [fId, dh] of folderHandlesMapRef.current.entries()) {
        if (dh === dirHandle) folderIds.add(fId);
      }
      // Collect all paper IDs in those folders
      const paperIds = new Set();
      for (const folder of foldersRef.current) {
        if (folderIds.has(folder.id)) {
          for (const paper of folder.papers) paperIds.add(paper.id);
        }
      }
      if (!paperIds.size) return;
      // Read fresh data from IndexedDB to avoid stale closures
      const allChats = await loadAllChats();
      const chats = allChats.filter((t) => paperIds.has(t.paperId));
      const allAnns = await loadAllAnnotations();
      const annotations = allAnns.filter((a) => paperIds.has(a.paperId));
      const fileHandle = await dirHandle.getFileHandle('.paperview.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), chats, annotations }, null, 2));
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
    if (snapshot.annotations?.length) {
      // Save to IndexedDB; they'll be loaded per-paper when the paper is opened
      for (const ann of snapshot.annotations) await saveAnnotation(ann).catch(() => {});
    }
  };

  // Trigger a folder snapshot write for the folder that owns a given paper
  const syncFolderForPaper = (paperId) => {
    if (!paperId) return;
    for (const folder of foldersRef.current) {
      if (folder.papers.some((p) => p.id === paperId)) {
        const dh = folderHandlesMapRef.current.get(folder.id);
        if (dh) writeFolderSnapshot(dh).catch(() => {});
        return;
      }
    }
  };

  const handleOpenFolder = async () => {
    if (typeof window.showDirectoryPicker !== 'function') return;
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const flatFolders = await scanDirHandle(dirHandle);
      for (const f of flatFolders) folderHandlesMapRef.current.set(f.id, dirHandle);
      const snapshot = await readFolderSnapshot(dirHandle);
      if (snapshot) await applyFolderSnapshot(snapshot);
      setFolders(flatFolders);
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
    setUpStatusText("Preparing PDF parsing...");
    try {
      const ab = await pendingFile.arrayBuffer();
      const uint8 = new Uint8Array(ab);
      const { fullText, pageTexts, totalPages } = await extractPdfText(uint8, {
        enableOcrFallback: true,
        onProgress: (page, total) => {
          setUpStatusText(`Parsing page ${page}/${total}...`);
        },
      });
      const paper = {
        id: `p${Date.now()}`,
        name: pendingFile.name.replace(/\.pdf$/i, ""),
        authors: "Uploaded",
        year: new Date().getFullYear(),
        pages: totalPages,
        size: `${(pendingFile.size / 1024 / 1024).toFixed(1)} MB`,
        pdfBytes: uint8,
        fullText,
        pageTexts,
      };

      const noFolder = !upFolder || !folders.some((f) => f.id === upFolder);
      if (noFolder) {
        // No folder open yet — create an in-memory "Uploads" folder
        const uploadsId = 'f-uploads';
        const existing = folders.find((f) => f.id === uploadsId);
        if (existing) {
          setFolders((p) => p.map((f) => (f.id === uploadsId ? { ...f, papers: [...f.papers, paper], expanded: true } : f)));
          setUpFolder(uploadsId);
        } else {
          const uploadsFolder = { id: uploadsId, name: 'Uploads', expanded: true, papers: [paper], depth: 0 };
          setFolders([uploadsFolder]);
          setSelectedFolderId(uploadsId);
          setUpFolder(uploadsId);
        }
        // Open the paper directly without relying on stale folders state
        setOpenTabs((prev) => (prev.find((t) => t.id === paper.id) ? prev : [...prev, paper]));
        setActiveTabId(paper.id);
        setCurrentView('reader');
        scrollFnRef.current = null;
        setUpStatus("done");
        setTimeout(() => closeModal(), 600);
      } else {
        setFolders((p) => p.map((f) => (f.id === upFolder ? { ...f, papers: [...f.papers, paper], expanded: true } : f)));
        setUpStatus("done");
        setTimeout(() => {
          closeModal();
          openPaper(paper, upFolder);
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
                    onClick={() => openFolderTabs(folder.id)}
                    title="Open all files from this folder in tabs"
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
              <span className="sb-settings-dot" style={{ background: apiKey ? '#22c55e' : '#ef4444' }} />
              <span className="sb-settings-label">{apiKey ? `API key ••••${apiKey.slice(-4)}` : 'No API key'}</span>
              <button className="sb-settings-gear" onClick={() => { setSettingsKey(apiKey); setSettingsKeyVisible(false); setShowSettings(true); }} title="Settings"><IGear size={14} /></button>
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
                <span className="topbar-folder-name">{currentView === "library" ? "Library" : activeFolder?.name || "Reader"}</span>
                <span className="topbar-subtitle">
                  {currentView === "library"
                    ? `${totalPaperCount} paper${totalPaperCount === 1 ? "" : "s"} across ${folders.length} folders`
                    : activePaper?.pdfBytes
                      ? "Search, annotate, and verify with source-backed answers"
                      : "Reading from extracted text with chat grounded in the document"}
                </span>
              </div>
            </div>

            <div className="topbar-right">
              {openTabs.length > 0 && <span className="topbar-count">{openTabs.length} file{openTabs.length > 1 ? "s" : ""} open</span>}
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
                  onClick={() => { setActiveTabId(tab.id); scrollFnRef.current = null; }}
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
                        title="Set folder context and open all its files in reader tabs"
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
                        <span className="vt-page-total">{currentPage} of {activePaper.pages}</span>
                        <button className="vt-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= (activePaper.pages || 1)}><IRight /></button>
                      </div>
                    </div>

                    <div className={`pdf-scroll ${debugCitations ? "debug-text-layer" : ""}`}>
                      {activePaper.pdfBytes ? (
                        <PdfViewer
                          pdfBytes={activePaper.pdfBytes}
                          scale={scale}
                          onReady={handlePdfReady}
                          onPageChange={setCurrentPage}
                          debugCitations={debugCitations}
                          annotations={annotations}
                          onAnnotationClick={handleAnnotationClick}
                        />
                      ) : (
                        <TextFallback text={activePaper.fullText} />
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
                                    <button className="chat-overview-row-main" onClick={() => openChatThread(thread.id)}>
                                      <div className="chat-overview-row-top">
                                        <span className="chat-overview-row-title">{thread.title}</span>
                                      </div>
                                      <div className="chat-overview-row-meta">{formatChatMessageCount(thread.messages.length)} · {formatChatTimestamp(thread.updatedAt)}</div>
                                      <div className="chat-overview-row-summary">
                                        {thread.messages.length
                                          ? "Resume this line of questioning exactly where you left it."
                                          : "An empty thread ready for a new question."}
                                      </div>
                                    </button>
                                    <div className="chat-overview-row-actions">
                                      <button className="chat-thread-row-btn" onClick={() => openChatThread(thread.id)}>Open</button>
                                      <button className="chat-thread-row-btn" onClick={() => resetChatThreadById(thread.id)} disabled={!thread.messages.length}>Reset</button>
                                      <button className="chat-thread-delete" onClick={() => deleteChatThread(thread.id)} title="Delete chat"><ITrash size={14}/></button>
                                    </div>
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
                                  <div className="msg-u"><div className="msg-u-bubble">{m.content}</div></div>
                                ) : (
                                  <div className="msg-a">
                                    <div className="msg-a-row">
                                      <div className="msg-a-avatar">A</div>
                                      <div className="msg-a-bubble">
                                        <InlineCitedAnswer
                                          text={m.content}
                                          citations={m.citations || []}
                                          fileName={activePaper.name}
                                          onCitationClick={handleCitationClick}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}

                          {isChatLoading && (
                            <div className="chat-thinking">
                              <div className="typing"><span /><span /><span /></div>
                              <span style={{ fontSize: 13, color: "#888", marginLeft: 4 }}>Analysing…</span>
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
                                <div className="attach-picker" ref={attachMenuRef}>
                                  <button
                                    className="icon-btn"
                                    title="Choose PDFs for chat context"
                                    type="button"
                                    onClick={() => setAttachMenuOpen((v) => !v)}
                                  >
                                    <IPaperclip size={14} />
                                  </button>
                                  {attachMenuOpen && (
                                    <div className="attach-menu">
                                      <div className="attach-head">
                                        <span className="attach-title">Chat context PDFs</span>
                                        <div style={{ display: "flex", gap: 4 }}>
                                          <button
                                            className="attach-mini-btn"
                                            type="button"
                                            onClick={() => setSelectedChatPaperIds(activeFolderPapers.map((p) => p.id))}
                                          >
                                            All
                                          </button>
                                          <button
                                            className="attach-mini-btn"
                                            type="button"
                                            onClick={() => setSelectedChatPaperIds(activePaper?.id ? [activePaper.id] : [])}
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
                                            const checked = selectedChatPaperIds.includes(paper.id);
                                            return (
                                              <label key={paper.id} className="attach-item">
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={() => {
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

                              <button className="icon-btn send-btn" onClick={() => doSend()} disabled={(!input.trim() && !chip) || Boolean(loadingChatId)} title="Send">
                                <IArrowUp size={14} />
                              </button>
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
          <div className="ov" onClick={() => setShowSettings(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="m-hd">
                <span className="m-title">Settings</span>
                <button className="m-x" onClick={() => setShowSettings(false)}><IClose /></button>
              </div>

              <div className="settings-field">
                <label className="settings-label">OpenAI API Key</label>
                {apiKey ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="settings-input" style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', cursor: 'default', color: 'var(--text2)' }}>
                      {'•'.repeat(Math.min(apiKey.length, 20))}{'…' + apiKey.slice(-4)}
                    </span>
                    <button className="btn-sec" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => {
                      setApiKey('');
                      setStoredApiKey('');
                    }}>Remove</button>
                  </div>
                ) : (
                  <div className="settings-input-wrap">
                    <input
                      className="settings-input"
                      type="password"
                      value={settingsKey}
                      onChange={(e) => setSettingsKey(e.target.value)}
                      placeholder="sk-..."
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                )}
                <p className="settings-info">Your key is stored only in this browser and sent directly to OpenAI over HTTPS. We recommend setting a <a href="https://platform.openai.com/settings/organization/limits" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>spending limit</a> on your key.</p>
              </div>

              <div className="m-acts">
                <button className="btn-sec" onClick={() => setShowSettings(false)}>Cancel</button>
                {!apiKey && <button className="btn-pri" onClick={() => {
                  const trimmed = settingsKey.trim();
                  if (trimmed) {
                    setApiKey(trimmed);
                    setStoredApiKey(trimmed);
                  }
                  setShowSettings(false);
                }}>Save</button>}
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
                  { green:true,  text:'Your API key is stored in your browser\'s localStorage only.' },
                  { green:false, text:'PDF text is sent to OpenAI when you send a message.' },
                  { green:false, text:'Your API key is included in requests to OpenAI (encrypted via HTTPS).' },
                ].map((item, i) => (
                  <div key={i} style={{ display:'flex',gap:10,alignItems:'flex-start' }}>
                    <div style={{ width:8,height:8,borderRadius:'50%',background:item.green?'#16a34a':'#dc2626',marginTop:5,flexShrink:0 }} />
                    <span style={{ fontSize:13,color:'#4e4b45',lineHeight:1.5,fontWeight:500 }}>{item.text}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12,color:'#8a867c',marginBottom:24,lineHeight:1.5,fontWeight:500 }}>
                Green = stays on your device. Red = sent to OpenAI over HTTPS. We never see any of it.
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<PaperviewApp />} />
      <Route path="/app/*" element={<PaperviewApp />} />
    </Routes>
  );
}
