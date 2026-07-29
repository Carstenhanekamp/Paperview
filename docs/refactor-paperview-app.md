# PaperviewApp.jsx Extraction Map

**Status:** Phase 1 ✅ | Phase 2 ✅ (modals; FoundSourcesPanel/AgentPreviewDrawer deferred to Phase 4) | Phase 3 ✅ (`useApiKey`, `usePanelResize`, `useViewerSearch`, `useAnnotations`, `useRequestRuns` wired in; built by 4 parallel agents)

`PaperviewApp.jsx`: 6,564 → ~5,100 lines. Build + tests green after each step.

Extracted so far: `constants.js`, `apiKeyStorage.js`, `openaiResponseParsing.js`, `agentSources.js`, `miscUtils.js`, `ThinkingTrace.jsx`, `components/{SettingsModal,UploadModal,FolderPermModal}.jsx`, `hooks/{useApiKey,usePanelResize,useViewerSearch,useAnnotations,useRequestRun}.js`.

Remaining: Phase 4 heavy hooks (chat/agent threads, folders, paper payloads, chat/agent send paths) and Phase 5 view components (LibrarySidebar, LibraryView, AgentView, ReaderView, FoundSourcesPanel, AgentPreviewDrawer).

---

Original plan below.

## File anatomy (line ranges)

| Range | Contents |
|---|---|
| 1–33 | Imports |
| 34–249 | Constants, prompts, OpenAI tool definitions |
| 251–944 | ~50 pure helper functions (ids, base64, paths, URLs, found-sources, response parsing, title matching) |
| 945–1005 | `ThinkingTrace` component |
| 1006–4819 | `PaperviewApp` component: ~80 `useState`, ~31 `useEffect`, ~90 handlers |
| 4820–6564 | JSX: sidebar, library view, agent view, reader view, chat panel, 3 modals |

## Extraction phases (in order)

### Phase 1 — Pure helpers (zero risk, no state)

Extract to new files; `PaperviewApp.jsx` only gains imports.

1. **`src/apiKeyStorage.js`** — L278–396: `getRememberedApiKeyRecord`, `hasRememberedApiKey`, `clearLegacyStoredApiKey`, `clearRememberedApiKey`, `bytesToBase64`, `base64ToBytes`, encrypt/decrypt helpers. Self-contained (WebCrypto + localStorage).
2. **`src/agentSources.js`** — L427–934: URL helpers, `buildFoundSources`, `normalizeFoundSourceRecord`, `getMessageFoundSources`, `findMatchingRemotePaper`, `findPaperByName`, title/file matching, `mergeFoldersByRoot`, manual-fetch error helpers. Pure functions over data.
3. **`src/openaiResponseParsing.js`** — L685–822: `sanitizeJsonNewlines`, `extractOutputTextPart`, `extractResponseOutputText`, `extractFunctionCalls`, `formatSearchToolResult`, `extractWebSearchSources`, `extractReasoningSummary`, `isResponseIncompleteForMaxOutput`.
4. **`src/constants.js`** — L34–249: env config, prompts, tool schemas, limits. (Keep `CHAT_SYSTEM_PROMPT`/`AGENT_SYSTEM_PROMPT` here too.)
5. **`src/miscUtils.js`** — L251–276, 397–426: id helpers, `hasExtractedPaperText`, `isPaperTextCacheValid`, filename/path helpers, `createStoppedError`, `isAbortLikeError`.

### Phase 2 — Leaf components (props-only, low risk)

6. **`src/ThinkingTrace.jsx`** — L945–1005. Already a standalone component; just move it.
7. **`src/components/SettingsModal.jsx`** — JSX at ~L6335–6498 (`showSettings` block) + its state/handlers: `settingsKey`, `settingsPassphrase`, `rememberApiKey`, `unlockPassphrase`, `settingsError`, `settingsBusy`, `resetSettingsInputs`, `openSettingsModal`, `closeSettingsModal`, `handleRemoveApiKey`, `handleUnlockRememberedApiKey`, `handleSaveSettingsApiKey`. Depends on Phase 1.1. Expose `apiKey` state via callback or lift to a `useApiKey` hook (see Phase 3).
8. **`src/components/UploadModal.jsx`** — `showUpload` block (~L6264–6334) + `showUpload`, `dragOver`, `upFolder`, `upStatus`, `upStatusText`, `pendingFile`, `fileSelected`, `doUpload`, `closeModal`.
9. **`src/components/FolderPermModal.jsx`** — `showFolderPermModal` block (~L6498+). Small.
10. **`src/components/FoundSourcesPanel.jsx`** — `renderFoundSourcesPanel` (L4512–4666). Props: `message`, `remotePapers`, import states, `importPaperResult`, `openAgentPreviewPaper`.
11. **`src/components/AgentPreviewDrawer.jsx`** — `renderAgentPreviewDrawer` (L3985–4073) + preview state (`agentPreviewState/Scale/Page/Width`, resize handler).

### Phase 3 — Hooks (parallelizable, disjoint concerns)

Each hook moves its state + effects + callbacks out of `PaperviewApp` and returns a clear API. These are independent of each other, so they can be built by parallel agents — but the removals from `PaperviewApp.jsx` are applied sequentially by the coordinator.

12. **`src/hooks/useApiKey.js`** — `apiKey` state (currently implicit), remembered-key unlock flow, settings persistence. Wraps Phase 1.1. Consumed by SettingsModal and the send paths.
13. **`src/hooks/usePanelResize.js`** — `chatWidth`, `sidebarWidth`, `startChatResize`, `startSbResize`, `startAgentPreviewResize`, the three resize refs. Generic: `usePanelResize(initialWidth)`.
14. **`src/hooks/useViewerSearch.js`** — `viewerSearch*` state, `buildViewerSearchMatches`, `runViewerSearch`, `handleSearchClick`, `viewerSearchInputRef`. Depends on active paper text.
15. **`src/hooks/useAnnotations.js`** — `annotations`, `annPopover`, `annComment`, `handleHighlight`, `handleAnnotationClick`, `saveAnnotationComment`, `deleteAnnotationById` + persistence effects. Touches `PdfViewer` props — moderate coupling.
16. **`src/hooks/useRequestRun.js`** — `beginRequestRun`, `ensureRequestRunActive`, `finishRequestRun`, stop/abort logic. Used by both chat and agent send paths.

### Phase 4 — Heavy hooks (sequential, high coupling)

These own the core workflows and interact with many states. Do them one at a time, after Phases 1–3 land.

17. **`src/hooks/useChatThreads.js`** — `chatThreads`, `activeChatId`, append/update/start/open/reset/delete thread callbacks, thinking steps, persistence effects.
18. **`src/hooks/useAgentThreads.js`** — agent equivalents + `agentRemotePapersByThread`, `hydrateRemotePaperForAgent`, import states.
19. **`src/hooks/useFolders.js`** — `folders`, `folderHandlesMapRef`, `scanDirHandle`, snapshot read/sync/apply, `refreshRootFolderContents`, `handleOpenFolder`, create/delete folder/paper, `openFolderTabs`, `openAllPapersInFolder`.
20. **`src/hooks/usePaperPayloads.js`** — `paperPayloads`, `getPaperPayload`, `updatePaperPayload`, `mergePaperRecord`, `evictPaperPayload`, `ensurePaperPdfBytes`, `startPaperTextExtraction`, scan states.
21. **`src/hooks/useChatSend.js`** — `doSend`, `askAI`, `handleCitationClick`, `renderUsageMeta`, chat loading state. Depends on 12, 16, 17, 20.
22. **`src/hooks/useAgentSend.js`** — `doSendAgent` (690 lines, the biggest single function). Depends on 12, 16, 18, 19, 20.

### Phase 5 — View components (last)

Once hooks exist, the JSX sections become thin and can move out:

23. **`src/components/LibrarySidebar.jsx`** — sidebar JSX (~L4825–5050).
24. **`src/components/LibraryView.jsx`** — library grid (~L5030–5260).
25. **`src/components/AgentView.jsx`** — agent workspace (~L5180–5900, biggest JSX block).
26. **`src/components/ReaderView.jsx`** — tabs + `PdfViewer` wiring + chat panel (~L5900–6264).

## Rules for every extraction

- No behavior changes; no renaming of user-facing strings or CSS classes.
- Run `npm test` and `npm run build` after each phase.
- Keep `PaperviewApp.jsx` as the composition root: it wires hooks together and passes props down.
- If a helper is only used by one extracted module, move it there instead of a shared file.
