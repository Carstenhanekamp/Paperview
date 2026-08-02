import React from 'react';

export default function ThinkingTrace({ steps, isLive, expanded, onToggle }) {
  if (!steps?.length) return null;
  const searchCount = steps.filter((s) => s.type === "search").length;
  const resultCount = steps.filter((s) => s.type === "result").length;
  const panelRef = React.useRef(null);

  React.useEffect(() => {
    if (!isLive || !panelRef.current) return;
    panelRef.current.scrollTop = panelRef.current.scrollHeight;
  }, [isLive, steps]);

  const stepsEl = (
    <div className="thinking-trace-panel" ref={panelRef}>
      <div className="thinking-trace-steps">
        {steps.map((s, i) => {
          const done = !isLive || i < steps.length - 1 || s.type === "result";
          return (
            <div key={s.id} className={`thinking-step thinking-step-${s.type}`}>
              <div className="thinking-step-header">
                <span className={`thinking-step-tile ${done ? "done" : "pending"}`} aria-hidden="true" />
                <span className="thinking-step-label">{s.label}</span>
              </div>
              {s.body && <div className="thinking-step-body">{s.body}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  const meta = [
    searchCount ? `${searchCount} web result${searchCount === 1 ? "" : "s"}` : null,
    resultCount ? `${resultCount} kept` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className={`thinking-trace ${isLive ? "thinking-trace-live" : ""}`}>
      <button className="thinking-trace-head" type="button" onClick={isLive ? undefined : onToggle}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
          {isLive ? "Working…" : "Worked"}
        </span>
        {meta && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-5)" }}>{meta}</span>}
        {!isLive && <span className="thinking-trace-chevron" style={{ marginLeft: 8 }}>{expanded ? "▴" : "▾"}</span>}
      </button>
      {(isLive || expanded) && stepsEl}
    </div>
  );
}
