import React from 'react';
import { ISearch, IFile } from '../icons';

export default function LibrarySearch({
  query = '',
  onQueryChange,
  results = [],
  getTitle,
  onOpenPaper,
}) {
  return (
    <div className="library-search">
      <div className="library-search-field">
        <ISearch size={13} />
        <input
          className="library-search-input"
          value={query}
          onChange={(e) => onQueryChange?.(e.target.value)}
          placeholder="Where did I save that paper…?"
        />
      </div>
      {query.trim() && (
        <div className="library-search-results">
          {results.length === 0 ? (
            <div className="library-search-empty">No matching papers yet. Open papers to extract text and build the index.</div>
          ) : (
            results.map((hit) => (
              <button
                key={`${hit.paperId}-${hit.pageNum || 0}`}
                type="button"
                className="library-search-hit"
                onClick={() => onOpenPaper?.(hit.paper, hit.folderId)}
              >
                <IFile size={12} />
                <div className="library-search-hit-body">
                  <div className="library-search-hit-title">
                    {getTitle?.(hit.paper) || hit.paper?.name || 'Untitled'}
                  </div>
                  <div className="library-search-hit-meta">
                    {[hit.folderName, hit.pageNum ? `p.${hit.pageNum}` : null, hit.score != null ? `score ${hit.score.toFixed?.(2) ?? hit.score}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {hit.snippet && <div className="library-search-hit-snippet">{hit.snippet}</div>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
