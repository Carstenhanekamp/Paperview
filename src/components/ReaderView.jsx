import React from 'react';
import { ISearch, IArrowUp, IArrowDown, IZoomOut, IZoomIn, ILeft, IRight } from '../icons';
import PdfViewer from '../PdfViewer';
import TextFallback from '../TextFallback';
import { materializeFullText } from '../chatUtils';

export default function ReaderView({
  activePaper,
  scale,
  setScale,
  currentPage,
  setCurrentPage,
  goToPage,
  activePaperTotalPages,
  handlePdfReady,
  handlePdfDocumentLoad,
  annotations,
  handleAnnotationClick,
  debugCitations,
  viewerSearchOpen,
  setViewerSearchOpen,
  viewerSearchQuery,
  setViewerSearchQuery,
  viewerSearchStatus,
  setViewerSearchStatus,
  viewerSearchMatches,
  setViewerSearchMatches,
  viewerSearchIndex,
  setViewerSearchIndex,
  viewerSearchInputRef,
  canRunViewerSearch,
  hasViewerSearchResults,
  runViewerSearch,
  handleSearchClick,
  searchablePageTexts,
  chatOpen,
  startChatResize,
}) {
  return (
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
        <div
          className="chat-resize-handle"
          onMouseDown={startChatResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat panel"
        >
          <span className="chat-resize-grip" />
        </div>
      )}
    </>
  );
}
