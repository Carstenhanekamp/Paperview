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

  const segments = useMemo(() => {
    const lines = String(text || "").split("\n");
    const out = [];
    lines.forEach((line, li) => {
      if (!line.trim()) {
        out.push({ type: "br", id: `br-${li}` });
      } else {
        const parts = (line.match(/[^.!?]+[.!?]+[,;]?(?:\s+|$)|[^.!?]+$/g) || [line])
          .map((p) => p.replace(/^[\s,;]+/, ''))
          .filter(Boolean);
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
    if (hoveredCitation == null) return undefined;

    const handleOutsidePointer = (event) => {
      if (!event.target.closest(".inline-cit-wrap")) {
        setHoveredCitation(null);
      }
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
    const parts = String(value || "").replace(/^[\s,;]+/, "").split(/\*\*([^*]+)\*\*/g);
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
                    className={`inline-cit-anchor${hoveredCitation === ci ? " active" : ""}`}
                    type="button"
                    aria-label={`Show citation ${ci + 1}`}
                    aria-expanded={hoveredCitation === ci}
                    aria-haspopup="dialog"
                    title={`Source ${ci + 1}${c?.page ? `, page ${c.page}` : ""}`}
                    onMouseEnter={() => showPopover(ci)}
                    onClick={() => setHoveredCitation((prev) => (prev === ci ? null : ci))}
                  >
                    <span className="inline-cit-anchor-index">{ci + 1}</span>
                  </button>
                  {hoveredCitation === ci && (
                    <div
                      className="inline-cit-popover"
                      style={popoverStyle || undefined}
                      onMouseEnter={() => showPopover(ci)}
                      onMouseLeave={scheduleHide}
                    >
                      <div className="source-card" onClick={() => onCitationClick?.(c)}>
                        <div className="source-card-top">
                          <IFile size={12} style={{ color: "#6f7786", flexShrink: 0 }} />
                          <span className="source-card-file">{c.fileName || fileName}</span>
                          <span className="source-card-page">p.{c.page}</span>
                          <span className="source-card-jump">Jump</span>
                        </div>
                        {c.section && <div className="source-card-section">{c.section}</div>}
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
