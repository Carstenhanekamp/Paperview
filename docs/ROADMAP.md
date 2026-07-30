# Paperview Roadmap

Goal: the best tool for people who work with PDFs and want AI to help them read and find answers — academic, professional, and affordable for students via **pay-per-use** instead of subscriptions.

Positioning vs. Anara: they win on polish, cross-paper synthesis, and library memory. We win on **privacy (local-first)** and **pricing (pay per question, not per month)**.

---

## 1. Pay-per-use model (the differentiator)

- **Credit wallet**: one-time credit packs (€5/€10) via Stripe — no subscription. Show balance + per-question cost estimate *before* sending (`openaiPricing.js` already has the plumbing).
- **BYOK stays free forever**: bring-your-own-key = no credits needed. Credits are a managed-key convenience layer, keeping open-source goodwill.
- **Minimal backend** (the big architectural change): small Vercel function holding the OpenAI key, a credits table (e.g. Supabase free tier), magic-link email login. Strictly optional — local-first story stays intact.
- **Transparent pricing**: OpenAI cost + small markup, shown live ("this question: €0.003"). ~100× cheaper than €20/month for typical student usage.

## 2. Core functionality gaps (vs. Anara)

- **Cross-paper Q&A**: ask across a folder / whole library, not just one paper. Anara's headline feature and the #1 academic expectation. Foundation: `ragUtils.js` + `useChatSend` — extend retrieval across papers with per-paper citations. *(Unblocked by the refactor.)*
- **Bibliography metadata**: auto-detect title/authors/year/DOI (CrossRef API, free); library shows real citations instead of filenames; BibTeX export.
- **Library persistence/memory**: index papers (embeddings in IndexedDB) so "where did I save that battery paper?" works.
- **Quick explain**: select text in PDF → inline "explain this" popover. Cheap to build, huge daily-use win.
- ~~Citation verification~~ — **done**: clickable `[N]` anchors with quoted-passage popovers and jump-to-source (`InlineCitedAnswer.jsx`). Remaining polish: flag weak/ambiguous citations.

## 3. UX improvements

- **First-run flow**: with credits, onboarding becomes open app → buy €3 credits or paste key → first answer in under a minute (today the API-key requirement is a wall for students).
- **Library view**: sortable table (title, authors, year, added) — "academic instrument", not file browser.
- **Chat UX**: suggested follow-ups, regenerate answer, visible model picker (cheap/quality toggle matters under pay-per-use).
- **Cost visibility**: persistent subtle credit counter in header + per-message cost on hover.

## 4. UI / visual polish

- One design pass toward "scientific instrument": quiet typography (serif for reading, e.g. Source Serif + Inter for UI), generous whitespace, one accent color, refined spacing/shadows.
- Landing page leads with **"Pay per question, not per month"** — that's the headline. Must look great on mobile (where students first find it), even though the app itself is desktop-only.

## 5. Engineering hygiene

- ~~Split `PaperviewApp.jsx`~~ — **done** (6,564 → 1,875 lines; 11 hooks + 7 components extracted; `docs/refactor-paperview-app.md`).
- **Expand test coverage** around `ragUtils`, `chatUtils`, and the send hooks before building cross-paper retrieval. The refactor proved build-green ≠ runtime-correct (TDZ crashes, a dropped `SEARCH_DOCUMENT_TOOL` import) — the 7-test suite is too thin.
- **Smoke-test automation**: the headless-browser script used during the refactor (puppeteer-core + Edge) could become a permanent CI check.

## Suggested order

1. ~~Split `PaperviewApp.jsx` + citation span-jumping + quick-explain~~ — split done; quick-explain next
2. Cross-paper Q&A + library metadata (the "real tool" milestone)
3. Credits backend + Stripe + onboarding flow (the business milestone)
4. Design polish pass + landing page
