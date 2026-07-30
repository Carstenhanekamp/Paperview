import React from 'react';
import { IFolder, IPlus, IUpload, IChevronDown, IRight, IFolderOpen, ITrash, IFile } from '../icons';

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
}) {
  return (
    <div className="library-view">
      <div className="library-head">
        <div className="library-title">Library</div>
        <div className="library-actions">
          {typeof window.showDirectoryPicker === 'function' && (
            <button className="lib-btn dark" onClick={() => setShowFolderPermModal(true)}><IFolder size={12} /> Open Folder</button>
          )}
          <button className="lib-btn" onClick={startNewFolder}><IPlus size={12} /> New Folder</button>
          <button className="lib-btn dark" onClick={() => setShowUpload(true)}><IUpload size={12} /> Upload PDF</button>
        </div>
      </div>

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

      <div className="library-db">
        <div className="db-head">
          <div className="db-h">Name</div>
          <div className="db-h">Type</div>
          <div className="db-h">Files</div>
          <div className="db-h">Open Tabs</div>
          <div className="db-h">Actions</div>
        </div>

        {folders.map((folder) => (
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
              </div>
              <div className="db-cell"><span className="db-chip">Folder</span></div>
              <div className="db-cell">{folder.papers.length}</div>
              <div className="db-cell">{openTabs.filter((tab) => folder.papers.some((p) => p.id === tab.id)).length}</div>
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
                  folder.papers.map((paper) => (
                    <div className="db-file-row" key={paper.id}>
                      <div className="db-cell db-file-indent">
                        <IFile size={12} />
                        <span className="db-file-name">{paper.name}</span>
                      </div>
                      <div className="db-cell"><span className="db-chip">PDF</span></div>
                      <div className="db-cell">{paper.pages ?? "-"}</div>
                      <div className="db-cell"><span className="db-meta">{openTabs.some((t) => t.id === paper.id) ? "Open" : "-"}</span></div>
                      <div className="db-cell">
                        <div className="db-actions">
                          <button className="db-open" onClick={() => openPaper(paper, folder.id)}>Open</button>
                          <button className="lib-icon-btn" title="Delete file" onClick={() => deletePaper(folder.id, paper.id)}><ITrash size={13} /></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
