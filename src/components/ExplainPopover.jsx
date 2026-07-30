import React from 'react';
import { IClose } from '../icons';

function formatExplainText(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
}

export default function ExplainPopover({
  state,
  onDismiss,
  onAddToChat,
}) {
  if (!state) return null;

  const { x, y, passage, answer, loading, error } = state;

  return (
    <div
      className="explain-popover"
      style={{
        left: Math.min(Math.max(x - 180, 8), window.innerWidth - 380),
        top: Math.min(Math.max(y + 8, 8), window.innerHeight - 320),
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="explain-popover-head">
        <span className="explain-popover-label">Quick explain</span>
        <button className="explain-popover-close" type="button" onClick={onDismiss} title="Dismiss">
          <IClose size={12} />
        </button>
      </div>
      <div className="explain-popover-passage">"{passage}"</div>
      {loading && <div className="explain-popover-status">Explaining…</div>}
      {error && <div className="explain-popover-error">{error}</div>}
      {!loading && answer && (
        <div
          className="explain-popover-answer"
          dangerouslySetInnerHTML={{ __html: formatExplainText(answer) }}
        />
      )}
      <div className="explain-popover-actions">
        <button className="ann-popover-btn" type="button" onClick={onDismiss}>
          Dismiss
        </button>
        <button
          className="ann-popover-btn primary"
          type="button"
          disabled={loading || !answer}
          onClick={() => onAddToChat(passage)}
        >
          Add to chat
        </button>
      </div>
    </div>
  );
}
