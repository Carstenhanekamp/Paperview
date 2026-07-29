import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FETCH_REMOTE_PAPER_TOOL,
  AGENT_WEB_SEARCH_TOOL,
  AGENT_SYSTEM_PROMPT,
  SEARCH_DOCUMENT_TOOL,
  MAX_SEARCH_TOOL_ROUNDS,
  MAX_AGENT_RESEARCH_PASSES,
  TARGET_FOUND_SOURCES,
  AGENT_MAX_OUTPUT_TOKENS,
  AGENT_FINALIZE_MAX_OUTPUT_TOKENS,
} from '../constants';
import {
  sanitizeJsonNewlines,
  fetchWithCorsProxy,
  extractResponseOutputText,
  extractFunctionCalls,
  formatSearchToolResult,
  extractWebSearchSources,
  extractReasoningSummary,
  isResponseIncompleteForMaxOutput,
  requestOpenAIResponse,
} from '../openaiResponseParsing';
import { selectRelevantPassages } from '../ragUtils';
import {
  isPdfUrl,
  normalizeAgentSourceUrl,
  getUrlHost,
  summarizeToWordLimit,
  buildRemotePaperKey,
  buildFoundSources,
  findMatchingRemotePaper,
  findPaperByName,
  isManualPdfFetchError,
  buildManualPdfFetchMessage,
} from '../agentSources';
import { createChatMessageId, makeStableId, hasExtractedPaperText, isAbortLikeError } from '../miscUtils';
import { derivePageTexts } from '../chatUtils';
import { addUsageTotals, createUsageTotals, getUsageBreakdown } from '../openaiPricing';
import { extractPdfText, validatePdfBytes } from '../pdfUtils';
import { mergePaperWithPayload, pickPaperPayload, stripPaperPayload } from '../paperPayloadUtils';
import { IClose, IZoomIn, IZoomOut } from '../icons';
import PdfViewer from '../PdfViewer';

export function useAgentSend({
  agentInput,
  setAgentInput,
  activeAgentChatId,
  agentLoadingState,
  setAgentLoadingState,
  selectedModel,
  apiKey,
  openSettingsModal,
  currentAgentMessages,
  agentContextPapers,
  selectedAgentTool,
  selectedRootFolderId,
  folders,
  agentWorkspacePapers,
  activeTabId,
  getPaperPayload,
  updatePaperPayload,
  mergePaperRecord,
  evictPaperPayload,
  startPaperTextExtraction,
  appendMessageToAgentChat,
  updateMessageInAgentChat,
  pushAgentThinkingStep,
  clearAgentThinkingSteps,
  agentThinkingStepsRef,
  agentRequestRef,
  beginRequestRun,
  ensureRequestRunActive,
  finishRequestRun,
}) {
  const [agentRemotePapersByThread, setAgentRemotePapersByThread] = useState({});
  const [agentPreviewState, setAgentPreviewState] = useState(null);
  const [agentPreviewScale, setAgentPreviewScale] = useState(1.05);
  const [agentPreviewPage, setAgentPreviewPage] = useState(1);
  const [agentPreviewWidth, setAgentPreviewWidth] = useState(null);
  const agentPreviewScrollFnRef = useRef(null);
  const agentPreviewPaneRef = useRef(null);
  const agentRemotePaperJobsRef = useRef(new Map());

  const activeAgentRemotePapers = useMemo(
    () => (agentRemotePapersByThread[activeAgentChatId] || []).map((paper) => mergePaperRecord(paper)),
    [agentRemotePapersByThread, activeAgentChatId, mergePaperRecord]
  );
  const activeAgentPreviewPaper = useMemo(
    () =>
      activeAgentRemotePapers.find((paper) => paper.id === agentPreviewState?.paperId) ||
      agentWorkspacePapers.find((paper) => paper.id === agentPreviewState?.paperId) ||
      null,
    [activeAgentRemotePapers, agentPreviewState?.paperId, agentWorkspacePapers]
  );
  const hasAgentPreview = Boolean(agentPreviewState && activeAgentPreviewPaper?.pdfBytes?.length);

  useEffect(() => {
    if (!agentPreviewState) return;
    if (agentPreviewState.chatId !== activeAgentChatId) {
      setAgentPreviewState(null);
      agentPreviewScrollFnRef.current = null;
      return;
    }
    if (agentPreviewState.paperId && !activeAgentPreviewPaper) {
      setAgentPreviewState(null);
      agentPreviewScrollFnRef.current = null;
    }
  }, [agentPreviewState, activeAgentChatId, activeAgentPreviewPaper]);

  const clearAgentRemotePapersForThread = useCallback((chatId) => {
    if (!chatId) return;
    const remotePapers = agentRemotePapersByThread[chatId] || [];
    remotePapers.forEach((paper) => {
      if (paper?.id && paper.id !== activeTabId && paper.id !== agentPreviewState?.paperId) {
        evictPaperPayload(paper.id);
      }
    });
    setAgentRemotePapersByThread((prev) => {
      if (!prev[chatId]) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    for (const key of [...agentRemotePaperJobsRef.current.keys()]) {
      if (key.startsWith(`${chatId}:`)) {
        agentRemotePaperJobsRef.current.delete(key);
      }
    }
  }, [activeTabId, agentPreviewState?.paperId, agentRemotePapersByThread, evictPaperPayload]);

  const upsertAgentRemotePaper = useCallback((chatId, nextPaper) => {
    if (!chatId || !nextPaper?.id) return;
    const payload = pickPaperPayload(nextPaper);
    if (payload) {
      updatePaperPayload(nextPaper.id, payload);
    }
    const nextDescriptor = stripPaperPayload(nextPaper);
    setAgentRemotePapersByThread((prev) => {
      const existing = prev[chatId] || [];
      const nextList = existing.some((paper) => paper.id === nextDescriptor.id)
        ? existing.map((paper) => (paper.id === nextDescriptor.id ? { ...paper, ...nextDescriptor } : paper))
        : [...existing, nextDescriptor];
      return { ...prev, [chatId]: nextList };
    });
  }, [updatePaperPayload]);

  const hydrateRemotePaperForAgent = useCallback(async (chatId, descriptor, options = {}) => {
    if (!chatId) throw new Error("No active Agent thread is available.");
    const title = String(descriptor?.title || "").trim() || "Remote paper";
    const sourceUrl = normalizeAgentSourceUrl(descriptor?.sourceUrl || descriptor?.source_url || descriptor?.url || "");
    const pdfUrl = normalizeAgentSourceUrl(descriptor?.pdfUrl || descriptor?.pdf_url || "");
    if (!pdfUrl || !isPdfUrl(pdfUrl)) {
      throw new Error(`No direct PDF URL is available for "${title}".`);
    }

    const remoteKey = buildRemotePaperKey({ title, sourceUrl, pdfUrl, doi: descriptor?.doi });
    const jobKey = `${chatId}:${remoteKey}`;
    const existing = (agentRemotePapersByThread[chatId] || []).find((paper) => buildRemotePaperKey(paper) === remoteKey);
    const existingPayload = existing?.id ? getPaperPayload(existing.id) : null;
    if ((existing?.hydrationStatus === "ready" || existing?.hydrationStatus === "preview_only") && existingPayload?.pdfBytes?.length) {
      return mergePaperWithPayload(existing, existingPayload);
    }
    if (agentRemotePaperJobsRef.current.has(jobKey)) {
      return agentRemotePaperJobsRef.current.get(jobKey);
    }

    const remotePaperId = existing?.id || makeStableId("rp", `${chatId}:${remoteKey}`);
    const basePaper = {
      id: remotePaperId,
      name: title,
      title,
      sourceUrl,
      pdfUrl,
      doi: String(descriptor?.doi || "").trim(),
      authors: Array.isArray(descriptor?.authors) ? descriptor.authors.filter(Boolean) : [],
      year: String(descriptor?.year || "").trim(),
      venue: String(descriptor?.venue || "").trim(),
      summary: summarizeToWordLimit(descriptor?.summary || descriptor?.abstract || descriptor?.note || ""),
      sourceHost: getUrlHost(sourceUrl || pdfUrl),
      pages: existing?.pages || null,
      fileSize: existing?.fileSize || null,
      fileLastModified: existing?.fileLastModified || null,
      hydrationStatus: "loading",
      hydrationError: "",
    };
    upsertAgentRemotePaper(chatId, basePaper);
    if (options.traceLabel) {
      pushAgentThinkingStep({
        id: `ats-${Date.now()}-fetch-${remotePaperId}`,
        chatId,
        type: "search",
        label: options.traceLabel,
      });
    }

    const job = (async () => {
      try {
        const response = await fetchWithCorsProxy(pdfUrl);
        if (!response.ok) {
          throw new Error(`Remote PDF download failed (${response.status}).`);
        }
        const fileBuffer = await response.arrayBuffer();
        const pdfBytes = new Uint8Array(fileBuffer);
        const validation = await validatePdfBytes(pdfBytes);
        let hydratedPaper = {
          ...basePaper,
          pdfBytes,
          fileSize: pdfBytes.byteLength,
          fileLastModified: Date.now(),
          pages: validation.totalPages || basePaper.pages,
          hydrationStatus: "preview_only",
        };
        upsertAgentRemotePaper(chatId, hydratedPaper);

        try {
          const { pageTexts, totalPages } = await extractPdfText(pdfBytes);
          hydratedPaper = {
            ...hydratedPaper,
            pageTexts,
            pages: totalPages,
            hydrationStatus: "ready",
            hydrationError: "",
          };
          upsertAgentRemotePaper(chatId, hydratedPaper);
          if (options.resultLabel) {
            pushAgentThinkingStep({
              id: `ats-${Date.now()}-fetched-${remotePaperId}`,
              chatId,
              type: "result",
              label: options.resultLabel,
            });
          }
        } catch (extractError) {
          hydratedPaper = {
            ...hydratedPaper,
            hydrationStatus: "preview_only",
            hydrationError: extractError?.message || "Could not extract text from this PDF.",
          };
          upsertAgentRemotePaper(chatId, hydratedPaper);
          if (options.errorLabel) {
            pushAgentThinkingStep({
              id: `ats-${Date.now()}-fetcherr-${remotePaperId}`,
              chatId,
              type: "result",
              label: options.errorLabel,
              body: hydratedPaper.hydrationError,
            });
          }
        }

        return hydratedPaper;
      } catch (fetchError) {
        const friendlyHydrationError = isManualPdfFetchError(fetchError?.message)
          ? buildManualPdfFetchMessage(title)
          : (fetchError?.message || "Could not fetch this PDF.");
        const failedPaper = {
          ...basePaper,
          hydrationStatus: "manual_required",
          hydrationError: friendlyHydrationError,
        };
        upsertAgentRemotePaper(chatId, failedPaper);
        if (options.errorLabel) {
          pushAgentThinkingStep({
            id: `ats-${Date.now()}-fetchfail-${remotePaperId}`,
            chatId,
            type: "result",
            label: options.errorLabel,
            body: friendlyHydrationError,
          });
        }
        throw new Error(friendlyHydrationError);
      } finally {
        agentRemotePaperJobsRef.current.delete(jobKey);
      }
    })();

    agentRemotePaperJobsRef.current.set(jobKey, job);
    return job;
  }, [agentRemotePapersByThread, getPaperPayload, upsertAgentRemotePaper]);

  const handleAgentPreviewReady = useCallback((fn) => {
    agentPreviewScrollFnRef.current = fn;
  }, []);

  const jumpAgentPreviewToLocation = useCallback((page, searchText = "") => {
    const jump = (tries = 18) => {
      if (agentPreviewScrollFnRef.current) {
        agentPreviewScrollFnRef.current(Number(page) || 1, searchText || "");
        return;
      }
      if (tries > 0) setTimeout(() => jump(tries - 1), 120);
    };
    jump();
  }, []);

  const openAgentPreviewPaper = useCallback(async (descriptor, options = {}) => {
    const targetChatId = options.chatId || activeAgentChatId;
    if (!targetChatId) return;
    try {
      const remotePaper = await hydrateRemotePaperForAgent(targetChatId, descriptor);
      setAgentPreviewWidth(null);
      setAgentPreviewState({
        chatId: targetChatId,
        paperId: remotePaper.id,
        page: Number(options.page) || 1,
        searchText: options.searchText || "",
      });
      setAgentPreviewPage(Number(options.page) || 1);
      agentPreviewScrollFnRef.current = null;
      setTimeout(() => {
        if (options.page || options.searchText) {
          jumpAgentPreviewToLocation(options.page || 1, options.searchText || "");
        }
      }, 120);
    } catch (error) {
      const fallbackUrl = normalizeAgentSourceUrl(
        descriptor?.pdfUrl || descriptor?.pdf_url || descriptor?.sourceUrl || descriptor?.source_url || descriptor?.url || ""
      );
      if (fallbackUrl) {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      } else {
        throw error;
      }
    }
  }, [activeAgentChatId, hydrateRemotePaperForAgent, jumpAgentPreviewToLocation]);

  const doSendAgent = async (override) => {
    const text = override || agentInput;
    if (!text.trim() || !activeAgentChatId || agentLoadingState || !selectedRootFolderId) return;
    const targetChatId = activeAgentChatId;
    const { controller, token } = beginRequestRun(agentRequestRef, targetChatId);
    const activeTool = selectedAgentTool;
    const userMessage = {
      id: createChatMessageId(),
      role: "user",
      content: text,
      agentToolId: activeTool?.id || null,
      agentToolTitle: activeTool?.title || "",
    };
    appendMessageToAgentChat(targetChatId, userMessage, { renameFromUser: text });
    setAgentInput("");
    setAgentLoadingState({
      chatId: targetChatId,
      phase: "preparing",
      label: activeTool ? `${activeTool.title}...` : "Preparing research...",
    });
    clearAgentThinkingSteps(targetChatId);

    try {
      const usageTotals = createUsageTotals();
      const conversationHistory = currentAgentMessages.slice(-8);
      const contextPapers = agentContextPapers;
      const readyContextPapers = [];
      let threadRemotePapers = (agentRemotePapersByThread[targetChatId] || []).map((paper) => mergePaperWithPayload(paper, getPaperPayload(paper.id)));

      if (contextPapers.some((paper) => !hasExtractedPaperText(paper))) {
        setAgentLoadingState({
          chatId: targetChatId,
          phase: "scanning",
          label:
            contextPapers.length === 1
              ? `Scanning ${contextPapers[0].name} for local context...`
              : `Scanning ${contextPapers.length} papers for local context...`,
        });
      }

      for (const paper of contextPapers) {
        readyContextPapers.push(hasExtractedPaperText(paper) ? paper : await startPaperTextExtraction(paper));
        ensureRequestRunActive(agentRequestRef, token);
      }

      setAgentLoadingState({
        chatId: targetChatId,
        phase: "thinking",
        label:
          activeTool?.id === "search-workspace"
            ? "Searching workspace..."
            : activeTool?.id === "research"
              ? (readyContextPapers.length ? "Researching across web and local papers..." : "Researching across the web...")
              : "Searching papers...",
      });

      pushAgentThinkingStep({
        id: `ats-${Date.now()}-boot-reason`,
        chatId: targetChatId,
        type: "reasoning",
        label:
          activeTool?.id === "research"
            ? "Planning a deeper research strategy..."
            : activeTool?.id === "outline-review"
              ? "Planning the review structure and evidence needs..."
              : "Planning the search strategy...",
      });
      if (activeTool?.allowWebSearch !== false) {
        pushAgentThinkingStep({
          id: `ats-${Date.now()}-boot-web`,
          chatId: targetChatId,
          type: "search",
          label:
            activeTool?.id === "research"
              ? "Searching the web for relevant scholarly sources..."
              : "Preparing web source discovery...",
        });
      }
      if ((activeTool?.allowLocalSearch ?? true) && readyContextPapers.length) {
        pushAgentThinkingStep({
          id: `ats-${Date.now()}-boot-local`,
          chatId: targetChatId,
          type: "search",
          label:
            readyContextPapers.length === 1
              ? `Reviewing the attached local paper "${readyContextPapers[0].name}"...`
              : `Reviewing ${readyContextPapers.length} attached local papers...`,
        });
      }

      const availableDocumentNames = readyContextPapers.map((paper) => `"${paper.name}"`).join(", ");
      const modeInstruction = activeTool?.instruction || "No Agent tool is selected. Use the available tools that best fit the user's request.";
      const localContextInstruction = readyContextPapers.length
        ? `Attached local documents for this turn: ${availableDocumentNames}. If you cite a local document, call search_document before citing it.`
        : "No local PDFs are attached for this turn.";
      const enabledTools = [];
      if (activeTool?.allowWebSearch !== false) {
        enabledTools.push(AGENT_WEB_SEARCH_TOOL);
        enabledTools.push(FETCH_REMOTE_PAPER_TOOL);
      }
      if (activeTool?.allowLocalSearch ?? true) {
        enabledTools.push(SEARCH_DOCUMENT_TOOL);
      }
      const reasoningEffort =
        readyContextPapers.length > 0 && activeTool?.reasoningEffortWithLocal
          ? activeTool.reasoningEffortWithLocal
          : activeTool?.reasoningEffort || "low";
      const basePayload = {
        model: selectedModel,
        max_output_tokens: AGENT_MAX_OUTPUT_TOKENS,
        instructions: [AGENT_SYSTEM_PROMPT, modeInstruction, localContextInstruction].filter(Boolean).join("\n\n"),
        include: ["web_search_call.action.sources"],
        reasoning: { effort: reasoningEffort, summary: "detailed" },
        ...(enabledTools.length ? { tools: enabledTools, tool_choice: "auto" } : {}),
      };
      const normalizeParsedAgentResponse = (responseData) => {
        const raw = extractResponseOutputText(responseData);
        const tryParseJson = (str) => {
          try {
            const parsed = JSON.parse(str);
            if (parsed?.answer) return parsed;
          } catch {}
          try {
            const parsed = JSON.parse(sanitizeJsonNewlines(str));
            if (parsed?.answer) return parsed;
          } catch {}
          return null;
        };
        // Find the { that begins the actual JSON response object by scanning all { positions.
        // The greedy /\{[\s\S]*\}/ fails when the model prefixes the JSON with prose containing
        // curly braces (e.g. "{EEG markers}"), so we try each { from last to first.
        const lastBrace = raw.lastIndexOf('}');
        if (lastBrace !== -1) {
          let pos = raw.indexOf('{');
          const starts = [];
          while (pos !== -1 && pos <= lastBrace) {
            starts.push(pos);
            pos = raw.indexOf('{', pos + 1);
          }
          for (let i = starts.length - 1; i >= 0; i--) {
            const result = tryParseJson(raw.slice(starts[i], lastBrace + 1));
            if (result) {
              return {
                parsed: result,
                parsedJson: true,
                raw,
              };
            }
          }
        }
        return {
          parsed: { answer: raw.replace(/```json|```/g, "").trim(), citations: [], paper_results: [] },
          parsedJson: false,
          raw,
        };
      };

      const normalizePaperResults = (paperResults = []) =>
        paperResults
          .map((result, index) => {
            const sourceUrl = normalizeAgentSourceUrl(result?.source_url || result?.sourceUrl || result?.url || result?.landing_url || "");
            const pdfUrl = normalizeAgentSourceUrl(result?.pdf_url || result?.pdfUrl || "");
            return {
              id: result?.id || `paper-result-${targetChatId}-${Date.now()}-${index}`,
              title: String(result?.title || `Paper ${index + 1}`),
              authors: Array.isArray(result?.authors)
                ? result.authors.map((author) => String(author || "").trim()).filter(Boolean)
                : String(result?.authors || "").split(/,\s*/).filter(Boolean),
              year: result?.year ? String(result.year) : "",
              venue: String(result?.venue || result?.journal || result?.source || ""),
              abstract: String(result?.abstract || ""),
              summary: summarizeToWordLimit(result?.summary || result?.abstract || ""),
              sourceUrl,
              pdfUrl: isPdfUrl(pdfUrl) ? pdfUrl : "",
              doi: String(result?.doi || ""),
            };
          })
          .filter((result) => result.title || result.sourceUrl);

      const collectWebSources = (responseData, label, type = "search") => {
        const passSources = extractWebSearchSources(responseData);
        if (passSources.length) {
          collectedWebSources.push(...passSources);
          pushAgentThinkingStep({
            id: `ats-${Date.now()}-web-${Math.random().toString(36).slice(2, 7)}`,
            chatId: targetChatId,
            type,
            label,
          });
        }
        return passSources;
      };

      const upsertThreadRemotePaper = (nextPaper) => {
        if (!nextPaper?.id) return;
        threadRemotePapers = threadRemotePapers.some((paper) => paper.id === nextPaper.id)
          ? threadRemotePapers.map((paper) => (paper.id === nextPaper.id ? { ...paper, ...nextPaper } : paper))
          : [...threadRemotePapers, nextPaper];
      };

      const getSearchableDocuments = () => [
        ...readyContextPapers,
        ...threadRemotePapers.filter((paper) => hasExtractedPaperText(paper)),
      ];

      const formatAvailableDocuments = () => {
        const documents = getSearchableDocuments();
        return documents.length
          ? documents.map((paper) => `"${paper.name}"`).join(", ")
          : "none";
      };

      const finalizeAgentJsonResponse = async (responseData) => {
        let current = responseData;
        let parseResult = normalizeParsedAgentResponse(current);

        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (parseResult.parsedJson && !isResponseIncompleteForMaxOutput(current)) {
            return { responseData: current, parseResult };
          }

          pushAgentThinkingStep({
            id: `ats-${Date.now()}-finalize-${attempt + 1}`,
            chatId: targetChatId,
            type: "reasoning",
            label: attempt === 0 ? "Finalizing the answer cleanly..." : "Retrying final answer formatting...",
          });

          current = await requestOpenAIResponse(apiKey, {
            model: selectedModel,
            previous_response_id: current.id,
            max_output_tokens: AGENT_FINALIZE_MAX_OUTPUT_TOKENS,
            instructions: [
              AGENT_SYSTEM_PROMPT,
              "Return the final answer again from scratch as one complete JSON object using the required schema.",
              "Do not call tools. Do not continue a partial JSON object. Rewrite the full final answer compactly enough to fit within this response.",
              "Preserve the complete citations array and paper_results before expanding the answer prose. If needed, shorten the answer slightly rather than dropping citations.",
            ].join("\n\n"),
            reasoning: { effort: "low", summary: "detailed" },
            input: [
              {
                role: "user",
                content: "Return the final answer again from scratch as one complete JSON object only. Keep the citations and paper_results complete, and if you need to save tokens, compress the answer wording before omitting citations. Do not call any more tools.",
              },
            ],
          }, { signal: controller.signal });
          ensureRequestRunActive(agentRequestRef, token);
          addUsageTotals(usageTotals, current?.usage);
          const finalReasoning = extractReasoningSummary(current);
          if (finalReasoning) {
            pushAgentThinkingStep({
              id: `ats-${Date.now()}-finalize-reason-${attempt + 1}`,
              chatId: targetChatId,
              type: "reasoning",
              label: "Final answer reasoning",
              body: finalReasoning,
            });
          }
          parseResult = normalizeParsedAgentResponse(current);
        }

        return { responseData: current, parseResult };
      };

      const runAgentPass = async ({ input: passInput, previousResponseId = null, passNumber = 1 }) => {
        let responseData = await requestOpenAIResponse(apiKey, {
          ...basePayload,
          ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
          input: passInput,
        }, { signal: controller.signal });
        ensureRequestRunActive(agentRequestRef, token);
        addUsageTotals(usageTotals, responseData?.usage);
        collectWebSources(
          responseData,
          passNumber === 1
            ? `Web search discovered ${extractWebSearchSources(responseData).length} candidate source${extractWebSearchSources(responseData).length === 1 ? "" : "s"}.`
            : `Research pass ${passNumber} discovered ${extractWebSearchSources(responseData).length} more candidate source${extractWebSearchSources(responseData).length === 1 ? "" : "s"}.`
        );
        const initialReasoning = extractReasoningSummary(responseData);
        if (initialReasoning) {
          pushAgentThinkingStep({
            id: `ats-${Date.now()}-reason-${passNumber}`,
            chatId: targetChatId,
            type: "reasoning",
            label: passNumber === 1 ? "Reasoning" : `Reasoning pass ${passNumber}`,
            body: initialReasoning,
          });
        }

        let toolCycles = 0;
        while (toolCycles < MAX_SEARCH_TOOL_ROUNDS) {
          ensureRequestRunActive(agentRequestRef, token);
          const toolCalls = extractFunctionCalls(responseData);
          if (!toolCalls.length) break;
          toolCycles += 1;

          const toolOutputs = [];
          for (const call of toolCalls) {
            let args = {};
            if (typeof call.arguments === "string") {
              try {
                args = JSON.parse(call.arguments || "{}");
              } catch {
                args = {};
              }
            } else if (call.arguments && typeof call.arguments === "object") {
              args = call.arguments;
            }

            if (call.name === FETCH_REMOTE_PAPER_TOOL.name) {
              ensureRequestRunActive(agentRequestRef, token);
              const descriptor = {
                title: String(args.title || "").trim(),
                sourceUrl: String(args.source_url || "").trim(),
                pdfUrl: String(args.pdf_url || "").trim(),
                doi: String(args.doi || "").trim(),
              };
              try {
                const remotePaper = await hydrateRemotePaperForAgent(targetChatId, descriptor, {
                  traceLabel: `Fetching remote PDF for "${descriptor.title || "paper"}"...`,
                  resultLabel: `Hydrated "${descriptor.title || "paper"}" for grounded citation search.`,
                  errorLabel: `Fetched "${descriptor.title || "paper"}", but text extraction was incomplete.`,
                });
                ensureRequestRunActive(agentRequestRef, token);
                upsertThreadRemotePaper(remotePaper);
                toolOutputs.push({
                  type: "function_call_output",
                  call_id: call.call_id,
                  output: [
                    `Hydrated remote paper: "${remotePaper.name}"`,
                    remotePaper.hydrationStatus === "ready"
                      ? `The paper is now searchable with search_document under the exact document name "${remotePaper.name}".`
                      : "The PDF is available for preview, but text extraction did not complete, so search_document may not find passages.",
                    `Available searchable documents: ${formatAvailableDocuments()}.`,
                  ].join("\n"),
                });
              } catch (fetchError) {
                pushAgentThinkingStep({
                  id: `ats-${Date.now()}-fetch-fail-${call.call_id}`,
                  chatId: targetChatId,
                  type: "result",
                  label: `Could not hydrate "${descriptor.title || "remote paper"}"`,
                  body: fetchError?.message || String(fetchError),
                });
                toolOutputs.push({
                  type: "function_call_output",
                  call_id: call.call_id,
                  output: `Remote paper hydration failed for "${descriptor.title || "paper"}": ${fetchError?.message || String(fetchError)}`,
                });
              }
              continue;
            }

            if (call.name !== SEARCH_DOCUMENT_TOOL.name) {
              toolOutputs.push({
                type: "function_call_output",
                call_id: call.call_id,
                output: `Unsupported tool call "${call.name}".`,
              });
              continue;
            }

            const requestedQuery = String(args.query || "").trim() || text;
            const requestedDocument = String(args.document_name || "").trim();
            pushAgentThinkingStep({
              id: `ats-${Date.now()}-search-${toolCycles}-${call.call_id}`,
              chatId: targetChatId,
              type: "search",
              label: `Searching "${requestedDocument}" for "${requestedQuery.length > 60 ? `${requestedQuery.slice(0, 60)}...` : requestedQuery}"...`,
            });

            const paper = findPaperByName(getSearchableDocuments(), requestedDocument);
            if (!paper) {
              pushAgentThinkingStep({
                id: `ats-${Date.now()}-search-miss-${toolCycles}-${call.call_id}`,
                chatId: targetChatId,
                type: "result",
                label: `Document not available: "${requestedDocument || "unknown"}"`,
                body: `Available searchable documents: ${formatAvailableDocuments()}.`,
              });
              toolOutputs.push({
                type: "function_call_output",
                call_id: call.call_id,
                output: `Document "${requestedDocument}" was not found. Available searchable documents: ${formatAvailableDocuments()}.`,
              });
              continue;
            }

            const pageTexts = Array.isArray(paper.pageTexts) && paper.pageTexts.length
              ? paper.pageTexts
              : derivePageTexts(paper);
            const passages = selectRelevantPassages(requestedQuery, pageTexts, {
              topN: 4,
              minScore: 0.01,
              maxChars: 12000,
              maxExcerptChars: 1200,
              pageHint: Number.isFinite(args.page_hint) ? args.page_hint : null,
            });

            pushAgentThinkingStep({
              id: `ats-${Date.now()}-search-hit-${toolCycles}-${call.call_id}`,
              chatId: targetChatId,
              type: "result",
              label: passages.length
                ? `Found ${passages.length} passage${passages.length === 1 ? "" : "s"} in "${paper.name}".`
                : `No direct passages found in "${paper.name}".`,
            });
            toolOutputs.push({
              type: "function_call_output",
              call_id: call.call_id,
              output: formatSearchToolResult(paper, requestedQuery, passages),
            });
          }

          responseData = await requestOpenAIResponse(apiKey, {
            ...basePayload,
            previous_response_id: responseData.id,
            input: toolOutputs,
          }, { signal: controller.signal });
          ensureRequestRunActive(agentRequestRef, token);
          addUsageTotals(usageTotals, responseData?.usage);
          collectWebSources(
            responseData,
            `Web search now has ${extractWebSearchSources(responseData).length} consulted source${extractWebSearchSources(responseData).length === 1 ? "" : "s"} in play.`,
            "result"
          );
          const continuedReasoning = extractReasoningSummary(responseData);
          if (continuedReasoning) {
            pushAgentThinkingStep({
              id: `ats-${Date.now()}-reason-next-${toolCycles}`,
              chatId: targetChatId,
              type: "reasoning",
              label: "Continued reasoning",
              body: continuedReasoning,
            });
          }
        }

        return responseData;
      };

      const collectedWebSources = [];
      let collectedPaperResults = [];
      let passNumber = 1;
      let data = await runAgentPass({
        passNumber,
        input: [
          ...conversationHistory.map((message) => ({
            role: message.role === "ai" ? "assistant" : message.role,
            content: message.content,
          })),
          {
            role: "user",
            content: text,
          },
        ],
      });

      let parseResult = normalizeParsedAgentResponse(data);
      let parsed = parseResult.parsed;
      collectedPaperResults = normalizePaperResults(parsed.paper_results || []);
      let foundSourcesMeta = buildFoundSources({
        paperResults: collectedPaperResults,
        webSources: collectedWebSources,
        remotePapers: threadRemotePapers,
      });

      while (
        activeTool?.id === "research" &&
        passNumber < MAX_AGENT_RESEARCH_PASSES &&
        foundSourcesMeta.total < TARGET_FOUND_SOURCES
      ) {
        const beforeTotal = foundSourcesMeta.total;
        const nextPassNumber = passNumber + 1;
        pushAgentThinkingStep({
          id: `ats-${Date.now()}-deepen-${nextPassNumber}`,
          chatId: targetChatId,
          type: "search",
          label: `Research pass ${nextPassNumber}: broadening for more distinct scholarly sources...`,
        });
        data = await runAgentPass({
          passNumber: nextPassNumber,
          previousResponseId: data.id,
          input: [
            {
              role: "user",
              content: "Continue searching for additional distinct scholarly sources. Broaden and refine the search, fetch and ground any high-value PDFs you rely on, then return an updated final JSON answer using the same schema.",
            },
          ],
        });
        parseResult = normalizeParsedAgentResponse(data);
        parsed = parseResult.parsed;
        collectedPaperResults = [
          ...collectedPaperResults,
          ...normalizePaperResults(parsed.paper_results || []),
        ];
        foundSourcesMeta = buildFoundSources({
          paperResults: collectedPaperResults,
          webSources: collectedWebSources,
          remotePapers: threadRemotePapers,
        });
        if (foundSourcesMeta.total <= beforeTotal) {
          pushAgentThinkingStep({
            id: `ats-${Date.now()}-deepen-stop-${nextPassNumber}`,
            chatId: targetChatId,
            type: "result",
            label: `Research pass ${nextPassNumber} did not add new distinct sources.`,
          });
          passNumber = nextPassNumber;
          break;
        }
        pushAgentThinkingStep({
          id: `ats-${Date.now()}-deepen-done-${nextPassNumber}`,
          chatId: targetChatId,
          type: "result",
          label: `Research pass ${nextPassNumber} expanded the source set to ${foundSourcesMeta.total}.`,
        });
        passNumber = nextPassNumber;
      }

      const finalized = await finalizeAgentJsonResponse(data);
      data = finalized.responseData;
      parseResult = finalized.parseResult;
      parsed = parseResult.parsed;
      collectedPaperResults = [
        ...collectedPaperResults,
        ...normalizePaperResults(parsed.paper_results || []),
      ];
      foundSourcesMeta = buildFoundSources({
        paperResults: collectedPaperResults,
        webSources: collectedWebSources,
        remotePapers: threadRemotePapers,
      });

      const allPapers = folders.flatMap((folder) =>
        folder.papers.map((paper) => ({ ...paper, folderId: folder.id }))
      );
      const norm = (value) => String(value || "").trim().toLowerCase();
      const foundSourceMap = new Map(
        foundSourcesMeta.all
          .map((source) => [buildRemotePaperKey(source), source])
          .filter(([key]) => key)
      );
      const normalizedCitations = (parsed.citations || [])
        .map((citation, index) => {
          const kind = String(citation?.kind || (citation?.file ? "local" : "web")).toLowerCase();
          if (kind === "local") {
            const requestedName = String(citation.file || citation.fileName || citation.document || "").trim();
            const matchPaper = requestedName
              ? allPapers.find((paper) => norm(paper.name) === norm(requestedName))
              : null;
            return {
              kind: "local",
              ...citation,
              fileName: matchPaper?.name || requestedName || "Unknown file",
              paperId: matchPaper?.id || null,
              folderId: matchPaper?.folderId || null,
              page: Number.isFinite(Number(citation?.page)) ? Number(citation.page) : null,
              section: String(citation?.section || ""),
              text: String(citation?.text || citation?.note || ""),
              title: String(citation?.title || matchPaper?.name || requestedName || `Local source ${index + 1}`),
            };
          }

          const url = normalizeAgentSourceUrl(citation?.url || citation?.source_url || "");
          const pdfUrl = normalizeAgentSourceUrl(citation?.pdf_url || citation?.pdfUrl || "");
          const matchedSource = foundSourceMap.get(buildRemotePaperKey({
            title: citation?.title,
            sourceUrl: url,
            pdfUrl,
            doi: citation?.doi,
          })) || null;
          const remotePaper = findMatchingRemotePaper(threadRemotePapers, {
            remotePaperId: matchedSource?.remotePaperId,
            title: citation?.title,
            sourceUrl: url,
            pdfUrl,
            doi: citation?.doi,
          });
          if (!url && !pdfUrl && !remotePaper?.pdfUrl) return null;
          return {
            kind: "web",
            title: String(citation?.title || matchedSource?.title || citation?.source || `Web source ${index + 1}`),
            url: url || matchedSource?.sourceUrl || remotePaper?.sourceUrl || remotePaper?.pdfUrl || "",
            pdfUrl: pdfUrl || matchedSource?.pdfUrl || remotePaper?.pdfUrl || "",
            source: String(citation?.source || matchedSource?.venue || matchedSource?.sourceHost || remotePaper?.sourceHost || getUrlHost(url || pdfUrl)),
            text: String(citation?.text || citation?.note || ""),
            note: String(citation?.note || ""),
            page: Number.isFinite(Number(citation?.page)) ? Number(citation.page) : null,
            section: String(citation?.section || ""),
            remotePaperId: remotePaper?.id || matchedSource?.remotePaperId || null,
          };
        })
        .filter(Boolean);

      if (!normalizedCitations.length && collectedWebSources.length) {
        normalizedCitations.push(
          ...foundSourcesMeta.shown.slice(0, 6).map((source, index) => ({
            kind: "web",
            title: String(source?.title || `Web source ${index + 1}`),
            url: source?.sourceUrl || source?.pdfUrl || "",
            pdfUrl: source?.pdfUrl || "",
            source: String(source?.venue || source?.sourceHost || getUrlHost(source?.sourceUrl || source?.pdfUrl || "")),
            text: "",
            note: "",
            page: null,
            section: "",
            remotePaperId: source?.remotePaperId || null,
          })).filter((source) => source.url)
        );
      }

      if (!collectedPaperResults.length && collectedWebSources.length) {
        collectedPaperResults = foundSourcesMeta.shown.map((source, index) => ({
          id: source.id || `paper-result-${targetChatId}-fallback-${index}`,
          title: source.title || `Result ${index + 1}`,
          authors: source.authors || [],
          year: source.year || "",
          venue: source.venue || source.sourceHost || "",
          abstract: source.summary || "",
          summary: source.summary || "",
          sourceUrl: source.sourceUrl || "",
          pdfUrl: source.pdfUrl || "",
          doi: source.doi || "",
        }));
      }

      const usageBreakdown = getUsageBreakdown(selectedModel, usageTotals);
      const usageMeta = {
        model: usageBreakdown.model,
        pricingModel: usageBreakdown.pricingModel,
        inputTokens: usageBreakdown.inputTokens,
        cachedInputTokens: usageBreakdown.cachedInputTokens,
        uncachedInputTokens: usageBreakdown.uncachedInputTokens,
        outputTokens: usageBreakdown.outputTokens,
        reasoningTokens: usageBreakdown.reasoningTokens,
        totalTokens: usageBreakdown.totalTokens,
        inputCost: usageBreakdown.inputCost,
        outputCost: usageBreakdown.outputCost,
        totalCost: usageBreakdown.totalCost,
      };

      ensureRequestRunActive(agentRequestRef, token);
      updateMessageInAgentChat(targetChatId, userMessage.id, (message) => ({
        ...message,
        usage: usageMeta,
      }));

      const capturedTrace = agentThinkingStepsRef.current.filter((step) => step.chatId === targetChatId);
      appendMessageToAgentChat(targetChatId, {
        id: createChatMessageId(),
        role: "ai",
        content: String(parsed.answer || "").replace(/^[,\s]+/, ""),
        citations: normalizedCitations,
        foundSources: foundSourcesMeta.all,
        foundSourcesShown: foundSourcesMeta.shown.length,
        foundSourcesTotal: foundSourcesMeta.total,
        paperResults: collectedPaperResults,
        usage: usageMeta,
        thinkingTrace: capturedTrace,
      });
      clearAgentThinkingSteps(targetChatId);
    } catch (error) {
      if (isAbortLikeError(error)) {
        clearAgentThinkingSteps(targetChatId);
        return;
      }
      const rawMessage = error?.message || String(error);
      if (/No OpenAI API key is configured/i.test(rawMessage)) {
        openSettingsModal("");
      }
      const friendlyMessage = /web_search|unsupported|not supported/i.test(rawMessage)
        ? `The selected model (${selectedModel}) could not use web search. Choose a model with tool support and try again.`
        : rawMessage;
      appendMessageToAgentChat(targetChatId, {
        id: createChatMessageId(),
        role: "ai",
        content: `Could not prepare this agent request: ${friendlyMessage}`,
        citations: [],
        foundSources: [],
        foundSourcesShown: 0,
        foundSourcesTotal: 0,
        paperResults: [],
      });
    } finally {
      finishRequestRun(agentRequestRef, token);
      setAgentLoadingState(null);
    }
  };

  const renderAgentPreviewDrawer = useCallback(() => {
    if (!agentPreviewState || !activeAgentPreviewPaper?.pdfBytes?.length) return null;
    const previewSourceUrl = normalizeAgentSourceUrl(activeAgentPreviewPaper.sourceUrl || activeAgentPreviewPaper.pdfUrl || "");
    const previewSubtitle = activeAgentPreviewPaper.venue
      || activeAgentPreviewPaper.sourceHost
      || activeAgentPreviewPaper.authors
      || "Workspace PDF";
    return (
      <aside className="agent-preview-drawer" ref={agentPreviewPaneRef}>
        <div className="agent-preview-head">
          <div className="agent-preview-copy">
            <div className="agent-empty-eyebrow">In-chat PDF preview</div>
            <div className="agent-preview-title">{activeAgentPreviewPaper.title || activeAgentPreviewPaper.name || "Remote paper"}</div>
            <div className="agent-preview-subtitle">
              {previewSubtitle}
            </div>
          </div>
          <button
            className="chat-topbar-btn"
            type="button"
            onClick={() => {
              setAgentPreviewWidth(null);
              setAgentPreviewState(null);
              agentPreviewScrollFnRef.current = null;
            }}
            title="Close preview"
          >
            <IClose size={14} />
          </button>
        </div>

        <div className="agent-preview-toolbar">
          <div className="agent-preview-toolbar-meta">Page {Math.max(1, Number(agentPreviewPage) || 1)}</div>
          <div className="agent-preview-toolbar-actions">
            <button
              className="chat-topbar-btn"
              type="button"
              onClick={() => setAgentPreviewScale((value) => Math.max(0.7, Number((value - 0.1).toFixed(2))))}
              title="Zoom out"
            >
              <IZoomOut size={14} />
            </button>
            <button
              className="chat-topbar-btn"
              type="button"
              onClick={() => setAgentPreviewScale((value) => Math.min(1.8, Number((value + 0.1).toFixed(2))))}
              title="Zoom in"
            >
              <IZoomIn size={14} />
            </button>
            {previewSourceUrl ? (
              <button
                className="chat-history-btn"
                type="button"
                onClick={() => window.open(previewSourceUrl, "_blank", "noopener,noreferrer")}
              >
                Open source
              </button>
            ) : null}
          </div>
        </div>

        {activeAgentPreviewPaper.hydrationError ? (
          <div className="agent-preview-note">{activeAgentPreviewPaper.hydrationError}</div>
        ) : null}

        <div className="agent-preview-viewer">
          <div className="pdf-scroll">
            <PdfViewer
              pdfBytes={activeAgentPreviewPaper.pdfBytes}
              paperId={activeAgentPreviewPaper.id}
              fileSize={activeAgentPreviewPaper.fileSize}
              fileLastModified={activeAgentPreviewPaper.fileLastModified}
              scale={agentPreviewScale}
              onReady={handleAgentPreviewReady}
              onPageChange={setAgentPreviewPage}
            />
          </div>
        </div>
      </aside>
    );
  }, [
    activeAgentPreviewPaper,
    agentPreviewPage,
    agentPreviewScale,
    agentPreviewState,
    handleAgentPreviewReady,
  ]);

  return {
    doSendAgent,
    agentRemotePapersByThread,
    activeAgentRemotePapers,
    clearAgentRemotePapersForThread,
    upsertAgentRemotePaper,
    hydrateRemotePaperForAgent,
    agentPreviewState,
    setAgentPreviewState,
    agentPreviewScale,
    setAgentPreviewScale,
    agentPreviewPage,
    setAgentPreviewPage,
    agentPreviewWidth,
    setAgentPreviewWidth,
    agentPreviewScrollFnRef,
    agentPreviewPaneRef,
    activeAgentPreviewPaper,
    hasAgentPreview,
    handleAgentPreviewReady,
    jumpAgentPreviewToLocation,
    openAgentPreviewPaper,
    renderAgentPreviewDrawer,
  };
}
