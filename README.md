# Paperview

Paperview is a local-first research paper reader and research agent. Open local folders of PDFs, read and annotate papers, ask grounded questions with citations, search for papers online, and import promising PDFs back onto your own disk.

No Paperview account is required. The app runs locally in the browser for reading and workspace storage, and can optionally use small Vercel-compatible API functions for OpenAI requests and remote PDF downloads to avoid browser CORS issues.

## Try Paperview

Use the hosted app if you do not want to self-host:

**[View Paperview](https://paperview.carstenhanekamp.nl/)**

The hosted version runs on Vercel's free tier, so availability and usage limits may vary.
The hosted app does not include a shared OpenAI API key. Reading, folder storage, and local workspace features run in the browser; AI features require your own OpenAI API key.
Keys entered in Settings are kept in memory by default. If you choose to remember a key on a device, Paperview stores an encrypted copy in browser storage using a passphrase that is never stored.

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

- Node.js 22.13+
- npm
- Chrome/Edge for web folder access, or macOS 12+ for the native app
- Rust 1.88+ and Xcode Command Line Tools when building the macOS app
- An OpenAI API key for AI Q&A, web research, and agent features

### Setup

```bash
git clone https://github.com/Carstenhanekamp/Paperview.git
cd Paperview
npm install
cp .env.example .env.local
# Optional: add OPENAI_API_KEY to .env.local for the local backend proxy
npm run dev
```

Then open the local Vite URL shown in your terminal.

### Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key
VITE_OPENAI_API_KEY=
VITE_OPENAI_MODEL=gpt-5.4-mini
VITE_OPENAI_MODELS=gpt-5.4-nano,gpt-5.4-mini,gpt-5.4
VITE_PAPERVIEW_API_BASE_URL=https://your-paperview-deployment.example
```

Use `OPENAI_API_KEY` for local development and deployed environments when you want requests to go through the backend proxy. The Vite dev server mounts the local API middleware from `api/`, so OpenAI requests can stay server-side during `npm run dev`.

`VITE_OPENAI_API_KEY` is only a browser-side development escape hatch. Values prefixed with `VITE_` are exposed to the client bundle, so do not use it for shared deployments or committed examples.

`VITE_OPENAI_MODEL` sets the default model. `VITE_OPENAI_MODELS` controls the comma-separated list shown in model pickers.

`VITE_PAPERVIEW_API_BASE_URL` is required in distributable desktop builds that use hosted wallet credit or the hosted PDF proxy. BYOK OpenAI requests and direct PDF downloads use Tauri's native HTTPS client.

## Scripts

```bash
npm run dev
npm run dev:desktop
npm test
npm run build
npm run build:desktop
npm run preview
```

- `npm run dev`: start the Vite app with local API middleware
- `npm run dev:desktop`: start the Vite app inside the Tauri development shell
- `npm test`: run the Vitest suite
- `npm run build`: create a production build
- `npm run build:desktop`: create the native app and `.dmg` on macOS
- `npm run preview`: preview the production build locally

### macOS desktop development

The native target shares the React UI with the web app. Native folder selection, file I/O, HTTPS, external links, deep links, and Keychain access are provided through Tauri 2.

```bash
cp .env.example .env.local
npm ci
npm run dev:desktop
```

For Supabase email sign-in, add `paperview://auth/callback` to the project's allowed redirect URLs. Unsigned local bundles can be built with:

```bash
npm run tauri build -- --target universal-apple-darwin --bundles app,dmg --no-sign
```

Signed release builds use [`.github/workflows/tauri-macos.yml`](.github/workflows/tauri-macos.yml). Configure repository variables `PAPERVIEW_API_BASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`, plus Apple secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, and `APPLE_API_KEY_CONTENT`.

## Project Structure

```text
src/
|- __tests are colocated as *.test.js files
|- App.jsx
|- DesktopGate.jsx
|- PaperviewApp.jsx
|- LandingPage.jsx
|- PdfViewer.jsx
|- InlineCitedAnswer.jsx
|- TextFallback.jsx
|- chatUtils.js
|- ragUtils.js
|- pdfUtils.js
|- pdfViewerUtils.js
|- paperPayloadUtils.js
|- openaiPricing.js
|- db.js
|- icons.jsx
|- styles.js
`- main.jsx

api/
|- openai-response.js
`- fetch-pdf.js

src/platform/
|- fs/
|- deepLinks.js
|- http.js
`- secrets.js

src-tauri/
|- capabilities/
|- src/
|- Cargo.toml
`- tauri.conf.json
```

## Data Storage

Paperview stores state locally using IndexedDB and folder snapshots:

- **chats**: Per-paper conversation threads and message history
- **agentChats**: Workspace-level agent threads tied to a root folder
- **annotations**: Highlights and notes with page numbers and timestamps
- **folderHandles**: Persisted File System Access API handles for local folders
- **folderRoots**: Persisted native folder paths; Tauri restores their runtime scopes
- **.paperview.json**: Folder snapshot containing chats, agent chats, and annotations
- **remembered API key**: Optional passphrase-encrypted browser record on the web or macOS Keychain item in the native app

Imported PDFs are written as real files into the selected folder, or into an `Imported Papers` subfolder under the active root.

## Network Usage

Paperview is local-first, but it does make network requests for:

- OpenAI API inference and tool calls, either through the backend proxy or directly from the browser when a user supplies a client-side key
- User-initiated web research through OpenAI web search
- User-initiated direct PDF downloads when importing papers from search results, preferably through the backend PDF proxy when deployed

## Roadmap

Paperview is ready for early open-source use, with a few areas that would make it more robust and contributor-friendly:

- **Self-hosting and privacy guide**: Add a step-by-step Vercel guide with environment variable setup, API-key handling, and privacy notes.
- **Workspace import/export**: Add a portable archive format for PDFs, annotations, chats, and `.paperview.json` snapshots.
- **Bibliography metadata**: Detect DOI, arXiv IDs, titles, authors, and publication years for better library search and organization.
- **Citation review tools**: Let users jump from each answer citation to the exact extracted text span and flag weak or ambiguous citations.
- **Zotero and BibTeX workflows**: Import/export bibliographic metadata for existing research libraries.
- **Accessibility and keyboard navigation**: Improve reader, annotation, and chat workflows for keyboard-heavy use.
- **Smaller app modules**: Split `PaperviewApp.jsx` into focused components and hooks once behavior is covered by tests.
- **Dependency maintenance**: Keep the Vite, React, and GitHub Actions toolchain current without broad major-version jumps.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

1. Fork the repository and create a branch from `main`
2. Run `npm install` and `npm run dev`
3. Keep changes focused on a single concern
4. Run `npm test` and `npm run build`
5. Test folder workflows in Chrome or Edge
6. Open a pull request with a clear summary of what changed and why

### Guidelines

- Respect the local-first model: user data should stay on the user's machine
- PDF.js, Tesseract.js, OCR workers, and English OCR data are versioned npm dependencies bundled with the app
- `PaperviewApp.jsx` is large, so read surrounding context carefully before editing
- Prefer direct, readable code over unnecessary abstraction

## Security

Please do not open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for responsible disclosure guidance.

## License

Paperview is licensed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE) for details.
