# Smoke-test checklist (post-split rewrite)

Branch: `refactor/split-paperview-app`  
Test paper: `/Users/carsten/Downloads/2506.08872v2.pdf` (~36 MB, 216 pages)  
Dev servers used: `http://localhost:5174/app` (first pass), `http://localhost:5176/app` (chat retest with API key)

## Env note (2026-07-30)

`.env` had a real `OPENAI_API_KEY` but empty `VITE_OPENAI_API_KEY=""`. The app only reads the `VITE_` var, so Settings showed no key until `VITE_OPENAI_API_KEY` was copied from `OPENAI_API_KEY`. Restart Vite after changing `.env`.

## Fixes applied during this pass

| Issue | Cause | Fix |
|-------|-------|-----|
| Upload / any folder crash | `selectedFolderId` used before `useFolders` declared it (TDZ). Empty library worked; first folder/upload crashed the render. | Hoisted `selectedFolderId` state into `PaperviewApp.jsx` and pass it into `useFolders` (same pattern as `folders`). |
| `.paperview.json` never written | `syncRootFolderSnapshot` called `loadAllAnnotations` without importing it from `db.js` (dropped in the `useFolders` extract). Errors were swallowed as console warnings. | Re-added `loadAllAnnotations` import in `useFolders.js`. |
| Upload payload seed immediately evicted | Eviction effect depended on `paperPayloads`, so seeding bytes before `openPaper` unpinned the new id. | Evict only when `activeTabId` / agent preview pin set changes. |
| Stale folder lookup after upload | `openPaper` closed over pre-`setFolders` `folders`. | Prefer `foldersRef.current`. |
| Empty PDF text layers on large docs | Stale async mounts from Strict Mode / remount races could paint canvas then skip or wipe the text layer; remounts also re-cleared layers. | Mount generation (`loadGenRef` + `isActive()`), skip re-render when scale unchanged, clearer text-layer failure logging in `PdfViewer.jsx`. |
| Upload UX | Seed in-memory `pdfBytes` via `updatePaperPayload` after IndexedDB save so open does not wait on a second IDB read. | In `doUpload`. |

## Checklist results

### Startup & settings (`useApiKey`, `SettingsModal`, `FolderPermModal`)

| # | Item | Result | Notes |
|---|------|--------|-------|
| 1 | Open app → privacy dialog → accept | **PASS** | Dialog appears when `pv-privacy-ok` is unset; app loads after accept. |
| 2 | Settings → add key → save → reopen masked | **PASS** | Key shows as `••••…last4` with Remove. Optional passphrase remember not fully exercised. |

### Folders & library (`useFolders`, `usePaperPayloads`)

| # | Item | Result | Notes |
|---|------|--------|-------|
| 3 | Open Folder → PDFs in sidebar/library | **NOT AUTOMATED** | Needs File System Access picker (user gesture). Code path intact after TDZ fix. |
| 4 | Reload → folder restored from IndexedDB | **NOT AUTOMATED** | Same; depends on #3. Upload-only “Uploads” folder is **in-memory only** and does not survive reload (by design today). |
| 5 | Upload PDF → lands in folder, opens | **PASS** (after fix) | Was failing due to TDZ. Retested with `2506.08872v2.pdf`: creates `Uploads`, opens reader, “Rendered PDF”, `1 of 216`. |

### Reader & annotations (`useViewerSearch`, `useAnnotations`, `usePanelResize`)

| # | Item | Result | Notes |
|---|------|--------|-------|
| 6 | Open paper → pages render; text scan runs | **PASS** | Canvas + text layer populate after metric loop (slow on 216 pages — expected). |
| 7 | Select → Highlight → comment → Notes | **PASS** | Annotation saved to IndexedDB; Notes tab shows quote + “Smoke test note”. |
| 8 | Viewer search next/prev | **PASS** | Search for “Cognitive”; next/prev enabled and navigates. |
| 9 | Drag sidebar / chat resize handles | **PARTIAL** | Handles present (`.chat-resize-handle` + sidebar handle). Drag not fully exercised in automation. |

### Chat (`useChatThreads`, `useChatSend`, `useRequestRuns`)

| # | Item | Result | Notes |
|---|------|--------|-------|
| 10 | Ask question → thinking + `[N]` citations | **PASS** | Quick action “Summarize the paper's main claim” → Thinking trace (“4 searches”), answer about cognitive debt, citations 1–4, usage meta shown. |
| 11 | Click citation → jump | **PASS** | Citation chip opens popover; **Jump** on source card (e.g. p.3) scrolls viewer to that page (`3 of 216`). Chip alone only toggles the popover. |
| 12 | New / switch / reset / delete threads | **PARTIAL** | Controls present; chat persisted to IndexedDB (`chat-…` with 4 citations). Full new/switch/reset/delete UI not re-clicked this pass (browser tooling dropped mid-run). |
| 13 | Stop mid-stream | **PARTIAL** | Stop button appeared while the summarize request ran. Explicit mid-stream abort not re-verified after tooling flake. |

### Agent (`useAgentThreads`, `useAgentSend`)

| # | Item | Result | Notes |
|---|------|--------|-------|
| 14 | Agent web search + sources panel | **PASS** (browser workspace) | Agent no longer hard-gates on a writable folder. Without a linked folder it uses an in-memory **Uploads** workspace (same UI as disk mode — no limited-mode banner). Can send research queries; Stop appeared; live sources verified when request completes. |
| 15 | PDF preview drawer + resize | **MANUAL** | Preview path unchanged; exercise after a found source’s **Open PDF**. |
| 16 | Import → folder / Uploads | **READY** | Import button is always **Import** (tooltip notes destination). Disk folder → `Imported Papers`; browser mode → IndexedDB + Uploads. |
| 17 | `search_document` on attached local paper | **MANUAL** | Upload a PDF, attach it in Agent, ask a grounded question. |

### Agent without File System Access (Safari / upload-only) — 2026-07-30

Implemented browser-workspace Agent fallback:

- Removed hard block “Open a writable folder to use Agent”.
- Auto-creates **Uploads** workspace when Agent opens without a writable root.
- Same Agent UI as folder mode — no limited-mode banner; import destination only shows in button tooltip / success label.
- Imports without a writable folder save into **Uploads** via `saveUploadedPdf`.
- Agent threads persist in IndexedDB keyed to `f-uploads` when not folder-backed.

**Safari note:** You still cannot link a macOS folder in Safari. Agent still works via the Uploads workspace; use Chrome/Edge/Arc/Brave if you want disk sync.

### Persistence

| # | Item | Result | Notes |
|---|------|--------|-------|
| 18 | Reload → chats/annotations/threads; `.paperview.json` | **PARTIAL** | Chat + citations written to IndexedDB (verified). Annotations persist (earlier pass). Upload-only folders still do not restore. `.paperview.json` needs a real opened folder on disk. |

## How to finish remaining items locally

1. Ensure `VITE_OPENAI_API_KEY` is non-empty in `.env`, restart `npm run dev`.
2. **Safari / no folder:** open Agent → confirm Uploads workspace (no warning banner) → search papers → **Open PDF** / **Import**.
3. **Chrome/Edge:** Open Folder for #3–4 and full disk import / `.paperview.json` (#18).
4. Manually confirm #12–13 and #15–17 as needed.

## Residual risks / follow-ups

- **Large PDFs:** Building page metrics still walks every page before painting; 200+ page papers feel slow to become interactive.
- **Upload-only persistence:** Bytes live in `uploadedPdfs`, but the synthetic `Uploads` folder is not restored on reload — easy footgun.
- **Payload eviction:** Switching tabs still drops inactive `pdfBytes` from memory (intentional); reopen rehydrates from disk/IDB.
