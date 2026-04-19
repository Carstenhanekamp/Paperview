# Contributing to Paperview

Thanks for taking the time to improve Paperview. This project is local-first, so changes should keep user papers, notes, chats, and folder snapshots on the user's machine unless the user clearly asks for network-backed AI or paper discovery.

## Development setup

1. Install Node.js 20.19+ and npm.
2. Fork and clone the repository.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Add `OPENAI_API_KEY` to `.env.local` if you want to test AI features.
6. Run `npm run dev`.

The Vite dev server mounts the local API middleware from `api/`, so local OpenAI requests can use `OPENAI_API_KEY` without exposing it to the browser bundle.

## Before opening a pull request

Run:

```bash
npm test
npm run build
```

Also test the affected workflow in Chrome or Edge when your change touches folder access, imports, annotations, PDF reading, or workspace persistence. The File System Access API is Chromium-based.

## Pull request guidelines

- Keep each PR focused on one problem or feature.
- Include a short summary of the user-facing change.
- Mention any privacy, storage, network, or API-key implications.
- Add or update focused tests when changing shared utilities, parsing, persistence, citations, or import behavior.
- Avoid committing generated build output, local env files, local paper collections, or `.paperview.json` files from personal libraries.

## Code style

- Prefer the existing React and utility patterns before adding new abstractions.
- Keep user data local by default.
- Use the backend proxy path for OpenAI and remote PDF downloads when possible.
- Leave PDF.js and Tesseract.js on their current CDN loading path unless there is a clear reason to change that architecture.
- `src/PaperviewApp.jsx` is large; read nearby state and helper logic before editing it. (or make it smaller if you like to help me out)

## Reporting bugs

When filing a bug, include:

- Your browser and operating system.
- Whether you are running locally or on a deployment.
- Steps to reproduce the issue.
- Any console or terminal errors that do not contain secrets.
- Whether the issue involves local PDFs, remote imports, AI requests, OCR, annotations, or folder permissions.
