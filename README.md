# Paperview

An AI-powered research paper reader with source-backed answers. Upload PDFs, ask questions, and get answers grounded in the paper's content — all stored locally in your browser.

## Features

- **PDF Reading** — Render and navigate research papers with PDF.js
- **AI Q&A** — Ask questions about papers and get answers with source citations, powered by OpenAI
- **OCR Support** — Extract text from scanned/image-based PDFs via Tesseract.js
- **Annotations** — Highlight and annotate papers with page-level metadata
- **Chat Threads** — Maintain multiple conversation threads per paper
- **Folder Management** — Organize papers using the File System Access API
- **Offline Support** — PWA with service worker caching for offline use

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite |
| Routing | React Router v7 |
| Local DB | Dexie (IndexedDB) |
| PDF Rendering | PDF.js (CDN) |
| OCR | Tesseract.js (CDN) |
| AI | OpenAI API (configurable model) |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- An OpenAI API key

### Setup

```bash
npm install
cp .env.example .env.local
# Add your OpenAI API key to .env.local
npm run dev
```

### Environment Variables

```env
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_OPENAI_MODEL=gpt-4o-mini   # optional, defaults to gpt-4o-mini
```

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Project Structure

```
src/
├── App.jsx         # Core application — PDF viewer, chat, annotations, OCR
├── LandingPage.jsx # Landing/onboarding page
├── db.js           # Dexie schema (chats, folderHandles, annotations)
└── main.jsx        # React entry point
```

## Data Storage

All data is stored client-side using IndexedDB (via Dexie):
- **chats** — Conversation threads per paper
- **annotations** — Highlights and notes with page numbers
- **folderHandles** — Persisted file system folder access handles

No data is sent to any server other than the OpenAI API for inference.
