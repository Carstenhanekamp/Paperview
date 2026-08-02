import React from 'react';
import { IClose, IFile, IUpload } from '../icons';

export default function UploadModal({
  folders,
  upFolder,
  setUpFolder,
  upStatus,
  upStatusText,
  pendingFile,
  dragOver,
  setDragOver,
  fileRef,
  fileSelected,
  doUpload,
  closeModal,
}) {
  return (
    <div className="ov" onClick={closeModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-hd">
          <span className="m-title">Upload PDF</span>
          <button className="m-x" onClick={closeModal}><IClose /></button>
        </div>

        {upStatus === "parsing" ? (
          <div style={{ textAlign: "center", padding: "36px 24px" }}>
            <div className="typing" style={{ justifyContent: "center" }}><span /><span /><span /></div>
            <p style={{ fontSize: 13, color: "#444", marginTop: 12 }}>{upStatusText || "Parsing PDF..."}</p>
          </div>
        ) : upStatus === "done" ? (
          <div style={{ textAlign: "center", padding: "36px 24px" }}>
            <div style={{ fontSize: 32, color: "#111" }}>✓</div>
            <p style={{ color: "#111", fontWeight: 600 }}>Uploaded successfully</p>
          </div>
        ) : (
          <>
            <div
              className={`dz ${dragOver ? "drag" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); fileSelected(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
            >
              <div style={{ color: "#666", display: "flex", justifyContent: "center", marginBottom: 10 }}>
                {pendingFile ? <IFile size={28} /> : <IUpload size={28} />}
              </div>
              {pendingFile ? (
                <>
                  <h3 className="dz-filename" title={pendingFile.name}>{pendingFile.name}</h3>
                  <p>{(pendingFile.size / 1024 / 1024).toFixed(1)} MB · click to change</p>
                </>
              ) : (
                <>
                  <h3>Drop PDF here or browse</h3>
                  <p>All pages rendered as real PDF</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => fileSelected(e.target.files[0])} />
            </div>

            {upStatus === "error" && <p style={{ color: "#b91c1c", fontSize: 12, marginTop: 8, textAlign: "center" }}>Please select a valid PDF file.</p>}

            <div className="fs">
              <label>Add to folder</label>
              {folders.length === 0 ? (
                <div style={{ fontSize: 12, color: '#8a867c', padding: '8px 10px', background: '#fff', borderRadius: 7, border: '1px solid #ececec' }}>
                  Will be added to a new <strong>Uploads</strong> folder
                </div>
              ) : (
                <select value={upFolder} onChange={(e) => setUpFolder(e.target.value)}>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="m-acts">
              <button className="btn-sec" onClick={closeModal}>Cancel</button>
              <button className="btn-pri" onClick={doUpload} disabled={!pendingFile}>Upload & Render</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
