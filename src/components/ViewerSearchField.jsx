import React from 'react';
import { ISearch, IClose, IArrowUp, IArrowDown } from '../icons';

/**
 * In-document find control for the reader title bar.
 * Replaces the old dual-UI (readonly ⌘F chip → separate toolbar over the PDF).
 */
export default function ViewerSearchField({
  open,
  query,
  status,
  matchIndex,
  matchCount,
  canSearch,
  inputRef,
  onOpen,
  onClose,
  onQueryChange,
  onFindNext,
  onFindPrev,
}) {
  const meta =
    status ||
    (matchCount > 0 && matchIndex >= 0 ? `${matchIndex + 1}/${matchCount}` : '');

  return (
    <div className={`topbar-find${open ? ' open' : ''}`} role="search">
      <span className="topbar-find-ico" aria-hidden="true">
        <ISearch size={13} />
      </span>
      <input
        ref={inputRef}
        className="topbar-find-input"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={open ? 'Find in PDF…' : '⌘F'}
        value={query}
        title="Find in this PDF"
        aria-label="Find in this PDF"
        onFocus={onOpen}
        onClick={onOpen}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.shiftKey ? onFindPrev : onFindNext)();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onFindNext();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            onFindPrev();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      {open && (
        <div className="topbar-find-actions">
          {meta ? <span className="topbar-find-meta">{meta}</span> : null}
          <button
            type="button"
            className="topbar-find-btn"
            onClick={onFindPrev}
            disabled={!canSearch}
            title="Previous match"
            aria-label="Previous match"
          >
            <IArrowUp size={13} />
          </button>
          <button
            type="button"
            className="topbar-find-btn"
            onClick={onFindNext}
            disabled={!canSearch}
            title="Next match"
            aria-label="Next match"
          >
            <IArrowDown size={13} />
          </button>
          <button
            type="button"
            className="topbar-find-btn"
            onClick={onClose}
            title="Close find"
            aria-label="Close find"
          >
            <IClose size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
