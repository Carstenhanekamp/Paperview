import React from 'react';
import { IFolder, IPlus, IUpload } from '../icons';
import { useScopedStyles } from '../hooks/useScopedStyles';

const EMPTY_CSS = `
.pv-empty {
  --pv-ease: cubic-bezier(0.32, 0.72, 0, 1);
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 28px 48px;
  background:
    radial-gradient(70% 50% at 12% 8%, rgba(85, 105, 127, 0.09), transparent 58%),
    radial-gradient(55% 40% at 92% 88%, rgba(20, 22, 28, 0.04), transparent 60%),
    var(--desk);
  color: var(--ink);
  overflow: auto;
  position: relative;
}
.pv-empty--surface {
  border-radius: 11px;
  background:
    radial-gradient(70% 50% at 12% 8%, rgba(85, 105, 127, 0.07), transparent 58%),
    var(--surface);
  box-shadow: var(--sh-card);
}
.pv-empty-card {
  width: min(440px, 100%);
  text-align: left;
  animation: pv-empty-in 0.65s var(--pv-ease) both;
}
.pv-empty-icon {
  width: 40px;
  height: 40px;
  margin: 0 0 22px;
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-empty-title {
  margin: 0 0 12px;
  font-family: var(--sans);
  font-size: clamp(22px, 3.2vw, 28px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
  color: var(--ink);
  max-width: 16ch;
}
.pv-empty-copy {
  margin: 0 0 26px;
  font-family: var(--serif);
  font-size: 15.5px;
  line-height: 1.55;
  color: var(--text-2);
  max-width: 38ch;
}
.pv-empty-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 28px;
}
.pv-empty-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background 0.35s var(--pv-ease), transform 0.35s var(--pv-ease);
}
.pv-empty-primary:hover { background: var(--accent-hover); }
.pv-empty-primary:active { transform: scale(0.985); }
.pv-empty-secondary-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.pv-empty-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: rgba(20, 22, 28, 0.055);
  color: var(--ink-3);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background 0.3s var(--pv-ease), color 0.3s var(--pv-ease);
}
.pv-empty-secondary:hover {
  background: rgba(20, 22, 28, 0.09);
  color: var(--ink);
}
.pv-empty-checklist {
  border-radius: 14px;
  background: rgba(20, 22, 28, 0.04);
  box-shadow: inset 0 0 0 0.5px rgba(20, 22, 28, 0.08);
  padding: 14px 14px 12px;
}
.pv-empty-checklist-label {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-4);
}
.pv-empty-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 8px 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: default;
}
.pv-empty-check[data-action="true"] {
  cursor: pointer;
}
.pv-empty-check[data-action="true"]:hover {
  background: rgba(20, 22, 28, 0.04);
}
.pv-empty-check + .pv-empty-check {
  margin-top: 2px;
}
.pv-empty-check-mark {
  width: 18px;
  height: 18px;
  margin-top: 1px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}
.pv-empty-check-mark.on {
  background: var(--accent);
  color: #fff;
}
.pv-empty-check-mark.off {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px rgba(20, 22, 28, 0.18);
  color: transparent;
}
.pv-empty-check-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
}
.pv-empty-check-text {
  font-size: 13px;
  font-weight: 550;
  color: var(--ink-3);
  line-height: 1.35;
}
.pv-empty-check[data-done="true"] .pv-empty-check-text {
  color: var(--ink);
}
.pv-empty-check-hint {
  font-size: 12px;
  color: var(--text-4);
  line-height: 1.3;
}
@keyframes pv-empty-in {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 520px) {
  .pv-empty-secondary-row { grid-template-columns: 1fr; }
  .pv-empty-title { max-width: none; }
}
@media (prefers-reduced-motion: reduce) {
  .pv-empty-card { animation: none; }
  .pv-empty-primary { transition: none; }
}
`;

function CheckMark({ done }) {
  return (
    <span className={`pv-empty-check-mark ${done ? 'on' : 'off'}`} aria-hidden="true">
      {done ? (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

function maskKeyTip(apiKey) {
  if (!apiKey || apiKey.length < 4) return null;
  return `··${apiKey.slice(-4)}`;
}

function folderPermissionHint() {
  if (typeof navigator === 'undefined') return 'Your browser will ask once.';
  const ua = navigator.userAgent || '';
  if (/Mac|iPhone|iPad|iPod/i.test(ua) || navigator.platform?.startsWith?.('Mac')) {
    return 'macOS will ask once.';
  }
  return 'Your browser will ask once.';
}

/**
 * First-open empty state — open a folder before reading or browsing the library.
 */
export default function EmptyReaderState({
  variant = 'reader',
  sidebarOpen = true,
  canPickFolder = true,
  hasFolder = false,
  apiKey = '',
  hasCredit = false,
  onOpenSidebar,
  onOpenFolder,
  onNewFolder,
  onUpload,
  onOpenSettings,
}) {
  useScopedStyles('pv-empty-reader', EMPTY_CSS);

  const keyReady = Boolean(apiKey) || Boolean(hasCredit);
  const keyTip = maskKeyTip(apiKey);
  const keyLabel = apiKey
    ? `Your API key is set${keyTip ? ` · ${keyTip}` : ''}`
    : hasCredit
      ? 'Tryout credit is ready'
      : 'Add an API key (or tryout credit)';

  const title = hasFolder
    ? (variant === 'library' ? 'This library has no papers yet.' : 'Open a paper to start reading.')
    : 'Choose the folder to research into.';

  const copy = hasFolder
    ? (variant === 'library'
      ? 'Open another folder, create one, or upload a PDF to start building this workspace. Chats and notes stay with the papers on disk.'
      : 'Pick a PDF from the library sidebar, or add another folder. Chats and notes stay with the papers on disk.')
    : 'Paperview reads the PDFs already in that folder and writes new ones back into it. The plan, the notes and the report are saved there too, so a project travels with the folder rather than an account.';

  const openLibraryCue = () => {
    if (!sidebarOpen) onOpenSidebar?.();
  };

  return (
    <div className={`pv-empty${variant === 'library' ? ' pv-empty--surface' : ''}`}>
      {variant === 'reader' && !sidebarOpen && (
        <button
          type="button"
          className="topbar-btn"
          onClick={onOpenSidebar}
          style={{ position: 'absolute', top: 18, left: 18 }}
        >
          Library
        </button>
      )}
      <div className="pv-empty-card">
        <div className="pv-empty-icon" aria-hidden="true">
          <IFolder size={28} sw={1.5} />
        </div>
        <h2 className="pv-empty-title">{title}</h2>
        <p className="pv-empty-copy">{copy}</p>

        <div className="pv-empty-actions">
          {canPickFolder ? (
            <button type="button" className="pv-empty-primary" onClick={onOpenFolder}>
              <IFolder size={15} sw={1.75} />
              {hasFolder ? 'Open another folder…' : 'Open a folder…'}
            </button>
          ) : (
            <button type="button" className="pv-empty-primary" onClick={onUpload}>
              <IUpload size={15} />
              Upload a PDF…
            </button>
          )}
          <div className="pv-empty-secondary-row">
            <button
              type="button"
              className="pv-empty-secondary"
              onClick={() => {
                openLibraryCue();
                onNewFolder?.();
              }}
            >
              <IPlus size={14} />
              New folder
            </button>
            <button type="button" className="pv-empty-secondary" onClick={onUpload}>
              <IUpload size={14} />
              Upload a PDF instead
            </button>
          </div>
        </div>

        <div className="pv-empty-checklist" aria-label="Before the first run">
          <div className="pv-empty-checklist-label">Before the first run</div>
          <button
            type="button"
            className="pv-empty-check"
            data-done={keyReady ? 'true' : 'false'}
            data-action={keyReady ? 'false' : 'true'}
            onClick={keyReady ? undefined : onOpenSettings}
          >
            <CheckMark done={keyReady} />
            <span className="pv-empty-check-body">
              <span className="pv-empty-check-text">{keyLabel}</span>
              {!keyReady ? <span className="pv-empty-check-hint">Opens settings</span> : null}
            </span>
          </button>
          <button
            type="button"
            className="pv-empty-check"
            data-done={hasFolder ? 'true' : 'false'}
            data-action={hasFolder || !canPickFolder ? 'false' : 'true'}
            onClick={hasFolder || !canPickFolder ? undefined : onOpenFolder}
          >
            <CheckMark done={hasFolder} />
            <span className="pv-empty-check-body">
              <span className="pv-empty-check-text">
                {hasFolder
                  ? 'A folder, with read and write access.'
                  : 'A folder, granted read and write access.'}
              </span>
              {!hasFolder && canPickFolder ? (
                <span className="pv-empty-check-hint">{folderPermissionHint()}</span>
              ) : null}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
