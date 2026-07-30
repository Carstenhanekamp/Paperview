import React, { useCallback } from 'react';
import { CHAT_SYSTEM_PROMPT, SEARCH_DOCUMENT_TOOL, MAX_SEARCH_TOOL_ROUNDS } from '../constants';
import {
  sanitizeJsonNewlines,
  extractResponseOutputText,
  extractFunctionCalls,
  formatSearchToolResult,
  extractReasoningSummary,
  requestOpenAIResponse,
} from '../openaiResponseParsing';
import { selectRelevantPassages } from '../ragUtils';
import { findPaperByName, findMatchingRemotePaper, findWorkspacePaperForSource, normalizeAgentSourceUrl } from '../agentSources';
import { createChatMessageId, hasExtractedPaperText, isAbortLikeError } from '../miscUtils';
import { derivePageTexts } from '../chatUtils';
import { addUsageTotals, createUsageTotals, getUsageBreakdown, formatTokenCount, formatUsd } from '../openaiPricing';
import { resolveContextPapersForQuery, CORPUS_TOP_K, mapCitationFileToPaper } from '../corpusRetrieve';
import { displayPaperTitle } from '../biblioUtils';

function paperDisplayName(paper, getMeta) {
  if (!paper) return 'Unknown';
  const meta = typeof getMeta === 'function' ? getMeta(paper.id) : null;
  return displayPaperTitle(paper, meta) || paper.name || 'Unknown';
}

export function useChatSend({
  input,
  setInput,
  chip,
  setChip,
  activeChatId,
  chatLoadingState,
  setChatLoadingState,
  selectedModel,
  apiKey,
  openSettingsModal,
  currentMessages,
  chatContextPapers,
  chatContextMode = 'auto',
  searchCorpus,
  getMeta,
  folders,
  activePaper,
  activeAgentRemotePapers,
  agentWorkspacePapers,
  currentView,
  activeAgentChatId,
  activeTabId,
  setActiveTabId,
  setCurrentView,
  popup,
  setPopup,
  scrollFnRef,
  startPaperTextExtraction,
  appendMessageToChat,
  updateMessageInChat,
  pushThinkingStep,
  clearThinkingSteps,
  thinkingStepsRef,
  chatRequestRef,
  beginRequestRun,
  ensureRequestRunActive,
  finishRequestRun,
  openPaper,
  openAgentPaper,
  openAgentPreviewPaper,
}) {
  const doSend = async (override) => {
    const text = override || (chip ? `[Regarding: "${chip.substring(0, 80)}..."]\n${input}` : input);
    if (!text.trim() || !activeChatId || chatLoadingState) return;
    const targetChatId = activeChatId;
    const { controller, token } = beginRequestRun(chatRequestRef, targetChatId);
    const userMessage = { id: createChatMessageId(), role: "user", content: text };
    appendMessageToChat(targetChatId, userMessage, { renameFromUser: text });
    setInput("");
    setChip(null);
    setChatLoadingState({ chatId: targetChatId, phase: "preparing", label: "Preparing chat..." });
    clearThinkingSteps(targetChatId);

    try {
      const usageTotals = createUsageTotals();
      const conversationHistory = currentMessages.slice(-8);
      const candidatePapers = chatContextPapers;
      if (!candidatePapers.length) {
        throw new Error("No document is currently selected. Open or attach a PDF before asking a question.");
      }

      const pinned = activePaper && (chatContextMode === 'folder' || chatContextMode === 'library')
        ? [activePaper]
        : [];

      setChatLoadingState({
        chatId: targetChatId,
        phase: "preparing",
        label:
          chatContextMode === 'folder' || chatContextMode === 'library'
            ? "Ranking papers in scope..."
            : "Preparing chat...",
      });

      const contextPapers = await resolveContextPapersForQuery({
        query: text,
        scopeMode: chatContextMode,
        searchCorpus,
        candidatePapers,
        pinnedPapers: pinned,
        limit: CORPUS_TOP_K,
      });
      ensureRequestRunActive(chatRequestRef, token);

      if (!contextPapers.length) {
        throw new Error("No document is currently selected. Open or attach a PDF before asking a question.");
      }

      const readyContextPapers = [];
      if (contextPapers.some((paper) => !hasExtractedPaperText(paper))) {
        setChatLoadingState({
          chatId: targetChatId,
          phase: "scanning",
          label:
            contextPapers.length === 1
              ? `Scanning ${paperDisplayName(contextPapers[0], getMeta)} for chat...`
              : `Scanning ${contextPapers.length} papers for chat...`,
        });
      }
      for (const paper of contextPapers) {
        readyContextPapers.push(hasExtractedPaperText(paper) ? paper : await startPaperTextExtraction(paper));
        ensureRequestRunActive(chatRequestRef, token);
      }

      setChatLoadingState({ chatId: targetChatId, phase: "thinking", label: "Analysing..." });

      const availableDocumentNames = readyContextPapers
        .map((paper) => `"${paper.name}"`)
        .join(", ");
      const documentTitleHints = readyContextPapers
        .map((paper) => {
          const title = paperDisplayName(paper, getMeta);
          return title !== paper.name ? `- "${paper.name}" (title: ${title})` : `- "${paper.name}"`;
        })
        .join("\n");
      const basePayload = {
        model: selectedModel,
        max_output_tokens: 4096,
        text: { format: { type: "json_object" } },
        instructions: CHAT_SYSTEM_PROMPT,
        tools: [SEARCH_DOCUMENT_TOOL],
        reasoning: { effort: "low", summary: "detailed" },
      };

      let data = await requestOpenAIResponse(apiKey, {
        ...basePayload,
        input: [
          ...conversationHistory.map((message) => ({
            role: message.role === "ai" ? "assistant" : message.role,
            content: message.content,
          })),
          {
            role: "user",
            content: `Available documents (use exact file names with search_document):\n${documentTitleHints}\n\nQuestion: ${text}\n\nUse the search_document tool to retrieve evidence before answering. Respond in JSON format. Citation "file" must match an exact document name.`,
          },
        ],
      }, { signal: controller.signal });
      ensureRequestRunActive(chatRequestRef, token);
      addUsageTotals(usageTotals, data?.usage);
      console.log("[reasoning debug] first response output:", JSON.stringify(data?.output?.map(o => ({ type: o.type, summary: o.summary })), null, 2));
      const reasoning1 = extractReasoningSummary(data);
      if (reasoning1) pushThinkingStep({ id: `ts-${Date.now()}-r1`, chatId: targetChatId, type: "reasoning", label: "Reasoning", body: reasoning1 });

      let rounds = 0;
      while (rounds < MAX_SEARCH_TOOL_ROUNDS) {
        ensureRequestRunActive(chatRequestRef, token);
        const toolCalls = extractFunctionCalls(data);
        if (!toolCalls.length) break;

        rounds += 1;
        for (const call of toolCalls) {
          let args = {};
          try { args = JSON.parse(call.arguments || "{}"); } catch {}
          const q = String(args.query || "").trim();
          const doc = String(args.document_name || "").trim();
          pushThinkingStep({ id: `ts-${Date.now()}-s${rounds}-${call.call_id}`, chatId: targetChatId, type: "search", label: `Searching "${doc}" for "${q.length > 60 ? q.slice(0, 60) + "…" : q}"...` });
        }

        const richOutputs = toolCalls.map((call) => {
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

          const requestedQuery = String(args.query || "").trim() || text;
          const paper = findPaperByName(readyContextPapers, args.document_name);

          if (!paper) {
            return {
              toolOutput: {
                type: "function_call_output",
                call_id: call.call_id,
                output: `Document "${String(args.document_name || "").trim()}" was not found. Available documents: ${availableDocumentNames}`,
              },
              paperName: String(args.document_name || "").trim(),
              passageCount: 0,
              notFound: true,
            };
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

          return {
            toolOutput: {
              type: "function_call_output",
              call_id: call.call_id,
              output: formatSearchToolResult(paper, requestedQuery, passages),
            },
            paperName: paper.name,
            passageCount: passages.length,
            notFound: false,
          };
        });
        const toolOutputs = richOutputs.map(r => r.toolOutput);
        for (const r of richOutputs) {
          pushThinkingStep({ id: `ts-${Date.now()}-r${rounds}-${r.paperName}`, chatId: targetChatId, type: "result", label: r.notFound ? `Document not found: "${r.paperName}"` : `Found ${r.passageCount} passage${r.passageCount !== 1 ? "s" : ""} in "${r.paperName}"` });
        }

        data = await requestOpenAIResponse(apiKey, {
          ...basePayload,
          previous_response_id: data.id,
          input: toolOutputs,
        }, { signal: controller.signal });
        ensureRequestRunActive(chatRequestRef, token);
        addUsageTotals(usageTotals, data?.usage);
        const reasoningN = extractReasoningSummary(data);
        if (reasoningN) pushThinkingStep({ id: `ts-${Date.now()}-rn${rounds}`, chatId: targetChatId, type: "reasoning", label: "Continued reasoning", body: reasoningN });
      }

      // If still tool calls after max rounds, proceed anyway with the last response that has text

      const raw = extractResponseOutputText(data);
      let parsed;
      {
        const tryParseJson = (str) => { try { const p = JSON.parse(str); if (p?.answer) return p; } catch {} try { const p = JSON.parse(sanitizeJsonNewlines(str)); if (p?.answer) return p; } catch {} return null; };
        const lastBrace = raw.lastIndexOf('}');
        let found = null;
        if (lastBrace !== -1) {
          let pos = raw.indexOf('{');
          const starts = [];
          while (pos !== -1 && pos <= lastBrace) { starts.push(pos); pos = raw.indexOf('{', pos + 1); }
          for (let i = starts.length - 1; i >= 0; i--) { found = tryParseJson(raw.slice(starts[i], lastBrace + 1)); if (found) break; }
        }
        parsed = found || { answer: raw.replace(/```json|```/g, "").trim(), citations: [] };
      }

      const allPapers = folders.flatMap((folder) =>
        folder.papers.map((paper) => ({ ...paper, folderId: folder.id }))
      );
      const normalizedCitations = (parsed.citations || []).map((c) => {
        const requestedName = String(c.file || c.fileName || c.document || "").trim();
        const match =
          mapCitationFileToPaper(requestedName, allPapers) ||
          (requestedName
            ? allPapers.find((paper) => {
                const title = paperDisplayName(paper, getMeta);
                return title.toLowerCase() === requestedName.toLowerCase();
              })
            : null);
        const label = match ? paperDisplayName(match, getMeta) : requestedName || activePaper?.name || "Unknown file";
        return {
          ...c,
          fileName: match?.name || requestedName || activePaper?.name || "Unknown file",
          displayTitle: label,
          paperId: match?.id || activePaper?.id || null,
          folderId: match?.folderId || null,
        };
      });

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

      ensureRequestRunActive(chatRequestRef, token);
      updateMessageInChat(targetChatId, userMessage.id, (message) => ({
        ...message,
        usage: usageMeta,
      }));
      const capturedTrace = thinkingStepsRef.current.filter(s => s.chatId === targetChatId);
      appendMessageToChat(targetChatId, {
        id: createChatMessageId(),
        role: "ai",
        content: String(parsed.answer).replace(/^[,\s]+/, ""),
        citations: normalizedCitations,
        usage: usageMeta,
        thinkingTrace: capturedTrace,
      });
      clearThinkingSteps(targetChatId);
    } catch (e) {
      if (isAbortLikeError(e)) {
        clearThinkingSteps(targetChatId);
        return;
      }
      if (/No OpenAI API key is configured/i.test(e?.message || "")) {
        openSettingsModal("");
      }
      appendMessageToChat(targetChatId, {
        id: createChatMessageId(),
        role: "ai",
        content: `Could not prepare this chat request: ${e?.message || String(e)}`,
        citations: [],
      });
    } finally {
      finishRequestRun(chatRequestRef, token);
      setChatLoadingState(null);
    }
  };

  const askAI = async () => {
    const t = popup.text;
    setPopup(null);
    window.getSelection()?.removeAllRanges();
    await doSend(`Explain this passage: "${t.substring(0, 200)}${t.length > 200 ? "..." : ""}"`);
  };

  const handleCitationClick = (citation) => {
    if (citation?.kind === "web" || citation?.url) {
      const remotePaper = findMatchingRemotePaper(activeAgentRemotePapers, {
        remotePaperId: citation?.remotePaperId,
        title: citation?.title,
        sourceUrl: citation?.url,
        pdfUrl: citation?.pdfUrl,
      });
      const pdfUrl = normalizeAgentSourceUrl(citation?.pdfUrl || remotePaper?.pdfUrl || "");
      const sourceUrl = normalizeAgentSourceUrl(citation?.url || remotePaper?.sourceUrl || "");
      const localPaper = findWorkspacePaperForSource(agentWorkspacePapers, {
        title: citation?.title || remotePaper?.title || remotePaper?.name || "",
        sourceUrl,
        pdfUrl,
        doi: citation?.doi || remotePaper?.doi || "",
      });
      if (localPaper && currentView === "agent") {
        openAgentPaper(localPaper, {
          page: Number(citation?.page) || 1,
          searchText: citation?.text || citation?.note || "",
        });
        return;
      }
      if ((pdfUrl || remotePaper?.id) && currentView === "agent" && activeAgentChatId) {
        openAgentPreviewPaper({
          remotePaperId: remotePaper?.id || citation?.remotePaperId || null,
          title: citation?.title || remotePaper?.title || remotePaper?.name || "Remote paper",
          sourceUrl,
          pdfUrl,
          doi: citation?.doi || remotePaper?.doi || "",
        }, {
          chatId: activeAgentChatId,
          page: Number(citation?.page) || 1,
          searchText: citation?.text || citation?.note || "",
        }).catch(() => {});
        return;
      }
      if (sourceUrl) window.open(sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const targetPaperId = citation?.paperId || activePaper?.id;
    const owner = folders.find((f) => f.papers.some((p) => p.id === targetPaperId));
    const targetPaper = owner?.papers.find((p) => p.id === targetPaperId) || activePaper;

    const jump = (tries = 18) => {
      if (scrollFnRef.current) {
        scrollFnRef.current(Number(citation?.page) || 1, citation?.text || "");
        return;
      }
      if (tries > 0) setTimeout(() => jump(tries - 1), 120);
    };

    if (targetPaper && targetPaper.id !== activeTabId) {
      if (owner?.id) {
        openPaper(targetPaper, owner.id).then(() => {
          setTimeout(() => jump(), 220);
        }).catch(() => {});
      } else {
        setCurrentView("reader");
        setActiveTabId(targetPaper.id);
        scrollFnRef.current = null;
        setTimeout(() => jump(), 220);
      }
      return;
    }
    jump();
  };

  const renderUsageMeta = useCallback((message) => {
    const usage = message?.usage;
    if (!usage?.model) return null;

    if (message.role === "user" && usage.inputTokens > 0) {
      const details = [
        usage.model,
        `${formatTokenCount(usage.inputTokens)} input tok`,
      ];
      if (usage.cachedInputTokens > 0) {
        details.push(`${formatTokenCount(usage.cachedInputTokens)} cached`);
      }
      const formattedCost = formatUsd(usage.inputCost);
      if (formattedCost) details.push(formattedCost);
      return React.createElement("div", { className: "chat-usage-meta" }, details.join(" | "));
    }

    if (message.role === "ai" && usage.outputTokens > 0) {
      const details = [
        usage.model,
        `${formatTokenCount(usage.outputTokens)} output tok`,
      ];
      if (usage.reasoningTokens > 0) {
        details.push(`${formatTokenCount(usage.reasoningTokens)} reasoning`);
      }
      const formattedCost = formatUsd(usage.outputCost);
      if (formattedCost) details.push(formattedCost);
      return React.createElement("div", { className: "chat-usage-meta" }, details.join(" | "));
    }

    return null;
  }, []);

  return { doSend, askAI, handleCitationClick, renderUsageMeta };
}
