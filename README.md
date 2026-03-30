# Paperview

An AI-powered research paper reader with source-backed answers. Upload PDFs, ask questions, and get cited answers grounded in the paper's content — all stored locally in your browser. No backend, no account required.

## What is Paperview?

Paperview is a single-page web application that lets you read, annotate, and have AI-powered conversations with research papers. It runs entirely in the browser — your papers, chats, and annotations never leave your machine (except for inference calls to the OpenAI API). It uses the File System Access API to read PDFs directly from your local file system.

Key highlights:
- All data is stored locally in IndexedDB — no server, no database
- AI answers are cited with source references so you can verify every claim
- Works with scanned/image-based PDFs via OCR
- Supports multiple chat threads per paper and persistent annotations

## Features

- **PDF Reading** — Render and navigate research papers with PDF.js
- **AI Q&A with Citations** — Ask questions and get answers with inline source citations, powered by OpenAI
- **OCR Support** — Extract text from scanned or image-based PDFs via Tesseract.js
- **Annotations** — Highlight and annotate papers with page-level metadata
- **Chat Threads** — Maintain multiple independent conversation threads per paper
- **Folder Management** — Organize and persist access to local paper collections via the File System Access API
- **Cost Tracking** — Per-session token usage and cost estimates for OpenAI calls
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
git clone https://github.com/Carstenhanekamp/Paperview.git
cd Paperview
npm install
cp .env.example .env.local
# Add your OpenAI API key to .env.local
npm run dev
```

### Environment Variables

```env
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_OPENAI_MODEL=gpt-5.4-mini   # optional, defaults to gpt-5.4
```

## Scripts

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

## Project Structure

```
src/
├── App.jsx               # Root component and routing setup
├── PaperviewApp.jsx      # Core application — layout, state, PDF viewer integration
├── LandingPage.jsx       # Landing and onboarding page
├── PdfViewer.jsx         # PDF rendering component (PDF.js wrapper)
├── InlineCitedAnswer.jsx # Renders AI answers with inline source citations
├── TextFallback.jsx      # Fallback text display for non-renderable PDFs
├── chatUtils.js          # Chat message construction and conversation helpers
├── ragUtils.js           # Retrieval-augmented generation logic (chunking, context assembly)
├── pdfUtils.js           # PDF text extraction and page utilities
├── openaiPricing.js      # Token cost calculation per model
├── db.js                 # Dexie schema (chats, folderHandles, annotations)
├── icons.jsx             # SVG icon components
├── styles.js             # Shared styles and theme tokens
└── main.jsx              # React entry point
```

## Data Storage

All data is stored client-side using IndexedDB (via Dexie):
- **chats** — Conversation threads and message history per paper
- **annotations** — Highlights and notes with page numbers and timestamps
- **folderHandles** — Persisted File System Access API handles for local folders

No data is sent to any server other than the OpenAI API for inference.

## Contributing

Contributions are welcome. Here is how to get started:

### Reporting Issues

Open an issue on GitHub with:
- A clear description of the bug or feature request
- Steps to reproduce (for bugs)
- Browser and OS version

### Making Changes

1. Fork the repository and create a branch from `main`
2. Run `npm install` and `npm run dev` to confirm everything works locally
3. Make your changes — keep them focused on a single concern
4. Test in a Chromium-based browser (File System Access API requires Chrome/Edge)
5. Open a pull request with a clear description of what changed and why

### Guidelines

- **Respect local-first principles** — User data should stay on their machine.
- **PDF.js and Tesseract.js stay on CDN** — They are loaded via script tags in `index.html`, not bundled via npm, to keep the build size manageable.
- **App.jsx / PaperviewApp.jsx are large files** — Read the surrounding context carefully before editing; changes can have wide blast radius.
- **No unnecessary abstractions** — Prefer clear, direct code over premature generalization.

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE) for details.

The AGPL-3.0 is a copyleft license. The key distinction from the regular GPL is that it also triggers share-alike requirements when you run the software as a network service — not just when you distribute it.

**Allowed:**
- Use, modify, and distribute this software freely
- Use it privately or internally without restrictions
- Build on it for personal or commercial projects

**Required (if you distribute or host it publicly):**
- Disclose your source code, including any modifications
- License your derivative work under AGPL-3.0 as well
- State what changes you made

**Not allowed:**
- Distributing or hosting a modified version without releasing the source
- Sublicensing under a more restrictive or proprietary license
