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

- ~~Citation verification~~ — **done**: clickable `[N]` anchors with quoted-passage popovers and jump-to-source (`InlineCitedAnswer.jsx`). Remaining polish: flag weak/ambiguous citations.
- ~~Quick explain~~ — **done**: select text → inline Explain popover (`useExplainSelection` + `ExplainPopover`); Ask AI still routes to chat.
- ~~Bibliography metadata~~ — **done**: CrossRef enrichment + `paperMeta` store + library citation columns + BibTeX export.
- ~~Library persistence/memory~~ — **done**: `paperChunks` index + library search UI.
- ~~Cross-paper Q&A~~ — **done**: Folder/Library context modes with corpus pre-rank (`corpusRetrieve` + `libraryIndex`); citations across papers.

## 3. UX improvements

- **First-run flow**: with credits, onboarding becomes open app → buy €3 credits or paste key → first answer in under a minute (today the API-key requirement is a wall for students).
- **Library view**: further sort/filter polish on the citation table (title, authors, year, added).
- **Chat UX**: suggested follow-ups, regenerate answer, visible model picker (cheap/quality toggle matters under pay-per-use).
- **Cost visibility**: persistent subtle credit counter in header + per-message cost on hover.

## 4. UI / visual polish

- One design pass toward "scientific instrument": quiet typography (serif for reading, e.g. Source Serif + Inter for UI), generous whitespace, one accent color, refined spacing/shadows.
- Landing page leads with **"Pay per question, not per month"** — that's the headline. Must look great on mobile (where students first find it), even though the app itself is desktop-only.

## 5. Engineering hygiene

- ~~Split `PaperviewApp.jsx`~~ — **done** (6,564 → 1,875 lines; 11 hooks + 7 components extracted; `docs/refactor-paperview-app.md`). Follow [AGENTS.md](../AGENTS.md) so new work stays modular.
- ~~Expand test coverage~~ around `ragUtils` / biblio / corpus / library index — **started** (`coreFunctionality.test.js`). Keep growing coverage around send hooks.
- **Smoke-test automation**: the headless-browser script used during the refactor (puppeteer-core + Edge) could become a permanent CI check.

## Suggested order

1. ~~Split `PaperviewApp.jsx` + citation span-jumping + core functionality gaps~~ — **done**
2. Credits backend + Stripe + onboarding flow (the business milestone)
3. Design polish pass + landing page
