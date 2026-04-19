# Security Policy

## Supported versions

Paperview is early-stage open source software. Security fixes target the `main` branch unless a maintained release branch is announced in the future.

## Reporting a vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Use GitHub's private vulnerability reporting for this repository if it is enabled. If it is not enabled, contact the maintainer privately before publishing details.

Include as much of the following as you can:

- Affected area, such as local file access, API proxying, PDF import, OpenAI requests, or stored workspace data.
- Reproduction steps or a minimal proof of concept.
- Expected impact and whether user files, API keys, or local IndexedDB data are involved.
- Browser, operating system, and deployment context.

## Secret handling

Never commit `.env`, `.env.local`, API keys, private PDFs, personal paper libraries, or generated `.paperview.json` snapshots. If a secret is committed, rotate it immediately and remove it from the repository history before making the repository public.

For development and deployment, prefer `OPENAI_API_KEY` on the server side. Variables prefixed with `VITE_` are exposed to the browser bundle.
