# CLAUDE.md

This file provides context for Claude Code when working in this repository.

**Agent coding standards:** follow [AGENTS.md](AGENTS.md) (composition root, small files, extract don’t append).

## Project Overview

**Paperview** is a single-page React application for reading and interacting with research papers using AI. It runs entirely in the browser — no backend, no database server. Papers are loaded from the local file system via the File System Access API.

## Key Architecture Decisions

- **No backend** — All logic lives in the frontend. OpenAI is called directly from the browser using an API key stored in `.env.local`.
- **IndexedDB via Dexie** — Chats, annotations, folder handles, paper text cache, and related stores are persisted locally in the browser.
- **PDF.js and Tesseract.js loaded from CDN** — Not bundled via npm; loaded via script tags in `index.html`.
- **Composition root** — `PaperviewApp.jsx` (~1.9k lines) wires hooks and views. Do not re-monolith it; put new logic in `src/hooks/`, `src/components/`, or pure `src/*.js` utils. See [AGENTS.md](AGENTS.md) and [docs/refactor-paperview-app.md](docs/refactor-paperview-app.md).

## Environment Variables

```env
VITE_OPENAI_API_KEY   # Required — user-supplied OpenAI key
VITE_OPENAI_MODEL     # Optional — defaults to gpt-4o-mini
```

The `.env.local` file is gitignored. `.env.example` is the template.

## Database Schema (db.js)

Dexie stores (see `db.js` for current version):
- `chats` — indexed by `id`, `paperId`, `updatedAt`
- `folderHandles` — indexed by `id`
- `annotations` — indexed by `id`, `paperId`, `pageNum`, `createdAt`
- Plus text/OCR caches and related stores as schema evolves (`paperTextCache`, `paperMeta`, `paperChunks`, …)

## Development

```bash
npm run dev      # Vite dev server
npm run build    # Production build (outputs to dist/)
npm run preview  # Serve dist/ locally
```
