import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { IFile } from './icons';

export default function InlineCitedAnswer({ text, citations = [], fileName, onCitationClick }) {
  const [hoveredCitation, setHoveredCitation] = useState(null);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const hideTimerRef = useRef(null);
  const citationWrapRefs = useRef(new Map());

  const normalize = useCallback((s) =>
    (s || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim(), []);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    if (hoveredCitation == null) return undefined;
    const handleOutsidePointer = (event) => {
      if (!event.target.closest(".inline-cit-wrap")) setHoveredCitation(null);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setHoveredCitation(null);
    };
    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [hoveredCitation]);

  useEffect(() => {
    if (hoveredCitation == null) {
      setPopoverStyle(null);
      return undefined;
    }
    const updatePopoverPosition = () => {
      const wrap = citationWrapRefs.current.get(hoveredCitation.anchorKey);
      const panel = wrap?.closest(".citation-popover-boundary") || wrap?.closest(".chat-panel");
      if (!wrap || !panel) { setPopoverStyle(null); return; }
      const wrapRect = wrap.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const maxWidth = Math.min(320, Math.max(220, panelRect.width - 28));
      const clampedLeft = Math.min(
        Math.max(panelRect.left + 10, wrapRect.left),
        panelRect.right - maxWidth - 10
      );
      setPopoverStyle({ left: `${clampedLeft - wrapRect.left}px`, width: `${maxWidth}px` });
    };
    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    return () => window.removeEventListener("resize", updatePopoverPosition);
  }, [hoveredCitation]);

  const showPopover = (anchorKey, citationIndex) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setHoveredCitation({ anchorKey, citationIndex });
  };

  const scheduleHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setHoveredCitation(null), 120);
  };

  const renderCitationAnchor = (ci, key) => {
    const c = citations[ci];
    if (!c) return null;
    const anchorKey = `anchor-${key}`;
    const isWebCitation = c?.kind === "web" || Boolean(c?.url);
    const title = isWebCitation
      ? `Source ${ci + 1}`
      : `Source ${ci + 1}${c?.page ? `, page ${c.page}` : ""}`;

    return (
      <span
        key={key}
        className="inline-cit-wrap"
        ref={(node) => {
          if (node) citationWrapRefs.current.set(anchorKey, node);
          else citationWrapRefs.current.delete(anchorKey);
        }}
        onMouseEnter={() => showPopover(anchorKey, ci)}
        onMouseLeave={scheduleHide}
      >
        <button
          className={`inline-cit-anchor${hoveredCitation?.anchorKey === anchorKey ? " active" : ""}`}
          type="button"
          aria-label={`Show citation ${ci + 1}`}
          aria-expanded={hoveredCitation?.anchorKey === anchorKey}
          aria-haspopup="dialog"
          title={title}
          onMouseEnter={() => showPopover(anchorKey, ci)}
          onClick={() => setHoveredCitation((prev) => (prev?.anchorKey === anchorKey ? null : { anchorKey, citationIndex: ci }))}
        >
          <span className="inline-cit-anchor-index">{ci + 1}</span>
        </button>
        {hoveredCitation?.anchorKey === anchorKey && (
          <div
            className="inline-cit-popover"
            style={popoverStyle || undefined}
            onMouseEnter={() => showPopover(anchorKey, ci)}
            onMouseLeave={scheduleHide}
          >
            <div
              className="source-card"
              role="button"
              tabIndex={0}
              onClick={() => onCitationClick?.(c)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onCitationClick?.(c);
                }
              }}
            >
              <div className="source-card-top">
                <IFile size={12} style={{ color: "#6f7786", flexShrink: 0 }} />
                <span className="source-card-file">{c.title || c.fileName || fileName || `Source ${ci + 1}`}</span>
                {isWebCitation ? (
                  <span className="source-card-page">{c.source || "Web"}</span>
                ) : c.page ? (
                  <span className="source-card-page">p.{c.page}</span>
                ) : null}
                <span className="source-card-jump">{isWebCitation ? "Open" : "Jump"}</span>
              </div>
              {c.section ? <div className="source-card-section">{c.section}</div> : null}
              {c.note ? <div className="source-card-note">{c.note}</div> : null}
              {c.text ? (
                <div className="source-card-text">
                  {isWebCitation ? c.text : `"${c.text}"`}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </span>
    );
  };

  const renderBoldSegments = useCallback((content, keyPrefix) => {
    const nodes = [];
    const regex = /\*\*(.+?)\*\*/g;
    let last = 0;
    let m;

    while ((m = regex.exec(content)) !== null) {
      if (m.index > last) {
        nodes.push(
          <React.Fragment key={`${keyPrefix}-t${nodes.length}`}>
            {content.slice(last, m.index)}
          </React.Fragment>
        );
      }
      nodes.push(<strong key={`${keyPrefix}-b${nodes.length}`}>{m[1]}</strong>);
      last = m.index + m[0].length;
      if (!m[0]?.length) regex.lastIndex += 1;
    }

    if (last < content.length) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-t${nodes.length}`}>
          {content.slice(last)}
        </React.Fragment>
      );
    }

    return nodes;
  }, []);

  // Parse citations first so nested markdown inside bold text cannot swallow [N] markers.
  const parseInlineLine = useCallback((line, keyPrefix) => {
    const nodes = [];
    const regex = /\[(\d+)\]/g;
    let last = 0;
    let m;

    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) {
        nodes.push(...renderBoldSegments(line.slice(last, m.index), `${keyPrefix}-s${nodes.length}`));
      }
      nodes.push(renderCitationAnchor(Number(m[1]) - 1, `${keyPrefix}-c${nodes.length}`));
      last = m.index + m[0].length;
      if (!m[0]?.length) regex.lastIndex += 1;
    }

    if (last < line.length) {
      nodes.push(...renderBoldSegments(line.slice(last), `${keyPrefix}-s${nodes.length}`));
    }

    return nodes;
  }, [renderBoldSegments, citations, hoveredCitation, popoverStyle]);

  // Detect if text uses explicit [N] citation markers
  const hasExplicitMarkers = useMemo(() => /\[\d+\]/.test(String(text || "")), [text]);

  // Parse text into block-level elements for rendering
  const blocks = useMemo(() => {
    const lines = String(text || "").split("\n");
    const result = [];
    let listType = null; // "ul" or "ol"
    let listItems = [];

    const flushList = () => {
      if (listItems.length) {
        result.push({ type: listType, items: listItems });
        listItems = [];
        listType = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        flushList();
        continue;
      }

      const h3 = trimmed.match(/^###\s+(.*)/);
      const h2 = trimmed.match(/^##\s+(.*)/);
      const h1 = trimmed.match(/^#\s+(.*)/);
      if (h1 || h2 || h3) {
        flushList();
        const level = h3 ? 3 : h2 ? 2 : 1;
        const txt = (h3 || h2 || h1)[1];
        result.push({ type: "heading", level, text: txt });
        continue;
      }

      const bullet = trimmed.match(/^[-*•]\s+(.*)/);
      if (bullet) {
        if (listType !== "ul") { flushList(); listType = "ul"; }
        listItems.push(bullet[1]);
        continue;
      }

      const ordered = trimmed.match(/^\d+[.)]\s+(.*)/);
      if (ordered) {
        if (listType !== "ol") { flushList(); listType = "ol"; }
        listItems.push(ordered[1]);
        continue;
      }

      // Plain text — merge consecutive non-empty lines into the same paragraph
      flushList();
      if (result.length > 0 && result[result.length - 1].type === "p") {
        result[result.length - 1].text += " " + trimmed;
      } else {
        result.push({ type: "p", text: trimmed });
      }
    }

    flushList();
    return result;
  }, [text]);

  // Auto-placement logic for texts without explicit [N] markers
  const autoPlacement = useMemo(() => {
    if (hasExplicitMarkers) return new Map();

    const sentenceTexts = [];
    const sentenceBlockRefs = []; // {blockIdx, itemIdx?}

    blocks.forEach((block, bi) => {
      const extractSentences = (txt, ref) => {
        const parts = (txt.match(/[^.!?]+[.!?]+[,;]?(?:\s+|$)|[^.!?]+$/g) || [txt])
          .map((p) => p.replace(/^[\s,;]+/, "").trim())
          .filter(Boolean);
        parts.forEach((s) => { sentenceTexts.push(normalize(s)); sentenceBlockRefs.push(ref); });
      };

      if (block.type === "p") extractSentences(block.text, { bi });
      if (block.type === "ul" || block.type === "ol") {
        block.items.forEach((item, ii) => extractSentences(item, { bi, ii }));
      }
    });

    const makeNgrams = (arr, n) => {
      const gs = [];
      if (arr.length < n) return gs;
      for (let i = 0; i <= arr.length - n; i++) gs.push(arr.slice(i, i + n).join(" "));
      return gs;
    };

    const map = new Map();
    (citations || []).forEach((c, ci) => {
      const cNorm = normalize(c?.text || "");
      const cWords = cNorm.split(" ").filter(Boolean);
      if (!cWords.length) return;
      let bestRef = sentenceBlockRefs[0];
      let bestScore = -1;
      sentenceTexts.forEach((sNorm, si) => {
        const sWords = sNorm.split(" ").filter(Boolean);
        const sSet = new Set(sWords);
        const overlap = cWords.filter((w) => sSet.has(w)).length / cWords.length;
        const tri = makeNgrams(cWords, Math.min(3, cWords.length));
        const triHit = tri.length ? tri.some((g) => sNorm.includes(g)) : false;
        const fullHit = sNorm.includes(cNorm) ? 1 : 0;
        const score = overlap + (triHit ? 0.45 : 0) + fullHit;
        if (score > bestScore) { bestScore = score; bestRef = sentenceBlockRefs[si]; }
      });
      if (bestRef) {
        const key = bestRef.ii !== undefined ? `${bestRef.bi}-${bestRef.ii}` : String(bestRef.bi);
        const arr = map.get(key) || [];
        arr.push(ci);
        map.set(key, arr);
      }
    });

    return map;
  }, [hasExplicitMarkers, blocks, citations, normalize]);

  const renderBlock = (block, bi) => {
    if (block.type === "heading") {
      return <div key={`b${bi}`} className={`cited-answer-h${block.level}`}>{parseInlineLine(block.text, `b${bi}`)}</div>;
    }

    if (block.type === "p") {
      const trailingCitations = autoPlacement.get(String(bi)) || [];
      return (
        <div key={`b${bi}`} className="cited-answer-p">
          {parseInlineLine(block.text, `b${bi}`)}
          {trailingCitations.map((ci) => renderCitationAnchor(ci, `b${bi}-ac${ci}`))}
        </div>
      );
    }

    if (block.type === "ul" || block.type === "ol") {
      const Tag = block.type === "ol" ? "ol" : "ul";
      return (
        <Tag key={`b${bi}`} className="cited-answer-list">
          {block.items.map((item, ii) => {
            const trailingCitations = autoPlacement.get(`${bi}-${ii}`) || [];
            return (
              <li key={`b${bi}-li${ii}`} className="cited-answer-li">
                {parseInlineLine(item, `b${bi}-li${ii}`)}
                {trailingCitations.map((ci) => renderCitationAnchor(ci, `b${bi}-li${ii}-ac${ci}`))}
              </li>
            );
          })}
        </Tag>
      );
    }

    return null;
  };

  return (
    <div className="cited-answer-body">
      {blocks.map((block, bi) => renderBlock(block, bi))}
    </div>
  );
}
