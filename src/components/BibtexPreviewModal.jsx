import React, { useState } from 'react';
import { IClose, ICopy } from '../icons';

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BibtexPreviewModal({
  open,
  title = 'BibTeX',
  filename = 'export.bib',
  content = '',
  onClose,
}) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="bibtex-modal-backdrop" onMouseDown={onClose}>
      <div
        className="bibtex-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="bibtex-modal-head">
          <div>
            <div className="bibtex-modal-title">{title}</div>
            <div className="bibtex-modal-sub">{filename}</div>
          </div>
          <button className="lib-icon-btn" type="button" onClick={onClose} title="Close">
            <IClose size={13} />
          </button>
        </div>
        <pre className="bibtex-modal-body">{content || 'No BibTeX entries yet.'}</pre>
        <div className="bibtex-modal-actions">
          <button className="lib-btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="lib-btn" type="button" onClick={handleCopy}>
            <ICopy size={12} /> {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            className="lib-btn dark"
            type="button"
            disabled={!content}
            onClick={() => {
              downloadText(filename, content || '');
              onClose?.();
            }}
          >
            Download .bib
          </button>
        </div>
      </div>
    </div>
  );
}
