import { useState, useEffect, useCallback } from 'react';
import { saveAnnotation, loadAnnotations, deleteAnnotation } from '../db';
import { createRandomId } from '../idUtils';

export function useAnnotations({ activePaper, popup, setPopup, syncFolderForPaper }) {
  const [annotations, setAnnotations] = useState([]);
  const [annPopover, setAnnPopover] = useState(null);
  const [annComment, setAnnComment] = useState('');

  // Load annotations for active paper
  useEffect(() => {
    if (!activePaper?.id) { setAnnotations([]); return; }
    loadAnnotations(activePaper.id).then((anns) => setAnnotations(anns || [])).catch(() => setAnnotations([]));
  }, [activePaper?.id]);

  const handleHighlight = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    let range;
    try {
      range = sel.getRangeAt(0);
    } catch {
      return;
    }

    const selectedText = (popup?.text || sel.toString() || '').trim();
    if (selectedText.length < 1) return;

    const viewer = document.querySelector('.viewer');
    if (!viewer) return;

    // Find the page wrapper containing the selection
    let pageWrap = range.startContainer.nodeType === 3
      ? range.startContainer.parentElement?.closest('[data-page]')
      : range.startContainer.closest?.('[data-page]');
    if (!pageWrap) return;

    const pageNum = parseInt(pageWrap.dataset.page, 10);
    // Prefer top-level text-layer spans so offsets match applyAnnotationHighlights
    const tl = pageWrap.querySelector('.textLayer');
    if (!tl) return;

    const spans = Array.from(tl.querySelectorAll(':scope > span'));
    if (!spans.length) return;

    // Build character offset from text layer spans
    let charPos = 0;
    let startOffset = -1;
    let endOffset = -1;

    for (const span of spans) {
      const text = span.textContent || '';
      const spanStart = charPos;

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

    const newAnn = {
      id: createRandomId('ann'),
      paperId: activePaper?.id,
      pageNum,
      selectedText,
      comment: '',
      color: 'var(--highlight)',
      startOffset,
      endOffset,
      createdAt: Date.now(),
    };

    const rect = range.getBoundingClientRect();
    setAnnotations((prev) => [...prev, newAnn]);
    saveAnnotation(newAnn).catch(() => {});
    syncFolderForPaper(newAnn.paperId);
    setPopup(null);
    window.getSelection()?.removeAllRanges();

    // Show popover for comment entry
    setAnnPopover({ ann: newAnn, x: rect.left + rect.width / 2, y: rect.bottom + 4, isNew: true });
    setAnnComment('');
  };

  const handleAnnotationClick = useCallback((ann, pos) => {
    setAnnPopover({ ann, x: pos.x, y: pos.y, isNew: false });
    setAnnComment(ann.comment || '');
    setPopup(null);
  }, [setPopup]);

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

  return {
    annotations,
    setAnnotations,
    annPopover,
    setAnnPopover,
    annComment,
    setAnnComment,
    handleHighlight,
    handleAnnotationClick,
    saveAnnotationComment,
    deleteAnnotationById,
  };
}
