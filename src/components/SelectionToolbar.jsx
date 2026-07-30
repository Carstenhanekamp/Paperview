import React from 'react';
import { ISpark, IChat, IHighlight, ICopy } from '../icons';

export default function SelectionToolbar({
  popup,
  onAskAI,
  onExplain,
  onAddToChat,
  onHighlight,
  onCopy,
}) {
  if (!popup) return null;

  return (
    <div
      className="sel-pop"
      style={{
        left: Math.min(Math.max(popup.x - 160, 8), window.innerWidth - 420),
        top: Math.max(popup.y - 50, 8),
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="sel-btn pri" type="button" onClick={onAskAI}>
        <ISpark size={13} /> Ask AI
      </button>
      <button className="sel-btn pri" type="button" onClick={onExplain}>
        <ISpark size={13} /> Explain
      </button>
      <button className="sel-btn" type="button" onClick={onAddToChat}>
        <IChat size={13} /> Add to chat
      </button>
      <button className="sel-btn" type="button" onClick={onHighlight}>
        <IHighlight size={13} /> Highlight
      </button>
      <button className="sel-btn" type="button" onClick={onCopy}>
        <ICopy size={13} /> Copy
      </button>
    </div>
  );
}
