import React from 'react';

export default function ThinkingTrace({ steps, isLive, expanded, onToggle }) {
  if (!steps?.length) return null;
  const searchCount = steps.filter(s => s.type === "search").length;
  const icons = { reasoning: "o", search: ">", result: "+" };
  const panelRef = React.useRef(null);

  React.useEffect(() => {
    if (!isLive || !panelRef.current) return;
    panelRef.current.scrollTop = panelRef.current.scrollHeight;
  }, [isLive, steps]);

  const stepsEl = (
    <div className="thinking-trace-panel">
      <div ref={panelRef} className="thinking-trace-panel-scroll">
        <div className="thinking-trace-steps">
          {steps.map(s => (
            <div key={s.id} className={`thinking-step thinking-step-${s.type}`}>
              <div className="thinking-step-header">
                <span className="thinking-step-icon">{icons[s.type] || "-"}</span>
                <span className="thinking-step-label">{s.label}</span>
              </div>
              {s.body && (
                <div className="thinking-step-body">{s.body}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isLive) {
    return (
      <div className="thinking-trace thinking-trace-live">
        <div className="thinking-trace-summary">
          <span className="thinking-trace-summary-icon">*</span>
          <span className="thinking-trace-summary-label">Thinking</span>
          {searchCount > 0 && (
            <span className="thinking-trace-toggle-count">{searchCount} search{searchCount !== 1 ? "es" : ""}</span>
          )}
        </div>
        {stepsEl}
      </div>
    );
  }

  return (
    <div className="thinking-trace">
      <button className="thinking-trace-toggle" type="button" onClick={onToggle}>
        <span className="thinking-trace-toggle-icon">*</span>
        <span className="thinking-trace-toggle-label">Thinking</span>
        {searchCount > 0 && (
          <span className="thinking-trace-toggle-count">{searchCount} search{searchCount !== 1 ? "es" : ""}</span>
        )}
        <span className="thinking-trace-chevron">{expanded ? "^" : "v"}</span>
      </button>
      {expanded && stepsEl}
    </div>
  );
}
