import React, { useEffect, useRef, useState } from 'react';
import { loadPdfJs, getOcrPageData } from './pdfUtils';
import { computeVisiblePageWindow, mergeWindowWithTarget } from './pdfViewerUtils';

const PAGE_GAP = 12;
const OVERSCAN_PAGES = 2;

function waitForLayout() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function normalizeMatchText(value) {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function clearAnnotationHighlights(wrap) {
  if (!wrap) return;
  wrap.querySelectorAll('[data-ann-split]').forEach((span) => {
    span.textContent = span.dataset.annOrigText || span.textContent;
    span.removeAttribute('data-ann-split');
    span.removeAttribute('data-ann-orig-text');
  });
  wrap.querySelectorAll('.ann-hl').forEach((node) => {
    node.classList.remove('ann-hl');
    delete node.dataset.annId;
    node.style.removeProperty('background-color');
  });
}

function applyAnnotationHighlights(wrap, pageAnnotations) {
  clearAnnotationHighlights(wrap);
  if (!wrap || !pageAnnotations.length) return;

  const textLayer = wrap.querySelector('.textLayer');
  if (!textLayer) return;
  const spans = Array.from(textLayer.querySelectorAll(':scope > span'));
  if (!spans.length) return;

  const spanOffsets = [];
  let charPos = 0;
  spans.forEach((span) => {
    const text = span.textContent || '';
    spanOffsets.push({ span, start: charPos, end: charPos + text.length, text });
    charPos += text.length;
  });

  [...pageAnnotations]
    .sort((a, b) => a.startOffset - b.startOffset)
    .forEach((ann) => {
      const color = ann.color || 'rgba(255,213,79,.4)';
      spanOffsets.forEach((so) => {
        if (so.end <= ann.startOffset || so.start >= ann.endOffset) return;
        const relStart = Math.max(0, ann.startOffset - so.start);
        const relEnd = Math.min(so.text.length, ann.endOffset - so.start);

        if (relStart === 0 && relEnd === so.text.length) {
          so.span.classList.add('ann-hl');
          so.span.dataset.annId = ann.id;
          so.span.style.backgroundColor = color;
          return;
        }

        const before = so.text.substring(0, relStart);
        const highlighted = so.text.substring(relStart, relEnd);
        const after = so.text.substring(relEnd);
        so.span.dataset.annSplit = '1';
        so.span.dataset.annOrigText = so.text;
        so.span.textContent = '';
        if (before) so.span.appendChild(document.createTextNode(before));

        const hSpan = document.createElement('span');
        hSpan.textContent = highlighted;
        hSpan.classList.add('ann-hl');
        hSpan.dataset.annId = ann.id;
        hSpan.style.backgroundColor = color;
        so.span.appendChild(hSpan);

        if (after) so.span.appendChild(document.createTextNode(after));
      });
    });
}

async function buildOcrOverlay({ page, wrap, width, height, pageNum, scale, paperId, fileSize, fileLastModified }) {
  const existingTl = wrap.querySelector('.textLayer');
  if (existingTl) {
    const textContent = Array.from(existingTl.querySelectorAll('span')).map((node) => node.textContent).join('').trim();
    if (textContent.length > 20) {
      existingTl.style.pointerEvents = 'auto';
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
  if (!data.length) return;

  const ocrViewport = page.getViewport({ scale: ocrScale });
  const xScale = ocrViewport.width ? width / ocrViewport.width : 1;
  const yScale = ocrViewport.height ? height / ocrViewport.height : 1;
  wrap.querySelector('.ocrLayer')?.remove();

  const layer = document.createElement('div');
  layer.className = 'ocrLayer';
  layer.style.cssText = `position:absolute;top:0;left:0;width:${width}px;height:${height}px;overflow:hidden;line-height:1;pointer-events:auto;`;

  data.forEach((seg) => {
    if (!seg?.bbox || !seg.words?.length) return;
    const lineDiv = document.createElement('div');
    const lineWidth = Math.max(1, (seg.bbox.x1 - seg.bbox.x0) * xScale);
    const lineHeight = Math.max(1, (seg.bbox.y1 - seg.bbox.y0) * yScale);
    lineDiv.className = 'ocr-line';
    lineDiv.style.cssText = `position:absolute;left:${seg.bbox.x0 * xScale}px;top:${seg.bbox.y0 * yScale}px;width:${lineWidth}px;height:${lineHeight}px;line-height:1;pointer-events:none;user-select:none;`;

    seg.words.forEach((word, index) => {
      const span = document.createElement('span');
      const nextWord = seg.words[index + 1];
      const wordHeight = Math.max(1, (word.bbox.y1 - word.bbox.y0) * yScale);
      const wordAdvance = nextWord
        ? Math.max(word.bbox.x1 - word.bbox.x0, nextWord.bbox.x0 - word.bbox.x0)
        : (word.bbox.x1 - word.bbox.x0);
      span.className = 'ocr-word';
      span.dataset.targetW = String(Math.max(1, wordAdvance * xScale));
      span.style.cssText = `position:absolute;left:${Math.max(0, (word.bbox.x0 - seg.bbox.x0) * xScale)}px;top:${Math.max(0, (word.bbox.y0 - seg.bbox.y0) * yScale)}px;height:${wordHeight}px;font-size:${wordHeight}px;white-space:pre;transform-origin:0 0;`;
      span.textContent = index < seg.words.length - 1 ? `${word.text} ` : word.text;
      lineDiv.appendChild(span);
    });

    layer.appendChild(lineDiv);
  });

  if (existingTl) existingTl.style.pointerEvents = 'none';
  wrap.appendChild(layer);

  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      layer.querySelectorAll('.ocr-word').forEach((span) => {
        const targetW = parseFloat(span.dataset.targetW);
        const naturalW = span.scrollWidth;
        if (targetW > 0 && naturalW > 0) {
          const scaleX = targetW / naturalW;
          if (Math.abs(scaleX - 1) > 0.01) {
            span.style.transform = `scaleX(${scaleX.toFixed(4)})`;
          }
        }
      });
      resolve();
    });
  });
}

function matchContiguousTokens(elements, queryWords, getTextFn, options = {}) {
  const { returnAllExact = false, allowFuzzy = true } = options;
  if (!elements?.length || !queryWords.length) return null;

  const tokens = [];
  const tokenToEl = [];
  elements.forEach((node, index) => {
    normalizeMatchText(getTextFn(node))
      .split(' ')
      .filter(Boolean)
      .forEach((word) => {
        tokens.push(word);
        tokenToEl.push(index);
      });
  });

  if (!tokens.length) return null;
  const exactMatches = [];
  if (tokens.length >= queryWords.length) {
    for (let start = 0; start <= tokens.length - queryWords.length; start += 1) {
      let ok = true;
      for (let index = 0; index < queryWords.length; index += 1) {
        if (tokens[start + index] !== queryWords[index]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      exactMatches.push({
        elements: elements.slice(tokenToEl[start], tokenToEl[start + queryWords.length - 1] + 1),
        score: 1,
      });
    }
  }

  if (returnAllExact) return exactMatches;
  if (exactMatches.length) return exactMatches[0];
  if (!allowFuzzy) return null;
  const makeNgrams = (arr, n) => {
    if (arr.length < n) return [];
    const out = [];
    for (let index = 0; index <= arr.length - n; index += 1) {
      out.push(arr.slice(index, index + n).join(' '));
    }
    return out;
  };

  const queryBigrams = makeNgrams(queryWords, 2);
  const queryTrigrams = makeNgrams(queryWords, 3);
  const minWindow = Math.max(3, queryWords.length - 4);
  const maxWindow = Math.min(tokens.length, queryWords.length + 6);
  let best = null;

  for (let start = 0; start < tokens.length; start += 1) {
    for (let winLen = minWindow; winLen <= maxWindow; winLen += 1) {
      if (start + winLen > tokens.length) break;
      const candidate = tokens.slice(start, start + winLen);
      const candidateBigrams = new Set(makeNgrams(candidate, 2));
      const candidateTrigrams = new Set(makeNgrams(candidate, 3));
      const candidateSet = new Set(candidate);
      const biOverlap = queryBigrams.length ? queryBigrams.filter((gram) => candidateBigrams.has(gram)).length / queryBigrams.length : 0;
      const triOverlap = queryTrigrams.length ? queryTrigrams.filter((gram) => candidateTrigrams.has(gram)).length / queryTrigrams.length : 0;
      const tokenOverlap = queryWords.filter((word) => candidateSet.has(word)).length / queryWords.length;
      const lenPenalty = Math.abs(winLen - queryWords.length) * 0.02;
      const score = biOverlap * 0.6 + triOverlap * 0.25 + tokenOverlap * 0.15 - lenPenalty;
      const overlapCount = queryWords.filter((word) => candidateSet.has(word)).length;
      if (overlapCount < Math.max(2, Math.ceil(queryWords.length * 0.6))) continue;
      if (!best || score > best.score) {
        best = {
          elements: elements.slice(tokenToEl[start], tokenToEl[start + winLen - 1] + 1),
          score,
        };
      }
    }
  }

  return best && best.score >= 0.58 ? best : null;
}

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
  const pdfLibRef = useRef(null);
  const wrappersRef = useRef([]);
  const pageMetricsRef = useRef([]);
  const pageStatesRef = useRef({});
  const mountedWindowRef = useRef({ startPage: 1, endPage: 0 });
  const ocrDoneRef = useRef(new Set());
  const ocrInFlightRef = useRef(new Set());
  const onReadyRef = useRef(onReady);
  const onPageChangeRef = useRef(onPageChange);
  const onDocumentLoadRef = useRef(onDocumentLoad);
  const annotationsRef = useRef(annotations);
  const onAnnotationClickRef = useRef(onAnnotationClick);
  const [pdfReady, setPdfReady] = useState(0);

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

    let cleanupScroll = () => {};
    let cleanupResize = () => {};
    el.innerHTML = '';
    wrappersRef.current = [];
    pageMetricsRef.current = [];
    pageStatesRef.current = {};
    mountedWindowRef.current = { startPage: 1, endPage: 0 };
    ocrDoneRef.current = new Set();
    ocrInFlightRef.current = new Set();
    setPdfReady(0);

    const getScrollContainer = () => el.closest('.pdf-scroll');
    const getPageState = (pageNum) => {
      if (!pageStatesRef.current[pageNum]) {
        pageStatesRef.current[pageNum] = { ensurePromise: null, renderTask: null, canvas: null, textLayer: null, mounted: false };
      }
      return pageStatesRef.current[pageNum];
    };

    const clearMountedPage = (pageNum) => {
      const state = getPageState(pageNum);
      state.renderTask?.cancel?.();
      state.renderTask = null;
      state.ensurePromise = null;
      state.mounted = false;
      if (state.canvas) {
        state.canvas.width = 0;
        state.canvas.height = 0;
        state.canvas.remove();
        state.canvas = null;
      }
      if (state.textLayer) {
        state.textLayer.remove();
        state.textLayer = null;
      }
      const wrap = wrappersRef.current[pageNum - 1];
      wrap?.querySelector('.ocrLayer')?.remove();
      wrap?.querySelector('.cit-svg')?.remove();
      clearAnnotationHighlights(wrap);
    };

    const renderTextLayer = async (textContent, container, viewport) => {
      try {
        const task = pdfLibRef.current.renderTextLayer({ textContentSource: textContent, container, viewport });
        if (task?.promise) await task.promise;
      } catch {
        try {
          const task = pdfLibRef.current.renderTextLayer({ textContent, container, viewport, textDivs: [] });
          if (task?.promise) await task.promise;
        } catch {
          // ignore text-layer failures
        }
      }
    };

    const ensurePageMounted = async (pageNum) => {
      const state = getPageState(pageNum);
      if (state.ensurePromise) return state.ensurePromise;
      state.ensurePromise = (async () => {
        const wrap = wrappersRef.current[pageNum - 1];
        const metric = pageMetricsRef.current[pageNum - 1];
        if (!wrap || !metric || !pdfRef.current || cancelled) return null;

        if (!state.canvas) {
          wrap.querySelector('.page-placeholder')?.remove();
          state.canvas = document.createElement('canvas');
          state.canvas.style.cssText = `display:block;width:${metric.width}px;height:${metric.height}px;border-radius:8px;`;
          wrap.appendChild(state.canvas);
        }
        if (!state.textLayer) {
          state.textLayer = document.createElement('div');
          state.textLayer.className = 'textLayer';
          state.textLayer.style.cssText = `position:absolute;top:0;left:0;width:${metric.width}px;height:${metric.height}px;overflow:hidden;line-height:1;user-select:text;`;
          wrap.appendChild(state.textLayer);
        }

        state.mounted = true;
        const page = await pdfRef.current.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        state.canvas.width = Math.ceil(viewport.width * dpr);
        state.canvas.height = Math.ceil(viewport.height * dpr);
        state.canvas.style.width = `${viewport.width}px`;
        state.canvas.style.height = `${viewport.height}px`;
        state.textLayer.style.width = `${viewport.width}px`;
        state.textLayer.style.height = `${viewport.height}px`;
        state.textLayer.style.setProperty('--scale-factor', String(viewport.scale));
        wrap.style.width = `${viewport.width}px`;
        wrap.style.height = `${viewport.height}px`;
        wrap.style.setProperty('--scale-factor', String(viewport.scale));
        state.textLayer.innerHTML = '';

        const ctx = state.canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        const renderTask = page.render({ canvasContext: ctx, viewport });
        state.renderTask = renderTask;

        try {
          await renderTask.promise;
          if (cancelled || !state.mounted) return null;
          const textContent = await page.getTextContent({ includeMarkedContent: true });
          await renderTextLayer(textContent, state.textLayer, viewport);
          applyAnnotationHighlights(wrap, annotationsRef.current.filter((ann) => ann.pageNum === pageNum));
          if (!ocrDoneRef.current.has(pageNum)) {
            ensureOcr(pageNum, page, wrap, viewport).catch(() => {});
          }
          return { wrap, viewport };
        } catch (error) {
          if (error?.name !== 'RenderingCancelledException') console.warn(error);
          return null;
        } finally {
          state.renderTask = null;
          state.ensurePromise = null;
        }
      })();

      return state.ensurePromise;
    };

    const ensureOcr = async (pageNum, page, wrap, viewport) => {
      if (ocrDoneRef.current.has(pageNum) || ocrInFlightRef.current.has(pageNum)) return;
      if (!getPageState(pageNum).mounted) return;
      ocrInFlightRef.current.add(pageNum);
      try {
        await buildOcrOverlay({
          page,
          wrap,
          width: viewport.width,
          height: viewport.height,
          pageNum,
          scale,
          paperId,
          fileSize,
          fileLastModified,
        });
        ocrDoneRef.current.add(pageNum);
      } finally {
        ocrInFlightRef.current.delete(pageNum);
      }
    };

    const updateOffsets = () => {
      pageMetricsRef.current = wrappersRef.current.map((wrap, index) => ({
        ...(pageMetricsRef.current[index] || {}),
        top: wrap?.offsetTop || 0,
      }));
    };

    const updateWindow = (options = {}) => {
      const scrollContainer = getScrollContainer();
      if (!scrollContainer || !pageMetricsRef.current.length) return;

      let nextWindow = computeVisiblePageWindow({
        pageMetrics: pageMetricsRef.current,
        scrollTop: scrollContainer.scrollTop,
        viewportHeight: scrollContainer.clientHeight,
        overscanPages: OVERSCAN_PAGES,
      });
      if (options.forcePage) {
        nextWindow = mergeWindowWithTarget(nextWindow, options.forcePage, pageMetricsRef.current.length, OVERSCAN_PAGES);
      }

      const prevWindow = mountedWindowRef.current;
      mountedWindowRef.current = nextWindow;
      for (let pageNum = nextWindow.startPage; pageNum <= nextWindow.endPage; pageNum += 1) {
        ensurePageMounted(pageNum).catch(() => {});
      }
      for (let pageNum = prevWindow.startPage; pageNum <= prevWindow.endPage; pageNum += 1) {
        if (pageNum < nextWindow.startPage || pageNum > nextWindow.endPage) {
          clearMountedPage(pageNum);
        }
      }

      const targetY = scrollContainer.scrollTop + scrollContainer.clientHeight * 0.35;
      let bestPage = 1;
      let bestDist = Number.POSITIVE_INFINITY;
      pageMetricsRef.current.forEach((metric, index) => {
        const dist = Math.abs((metric?.top || 0) - targetY);
        if (dist < bestDist) {
          bestDist = dist;
          bestPage = index + 1;
        }
      });
      onPageChangeRef.current?.(bestPage);
    };

    const jumpToCitation = async (pageNum, searchText, occurrenceIndex) => {
      const wrap = wrappersRef.current[pageNum - 1];
      const scrollContainer = getScrollContainer();
      if (!wrap || !scrollContainer) return;

      scrollContainer.scrollTo({ top: Math.max(0, wrap.offsetTop - 80), behavior: 'smooth' });
      updateWindow({ forcePage: pageNum });
      await ensurePageMounted(pageNum);
      await waitForLayout();
      wrappersRef.current.forEach((node) => node?.querySelectorAll('.cit-svg').forEach((svg) => svg.remove()));
      if (!searchText) return;

      const queryWords = normalizeMatchText(String(searchText).replace(/^\s*["'""'']+|["'""'']+\s*$/g, '')).split(' ').filter(Boolean);
      if (!queryWords.length) return;
      const indexedSearch = Number.isInteger(occurrenceIndex) && occurrenceIndex >= 0;
      const targetWrap = wrappersRef.current[pageNum - 1];
      if (!targetWrap) return;

      const collectMatches = () => {
        const out = [];
        const ocrWords = Array.from(targetWrap.querySelectorAll('.ocr-word'));
        const ocrLines = Array.from(targetWrap.querySelectorAll('.ocr-line'));
        const textSpans = Array.from(targetWrap.querySelectorAll('.textLayer span'));
        const pushMatches = (matches, layer) => {
          if (!matches) return;
          const list = Array.isArray(matches) ? matches : [matches];
          list.forEach((match) => {
            if (match?.elements?.length) out.push({ ...match, layer });
          });
        };
        pushMatches(matchContiguousTokens(ocrWords, queryWords, (node) => node.textContent, { returnAllExact: indexedSearch, allowFuzzy: !indexedSearch }), 'ocrWords');
        pushMatches(matchContiguousTokens(ocrLines, queryWords, (node) => node.textContent, { returnAllExact: indexedSearch, allowFuzzy: !indexedSearch }), 'ocrLines');
        pushMatches(matchContiguousTokens(textSpans, queryWords, (node) => node.textContent, { returnAllExact: indexedSearch, allowFuzzy: !indexedSearch }), 'textLayer');
        return out;
      };

      let matches = collectMatches();
      if (!matches.length && !ocrDoneRef.current.has(pageNum)) {
        const page = await pdfRef.current.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        await ensureOcr(pageNum, page, targetWrap, viewport);
        await waitForLayout();
        matches = collectMatches();
      }

      if (!matches.length) {
        if (debugCitations) {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', targetWrap.offsetWidth);
          svg.setAttribute('height', targetWrap.offsetHeight);
          svg.setAttribute('class', 'cit-svg');
          svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:5;';
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', '8');
          rect.setAttribute('y', '8');
          rect.setAttribute('width', String(Math.max(10, targetWrap.offsetWidth - 16)));
          rect.setAttribute('height', String(Math.max(10, targetWrap.offsetHeight - 16)));
          rect.setAttribute('rx', '8');
          rect.setAttribute('fill', 'none');
          rect.setAttribute('stroke', 'rgba(220,38,38,.8)');
          rect.setAttribute('stroke-width', '2');
          rect.setAttribute('stroke-dasharray', '6 5');
          svg.appendChild(rect);
          targetWrap.appendChild(svg);
        }
        return;
      }

      let bestMatch = null;
      if (indexedSearch) {
        const orderedLayers = ['ocrWords', 'textLayer', 'ocrLines'];
        let chosen = [];
        orderedLayers.some((layer) => {
          const hits = matches.filter((match) => match.layer === layer);
          if (hits.length) {
            chosen = hits;
            return true;
          }
          return false;
        });
        bestMatch = chosen.length ? chosen[occurrenceIndex % chosen.length] : null;
      }
      if (!bestMatch) {
        const bestOverall = matches.reduce((best, match) => (match.score > best.score ? match : best), matches[0]);
        const bestText = matches.filter((match) => match.layer === 'textLayer').sort((a, b) => b.score - a.score)[0] || null;
        bestMatch = bestText && bestOverall.layer !== 'textLayer' && bestOverall.score < bestText.score + 0.12 ? bestText : bestOverall;
      }
      if (!bestMatch?.elements?.length) return;

      const wrapRect = targetWrap.getBoundingClientRect();
      const rows = [];
      bestMatch.elements.forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const top = Math.round(rect.top - wrapRect.top);
        const row = rows.find((entry) => Math.abs(entry.top - top) < 5);
        if (row) {
          row.left = Math.min(row.left, rect.left - wrapRect.left);
          row.right = Math.max(row.right, rect.right - wrapRect.left);
          row.height = Math.max(row.height, rect.height);
        } else {
          rows.push({ top, left: rect.left - wrapRect.left, right: rect.right - wrapRect.left, height: rect.height });
        }
      });
      if (!rows.length) return;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', targetWrap.offsetWidth);
      svg.setAttribute('height', targetWrap.offsetHeight);
      svg.setAttribute('class', 'cit-svg');
      svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:5;';
      rows.forEach((row) => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', Math.max(0, row.left - 3));
        rect.setAttribute('y', Math.max(0, row.top - 1));
        rect.setAttribute('width', Math.min(targetWrap.offsetWidth, row.right - row.left + 6));
        rect.setAttribute('height', row.height + 2);
        rect.setAttribute('rx', '3');
        rect.setAttribute('fill', 'rgba(250,204,21,.4)');
        rect.setAttribute('stroke', 'rgba(202,138,4,.55)');
        rect.setAttribute('stroke-width', '1');
        svg.appendChild(rect);
      });
      targetWrap.appendChild(svg);
    };

    (async () => {
      pdfLibRef.current = await loadPdfJs();
      const pdf = await pdfLibRef.current.getDocument({ data: pdfBytes.slice(0), stopAtErrors: false }).promise;
      if (cancelled) return;
      pdfRef.current = pdf;
      onDocumentLoadRef.current?.({ totalPages: pdf.numPages });

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const wrap = document.createElement('div');
        wrap.dataset.page = String(pageNum);
        wrap.style.cssText = `position:relative;margin:0 auto ${PAGE_GAP}px;width:${viewport.width}px;height:${viewport.height}px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);border:1px solid #ececec;border-radius:8px;`;
        const placeholder = document.createElement('div');
        placeholder.className = 'page-placeholder';
        placeholder.style.cssText = 'position:absolute;inset:0;border-radius:8px;background:linear-gradient(180deg,#fff 0%,#fbfbfa 100%);';
        wrap.appendChild(placeholder);
        wrappersRef.current.push(wrap);
        pageMetricsRef.current.push({ width: viewport.width, height: viewport.height, top: 0 });
        el.appendChild(wrap);
        try { page.cleanup?.(); } catch { /* ignore */ }
      }

      await waitForLayout();
      updateOffsets();
      setPdfReady((value) => value + 1);

      const scrollContainer = getScrollContainer();
      if (!scrollContainer) return;
      let rafId = null;
      const onScroll = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => updateWindow());
      };
      const onResize = () => {
        updateOffsets();
        updateWindow();
      };
      scrollContainer.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      cleanupScroll = () => {
        scrollContainer.removeEventListener('scroll', onScroll);
        if (rafId) cancelAnimationFrame(rafId);
      };
      cleanupResize = () => window.removeEventListener('resize', onResize);

      updateWindow({ forcePage: 1 });
      onReadyRef.current?.((pageNum, searchText, occurrenceIndex) => {
        setTimeout(() => {
          jumpToCitation(pageNum, searchText, occurrenceIndex).catch((error) => console.warn('Citation highlight failed:', error));
        }, 420);
      });
    })().catch((error) => {
      if (!cancelled) console.warn(error);
    });

    return () => {
      cancelled = true;
      cleanupScroll();
      cleanupResize();
      Object.keys(pageStatesRef.current).forEach((pageNum) => clearMountedPage(Number(pageNum)));
      try { pdfRef.current?.destroy?.(); } catch { /* ignore */ }
      pdfRef.current = null;
      pdfLibRef.current = null;
      wrappersRef.current = [];
      pageMetricsRef.current = [];
      pageStatesRef.current = {};
      el.innerHTML = '';
    };
  }, [debugCitations, fileLastModified, fileSize, paperId, pdfBytes, scale]);

  useEffect(() => {
    wrappersRef.current.forEach((wrap, index) => {
      if (wrap?.querySelector('.textLayer')) {
        applyAnnotationHighlights(wrap, annotations.filter((ann) => ann.pageNum === index + 1));
      }
    });
  }, [annotations, pdfReady, scale]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const handler = (event) => {
      const target = event.target.closest('[data-ann-id]');
      if (!target) return;
      const ann = annotationsRef.current.find((item) => item.id === target.dataset.annId);
      if (!ann || !onAnnotationClickRef.current) return;
      const rect = target.getBoundingClientRect();
      onAnnotationClickRef.current(ann, { x: rect.left + rect.width / 2, y: rect.bottom + 4 });
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, []);

  return <div ref={containerRef} className="pdf-pages" />;
}
