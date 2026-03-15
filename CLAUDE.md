# CLAUDE.md

This file provides context for Claude Code when working in this repository.

## Project Overview

**Paperview** is a single-page React application for reading and interacting with research papers using AI. It runs entirely in the browser — no backend, no database server. Papers are loaded from the local file system via the File System Access API.

## Key Architecture Decisions

- **No backend** — All logic lives in the frontend. OpenAI is called directly from the browser using an API key stored in `.env.local`.
- **IndexedDB via Dexie** — Chats, annotations, and folder handles are persisted locally in the browser.
- **PDF.js and Tesseract.js loaded from CDN** — Not bundled via npm; loaded via script tags in `index.html`.
- **App.jsx is large** — The main application component is ~5000 lines. Be careful with edits; understand the surrounding context before modifying.

## Environment Variables

```env
VITE_OPENAI_API_KEY   # Required — user-supplied OpenAI key
VITE_OPENAI_MODEL     # Optional — defaults to gpt-4o-mini
```

The `.env.local` file is gitignored. `.env.example` is the template.

## Database Schema (db.js)

Three Dexie stores:
- `chats` — indexed by `id`, `paperId`, `updatedAt`
- `folderHandles` — indexed by `id`
- `annotations` — indexed by `id`, `paperId`, `pageNum`, `createdAt`

## Development

```bash
npm run dev      # Vite dev server
npm run build    # Production build (outputs to dist/)
npm run preview  # Serve dist/ locally
```
