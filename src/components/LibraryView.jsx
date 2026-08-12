import React, { useEffect, useMemo, useState } from 'react';
import { IPlus, IChevronDown, IRight, ITrash, IFile, ICopy, IUpload } from '../icons';
import LibraryPaperDetail from './LibraryPaperDetail';
import BibtexPreviewModal from './BibtexPreviewModal';
import EmptyReaderState from './EmptyReaderState';
import { LIBRARY_QUARTO_CSS } from '../libraryQuartoStyles';
import { useScopedStyles } from '../hooks/useScopedStyles';
import { UPLOADS_FOLDER_ID } from '../constants';
import '../libraryQuarto.css';

const SWATCHES = ['', 's2', 's3'];

function formatFolderBytes(papers) {
  const bytes = (papers || []).reduce((sum, p) => sum + (Number(p.size) || Number(p.bytes) || 0), 0);
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(0)} MB`;
}

export default function LibraryView({
  setShowUpload,
  newFolder,
  nfName,
  setNfName,
  folderError,
  setFolderError,
  createFolder,
  cancelNewFolder,
  folders,
  selectedFolderId,
  openFolderTabs,
  openAllPapersInFolder,
  setUpFolder,
  deleteFolder,
  openPaper,
  deletePaper,
  getTitle,
  getAuthorsLine,
  getMeta,
  exportFolderBibtex,
  extractPaperMetaWithAI,
  canPickFolder = true,
  apiKey = '',
  hasCredit = false,
  onOpenFolder,
  onNewFolder,
  onOpenSettings,
}) {
  useScopedStyles('pv-library-quarto', LIBRARY_QUARTO_CSS);

  const [sortKey, setSortKey] = useState('title');
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [bibtexPreview, setBibtexPreview] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const paperCount = useMemo(
    () => (folders || []).reduce((sum, folder) => sum + (folder.papers?.length || 0), 0),
    [folders]
  );
  const hasWorkspaceFolder = useMemo(
    () => (folders || []).some((folder) => folder.id !== UPLOADS_FOLDER_ID),
    [folders]
  );
  // Guided empty whenever the library has nothing to browse yet.
  const showFirstRunEmpty = paperCount === 0;

  const sortedFolders = useMemo(() => {
    return (folders || []).map((folder) => {
      const papers = [...(folder.papers || [])].sort((a, b) => {
        const metaA = getMeta?.(a.id);
        const metaB = getMeta?.(b.id);
        if (sortKey === 'year') {
          return String(metaB?.year || '').localeCompare(String(metaA?.year || ''));
        }
        if (sortKey === 'authors') {
          return String(getAuthorsLine?.(a) || '').localeCompare(String(getAuthorsLine?.(b) || ''));
        }
        return String(getTitle?.(a) || a.name || '').localeCompare(String(getTitle?.(b) || b.name || ''));
      });
      return { ...folder, papers };
    });
  }, [folders, sortKey, getMeta, getTitle, getAuthorsLine]);

  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const folder of sortedFolders) {
        if (folder.papers?.length && !next.has(folder.id)) {
          next.add(folder.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sortedFolders]);

  const selected = useMemo(() => {
    if (!selectedPaperId) return null;
    for (const folder of sortedFolders) {
      const paper = folder.papers.find((p) => p.id === selectedPaperId);
      if (paper) return { paper, folder };
    }
    return null;
  }, [selectedPaperId, sortedFolders]);

  useEffect(() => {
    if (selected) return;
    for (const folder of sortedFolders) {
      if (folder.papers?.[0]) {
        setSelectedPaperId(folder.papers[0].id);
        return;
      }
    }
  }, [sortedFolders, selected]);

  const toggleExpanded = (folderId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const openBibtexPreview = ({ title, filename, content }) => {
    setBibtexPreview({ title, filename, content });
  };

  const handleUpload = () => {
    if (selectedFolderId) setUpFolder(selectedFolderId);
    else if (folders?.[0]?.id) setUpFolder(folders[0].id);
    setShowUpload(true);
  };

  if (showFirstRunEmpty) {
    return (
      <div className="library-view">
        {newFolder ? (
          <div
            className="library-main"
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'min(420px, calc(100% - 32px))',
              zIndex: 2,
              flex: 'none',
              height: 'auto',
              overflow: 'visible',
            }}
          >
            <div className="library-nf" style={{ borderBottom: 'none' }}>
              <input
                autoFocus
                className="nf-input"
                value={nfName}
                onChange={(e) => {
                  setNfName(e.target.value);
                  if (folderError) setFolderError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createFolder();
                  if (e.key === 'Escape') cancelNewFolder();
                }}
                placeholder="Folder name…"
              />
              {folderError && <div className="nf-error">{folderError}</div>}
              <div className="nf-ctrl">
                <button className="lib-btn dark" type="button" onClick={createFolder}>
                  <IPlus size={12} /> Create
                </button>
                <button className="lib-btn" type="button" onClick={cancelNewFolder}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <EmptyReaderState
          variant="library"
          canPickFolder={canPickFolder}
          hasFolder={hasWorkspaceFolder}
          apiKey={apiKey}
          hasCredit={hasCredit}
          onOpenFolder={onOpenFolder}
          onNewFolder={onNewFolder}
          onUpload={handleUpload}
          onOpenSettings={onOpenSettings}
        />
      </div>
    );
  }

  return (
    <div className="library-view library-view-with-detail">
      <div className="library-main">
        {newFolder && (
          <div className="library-nf">
            <input
              autoFocus
              className="nf-input"
              value={nfName}
              onChange={(e) => {
                setNfName(e.target.value);
                if (folderError) setFolderError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder();
                if (e.key === 'Escape') cancelNewFolder();
              }}
              placeholder="Folder name…"
            />
            {folderError && <div className="nf-error">{folderError}</div>}
            <div className="nf-ctrl">
              <button className="lib-btn dark" type="button" onClick={createFolder}>
                <IPlus size={12} /> Create
              </button>
              <button className="lib-btn" type="button" onClick={cancelNewFolder}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="library-db library-db-biblio">
          <div className="db-head">
            <button
              type="button"
              className={`db-h ${sortKey === 'title' ? 'sorted' : ''}`}
              onClick={() => setSortKey('title')}
            >
              Title {sortKey === 'title' ? <IChevronDown size={11} /> : null}
            </button>
            <button
              type="button"
              className={`db-h ${sortKey === 'authors' ? 'sorted' : ''}`}
              onClick={() => setSortKey('authors')}
            >
              Authors
            </button>
            <button
              type="button"
              className={`db-h ${sortKey === 'year' ? 'sorted' : ''}`}
              onClick={() => setSortKey('year')}
            >
              Year
            </button>
            <div className="db-h" style={{ cursor: 'default' }}>DOI</div>
            <div className="db-h" style={{ cursor: 'default', justifyContent: 'flex-end' }}>Actions</div>
          </div>

          {sortedFolders.map((folder, folderIndex) => {
            const isExpanded = expandedIds.has(folder.id);
            const sizeLabel = formatFolderBytes(folder.papers);
            return (
            <React.Fragment key={folder.id}>
              <div
                className={`db-row folder ${selectedFolderId === folder.id ? 'selected' : ''}`}
                onClick={() => openFolderTabs(folder.id, { forceReader: false })}
                title="Select this folder"
              >
                <div className="db-folder-main">
                  <button
                    className="db-toggle"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(folder.id);
                    }}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? <IChevronDown size={12} /> : <IRight size={12} />}
                  </button>
                  <span
                    className={`db-folder-swatch ${SWATCHES[folderIndex % SWATCHES.length]}`}
                    style={folder.color ? { background: folder.color } : undefined}
                  />
                  <span className="db-title">{folder.name}</span>
                  <span className="db-meta">
                    {folder.papers.length} file{folder.papers.length === 1 ? '' : 's'}
                    {sizeLabel ? ` · ${sizeLabel}` : ''}
                  </span>
                </div>
                <div className="db-folder-actions">
                  <button
                    className="db-open"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAllPapersInFolder(folder.id, { forceReader: true });
                    }}
                  >
                    Open all
                  </button>
                  <button
                    className="lib-icon-btn"
                    type="button"
                    title="Preview folder BibTeX"
                    onClick={(e) => {
                      e.stopPropagation();
                      openBibtexPreview({
                        title: `${folder.name} BibTeX`,
                        filename: `${folder.name || 'folder'}.bib`,
                        content: exportFolderBibtex?.(folder) || '',
                      });
                    }}
                  >
                    <ICopy size={13} />
                  </button>
                  <button
                    className="lib-icon-btn"
                    type="button"
                    title="Upload file to folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUpFolder(folder.id);
                      setShowUpload(true);
                    }}
                  >
                    <IUpload size={13} />
                  </button>
                  <button
                    className="lib-icon-btn"
                    type="button"
                    title="Delete folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFolder(folder.id);
                    }}
                  >
                    <ITrash size={13} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="db-folder-files">
                  {folder.papers.length === 0 ? (
                    <div className="db-file-row empty">
                      <div className="db-cell db-file-indent" style={{ gridColumn: '1 / span 5', gap: 10 }}>
                        <span>No files in this folder.</span>
                        <button
                          className="empty-upload-btn"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUpFolder(folder.id);
                            setShowUpload(true);
                          }}
                        >
                          <IUpload size={11} /> Upload your first pdf
                        </button>
                      </div>
                    </div>
                  ) : (
                    folder.papers.map((paper) => {
                      const meta = getMeta?.(paper.id);
                      const title = getTitle?.(paper) || paper.name;
                      const authors = getAuthorsLine?.(paper) || '—';
                      const year = meta?.year || paper.year || '—';
                      const doi = meta?.doi || '—';
                      const isSelected = selectedPaperId === paper.id;
                      return (
                        <div
                          className={`db-file-row ${isSelected ? 'selected' : ''}`}
                          key={paper.id}
                          onClick={() => setSelectedPaperId(paper.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedPaperId(paper.id);
                            }
                          }}
                        >
                          <div className="db-cell db-file-indent">
                            <IFile size={12} />
                            <div className="db-file-title-wrap">
                              <span className="db-file-name" title={title}>{title}</span>
                              {title !== paper.name && (
                                <span className="db-file-filename" title={paper.name}>{paper.name}</span>
                              )}
                            </div>
                          </div>
                          <div className="db-cell">
                            <span className="db-meta" title={authors}>{authors}</span>
                          </div>
                          <div className="db-cell">
                            <span className="db-meta">{year}</span>
                          </div>
                          <div className="db-cell">
                            <span className="db-meta" title={doi}>{doi}</span>
                          </div>
                          <div className="db-cell">
                            <div className="db-actions">
                              <button
                                className="lib-icon-btn"
                                type="button"
                                title="Delete file"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletePaper(folder.id, paper.id);
                                  if (selectedPaperId === paper.id) setSelectedPaperId(null);
                                }}
                              >
                                <ITrash size={13} />
                              </button>
                              <button
                                className="db-open"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPaper(paper, folder.id);
                                }}
                              >
                                Open
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </React.Fragment>
            );
          })}
        </div>
      </div>

      {selected ? (
        <LibraryPaperDetail
          paper={selected.paper}
          folder={selected.folder}
          meta={getMeta?.(selected.paper.id)}
          extractPaperMetaWithAI={extractPaperMetaWithAI}
          onClose={() => setSelectedPaperId(null)}
          onOpen={openPaper}
          onPreviewBibtex={openBibtexPreview}
        />
      ) : (
        <aside className="lib-detail">
          <div className="lib-detail-head">
            <span className="lib-detail-kicker">Paper details</span>
          </div>
          <div className="lib-detail-empty">Select a paper to inspect metadata.</div>
        </aside>
      )}

      <BibtexPreviewModal
        open={Boolean(bibtexPreview)}
        title={bibtexPreview?.title}
        filename={bibtexPreview?.filename}
        content={bibtexPreview?.content}
        onClose={() => setBibtexPreview(null)}
      />
    </div>
  );
}
