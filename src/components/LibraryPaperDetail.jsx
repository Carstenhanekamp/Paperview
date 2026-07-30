import React, { useMemo, useState } from 'react';
import { IClose, ICopy, IFile, ISpark } from '../icons';
import {
  displayPaperTitle,
  extractArxivIdFromFilename,
  formatAuthorsLine,
  isPlaceholderAuthor,
  toBibtexEntry,
} from '../biblioUtils';

function Field({ label, children }) {
  return (
    <div className="lib-detail-field">
      <div className="lib-detail-label">{label}</div>
      <div className="lib-detail-value">{children || '—'}</div>
    </div>
  );
}

export default function LibraryPaperDetail({
  paper,
  folder,
  meta,
  onClose,
  onOpen,
  onPreviewBibtex,
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
  const arxivUrl = arxivId ? `https://arxiv.org/abs/${arxivId}` : '';

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
      setAiError(err?.message || 'Could not extract metadata.');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <aside className="lib-detail" aria-label="Document details">
      <div className="lib-detail-head">
        <div className="lib-detail-kicker">Details</div>
        <button className="lib-icon-btn" type="button" onClick={onClose} title="Close details">
          <IClose size={13} />
        </button>
      </div>

      <div className="lib-detail-scroll">
        <div className="lib-detail-icon"><IFile size={18} /></div>
        <h2 className="lib-detail-title">{title}</h2>
        {authors ? <p className="lib-detail-authors">{authors}</p> : null}

        <button
          className="lib-btn lib-detail-ai-btn"
          type="button"
          disabled={aiBusy || !extractPaperMetaWithAI}
          onClick={handleExtractAi}
          title="Read the first pages and fill title, authors, year, DOI, venue"
        >
          <ISpark size={12} />
          {aiBusy ? 'Extracting…' : 'Extract with AI'}
        </button>
        {aiError && <div className="lib-detail-error">{aiError}</div>}
        {aiBusy && (
          <div className="lib-detail-status">
            Scanning pages and asking the model for citation fields…
          </div>
        )}

        <div className="lib-detail-grid">
          <Field label="Year">{year || '—'}</Field>
          <Field label="Venue">{meta?.venue || '—'}</Field>
          <Field label="DOI">
            {doiUrl ? (
              <a href={doiUrl} target="_blank" rel="noreferrer">{meta.doi}</a>
            ) : (
              '—'
            )}
          </Field>
          <Field label="arXiv">
            {arxivUrl ? (
              <a href={arxivUrl} target="_blank" rel="noreferrer">{arxivId}</a>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Folder">{folder?.name || '—'}</Field>
          <Field label="Filename">{paper.name || '—'}</Field>
          <Field label="Pages">{paper.pages ?? '—'}</Field>
          <Field label="Source">{meta?.source || 'not extracted yet'}</Field>
        </div>

        {meta?.abstract ? (
          <div className="lib-detail-section">
            <div className="lib-detail-section-head"><span>Abstract</span></div>
            <p className="lib-detail-abstract">{meta.abstract}</p>
          </div>
        ) : null}

        <div className="lib-detail-section">
          <div className="lib-detail-section-head">
            <span>BibTeX</span>
            <div className="lib-detail-section-actions">
              <button className="lib-btn" type="button" onClick={handleCopyBibtex}>
                <ICopy size={12} /> {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                className="lib-btn"
                type="button"
                onClick={() =>
                  onPreviewBibtex?.({
                    title: title || 'BibTeX',
                    filename: `${(paper.name || 'paper').replace(/\.pdf$/i, '')}.bib`,
                    content: bibtex,
                  })
                }
              >
                Preview
              </button>
            </div>
          </div>
          <pre className="lib-detail-bibtex">{bibtex}</pre>
        </div>
      </div>

      {showOpenButton && (
        <div className="lib-detail-footer">
          <button className="lib-btn dark" type="button" onClick={() => onOpen?.(paper, folder?.id)}>
            Open PDF
          </button>
        </div>
      )}
    </aside>
  );
}
