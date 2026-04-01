# Paperview

Paperview is a local-first research paper reader and research agent. Open local folders of PDFs, read and annotate papers, ask grounded questions with citations, search for papers online, and import promising PDFs back onto your own disk.

No account is required. The app still runs locally in the browser for reading and workspace storage, and can optionally use small Vercel Functions for OpenAI requests and remote PDF downloads to avoid browser CORS issues.

## What Paperview does

- Reads and renders PDFs with PDF.js
- Extracts text from scanned papers with OCR
- Answers questions with inline citations grounded in local PDFs
- Keeps multiple chat threads per paper
- Adds a separate Agent workspace for web research and paper discovery
- Imports found PDFs as real files into the selected local folder
- Mirrors chats and annotations into `.paperview.json` so a folder carries its history with it

## Features

- **PDF Reading**: Render and navigate research papers with PDF.js
- **AI Q&A with Citations**: Ask questions and get cited answers grounded in local paper text
- **Agent Workspace**: Search the web, compare against attached local papers, and keep separate workspace-level agent threads
- **Paper Discovery + Import**: Find papers online and save direct-PDF results back into the selected folder on disk
- **OCR Support**: Extract text from scanned or image-based PDFs via Tesseract.js
- **Annotations**: Highlight and annotate papers with page-level metadata
- **Chat Threads**: Maintain multiple independent conversation threads per paper
- **Folder Management**: Organize paper collections via the File System Access API
- **Cost Tracking**: Per-session token usage and cost estimates for OpenAI calls
- **Offline Support**: PWA with service worker caching for offline use

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite |
| Routing | React Router v7 |
| Local DB | Dexie (IndexedDB) |
| PDF Rendering | PDF.js (CDN) |
| OCR | Tesseract.js (CDN) |
| AI | OpenAI Responses API |
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
OPENAI_API_KEY=your_openai_api_key
VITE_OPENAI_API_KEY=
VITE_OPENAI_MODEL=gpt-5.4-mini
```

For local `npm run dev`, Vite does not serve the Vercel `api/` functions, so set `VITE_OPENAI_API_KEY` if you want to call OpenAI directly from the browser while developing. In deployed environments, prefer `OPENAI_API_KEY` so the backend proxy can keep OpenAI and remote PDF fetches server-side.

## Scripts

```bash
npm run dev
npm run build
npm run preview
```

## Project Structure

```text
src/
|- App.jsx
|- PaperviewApp.jsx
|- LandingPage.jsx
|- PdfViewer.jsx
|- InlineCitedAnswer.jsx
|- TextFallback.jsx
|- chatUtils.js
|- ragUtils.js
|- pdfUtils.js
|- openaiPricing.js
|- db.js
|- icons.jsx
|- styles.js
`- main.jsx
```

## Data Storage

Paperview stores state locally using IndexedDB and folder snapshots:

- **chats**: Per-paper conversation threads and message history
- **agentChats**: Workspace-level agent threads tied to a root folder
- **annotations**: Highlights and notes with page numbers and timestamps
- **folderHandles**: Persisted File System Access API handles for local folders
- **.paperview.json**: Folder snapshot containing chats, agent chats, and annotations

Imported PDFs are written as real files into the selected folder, or into an `Imported Papers` subfolder under the active root.

## Network Usage

Paperview is local-first, but it does make network requests for:

- OpenAI API inference and tool calls, either directly from the browser or through the optional backend proxy
- User-initiated web research through OpenAI web search
- User-initiated direct PDF downloads when importing papers from search results, preferably through the backend PDF proxy when deployed

## Contributing

1. Fork the repository and create a branch from `main`
2. Run `npm install` and `npm run dev`
3. Keep changes focused on a single concern
4. Test in a Chromium-based browser because File System Access requires Chrome or Edge
5. Open a pull request with a clear summary of what changed and why

### Guidelines

- Respect the local-first model: user data should stay on the user's machine
- PDF.js and Tesseract.js stay on CDNs rather than being bundled through npm
- `PaperviewApp.jsx` is large, so read surrounding context carefully before editing
- Prefer direct, readable code over unnecessary abstraction

## License

Paperview is licensed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE) for details.
