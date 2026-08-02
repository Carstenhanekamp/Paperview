import React, { useMemo, useState } from 'react';
import { IClose, ISpark } from '../icons';
import {
  displayPaperTitle,
  extractArxivIdFromFilename,
  formatAuthorsLine,
  isPlaceholderAuthor,
  toBibtexEntry,
} from '../biblioUtils';

export default function LibraryPaperDetail({
  paper,
  folder,
  meta,
  onClose,
  onOpen,
  extractPaperMetaWithAI,
  showOpenButton = true,
}) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [copied, setCopied] = useState(false);

  const title = displayPaperTitle(paper, meta);
  const authorsFromMeta = formatAuthorsLine(meta?.authors);
  const authorsFromPaper = isPlaceholderAuthor(paper?.authors) ? '' : formatAuthorsLine(paper?.authors);
  const authors = authorsFromMeta || authorsFromPaper;
  const year = meta?.year || '';
  const arxivId = meta?.arxivId || extractArxivIdFromFilename(paper?.name) || '';
  const bibtex = useMemo(
    () =>
      toBibtexEntry(
        {
          ...(meta || {}),
          arxivId: meta?.arxivId || arxivId,
          authors: meta?.authors?.length ? meta.authors : authors ? authors.split(', ') : [],
          year: meta?.year || year,
        },
        paper
      ),
    [meta, paper, arxivId, authors, year]
  );

  if (!paper) return null;

  const doiUrl = meta?.doi ? `https://doi.org/${meta.doi}` : '';
  const highlightCount = Number(paper?.highlightCount ?? meta?.highlightCount ?? 0);
  const chatCount = Number(paper?.chatCount ?? meta?.chatCount ?? 0);
  const chatMessages = Number(paper?.chatMessageCount ?? meta?.chatMessageCount ?? 0);

  const handleCopyBibtex = async () => {
    try {
      await navigator.clipboard?.writeText(bibtex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const handleExtractAi = async () => {
    if (!extractPaperMetaWithAI || aiBusy) return;
    setAiError(null);
    setAiBusy(true);
    try {
      await extractPaperMetaWithAI(paper);
    } catch (err) {
      let message = err?.message || 'Could not extract metadata.';
      try {
        const parsed = JSON.parse(message);
        if (parsed?.error?.message) message = parsed.error.message;
      } catch {
        // keep original string
      }
      setAiError(message);
    } finally {
      setAiBusy(false);
    }
  };

  const chatsLabel = chatCount
    ? `${chatCount} thread${chatCount === 1 ? '' : 's'}${chatMessages ? ` · ${chatMessages} messages` : ''}`
    : '—';

  const addedLabel = folder?.name ? `from ~/${folder.name}` : '—';

  return (
    <aside className="lib-detail" aria-label="Document details">
      <div className="lib-detail-head">
        <div className="lib-detail-kicker">Paper details</div>
        <button className="lib-icon-btn" type="button" onClick={onClose} title="Close details">
          <IClose size={13} />
        </button>
      </div>

      <div className="lib-detail-scroll">
        <h2 className="lib-detail-title">{title}</h2>
        {authors ? <p className="lib-detail-authors">{authors}</p> : null}

        <div className="lib-detail-chips">
          {meta?.venue ? (
            <span className="lib-chip accent">
              {meta.venue}{year ? ` ${year}` : ''}
            </span>
          ) : year ? (
            <span className="lib-chip accent">{year}</span>
          ) : null}
          {paper.pages != null ? <span className="lib-chip">{paper.pages} pages</span> : null}
          <span className="lib-chip">
            {paper.pdfBytes || paper.hasTextLayer ? 'Text layer ✓' : 'Scanned'}
          </span>
        </div>

        <dl className="lib-dl">
          <div className="lib-dl-row">
            <dt>DOI</dt>
            <dd>
              {doiUrl ? (
                <a href={doiUrl} target="_blank" rel="noreferrer">{meta.doi}</a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="lib-dl-row">
            <dt>Added</dt>
            <dd>{addedLabel}</dd>
          </div>
          <div className="lib-dl-row">
            <dt>Highlights</dt>
            <dd>{highlightCount || '—'}</dd>
          </div>
          <div className="lib-dl-row">
            <dt>Chats</dt>
            <dd>{chatsLabel}</dd>
          </div>
        </dl>

        <div className="lib-meta-block">
          <div className="lib-meta-label">Metadata</div>
          <div className="lib-meta-card">
            <ISpark size={14} />
            <div className="lib-meta-copy">
              <p>
                Title, authors, venue and DOI were extracted from the PDF. Re-run if the file was replaced.
              </p>
              <button
                className="extract"
                type="button"
                disabled={aiBusy || !extractPaperMetaWithAI}
                onClick={handleExtractAi}
              >
                {aiBusy ? 'Extracting…' : 'Extract with AI · ~$0.001'}
              </button>
              {aiError && <div className="lib-detail-error">{aiError}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="lib-detail-footer">
        {showOpenButton && (
          <button className="primary" type="button" onClick={() => onOpen?.(paper, folder?.id)}>
            Open in reader
          </button>
        )}
        <button className="ghost" type="button" onClick={handleCopyBibtex}>
          {copied ? 'Copied' : 'Copy BibTeX'}
        </button>
      </div>
    </aside>
  );
}
