import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IZoomOut, IZoomIn, ILeft, IRight, IHighlight } from '../icons';
import PdfViewer from '../PdfViewer';
import TextFallback from '../TextFallback';
import { materializeFullText } from '../chatUtils';
import { computeFitWidthScale } from '../pdfFitUtils';

const PDF_H_PADDING = 36; // matches .pdf-scroll horizontal padding (18 + 18)

export default function ReaderView({
  activePaper,
  currentPage,
  setCurrentPage,
  goToPage,
  activePaperTotalPages,
  handlePdfReady,
  handlePdfDocumentLoad,
  annotations,
  handleAnnotationClick,
  debugCitations,
  searchablePageTexts,
  onHighlightSelection,
  canHighlight = false,
}) {
  const pdfScrollRef = useRef(null);
  const zoomRef = useRef(1);
  const pinchFactorRef = useRef(1);
  const pinchCommitTimerRef = useRef(0);
  const gestureStartZoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [pinchFactor, setPinchFactor] = useState(1);
  const [viewerWidth, setViewerWidth] = useState(0);
  const [pageWidth, setPageWidth] = useState(null);
  const [pageEditing, setPageEditing] = useState(false);
  const [pageDraft, setPageDraft] = useState('');
  const pageInputRef = useRef(null);
  const ignorePageBlurRef = useRef(false);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (!pageEditing) return undefined;
    const id = requestAnimationFrame(() => {
      const el = pageInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(id);
  }, [pageEditing]);

  useEffect(() => {
    // External page changes (prev/next, search, citations) exit edit mode
    ignorePageBlurRef.current = true;
    setPageEditing(false);
  }, [currentPage, activePaper?.id]);

  const beginPageEdit = () => {
    ignorePageBlurRef.current = false;
    setPageDraft(String(currentPage));
    setPageEditing(true);
  };

  const commitPageEdit = () => {
    if (ignorePageBlurRef.current) {
      ignorePageBlurRef.current = false;
      return;
    }
    // Swallow the blur that follows Enter / unmount so we don't commit twice.
    ignorePageBlurRef.current = true;
    const total = Number(activePaperTotalPages) || 1;
    const raw = pageInputRef.current?.value ?? pageDraft;
    const parsed = parseInt(String(raw).trim(), 10);
    setPageEditing(false);
    if (!Number.isFinite(parsed)) return;
    const next = Math.max(1, Math.min(total, parsed));
    if (next !== currentPage) goToPage(next);
  };

  const cancelPageEdit = () => {
    ignorePageBlurRef.current = true;
    setPageEditing(false);
    setPageDraft(String(currentPage));
  };

  useEffect(() => {
    pinchFactorRef.current = pinchFactor;
  }, [pinchFactor]);

  useEffect(() => {
    setZoom(1);
    zoomRef.current = 1;
    setPinchFactor(1);
    pinchFactorRef.current = 1;
    setPageWidth(null);
  }, [activePaper?.id]);

  useEffect(() => {
    const el = pdfScrollRef.current;
    if (!el) return undefined;

    let raf = 0;
    const publishWidth = (width) => {
      if (!Number.isFinite(width) || width <= 0) return;
      setViewerWidth((prev) => (Math.abs(prev - width) < 1 ? prev : width));
    };

    publishWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => publishWidth(width));
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [activePaper?.id]);

  useEffect(() => {
    const el = pdfScrollRef.current;
    if (!el || !activePaper?.pdfBytes) return undefined;

    const clampZoom = (value) => Math.min(3, Math.max(0.5, value));

    const commitPinch = () => {
      const next = clampZoom(zoomRef.current * pinchFactorRef.current);
      zoomRef.current = next;
      setZoom(+next.toFixed(3));
      pinchFactorRef.current = 1;
      setPinchFactor(1);
    };

    const scheduleCommit = () => {
      window.clearTimeout(pinchCommitTimerRef.current);
      pinchCommitTimerRef.current = window.setTimeout(commitPinch, 140);
    };

    const onWheel = (event) => {
      // Trackpad pinch is reported as ctrl+wheel in Chromium/Firefox/Safari.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const current = zoomRef.current * pinchFactorRef.current;
      // deltaY is large for mouse wheels; keep trackpad pinches gradual.
      const delta = Math.max(-40, Math.min(40, event.deltaY));
      const nextAbsolute = clampZoom(current * Math.exp(-delta * 0.0035));
      const nextFactor = nextAbsolute / zoomRef.current;
      pinchFactorRef.current = nextFactor;
      setPinchFactor(+nextFactor.toFixed(4));
      scheduleCommit();
    };

    const onGestureStart = (event) => {
      event.preventDefault();
      gestureStartZoomRef.current = zoomRef.current * pinchFactorRef.current;
      window.clearTimeout(pinchCommitTimerRef.current);
    };

    const onGestureChange = (event) => {
      event.preventDefault();
      const absolute = clampZoom(gestureStartZoomRef.current * (event.scale || 1));
      const nextFactor = absolute / zoomRef.current;
      pinchFactorRef.current = nextFactor;
      setPinchFactor(+nextFactor.toFixed(4));
    };

    const onGestureEnd = (event) => {
      event.preventDefault();
      commitPinch();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    el.addEventListener('gestureend', onGestureEnd, { passive: false });

    return () => {
      window.clearTimeout(pinchCommitTimerRef.current);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
    };
  }, [activePaper?.id, activePaper?.pdfBytes]);

  const fitScale = useMemo(
    () =>
      computeFitWidthScale({
        containerWidth: viewerWidth,
        pageWidth,
        horizontalPadding: PDF_H_PADDING,
      }) || 1.2,
    [viewerWidth, pageWidth]
  );

  const scale = useMemo(() => {
    const next = fitScale * zoom;
    return Math.min(4, Math.max(0.4, +next.toFixed(3)));
  }, [fitScale, zoom]);

  const onDocumentLoad = (info) => {
    if (Number.isFinite(info?.pageWidth) && info.pageWidth > 0) {
      setPageWidth(info.pageWidth);
    }
    handlePdfDocumentLoad?.(info);
  };

  const zoomLabel = Math.round(zoom * pinchFactor * 100);
  const pinching = Math.abs(pinchFactor - 1) > 0.001;
  const pagesStyle = pinching
    ? { transform: `scale(${pinchFactor})`, transformOrigin: 'top center', willChange: 'transform' }
    : undefined;
  // Wait for the scroll container width so the first fit-scale isn't computed against 0.
  const viewerReady = viewerWidth > 0;

  return (
    <>
      <div className="viewer">
        <div className="viewer-frame">
          <div ref={pdfScrollRef} className={`pdf-scroll ${debugCitations ? "debug-text-layer" : ""}`}>
            {activePaper.pdfBytes ? (
              viewerReady ? (
                <div className="pdf-pages-zoom" style={pagesStyle}>
                  <PdfViewer
                    paperId={activePaper.id}
                    pdfBytes={activePaper.pdfBytes}
                    fileSize={activePaper.fileSize}
                    fileLastModified={activePaper.fileLastModified}
                    scale={scale}
                    onReady={handlePdfReady}
                    onDocumentLoad={onDocumentLoad}
                    onPageChange={setCurrentPage}
                    debugCitations={debugCitations}
                    annotations={annotations}
                    onAnnotationClick={handleAnnotationClick}
                  />
                </div>
              ) : null
            ) : (
              <TextFallback text={materializeFullText(searchablePageTexts)} />
            )}
          </div>

          <div className="viewer-float-toolbar">
            <button className="vt-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} title="Previous page">
              <ILeft size={14} />
            </button>
            <span className="vt-page">
              {pageEditing ? (
                <input
                  ref={pageInputRef}
                  className="vt-page-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="Go to page"
                  value={pageDraft}
                  onChange={(e) => setPageDraft(e.target.value.replace(/[^\d]/g, ''))}
                  onBlur={commitPageEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitPageEdit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelPageEdit();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="vt-page-current"
                  onClick={beginPageEdit}
                  title="Go to page"
                  aria-label={`Page ${currentPage}. Click to jump to a page.`}
                >
                  {currentPage}
                </button>
              )}
              <span className="vt-page-sep">/</span>
              <span className="vt-page-total">{activePaperTotalPages || "—"}</span>
            </span>
            <button className="vt-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= activePaperTotalPages} title="Next page">
              <IRight size={14} />
            </button>
            <span className="vt-sep" />
            <div className="vt-zoom">
              <button
                className="vt-btn"
                onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
                title="Zoom out"
              >
                <IZoomOut size={14} />
              </button>
              <span className="vt-zoom-val" title="100% fits the page to the viewer width · pinch trackpad to zoom">
                {zoomLabel}%
              </span>
              <button
                className="vt-btn"
                onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                title="Zoom in"
              >
                <IZoomIn size={14} />
              </button>
            </div>
            <span className="vt-sep" />
            <button
              type="button"
              className="vt-btn hl-btn"
              onMouseDown={(e) => {
                // Keep the PDF selection so highlight can read the range
                e.preventDefault();
              }}
              onClick={onHighlightSelection}
              disabled={!canHighlight}
              title={canHighlight ? 'Highlight selection' : 'Select text in the PDF to highlight'}
            >
              <IHighlight size={13} /> Highlight
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
