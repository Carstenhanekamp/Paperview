import React from 'react';
import { ISpark, IChat, IHighlight, ICopy } from '../icons';

export default function SelectionToolbar({
  popup,
  onExplain,
  onAddToChat,
  onHighlight,
  onCopy,
}) {
  if (!popup) return null;

  // preventDefault keeps the PDF text selection alive when clicking toolbar actions
  const keepSelection = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="sel-pop"
      style={{
        left: Math.min(Math.max(popup.x - 160, 8), window.innerWidth - 420),
        top: Math.max(popup.y - 50, 8),
      }}
      onMouseDown={keepSelection}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="sel-btn pri" type="button" onMouseDown={keepSelection} onClick={onExplain}>
        <ISpark size={13} /> Explain
      </button>
      <button className="sel-btn" type="button" onMouseDown={keepSelection} onClick={onAddToChat}>
        <IChat size={13} /> Add to chat
      </button>
      <button className="sel-btn" type="button" onMouseDown={keepSelection} onClick={onHighlight}>
        <IHighlight size={13} /> Highlight
      </button>
      <button className="sel-btn" type="button" onMouseDown={keepSelection} onClick={onCopy}>
        <ICopy size={13} /> Copy
      </button>
    </div>
  );
}
