# Agent instructions — Paperview

Paperview is a browser-only React app (Vite) for reading research PDFs with AI. Local-first via File System Access API + IndexedDB (Dexie). No backend.

For product/architecture context see [CLAUDE.md](CLAUDE.md). For the PaperviewApp split history see [docs/refactor-paperview-app.md](docs/refactor-paperview-app.md).

## Composition root — do not re-monolith

[`src/PaperviewApp.jsx`](src/PaperviewApp.jsx) is the **composition root** (~1.9k lines after extraction). It may wire hooks, pass props, and hold thin event glue only.

**Do not** add multi-hundred-line handlers, prompts, API pipelines, or large JSX blocks to `PaperviewApp.jsx`.

If a change would grow `PaperviewApp.jsx` by more than ~50 lines of real logic (not imports/prop plumbing), extract into a new hook/component/util in the **same** change.

Prefer **new files** over growing already-large modules (`useAgentSend.jsx`, `useFolders.js`, `useChatSend.js`). Soft target for new modules: one concern, preferably under ~400 lines; split earlier if a file owns two concerns.

## Folder map

| Path | Put here |
|------|----------|
| `src/hooks/` | Stateful workflows (`useExplainSelection`, `usePaperMeta`, …) |
| `src/components/` | UI (toolbars, popovers, library search, modals, views) |
| `src/*.js` | Pure utils (`biblioUtils.js`, `libraryIndex.js`, `ragUtils.js`, …) |
| `src/db.js` | Dexie schema + small CRUD helpers |
| Tests | Colocated `*.test.js` next to the module |

## Styles

Do not dump large feature CSS into unbounded growth of `styles.js`. Prefer a dedicated style block/file per non-trivial new surface, or a clearly scoped section.

## Extract, don’t append

- New AI paths → new hooks (do not bolt onto `useChatSend` / `useAgentSend` unless the change is a few lines of shared plumbing).
- New library/biblio/index logic → pure utils + thin hooks.
- Selection / explain / library search UI → components; composition root only mounts them.

## Cursor Cloud specific instructions

Repo-managed Cloud Agent config lives in [`.cursor/environment.json`](.cursor/environment.json) (`npm ci` + Vite on port 5173). Saving that environment in the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents#environments) is what enables Desktop / Agents Window — AGENTS.md notes alone are not enough.

Single product: Vite React SPA + optional local API middleware (no separate backend process).

### Run / test / build

- Standard scripts are in [package.json](package.json) / [README.md](README.md): `npm run dev`, `npm test`, `npm run build`.
- Native macOS scripts are `npm run dev:desktop` and `npm run build:desktop`; they require Rust 1.88+, Xcode Command Line Tools, and macOS for app/DMG bundling.
- There is **no ESLint/prettier lint script** in this repo.
- Dev server defaults to `http://localhost:5173/`; the reader lives at `/app`.
- Vite mounts `api/openai-response` and `api/fetch-pdf` as middleware during `npm run dev` (see [vite.config.js](vite.config.js)). Without `OPENAI_API_KEY` in `.env.local`, `/api/openai-response` returns 401 — expected. PDF reading/folder flows work without a key.

### Gotchas for cloud / automated browser testing

- **Use Open Folder, not Ctrl+O / direct file open.** Opening a `.pdf` via the OS/Chrome file picker often launches Chrome’s native PDF viewer in a new tab. In-app loading uses the File System Access API: click **Open Folder** (or **Open folder** on the empty library), select a directory of PDFs, then open a paper from the sidebar.
- First visit shows a privacy consent dialog (`I understand — open the app`). Accept it before the library UI appears.
- `/app` gates narrow viewports below 900px (`DesktopGate`); use a desktop-sized window or click **Continue anyway**.
- Folder access needs Chromium (Chrome/Edge). Upload-only / IndexedDB paths exist when `showDirectoryPicker` is unavailable, but prefer Open Folder for end-to-end folder workflows.
- Copy `.env.example` → `.env.local` for local config. Prefer server-side `OPENAI_API_KEY` over `VITE_OPENAI_API_KEY` (the latter is exposed to the client bundle). Restart Vite after env changes.
