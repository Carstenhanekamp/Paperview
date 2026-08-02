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
