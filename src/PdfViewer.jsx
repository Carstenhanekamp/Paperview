import React, { useState, useRef, useEffect } from 'react';
import { loadPdfJs, getOcrPageData } from './pdfUtils';

export default function PdfViewer({
  pdfBytes,
  paperId,
  fileSize = null,
  fileLastModified = null,
  scale = 1.4,
  onReady,
  onPageChange,
  onDocumentLoad,
  debugCitations = false,
  annotations = [],
  onAnnotationClick,
}) {
  const containerRef = useRef(null);
  const pdfRef = useRef(null);
  const wrappersRef = useRef([]);
  const [pdfReady, setPdfReady] = useState(0);
  const tasksRef = useRef([]);
  const observerRef = useRef(null);
  const ocrDoneRef = useRef(new Set());
  const ocrInFlightRef = useRef(new Set());
  const onReadyRef = useRef(onReady);
  const onPageChangeRef = useRef(onPageChange);
  const onDocumentLoadRef = useRef(onDocumentLoad);
  const annotationsRef = useRef(annotations);
  const onAnnotationClickRef = useRef(onAnnotationClick);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  useEffect(() => {
    onDocumentLoadRef.current = onDocumentLoad;
  }, [onDocumentLoad]);

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
      const ocrData = await getOcrPageData(page, {
        paperId,
        pageNum,
        scale: ocrScale,
        fileSize,
        fileLastModified,
      });
      const data = ocrData?.segments || [];
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
      const pdf = await lib.getDocument({ data: pdfBytes.slice(0), stopAtErrors: false }).promise;
      if (cancelled) return;
      pdfRef.current = pdf;
      if (onDocumentLoadRef.current) onDocumentLoadRef.current({ totalPages: pdf.numPages });
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
                .replace(/[""]/g, '"')
                .replace(/['']/g, "'")
                .replace(/[^\p{L}\p{N}\s]/gu, " ")
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();

            const q = normalizeText(String(searchText).replace(/^\s*["'""'']+|["'""'']+\s*$/g, ""));
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
  }, [fileLastModified, fileSize, paperId, pdfBytes, scale]);

  // Apply annotation highlights whenever annotations change (without full re-render)
  useEffect(() => {
    const wrappers = wrappersRef.current;
    if (!wrappers.length) return;

    // Clear existing annotation highlights — restore original span text
    wrappers.forEach((w) => {
      if (!w) return;
      w.querySelectorAll('[data-ann-split]').forEach((span) => {
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
          if (so.end <= startOffset || so.start >= endOffset) continue;

          const relStart = Math.max(0, startOffset - so.start);
          const relEnd = Math.min(so.text.length, endOffset - so.start);

          if (relStart === 0 && relEnd === so.text.length) {
            so.span.classList.add('ann-hl');
            so.span.dataset.annId = id;
            so.span.style.backgroundColor = color;
          } else {
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
