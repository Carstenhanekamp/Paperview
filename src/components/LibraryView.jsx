import React, { useMemo, useState } from 'react';
import { IFolder, IPlus, IUpload, IChevronDown, IRight, IFolderOpen, ITrash, IFile, ICopy } from '../icons';
import LibrarySearch from './LibrarySearch';
import LibraryPaperDetail from './LibraryPaperDetail';
import BibtexPreviewModal from './BibtexPreviewModal';

export default function LibraryView({
  setShowFolderPermModal,
  startNewFolder,
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
  toggleFolder,
  openAllPapersInFolder,
  openTabs,
  setUpFolder,
  deleteFolder,
  openPaper,
  deletePaper,
  getTitle,
  getAuthorsLine,
  getMeta,
  exportFolderBibtex,
  exportLibraryBibtex,
  extractPaperMetaWithAI,
  librarySearch,
  onLibrarySearch,
  searchResults,
}) {
  const [sortKey, setSortKey] = useState('title');
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [bibtexPreview, setBibtexPreview] = useState(null);

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

  const selected = useMemo(() => {
    if (!selectedPaperId) return null;
    for (const folder of sortedFolders) {
      const paper = folder.papers.find((p) => p.id === selectedPaperId);
      if (paper) return { paper, folder };
    }
    return null;
  }, [selectedPaperId, sortedFolders]);

  const openBibtexPreview = ({ title, filename, content }) => {
    setBibtexPreview({ title, filename, content });
  };

  return (
    <div className={`library-view ${selected ? 'library-view-with-detail' : ''}`}>
      <div className="library-main">
        <div className="library-head">
          <div className="library-title">Library</div>
          <div className="library-actions">
            {typeof window.showDirectoryPicker === 'function' && (
              <button className="lib-btn dark" onClick={() => setShowFolderPermModal(true)}><IFolder size={12} /> Open Folder</button>
            )}
            <button className="lib-btn" onClick={startNewFolder}><IPlus size={12} /> New Folder</button>
            <button className="lib-btn dark" onClick={() => setShowUpload(true)}><IUpload size={12} /> Upload PDF</button>
            <button
              className="lib-btn"
              type="button"
              title="Preview library BibTeX"
              onClick={() =>
                openBibtexPreview({
                  title: 'Library BibTeX',
                  filename: 'paperview-library.bib',
                  content: exportLibraryBibtex?.() || '',
                })
              }
            >
              <ICopy size={12} /> BibTeX
            </button>
          </div>
        </div>

        {typeof onLibrarySearch === 'function' && (
          <LibrarySearch
            query={librarySearch}
            onQueryChange={onLibrarySearch}
            results={searchResults}
            getTitle={getTitle}
            onOpenPaper={(paper, folderId) => {
              setSelectedPaperId(paper?.id || null);
              openPaper?.(paper, folderId);
            }}
          />
        )}

        {newFolder && (
          <div style={{ maxWidth: 420, marginBottom: 12 }}>
            <input
              autoFocus
              className="nf-input"
              value={nfName}
              onChange={(e) => {
                setNfName(e.target.value);
                if (folderError) setFolderError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFolder();
                if (e.key === "Escape") cancelNewFolder();
              }}
              placeholder="Folder name…"
            />
            {folderError && <div className="nf-error">{folderError}</div>}
            <div className="nf-ctrl">
              <button className="lib-btn dark" onClick={createFolder}><IPlus size={12} /> Create</button>
              <button className="lib-btn" onClick={cancelNewFolder}>Cancel</button>
            </div>
          </div>
        )}

        <div className="library-sort">
          <span className="library-sort-label">Sort papers</span>
          <select className="library-sort-select" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="title">Title</option>
            <option value="authors">Authors</option>
            <option value="year">Year</option>
          </select>
        </div>

        <div className="library-db library-db-biblio">
          <div className="db-head">
            <div className="db-h">Title</div>
            <div className="db-h">Authors</div>
            <div className="db-h">Year</div>
            <div className="db-h">DOI</div>
            <div className="db-h">Actions</div>
          </div>

          {sortedFolders.map((folder) => (
            <React.Fragment key={folder.id}>
              <div
                className={`db-row folder ${selectedFolderId === folder.id ? "selected" : ""}`}
                onClick={() => openFolderTabs(folder.id, { forceReader: false })}
                title="Select this folder"
              >
                <div className="db-cell">
                  <button
                    className="db-toggle"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolder(folder.id);
                    }}
                    title={folder.expanded ? "Collapse" : "Expand"}
                  >
                    {folder.expanded ? <IChevronDown size={12} /> : <IRight size={12} />}
                  </button>
                  {folder.expanded ? <IFolderOpen size={14} /> : <IFolder size={14} />}
                  <span className="db-title">{folder.name}</span>
                  <span className="db-meta" style={{ marginLeft: 8 }}>{folder.papers.length} files</span>
                </div>
                <div className="db-cell"><span className="db-chip">Folder</span></div>
                <div className="db-cell">—</div>
                <div className="db-cell">—</div>
                <div className="db-cell">
                  <div className="db-actions">
                    <button
                      className="db-open"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAllPapersInFolder(folder.id, { forceReader: true });
                      }}
                    >
                      Open all
                    </button>
                    <button
                      className="lib-icon-btn"
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
              </div>

              {folder.expanded && (
                <div className="db-folder-files">
                  {folder.papers.length === 0 ? (
                    <div className="db-file-row empty">
                      <div className="db-cell db-file-indent" style={{ gridColumn: "1 / span 5", gap: 10 }}>
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
                          <div className="db-cell"><span className="db-meta" title={authors}>{authors}</span></div>
                          <div className="db-cell"><span className="db-meta">{year}</span></div>
                          <div className="db-cell"><span className="db-meta" title={doi}>{doi}</span></div>
                          <div className="db-cell">
                            <div className="db-actions">
                              <button
                                className="db-open"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPaper(paper, folder.id);
                                }}
                              >
                                Open
                              </button>
                              <button
                                className="lib-icon-btn"
                                title="Delete file"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletePaper(folder.id, paper.id);
                                  if (selectedPaperId === paper.id) setSelectedPaperId(null);
                                }}
                              >
                                <ITrash size={13} />
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
          ))}
        </div>
      </div>

      {selected && (
        <LibraryPaperDetail
          paper={selected.paper}
          folder={selected.folder}
          meta={getMeta?.(selected.paper.id)}
          extractPaperMetaWithAI={extractPaperMetaWithAI}
          onClose={() => setSelectedPaperId(null)}
          onOpen={openPaper}
          onPreviewBibtex={openBibtexPreview}
        />
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
