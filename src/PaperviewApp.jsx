import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  saveChat,
  saveAgentChat,
  saveUploadedPdf,
} from './db';
import { clearOcrMemoryCache, extractPdfText, terminateTesseractWorkerNow, validatePdfBytes } from './pdfUtils';
import { IFolder, IFolderOpen, IFile, IPlus, ISearch, IUpload, IClose, ICopy, IZoomIn, IZoomOut, IPanel, IGrid, IChat, IMore, ILeft, IRight, ISpark, IPaperclip, IChevronDown, IArrowUp, IArrowDown, IChevronLeftDouble, IChevronRightDouble, ITrash, IGear, IHighlight, INotes } from './icons';
import { CSS } from './styles';
import { createAgentChatThreadRecord, createChatThreadRecord, formatChatTimestamp, formatChatMessageCount, derivePageTexts } from './chatUtils';
import TextFallback from './TextFallback';
import InlineCitedAnswer from './InlineCitedAnswer';
import PdfViewer from './PdfViewer';
import { selectRelevantPassages } from './ragUtils';
import { addUsageTotals, createUsageTotals, getUsageBreakdown, formatTokenCount, formatUsd } from './openaiPricing';
import { evictUnpinnedPayloads, mergePaperWithPayload, pickPaperPayload, stripPaperPayload } from './paperPayloadUtils';
import { usePaperPayloads } from './hooks/usePaperPayloads';

import {
  OPENAI_MODEL,
  OPENAI_MODELS,
  CHAT_SYSTEM_PROMPT,
  SEARCH_DOCUMENT_TOOL,
  FETCH_REMOTE_PAPER_TOOL,
  AGENT_WEB_SEARCH_TOOL,
  AGENT_SYSTEM_PROMPT,
  MAX_SEARCH_TOOL_ROUNDS,
  MAX_AGENT_RESEARCH_PASSES,
  TARGET_FOUND_SOURCES,
  MAX_FOUND_SOURCES_SHOWN,
  AGENT_MAX_OUTPUT_TOKENS,
  AGENT_FINALIZE_MAX_OUTPUT_TOKENS,
} from './constants';
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
} from './openaiResponseParsing';
import {
  stripPdfExtension,
  isPdfUrl,
  normalizeAgentSourceUrl,
  getUrlHost,
  buildAgentImportKey,
  summarizeToWordLimit,
  formatSourceAuthors,
  buildRemotePaperKey,
  buildFoundSources,
  getMessageFoundSources,
  findMatchingRemotePaper,
  findPaperByName,
  findWorkspacePaperForSource,
  isManualPdfFetchError,
  buildManualPdfFetchMessage,
} from './agentSources';
import {
  createChatMessageId,
  makeStableId,
  hasExtractedPaperText,
  buildFolderPath,
  isAbortLikeError,
} from './miscUtils';
import ThinkingTrace from './ThinkingTrace';
import SettingsModal from './components/SettingsModal';
import UploadModal from './components/UploadModal';
import FolderPermModal from './components/FolderPermModal';
import { useApiKey } from './hooks/useApiKey';
import { useRequestRuns } from './hooks/useRequestRun';
import { usePanelResize } from './hooks/usePanelResize';
import { useViewerSearch } from './hooks/useViewerSearch';
import { useAnnotations } from './hooks/useAnnotations';
import { useChatThreads } from './hooks/useChatThreads';
import { useAgentThreads } from './hooks/useAgentThreads';
import { useFolders } from './hooks/useFolders';

export default function PaperviewApp() {
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [input, setInput] = useState("");
  const [agentInput, setAgentInput] = useState("");
  const [chatLoadingState, setChatLoadingState] = useState(null);
  const [agentLoadingState, setAgentLoadingState] = useState(null);
  const [agentRemotePapersByThread, setAgentRemotePapersByThread] = useState({});
  const [popup, setPopup] = useState(null);
  const [chip, setChip] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [upFolder, setUpFolder] = useState("");
  const [upStatus, setUpStatus] = useState(null);
  const [upStatusText, setUpStatusText] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [agentSidebarOpen, setAgentSidebarOpen] = useState(true);
  const [chatPaneMode, setChatPaneMode] = useState("chat");
  const [currentView, setCurrentView] = useState("library");
  const [selectedModel, setSelectedModel] = useState(OPENAI_MODEL);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [agentAttachMenuOpen, setAgentAttachMenuOpen] = useState(false);
  const [agentToolMenuOpen, setAgentToolMenuOpen] = useState(false);
  const [selectedAgentToolId, setSelectedAgentToolId] = useState(null);
  const [selectedChatPaperIds, setSelectedChatPaperIds] = useState([]);
  const [chatContextMode, setChatContextMode] = useState("auto");
  const [selectedAgentPaperIds, setSelectedAgentPaperIds] = useState([]);
  const [agentImportStates, setAgentImportStates] = useState({});
  const [agentPreviewState, setAgentPreviewState] = useState(null);
  const [agentPreviewScale, setAgentPreviewScale] = useState(1.05);
  const [agentPreviewPage, setAgentPreviewPage] = useState(1);
  const [agentPreviewWidth, setAgentPreviewWidth] = useState(null);
  const { width: chatWidth, startResize: startChatResizeBase } = usePanelResize({ initialWidth: 480, min: 340, max: 760, direction: "right" });
  const { width: sidebarWidth, startResize: startSbResizeBase } = usePanelResize({ initialWidth: 260, min: 180, max: 520, direction: "left" });
  const { startResize: startAgentPreviewResizeBase } = usePanelResize({ initialWidth: 420, min: 300, max: 900, direction: "right" });
  const [currentPage, setCurrentPage] = useState(1);

  const [scale, setScale] = useState(1.4);

  const [privacyAccepted, setPrivacyAccepted] = useState(() => !!localStorage.getItem('pv-privacy-ok'));
  const [showFolderPermModal, setShowFolderPermModal] = useState(false);
  const {
    apiKey,
    apiKeySource,
    rememberedApiKeyAvailable,
    showSettings,
    settingsKey,
    setSettingsKey,
    settingsKeyVisible,
    setSettingsKeyVisible,
    rememberApiKey,
    setRememberApiKey,
    settingsPassphrase,
    setSettingsPassphrase,
    settingsPassphraseVisible,
    setSettingsPassphraseVisible,
    unlockPassphrase,
    setUnlockPassphrase,
    unlockPassphraseVisible,
    setUnlockPassphraseVisible,
    settingsError,
    setSettingsError,
    settingsBusy,
    openSettingsModal,
    closeSettingsModal,
    handleRemoveApiKey,
    handleUnlockRememberedApiKey,
    handleSaveSettingsApiKey,
    setRememberedApiKeyAvailable,
  } = useApiKey();
  const [edgeToast, setEdgeToast] = useState(false);
  const [debugCitations] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has("debugCitations");
    } catch {
      return false;
    }
  });
  const [agentFolderCheckStates, setAgentFolderCheckStates] = useState({});

  const endRef = useRef(null);
  const taRef = useRef(null);
  const agentEndRef = useRef(null);
  const agentTaRef = useRef(null);
  const agentPreviewScrollFnRef = useRef(null);
  const agentPreviewPaneRef = useRef(null);
  const fileRef = useRef(null);
  const scrollFnRef = useRef(null);
  const modelMenuRef = useRef(null);
  const attachMenuRef = useRef(null);
  const agentAttachMenuRef = useRef(null);
  const agentToolMenuRef = useRef(null);


  const syncRootFolderSnapshotRef = useRef(null);
  const agentRemotePaperJobsRef = useRef(new Map());
  const {
    chatRequestRef,
    agentRequestRef,
    beginRequestRun,
    ensureRequestRunActive,
    finishRequestRun,
  } = useRequestRuns();

  useEffect(() => () => { terminateTesseractWorkerNow().catch(() => {}); }, []);

  // Show one-time toast for Edge users about mini menu
  useEffect(() => {
    const isEdge = /Edg\//i.test(navigator.userAgent);
    if (isEdge && !localStorage.getItem('pv-edge-toast-dismissed')) {
      setEdgeToast(true);
    }
  }, []);

  const handlePdfReady = useCallback((fn) => {
    scrollFnRef.current = fn;
  }, []);

  const activePaperDescriptor = openTabs.find((t) => t.id === activeTabId) || null;
  const {
    paperPayloads,
    setPaperPayloads,
    paperPayloadsRef,
    paperScanStates,
    setPaperScanStates,
    paperTextJobsRef,
    getPaperPayload,
    updatePaperPayload,
    mergePaperRecord,
    evictPaperPayload,
    updatePaperEverywhere,
    updatePaperScanState,
    handlePdfDocumentLoad,
    ensurePaperPdfBytes,
    startPaperTextExtraction,
  } = usePaperPayloads({
    setFolders,
    setOpenTabs,
    activePaperDescriptor,
    activePaperId: activePaperDescriptor?.id,
  });
  const activePaper = useMemo(() => mergePaperRecord(activePaperDescriptor), [activePaperDescriptor, mergePaperRecord]);
  const selectedFolder = folders.find((f) => f.id === selectedFolderId) || null;


  const activeFolder =
    folders.find((f) => f.papers.some((p) => p.id === activeTabId)) ||
    selectedFolder ||
    null;
  const activeFolderPapers = activeFolder?.papers || [];
  const totalPaperCount = folders.reduce((sum, folder) => sum + folder.papers.length, 0);
  const selectedRootFolderId = selectedFolder?.rootFolderId || null;
  const selectedRootFolder = folders.find((folder) => folder.id === selectedRootFolderId) || null;
  const hasWritableAgentContext = Boolean(selectedRootFolder?.directoryHandle && selectedRootFolder?.rootHandle);
  const agentWorkspacePapers = useMemo(
    () =>
      selectedRootFolderId
        ? folders
            .filter((folder) => folder.rootFolderId === selectedRootFolderId)
            .flatMap((folder) => folder.papers.map((paper) => mergePaperRecord({ ...paper, folderId: folder.id })))
        : [],
    [folders, mergePaperRecord, selectedRootFolderId]
  );
  const searchablePageTexts = useMemo(() => derivePageTexts(activePaper), [activePaper]);
  const activePaperTotalPages = Math.max(1, Number(activePaper?.pages) || searchablePageTexts.length || 1);
  const activePaperScanState = activePaper?.id ? paperScanStates[activePaper.id] : null;
  const activePaperScanProgress = Math.max(
    0,
    Math.min(1, Number(activePaperScanState?.progress ?? activePaper?.textProgress) || 0)
  );
  const activePaperScanPercent = Math.round(activePaperScanProgress * 100);
  const isActivePaperScanning = (activePaperScanState?.status || activePaper?.textStatus) === "scanning";
  const activePaperScanLabel = activePaperScanState?.label || activePaper?.textStatusText || "Scanning paper...";

  const activeChat = useMemo(
    () => chatThreads.find((thread) => thread.id === activeChatId) || null,
    [chatThreads, activeChatId]
  );
  const activeAgentChat = useMemo(
    () => agentThreads.find((thread) => thread.id === activeAgentChatId && thread.rootFolderId === selectedRootFolderId) || null,
    [agentThreads, activeAgentChatId, selectedRootFolderId]
  );
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
  const currentMessages = activeChat?.messages || [];
  const currentAgentMessages = activeAgentChat?.messages || [];
  const activePaperThreads = useMemo(() => {
    if (!activePaper?.id) return [];
    return chatThreads
      .filter((thread) => thread.paperId === activePaper.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [chatThreads, activePaper?.id]);
  const selectedRootAgentThreads = useMemo(() => {
    if (!selectedRootFolderId) return [];
    return agentThreads
      .filter((thread) => thread.rootFolderId === selectedRootFolderId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [agentThreads, selectedRootFolderId]);

  const chatContextPapers = useMemo(() => {
    const paperPool = (activeFolderPapers.length ? activeFolderPapers : openTabs).filter(Boolean);
    const byId = new Map(paperPool.map((paper) => [paper.id, paper]));
    const explicitlySelected = selectedChatPaperIds.map((id) => byId.get(id)).filter(Boolean);
    if (chatContextMode === "manual") {
      return explicitlySelected.length ? explicitlySelected : (activePaper ? [activePaper] : []);
    }
    return activePaper ? [activePaper] : explicitlySelected;
  }, [activeFolderPapers, openTabs, selectedChatPaperIds, activePaper, chatContextMode]);
  const agentContextPapers = useMemo(() => {
    const byId = new Map(agentWorkspacePapers.map((paper) => [paper.id, paper]));
    return selectedAgentPaperIds.map((id) => byId.get(id)).filter(Boolean);
  }, [agentWorkspacePapers, selectedAgentPaperIds]);
  const activePaperMessageCount = useMemo(
    () => activePaperThreads.reduce((sum, thread) => sum + thread.messages.length, 0),
    [activePaperThreads]
  );
  const savedPaperThreads = useMemo(
    () => activePaperThreads.filter((thread) => thread.id !== activeChatId),
    [activePaperThreads, activeChatId]
  );
  const savedAgentThreads = useMemo(
    () => selectedRootAgentThreads.filter((thread) => thread.id !== activeAgentChatId),
    [selectedRootAgentThreads, activeAgentChatId]
  );
  const lastActiveMessage = currentMessages[currentMessages.length - 1] || null;
  const lastActiveAgentMessage = currentAgentMessages[currentAgentMessages.length - 1] || null;
  const activeChatLoadingState =
    chatLoadingState?.chatId === activeChatId && lastActiveMessage?.role === "user"
      ? chatLoadingState
      : null;
  const activeAgentLoadingState =
    agentLoadingState?.chatId === activeAgentChatId && lastActiveAgentMessage?.role === "user"
      ? agentLoadingState
      : null;
  const isChatLoading = Boolean(activeChatLoadingState);
  const isAgentLoading = Boolean(activeAgentLoadingState);
  const chatLoadingLabel =
    activeChatLoadingState?.phase === "scanning" && isActivePaperScanning
      ? `${activePaperScanLabel} (${activePaperScanPercent}%)`
      : activeChatLoadingState?.label || "Analysing...";
  const agentLoadingLabel = activeAgentLoadingState?.label || "Researching...";
  const activeChatSummary = activeChat ? `${formatChatMessageCount(currentMessages.length)} · ${formatChatTimestamp(activeChat.updatedAt)}` : "No active chat";
  const activeAgentSummary = activeAgentChat ? `${formatChatMessageCount(currentAgentMessages.length)} · ${formatChatTimestamp(activeAgentChat.updatedAt)}` : "No active agent chat";
  const chatQuickActions = [
    {
      title: "Summarize the paper's main claim",
      meta: "Fast overview",
      prompt: "Summarize the paper's main claim",
      icon: <ISpark size={13} />,
    },
    {
      title: "What methodology does this paper use?",
      meta: "Methods and design",
      prompt: "What methodology does this paper use?",
      icon: <ISearch size={13} />,
    },
    {
      title: "List the strongest limitations",
      meta: "Critical reading",
      prompt: "List the strongest limitations",
      icon: <IChat size={13} />,
    },
  ];
  const agentTools = [
    {
      id: "research",
      title: "Research",
      meta: "Deep web + library synthesis",
      placeholder: "Ask Paperview Agent to research a topic using the web and any selected local papers...",
      allowWebSearch: true,
      allowLocalSearch: true,
      reasoningEffort: "medium",
      reasoningEffortWithLocal: "high",
      instruction: "Selected Agent tool: Research. Perform a deeper research pass that synthesizes evidence across web_search and any attached local PDFs. Use web_search for discovery, use search_document for attached local papers, compare findings carefully, and surface nuanced agreements, disagreements, and evidence gaps.",
      icon: <ISpark size={13} />,
    },
    {
      id: "search-papers",
      title: "Search for papers",
      meta: "Discover literature",
      placeholder: "Ask Paperview Agent to find papers on a topic...",
      allowWebSearch: true,
      allowLocalSearch: true,
      reasoningEffort: "low",
      instruction: "Selected Agent tool: Search for papers. Prioritize web_search to find relevant literature and return paper_results when useful. Use local PDFs only when they materially help the answer.",
      icon: <ISearch size={13} />,
    },
    {
      id: "outline-review",
      title: "Outline literature review",
      meta: "Structure a review",
      placeholder: "Describe the topic you want a literature review outline for...",
      allowWebSearch: true,
      allowLocalSearch: true,
      reasoningEffort: "medium",
      instruction: "Selected Agent tool: Outline literature review. Produce a concise but well-structured review outline with themes, subtopics, and key papers. Use web_search for discovery and weave in attached local PDFs when relevant.",
      icon: <ISpark size={13} />,
    },
    {
      id: "compare-library",
      title: "Compare with my library",
      meta: "Web + local context",
      placeholder: "Ask for a comparison between current literature and your attached local papers...",
      allowWebSearch: true,
      allowLocalSearch: true,
      reasoningEffort: "medium",
      instruction: "Selected Agent tool: Compare with my library. Compare discovered web sources with the attached local PDFs. If no local PDFs are attached for this turn, say that clearly and continue with web evidence only.",
      icon: <IChat size={13} />,
    },
    {
      id: "search-workspace",
      title: "Search workspace",
      meta: "Use local PDFs only",
      placeholder: "Ask Paperview Agent to search only the attached local workspace papers...",
      allowWebSearch: false,
      allowLocalSearch: true,
      reasoningEffort: "low",
      instruction: "Selected Agent tool: Search workspace. Do not use web_search. Use only attached local PDFs through search_document. If no local PDFs are attached for this turn, say that clearly and ask the user to attach local papers.",
      icon: <IFolder size={13} />,
    },
  ];

  const selectedAgentTool = useMemo(
    () => agentTools.find((tool) => tool.id === selectedAgentToolId) || null,
    [agentTools, selectedAgentToolId]
  );

  const focusAgentComposer = useCallback(() => {
    requestAnimationFrame(() => {
      const textarea = agentTaRef.current;
      if (!textarea) return;
      textarea.focus();
      const caret = textarea.value.length;
      try {
        textarea.setSelectionRange(caret, caret);
      } catch {
        // Some browsers do not expose setSelectionRange for every textarea state.
      }
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, []);

  const selectAgentTool = useCallback((toolId) => {
    setSelectedAgentToolId(toolId);
    setAgentToolMenuOpen(false);
    focusAgentComposer();
  }, [focusAgentComposer]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, activeChatId]);

  useEffect(() => {
    agentEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentAgentMessages, activeAgentChatId]);

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

  useEffect(() => {
    const pinnedIds = new Set([activeTabId, agentPreviewState?.paperId].filter(Boolean));
    const evictedIds = Object.keys(paperPayloads).filter((paperId) => !pinnedIds.has(paperId));
    if (!evictedIds.length) return;
    evictedIds.forEach((paperId) => clearOcrMemoryCache(paperId));
    setPaperPayloads((prev) => evictUnpinnedPayloads(prev, pinnedIds));
  }, [activeTabId, agentPreviewState?.paperId, paperPayloads]);

  useEffect(() => {
    if (chatLoadingState?.chatId !== activeChatId) return;
    if (!lastActiveMessage || lastActiveMessage.role !== "user") {
      setChatLoadingState(null);
    }
  }, [activeChatId, chatLoadingState, lastActiveMessage]);

  useEffect(() => {
    if (agentLoadingState?.chatId !== activeAgentChatId) return;
    if (!lastActiveAgentMessage || lastActiveAgentMessage.role !== "user") {
      setAgentLoadingState(null);
    }
  }, [activeAgentChatId, agentLoadingState, lastActiveAgentMessage]);

  const activateReaderTab = useCallback((tabId) => {
    const descriptor = openTabs.find((tab) => tab.id === tabId);
    if (!descriptor) return;

    setActiveTabId(tabId);
    setCurrentView("reader");
    scrollFnRef.current = null;

    ensurePaperPdfBytes(descriptor)
      .then((hydratedPaper) => {
        if (!hasExtractedPaperText(hydratedPaper)) {
          startPaperTextExtraction(descriptor).catch(() => {});
        }
      })
      .catch((error) => {
        console.error('Failed to activate tab paper:', error);
      });
  }, [ensurePaperPdfBytes, openTabs, startPaperTextExtraction]);

  useEffect(() => {
    if (!activePaper?.id) {
      setActiveChatId(null);
      return;
    }

    const paperThreads = chatThreads
      .filter((thread) => thread.paperId === activePaper.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (paperThreads.length) {
      const alreadyActive = paperThreads.some((thread) => thread.id === activeChatId);
      if (!alreadyActive) {
        setActiveChatId(paperThreads[0].id);
      }
      return;
    }

    const thread = createChatThreadRecord(activePaper.id);
    setChatThreads((prev) => [thread, ...prev]);
    saveChat(thread).catch(() => {});
    syncFolderForPaper(thread.paperId);
    setActiveChatId(thread.id);
  }, [activePaper?.id]);

  useEffect(() => {
    if (!selectedRootFolderId || !hasWritableAgentContext) {
      setActiveAgentChatId(null);
      return;
    }

    const rootThreads = agentThreads
      .filter((thread) => thread.rootFolderId === selectedRootFolderId)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (rootThreads.some((thread) => thread.id === activeAgentChatId)) {
      return;
    }

    if (rootThreads.length) {
      setActiveAgentChatId(rootThreads[0].id);
      return;
    }

    const thread = createAgentChatThreadRecord(selectedRootFolderId);
    setAgentThreads((prev) => [thread, ...prev]);
    saveAgentChat(thread)
      .then(() => syncRootFolderSnapshotRef.current?.(selectedRootFolderId))
      .catch(() => {});
    setActiveAgentChatId(thread.id);
  }, [selectedRootFolderId, hasWritableAgentContext, activeAgentChatId, agentThreads]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTabId]);

  useEffect(() => {
    const availableIds = new Set(activeFolderPapers.map((p) => p.id));
    const next = selectedChatPaperIds.filter((id) => availableIds.has(id));

    if (chatContextMode === "auto") {
      const desired = activePaper && availableIds.has(activePaper.id) ? [activePaper.id] : next;
      const unchanged =
        desired.length === selectedChatPaperIds.length &&
        desired.every((id, index) => selectedChatPaperIds[index] === id);
      if (!unchanged) {
        setSelectedChatPaperIds(desired);
      }
      return;
    }

    if (!next.length && activePaper && availableIds.has(activePaper.id)) {
      setChatContextMode("auto");
      setSelectedChatPaperIds([activePaper.id]);
      return;
    }

    if (
      next.length !== selectedChatPaperIds.length ||
      next.some((id, index) => selectedChatPaperIds[index] !== id)
    ) {
      setSelectedChatPaperIds(next);
    }
  }, [activeFolderPapers, activePaper, selectedChatPaperIds, chatContextMode]);

  useEffect(() => {
    const availableIds = new Set(agentWorkspacePapers.map((p) => p.id));
    const next = selectedAgentPaperIds.filter((id) => availableIds.has(id));
    if (next.length !== selectedAgentPaperIds.length) {
      setSelectedAgentPaperIds(next);
    }
  }, [agentWorkspacePapers, selectedAgentPaperIds]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!modelMenuRef.current?.contains(e.target)) {
        setModelMenuOpen(false);
      }
      if (!attachMenuRef.current?.contains(e.target)) {
        setAttachMenuOpen(false);
      }
      if (!agentAttachMenuRef.current?.contains(e.target)) {
        setAgentAttachMenuOpen(false);
      }
      if (!agentToolMenuRef.current?.contains(e.target)) {
        setAgentToolMenuOpen(false);
      }
      // Dismiss citation highlights on any click (unless clicking a source card)
      if (!e.target.closest(".source-card")) {
        document.querySelectorAll(".cit-svg").forEach((s) => s.remove());
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (!text || text.length < 3) {
          setPopup(null);
          return;
        }
        try {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          const viewer = document.querySelector(".viewer");
          if (!viewer) return;
          const vr = viewer.getBoundingClientRect();
          if (rect.right < vr.left || rect.left > vr.right) return;
          setPopup({ text, x: rect.left + rect.width / 2, y: rect.top });
        } catch {
          // ignore
        }
      }, 50);
    };
    document.addEventListener("mouseup", handler);
    // Suppress Edge mini menu on text selection
    document.addEventListener("mscontrolselect", (e) => e.preventDefault());
    return () => document.removeEventListener("mouseup", handler);
  }, []);

  // Trigger a folder snapshot write for the folder that owns a given paper
  const syncFolderForPaper = (paperId) => {
    if (!paperId) return;
    for (const folder of foldersRef.current) {
      if (folder.papers.some((p) => p.id === paperId)) {
        syncRootFolderSnapshotRef.current?.(folder.rootFolderId)?.catch(() => {});
        return;
      }
    }
  };

  const {
    annotations,
    setAnnotations,
    annPopover,
    setAnnPopover,
    annComment,
    setAnnComment,
    handleHighlight,
    handleAnnotationClick,
    saveAnnotationComment,
    deleteAnnotationById,
  } = useAnnotations({ activePaper, popup, setPopup, syncFolderForPaper });

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

  const {
    chatThreads,
    setChatThreads,
    activeChatId,
    setActiveChatId,
    chatThreadsRef,
    thinkingSteps,
    thinkingStepsRef,
    thinkingExpanded,
    setThinkingExpanded,
    pushThinkingStep,
    clearThinkingSteps,
    appendMessageToChat,
    updateMessageInChat,
    startNewChat,
    openChatThread,
    resetActiveChatHistory,
    resetChatThreadById,
    deleteChatThread,
    stopChatRun,
  } = useChatThreads({
    syncFolderForPaper,
    chatRequestRef,
    activePaper,
    chatLoadingState,
    setChatLoadingState,
    setInput,
    setChip,
    setChatPaneMode,
  });

  const {
    agentThreads,
    setAgentThreads,
    activeAgentChatId,
    setActiveAgentChatId,
    agentThreadsRef,
    agentThinkingSteps,
    agentThinkingStepsRef,
    agentThinkingExpanded,
    setAgentThinkingExpanded,
    pushAgentThinkingStep,
    clearAgentThinkingSteps,
    appendMessageToAgentChat,
    updateMessageInAgentChat,
    startNewAgentChat,
    openAgentThread,
    resetActiveAgentHistory,
    resetAgentThreadById,
    deleteAgentThread,
    stopAgentRun,
  } = useAgentThreads({
    syncRootFolderSnapshotRef,
    agentRequestRef,
    selectedRootFolderId,
    hasWritableAgentContext,
    agentLoadingState,
    setAgentLoadingState,
    setAgentInput,
    setSelectedAgentPaperIds,
    setAgentPreviewState,
    agentPreviewScrollFnRef,
    clearAgentRemotePapersForThread,
  });

  const {
    folders,
    setFolders,
    foldersRef,
    selectedFolderId,
    setSelectedFolderId,
    newFolder,
    nfName,
    setNfName,
    folderError,
    setFolderError,
    folderHandlesMapRef,
    scanDirHandleRef,
    toggleFolder,
    createFolder,
    startNewFolder,
    cancelNewFolder,
    deletePaper,
    deleteFolder,
    refreshRootFolderContents,
    importPaperResult,
    handleOpenFolder,
  } = useFolders({
    setOpenTabs,
    setActiveTabId,
    activeTabId,
    setCurrentView,
    setChatThreads,
    setAgentThreads,
    agentThreadsRef,
    activeAgentChat,
    setActiveAgentChatId,
    setAgentInput,
    setSelectedAgentPaperIds,
    setAnnotations,
    evictPaperPayload,
    setAgentImportStates,
    selectedRootFolderId,
    hasWritableAgentContext,
    openAgentPaper,
    setUpFolder,
    syncRootFolderSnapshotRef,
  });


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

  const startChatResize = useCallback(
    (event) => startChatResizeBase(event, { enabled: chatOpen }),
    [chatOpen, startChatResizeBase]
  );

  const startSbResize = useCallback(
    (event) => startSbResizeBase(event, { enabled: sidebarOpen }),
    [sidebarOpen, startSbResizeBase]
  );

  const startAgentPreviewResize = useCallback(
    (event) => startAgentPreviewResizeBase(event, {
      enabled: hasAgentPreview,
      startWidth: agentPreviewPaneRef.current?.offsetWidth || 420,
    }),
    [hasAgentPreview, startAgentPreviewResizeBase]
  );

  const openPaper = async (paper, folderId) => {
    const ownerFolder =
      folders.find((f) => f.id === folderId) ||
      folders.find((f) => f.papers.some((p) => p.id === paper.id));
    if (ownerFolder) {
      setSelectedFolderId(ownerFolder.id);
      setFolders((prev) => prev.map((f) => (f.id === ownerFolder.id ? { ...f, expanded: true } : f)));
    }

    let readyPaper = paper;
    try {
      readyPaper = await ensurePaperPdfBytes(paper);
    } catch (err) {
      console.error('Failed to load PDF:', err);
      alert(`Could not open "${paper.name}".\n\n${err?.message || String(err)}`);
      return;
    }

    const readyDescriptor = stripPaperPayload(readyPaper);
    if (!openTabs.find((t) => t.id === readyDescriptor.id)) setOpenTabs((p) => [...p, readyDescriptor]);
    else setOpenTabs((p) => p.map((t) => t.id === readyDescriptor.id ? readyDescriptor : t));
    setActiveTabId(readyPaper.id);
    setCurrentView("reader");
    scrollFnRef.current = null;

    if (!hasExtractedPaperText(readyPaper)) {
      startPaperTextExtraction(readyDescriptor).catch(() => {});
    }
  };

  const openAgentPaper = useCallback(async (paper, options = {}) => {
    if (!paper) return;
    const ownerFolder =
      foldersRef.current.find((folder) => folder.id === paper.folderId) ||
      foldersRef.current.find((folder) => folder.papers.some((candidate) => candidate.id === paper.id));
    if (!ownerFolder) return;

    try {
      const readyPaper = await ensurePaperPdfBytes(paper);
      setSelectedFolderId(ownerFolder.id);
      setUpFolder(ownerFolder.id);
      setCurrentView("agent");
      setFolders((prev) => prev.map((folder) => (
        folder.id === ownerFolder.id || folder.id === ownerFolder.rootFolderId
          ? { ...folder, expanded: true }
          : folder
      )));
      setAgentPreviewWidth(null);
      setAgentPreviewState({
        chatId: activeAgentChatId,
        paperId: readyPaper.id,
        page: Number(options.page) || 1,
        searchText: options.searchText || "",
      });
      setAgentPreviewPage(Number(options.page) || 1);
      agentPreviewScrollFnRef.current = null;
      if (!hasExtractedPaperText(readyPaper)) {
        startPaperTextExtraction(readyPaper).catch(() => {});
      }
      setTimeout(() => {
        if (options.page || options.searchText) {
          jumpAgentPreviewToLocation(options.page || 1, options.searchText || "");
        }
      }, 120);
    } catch (err) {
      console.error('Failed to open paper in agent mode:', err);
      alert(`Could not open "${paper.name}".\n\n${err?.message || String(err)}`);
    }
  }, [activeAgentChatId, ensurePaperPdfBytes, jumpAgentPreviewToLocation, startPaperTextExtraction]);

  const openFolderTabs = (folderId, options = {}) => {
    const { forceReader = true } = options;
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    setSelectedFolderId(folderId);
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, expanded: true } : f)));
    if (forceReader) setCurrentView("reader");
    scrollFnRef.current = null;
  };

  const openAllPapersInFolder = useCallback(async (folderId, options = {}) => {
    const { forceReader = true } = options;
    const folder = foldersRef.current.find((item) => item.id === folderId);
    if (!folder) return;
    if (folder.papers.length > 4 && !window.confirm(`Open all ${folder.papers.length} papers in "${folder.name}"? This may still use more memory than opening one paper at a time.`)) {
      return;
    }

    setSelectedFolderId(folderId);
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, expanded: true } : f)));
    setOpenTabs(folder.papers.map((paper) => stripPaperPayload(paper)));
    setActiveTabId((prev) => (folder.papers.some((paper) => paper.id === prev) ? prev : folder.papers[0]?.id || null));
    if (forceReader) setCurrentView("reader");
    scrollFnRef.current = null;

    if (folder.papers[0]) {
      ensurePaperPdfBytes(folder.papers[0]).catch(() => {});
    }
  }, [ensurePaperPdfBytes]);

  const closeTab = (e, id) => {
    e.stopPropagation();
    const remaining = openTabs.filter((t) => t.id !== id);
    setOpenTabs(remaining);
    if (agentPreviewState?.paperId !== id) {
      evictPaperPayload(id);
    }
    if (activeTabId === id) {
      setActiveTabId(remaining[remaining.length - 1]?.id || null);
    }
    if (remaining.length === 0) {
      terminateTesseractWorkerNow().catch(() => {});
    }
  };

  const addToChat = () => {
    setChip(popup.text);
    setPopup(null);
    window.getSelection()?.removeAllRanges();
    taRef.current?.focus();
  };

  const goToPage = useCallback(
    (requestedPage, searchText = "", occurrenceIndex) => {
      const total = activePaperTotalPages;
      const page = Math.max(1, Math.min(total, Number(requestedPage) || 1));
      setCurrentPage(page);
      if (scrollFnRef.current) scrollFnRef.current(page, searchText, occurrenceIndex);
    },
    [activePaperTotalPages]
  );

  const {
    viewerSearchOpen,
    setViewerSearchOpen,
    viewerSearchQuery,
    setViewerSearchQuery,
    viewerSearchStatus,
    viewerSearchMatches,
    viewerSearchIndex,
    viewerSearchInputRef,
    canRunViewerSearch,
    hasViewerSearchResults,
    runViewerSearch,
    handleSearchClick,
  } = useViewerSearch({ activePaper, currentPage, goToPage, resetKey: activeTabId });


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
      const contextPapers = chatContextPapers;
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
              ? `Scanning ${contextPapers[0].name} for chat...`
              : `Scanning ${contextPapers.length} papers for chat...`,
        });
      }
      for (const paper of contextPapers) {
        readyContextPapers.push(hasExtractedPaperText(paper) ? paper : await startPaperTextExtraction(paper));
        ensureRequestRunActive(chatRequestRef, token);
      }

      setChatLoadingState({ chatId: targetChatId, phase: "thinking", label: "Analysing..." });

      const availableDocumentNames = readyContextPapers.map((paper) => `"${paper.name}"`).join(", ");
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
            content: `Available documents: ${availableDocumentNames}\n\nQuestion: ${text}\n\nUse the search_document tool to retrieve evidence before answering. Respond in JSON format.`,
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
      const norm = (v) => String(v || "").trim().toLowerCase();
      const normalizedCitations = (parsed.citations || []).map((c) => {
        const requestedName = String(c.file || c.fileName || c.document || "").trim();
        const match = requestedName
          ? allPapers.find((paper) => norm(paper.name) === norm(requestedName))
          : null;
        return {
          ...c,
          fileName: match?.name || requestedName || activePaper?.name || "Unknown file",
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
      return <div className="chat-usage-meta">{details.join(" | ")}</div>;
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
      return <div className="chat-usage-meta">{details.join(" | ")}</div>;
    }

    return null;
  }, []);

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


  const renderFoundSourcesPanel = useCallback((message) => {
    const foundSourcesMeta = getMessageFoundSources(message, activeAgentRemotePapers);
    if (!foundSourcesMeta.shown.length) return null;

    return (
      <section className="agent-found-sources">
        <div className="agent-found-sources-head">
          <div className="agent-found-sources-title">
            Found {foundSourcesMeta.total} source{foundSourcesMeta.total === 1 ? "" : "s"}
          </div>
          <div className="agent-found-sources-subtitle">
            Showing the top {foundSourcesMeta.shown.length} ranked by relevance
          </div>
        </div>

        <div className="agent-found-sources-list">
          {foundSourcesMeta.shown.map((source, index) => {
            const authorLine = formatSourceAuthors(source.authors);
            const venueLine = [source.venue, source.year].filter(Boolean).join(", ");
            const secondaryLine = venueLine || source.sourceHost || "Source";
            const importKey = buildAgentImportKey(message.id, source);
            const folderCheckState = agentFolderCheckStates[importKey] || null;
            const localPaper = findWorkspacePaperForSource(agentWorkspacePapers, source);
            const badgeLabel =
              localPaper
                ? "Found in folder"
                : source.hydrationStatus === "ready"
                  ? "Searchable PDF"
                  : source.hydrationStatus === "preview_only"
                    ? "Previewable PDF"
                    : source.hydrationStatus === "loading"
                      ? "Fetching PDF"
                      : source.hydrationStatus === "manual_required"
                        ? "Open in browser"
                        : source.hasPdf
                          ? "PDF link found"
                          : "";
            const openPdfInBrowser = () => {
              const targetUrl = normalizeAgentSourceUrl(source.pdfUrl || source.sourceUrl || "");
              if (targetUrl) window.open(targetUrl, "_blank", "noopener,noreferrer");
            };
            const checkFolderForPaper = async () => {
              if (!selectedRootFolderId) return;
              setAgentFolderCheckStates((prev) => ({
                ...prev,
                [importKey]: { status: "loading", label: "Checking folder..." },
              }));
              try {
                const refreshedFolders = await refreshRootFolderContents(selectedRootFolderId);
                const refreshedPaper = findWorkspacePaperForSource(
                  refreshedFolders.flatMap((folder) => folder.papers.map((paper) => ({ ...paper, folderId: folder.id }))),
                  source,
                );
                setAgentFolderCheckStates((prev) => ({
                  ...prev,
                  [importKey]: refreshedPaper
                    ? { status: "found", label: "Found in folder" }
                    : { status: "idle", label: "Not found yet" },
                }));
              } catch (error) {
                setAgentFolderCheckStates((prev) => ({
                  ...prev,
                  [importKey]: { status: "error", label: error?.message || "Could not check folder." },
                }));
              }
            };
            return (
              <article key={source.id || `${message.id}-source-${index}`} className="agent-found-source-row">
                <div className="agent-found-source-copy">
                  <div className="agent-found-source-title">{source.title || `Source ${index + 1}`}</div>
                  {authorLine ? (
                    <div className="agent-found-source-authors">{authorLine}</div>
                  ) : null}
                  {secondaryLine ? (
                    <div className="agent-found-source-meta">{secondaryLine}</div>
                  ) : null}
                  {source.summary ? (
                    <div className="agent-found-source-summary">{source.summary}</div>
                  ) : null}
                  {source.hydrationError ? (
                    <div className="agent-found-source-summary" style={{ color: "#9a3412" }}>{source.hydrationError}</div>
                  ) : null}
                  {source.hydrationStatus === "manual_required" && hasWritableAgentContext ? (
                    <div className="agent-found-source-summary">
                      Open the PDF in a browser tab, save it into <b>{selectedRootFolder?.name || "this workspace"}</b>, then click <b>Check folder</b>.
                    </div>
                  ) : null}
                  {folderCheckState?.label ? (
                    <div className="agent-found-source-summary">{folderCheckState.label}</div>
                  ) : null}
                  <div className="agent-found-source-link">{source.sourceUrl || source.pdfUrl || source.sourceHost}</div>
                </div>

                <div className="agent-found-source-actions">
                  {badgeLabel ? (
                    <span className="agent-found-source-badge">{badgeLabel}</span>
                  ) : null}
                  {source.sourceUrl ? (
                    <button
                      className="paper-result-btn"
                      type="button"
                      onClick={() => window.open(source.sourceUrl, "_blank", "noopener,noreferrer")}
                    >
                      Open source
                    </button>
                  ) : null}
                  {localPaper ? (
                    <button
                      className="paper-result-btn"
                      type="button"
                      onClick={() => openAgentPaper(localPaper)}
                    >
                      Open in agent mode
                    </button>
                  ) : null}
                  {!localPaper && source.hydrationStatus === "manual_required" && hasWritableAgentContext ? (
                    <button
                      className="paper-result-btn"
                      type="button"
                      onClick={() => checkFolderForPaper()}
                      disabled={folderCheckState?.status === "loading"}
                    >
                      Check folder
                    </button>
                  ) : null}
                  <button
                    className="paper-result-btn"
                    type="button"
                    disabled={!source.pdfUrl}
                    onClick={() => {
                      if (source.hydrationStatus === "manual_required") {
                        openPdfInBrowser();
                        return;
                      }
                      openAgentPreviewPaper({
                        remotePaperId: source.remotePaperId,
                        title: source.title,
                        sourceUrl: source.sourceUrl,
                        pdfUrl: source.pdfUrl,
                        doi: source.doi,
                      }, { chatId: activeAgentChatId }).catch(() => {});
                    }}
                  >
                    {source.hydrationStatus === "manual_required" ? "Open PDF in browser" : "Open PDF"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }, [activeAgentChatId, activeAgentRemotePapers, agentFolderCheckStates, agentWorkspacePapers, hasWritableAgentContext, openAgentPaper, openAgentPreviewPaper, refreshRootFolderContents, selectedRootFolder?.name, selectedRootFolderId]);



  const fileSelected = (f) => {
    if (!f?.name?.toLowerCase().endsWith(".pdf")) {
      setUpStatus("error");
      setUpStatusText("Please choose a file with a .pdf extension.");
      return;
    }
    setPendingFile(f);
    setUpStatus("ready");
    setUpStatusText("");
  };

  const doUpload = async () => {
    if (!pendingFile) return;
    setUpStatus("parsing");
    setUpStatusText("Opening PDF...");
    try {
      const ab = await pendingFile.arrayBuffer();
      const uint8 = new Uint8Array(ab);
      const paperId = `p${Date.now()}`;
      await saveUploadedPdf({
        paperId,
        pdfBytes: uint8,
        fileSize: pendingFile.size,
        fileLastModified: pendingFile.lastModified,
        updatedAt: Date.now(),
      });
      const paper = {
        id: paperId,
        name: stripPdfExtension(pendingFile.name),
        authors: "Uploaded",
        year: new Date().getFullYear(),
        pages: null,
        size: `${(pendingFile.size / 1024 / 1024).toFixed(1)} MB`,
        fileSize: pendingFile.size,
        fileLastModified: pendingFile.lastModified,
        textStatus: "idle",
        textProgress: 0,
        textError: null,
        textStatusText: "",
      };

      const noFolder = !upFolder || !folders.some((f) => f.id === upFolder);
      if (noFolder) {
        // No folder open yet — create an in-memory "Uploads" folder
        const uploadsId = 'f-uploads';
        const existing = folders.find((f) => f.id === uploadsId);
        const readyPaper = {
          ...paper,
          folderId: uploadsId,
          rootFolderId: existing?.rootFolderId || uploadsId,
        };
        if (existing) {
          setFolders((p) => p.map((f) => (f.id === uploadsId ? { ...f, papers: [...f.papers, readyPaper], expanded: true } : f)));
          setUpFolder(uploadsId);
        } else {
          const uploadsFolder = {
            id: uploadsId,
            name: 'Uploads',
            expanded: true,
            papers: [readyPaper],
            depth: 0,
            directoryHandle: null,
            rootHandle: null,
            rootFolderId: uploadsId,
            relativePath: "",
            folderPath: buildFolderPath('Uploads'),
          };
          setFolders([uploadsFolder]);
          setSelectedFolderId(uploadsId);
          setUpFolder(uploadsId);
        }
        setUpStatus("done");
        setTimeout(() => {
          closeModal();
          openPaper(readyPaper, uploadsId);
        }, 600);
      } else {
        const targetFolder = folders.find((f) => f.id === upFolder);
        const readyPaper = {
          ...paper,
          folderId: upFolder,
          rootFolderId: targetFolder?.rootFolderId || upFolder,
        };
        setFolders((p) => p.map((f) => (f.id === upFolder ? { ...f, papers: [...f.papers, readyPaper], expanded: true } : f)));
        setUpStatus("done");
        setTimeout(() => {
          closeModal();
          openPaper(readyPaper, upFolder);
        }, 600);
      }
    } catch (error) {
      setUpStatusText(error?.message || "This PDF could not be parsed.");
      setUpStatus("error");
    }
  };

  const closeModal = () => {
    setShowUpload(false);
    setUpStatus(null);
    setUpStatusText("");
    setPendingFile(null);
  };

  const filtered = folders.map((f) => ({
    ...f,
    visiblePapers: searchQ ? f.papers.filter((p) => p.name.toLowerCase().includes(searchQ.toLowerCase())) : f.papers,
  }));

  useEffect(() => {
    if (!folders.length) {
      setSelectedFolderId(null);
      setUpFolder("");
      return;
    }
    if (!selectedFolderId || !folders.some((f) => f.id === selectedFolderId)) {
      setSelectedFolderId(folders[0].id);
    }
    if (!upFolder || !folders.some((f) => f.id === upFolder)) {
      setUpFolder(folders[0].id);
    }
  }, [folders, selectedFolderId, upFolder]);

  return (
    <>
      <style>{CSS}</style>
      <div className="app" onMouseDown={(e) => { if (!e.target.closest(".sel-pop")) setPopup(null); if (!e.target.closest(".ann-popover") && !e.target.closest("[data-ann-id]")) setAnnPopover(null); }}>
        <div className={`sb ${sidebarOpen ? "" : "closed"}`} style={sidebarOpen ? { width: sidebarWidth, minWidth: sidebarWidth } : undefined}>
          <div className="sb-inner" style={{ width: sidebarWidth }}>
            <div className="sb-user">
              <div className="sb-avatar" style={{background:'#2563eb',color:'#fff',fontWeight:800,fontSize:13}}>P</div>
              <span className="sb-username">Paperview</span>
              <button className="sb-tog" onClick={() => setSidebarOpen(false)} title="Collapse">
                <IChevronLeftDouble size={14} />
              </button>
            </div>

            <div className="sb-nav">
              <button className={`sb-nav-item ${currentView === "reader" ? "active" : ""}`} onClick={() => setCurrentView("reader")}>
                <IGrid size={14} /> Reader
              </button>
              <button className={`sb-nav-item ${currentView === "library" ? "active" : ""}`} onClick={() => setCurrentView("library")}>
                <IFolder size={14} /> Library
              </button>
              <button className={`sb-nav-item ${currentView === "agent" ? "active" : ""}`} onClick={() => setCurrentView("agent")}>
                <ISpark size={14} /> Agent
              </button>
            </div>

            <div className="sb-search-wrap">
              <div className="sb-search-icon"><ISearch size={12} /></div>
              <input
                className="sb-search-input"
                placeholder="Search…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>

            <div className="sb-section">
              <div className="sb-section-label">Folders</div>
              {filtered.map((folder) => (
                <div key={folder.id} className="sb-folder">
                  <div
                    className={`sb-folder-hd ${selectedFolderId === folder.id ? "active" : ""}`}
                    style={folder.depth ? { paddingLeft: 8 + folder.depth * 14 } : undefined}
                    onClick={() => openFolderTabs(folder.id, { forceReader: currentView === "reader" })}
                    title="Select this folder"
                  >
                    <button
                      className="sb-folder-toggle"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolder(folder.id);
                      }}
                      title={folder.expanded ? "Collapse" : "Expand"}
                    >
                      {folder.expanded ? <IChevronDown size={12} /> : <IRight size={12} />}
                    </button>
                    {folder.expanded ? <IFolderOpen size={14} /> : <IFolder size={14} />}
                    <span className="sb-folder-name">{folder.name}</span>
                    <span className="sb-folder-cnt">{folder.papers.length}</span>
                  </div>
                  {folder.expanded && (
                    <div className="sb-papers">
                      {folder.papers.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#999", padding: "4px 8px", fontStyle: "italic" }}>Empty</div>
                      ) : folder.visiblePapers.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#999", padding: "4px 8px", fontStyle: "italic" }}>No matching files</div>
                      ) : (
                        folder.visiblePapers.map((paper) => (
                          <div
                            key={paper.id}
                            className={`sb-paper ${activeTabId === paper.id ? "active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openPaper(paper, folder.id);
                            }}
                          >
                            <span className="sb-paper-icon"><IFile size={12} /></span>
                            <span className="sb-paper-title">{paper.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}

              {newFolder && currentView !== "library" && (
                <div style={{ padding: "4px 0" }}>
                  <input
                    autoFocus
                    className="nf-input"
                    value={nfName}
                    onChange={(e) => {
                      setNfName(e.target.value);
                      if (folderError) setFolderError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createFolder();
                      if (e.key === "Escape") cancelNewFolder();
                    }}
                    placeholder="Folder name…"
                  />
                  {folderError && <div className="nf-error">{folderError}</div>}
                  <div className="nf-ctrl">
                    <button className="lib-btn dark" onClick={createFolder}><IPlus size={12} /> Create</button>
                    <button className="lib-btn" onClick={cancelNewFolder}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="sb-settings-bar">
              <span className="sb-settings-dot" style={{ background: apiKey ? '#22c55e' : rememberedApiKeyAvailable ? '#f59e0b' : '#ef4444' }} />
              <span className="sb-settings-label">{apiKey ? `API key ••••${apiKey.slice(-4)}` : rememberedApiKeyAvailable ? 'API key saved (locked)' : 'No API key'}</span>
              <button className="sb-settings-gear" onClick={() => openSettingsModal(apiKey)} title="Settings"><IGear size={14} /></button>
            </div>

            <div className="sb-footer">
              {typeof window.showDirectoryPicker === 'function' && (
                <button className="sb-upload-btn" onClick={() => setShowFolderPermModal(true)}><IFolder size={13} /> Open Folder</button>
              )}
              <button className={typeof window.showDirectoryPicker === 'function' ? "sb-new-folder" : "sb-upload-btn"} onClick={() => { if (folders.length) setUpFolder(folders[0].id); setShowUpload(true); }}><IUpload size={13} /> Upload PDF</button>
              <button className="sb-new-folder" onClick={startNewFolder}><IPlus size={13} /> New Folder</button>
            </div>
          </div>
        </div>

        {sidebarOpen && (
          <div
            className="sb-resize-handle"
            onMouseDown={startSbResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
          >
            <span className="sb-resize-grip" />
          </div>
        )}

        <div className="main">
          <div className="topbar">
            <div className="topbar-left">
              {!sidebarOpen && (
                <button className="topbar-btn" onClick={() => setSidebarOpen(true)}>
                  <IChevronRightDouble size={14} /> Library
                </button>
              )}
              <IFolder size={15} style={{ color: "#777" }} />
              <div className="topbar-title-stack">
                <span className="topbar-folder-name">
                  {currentView === "library"
                    ? "Library"
                    : currentView === "agent"
                      ? (selectedRootFolder?.name ? `Agent · ${selectedRootFolder.name}` : "Agent")
                      : activeFolder?.name || "Reader"}
                </span>
                <span className="topbar-subtitle">
                  {currentView === "library"
                    ? `${totalPaperCount} paper${totalPaperCount === 1 ? "" : "s"} across ${folders.length} folders`
                    : currentView === "agent"
                      ? (hasWritableAgentContext
                        ? `Research across the web and ${agentWorkspacePapers.length} local paper${agentWorkspacePapers.length === 1 ? "" : "s"} in this workspace`
                        : "Open a writable folder to enable agent search, imports, and synced chats")
                      : activePaper?.pdfBytes
                        ? "Search, annotate, and verify with source-backed answers"
                        : "Reading from extracted text with chat grounded in the document"}
                </span>
              </div>
            </div>

            <div className="topbar-right">
              {openTabs.length > 0 && <span className="topbar-count">{openTabs.length} file{openTabs.length > 1 ? "s" : ""} open</span>}
              {currentView === "agent" && selectedRootFolder && <span className="topbar-mode">{selectedRootAgentThreads.length} thread{selectedRootAgentThreads.length === 1 ? "" : "s"}</span>}
              {currentView === "reader" && activePaper && <span className="topbar-mode">{activePaper.pdfBytes ? "Rendered PDF" : "Text mode"}</span>}
              <div className="tb-divider" />
              {currentView === "reader" && (
                <>
                  <button className={`topbar-btn ${chatOpen ? "active" : ""}`} onClick={() => setChatOpen((v) => !v)}>
                    <IChat size={13} /> Chat
                  </button>
                </>
              )}
            </div>
          </div>

          {currentView === "reader" && openTabs.length > 0 && (
            <div className="tabbar">
              {openTabs.map((tab, idx) => {
                const active = tab.id === activeTabId;
                return (
                <div
                  key={tab.id}
                  className={`tab ${active ? "active" : ""} ${idx === 0 ? "tab-first" : ""} ${idx === openTabs.length - 1 ? "tab-last" : ""}`}
                  style={{ zIndex: active ? openTabs.length + 2 : idx + 1 }}
                  onClick={() => activateReaderTab(tab.id)}
                >
                  <span className="tab-icon"><IFile size={13} /></span>
                  <span className="tab-name">{tab.name}</span>
                  <button className="tab-close" onClick={(e) => closeTab(e, tab.id)}><IClose size={10} /></button>
                </div>
              );
              })}
              <div className="tabbar-tail" />
            </div>
          )}

          <div className={`content ${currentView === "reader" ? "content-reader" : ""}`}>
            {currentView === "library" ? (
              <div className="library-view">
                <div className="library-head">
                  <div className="library-title">Library</div>
                  <div className="library-actions">
                    {typeof window.showDirectoryPicker === 'function' && (
                      <button className="lib-btn dark" onClick={() => setShowFolderPermModal(true)}><IFolder size={12} /> Open Folder</button>
                    )}
                    <button className="lib-btn" onClick={startNewFolder}><IPlus size={12} /> New Folder</button>
                    <button className="lib-btn dark" onClick={() => setShowUpload(true)}><IUpload size={12} /> Upload PDF</button>
                  </div>
                </div>

                {newFolder && (
                  <div style={{ maxWidth: 420, marginBottom: 12 }}>
                    <input
                      autoFocus
                      className="nf-input"
                      value={nfName}
                      onChange={(e) => {
                        setNfName(e.target.value);
                        if (folderError) setFolderError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createFolder();
                        if (e.key === "Escape") cancelNewFolder();
                      }}
                      placeholder="Folder name…"
                    />
                    {folderError && <div className="nf-error">{folderError}</div>}
                    <div className="nf-ctrl">
                      <button className="lib-btn dark" onClick={createFolder}><IPlus size={12} /> Create</button>
                      <button className="lib-btn" onClick={cancelNewFolder}>Cancel</button>
                    </div>
                  </div>
                )}

                <div className="library-db">
                  <div className="db-head">
                    <div className="db-h">Name</div>
                    <div className="db-h">Type</div>
                    <div className="db-h">Files</div>
                    <div className="db-h">Open Tabs</div>
                    <div className="db-h">Actions</div>
                  </div>

                  {folders.map((folder) => (
                    <React.Fragment key={folder.id}>
                      <div
                        className={`db-row folder ${selectedFolderId === folder.id ? "selected" : ""}`}
                        onClick={() => openFolderTabs(folder.id, { forceReader: false })}
                        title="Select this folder"
                      >
                        <div className="db-cell">
                          <button
                            className="db-toggle"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFolder(folder.id);
                            }}
                            title={folder.expanded ? "Collapse" : "Expand"}
                          >
                            {folder.expanded ? <IChevronDown size={12} /> : <IRight size={12} />}
                          </button>
                          {folder.expanded ? <IFolderOpen size={14} /> : <IFolder size={14} />}
                          <span className="db-title">{folder.name}</span>
                        </div>
                        <div className="db-cell"><span className="db-chip">Folder</span></div>
                        <div className="db-cell">{folder.papers.length}</div>
                        <div className="db-cell">{openTabs.filter((tab) => folder.papers.some((p) => p.id === tab.id)).length}</div>
                        <div className="db-cell">
                          <div className="db-actions">
                            <button
                              className="db-open"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAllPapersInFolder(folder.id, { forceReader: true });
                              }}
                            >
                              Open all
                            </button>
                            <button
                              className="lib-icon-btn"
                              title="Upload file to folder"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUpFolder(folder.id);
                                setShowUpload(true);
                              }}
                            >
                              <IUpload size={13} />
                            </button>
                            <button
                              className="lib-icon-btn"
                              title="Delete folder"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteFolder(folder.id);
                              }}
                            >
                              <ITrash size={13} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {folder.expanded && (
                        <div className="db-folder-files">
                          {folder.papers.length === 0 ? (
                            <div className="db-file-row empty">
                              <div className="db-cell db-file-indent" style={{ gridColumn: "1 / span 5", gap: 10 }}>
                                <span>No files in this folder.</span>
                                <button
                                  className="empty-upload-btn"
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUpFolder(folder.id);
                                    setShowUpload(true);
                                  }}
                                >
                                  <IUpload size={11} /> Upload your first pdf
                                </button>
                              </div>
                            </div>
                          ) : (
                            folder.papers.map((paper) => (
                              <div className="db-file-row" key={paper.id}>
                                <div className="db-cell db-file-indent">
                                  <IFile size={12} />
                                  <span className="db-file-name">{paper.name}</span>
                                </div>
                                <div className="db-cell"><span className="db-chip">PDF</span></div>
                                <div className="db-cell">{paper.pages ?? "-"}</div>
                                <div className="db-cell"><span className="db-meta">{openTabs.some((t) => t.id === paper.id) ? "Open" : "-"}</span></div>
                                <div className="db-cell">
                                  <div className="db-actions">
                                    <button className="db-open" onClick={() => openPaper(paper, folder.id)}>Open</button>
                                    <button className="lib-icon-btn" title="Delete file" onClick={() => deletePaper(folder.id, paper.id)}><ITrash size={13} /></button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : currentView === "agent" ? (
              <div className={`agent-view ${agentSidebarOpen ? "" : "sidebar-collapsed"}`}>
                {!hasWritableAgentContext ? (
                  <div className="agent-gate">
                    <div className="agent-empty-icon"><ISpark size={18} /></div>
                    <div className="agent-gate-copy">
                      <div className="agent-empty-eyebrow">Folder-backed workspace required</div>
                      <h2>Open a writable folder to use Agent</h2>
                      <p>Agent chats sync into that folder&apos;s <code>.paperview.json</code>, and imported PDFs are written back to the same workspace on disk.</p>
                    </div>
                    <div className="agent-gate-actions">
                      {typeof window.showDirectoryPicker === 'function' ? (
                        <button className="lib-btn dark" type="button" onClick={() => setShowFolderPermModal(true)}>
                          <IFolder size={12} /> Open Folder
                        </button>
                      ) : null}
                      <button className="lib-btn" type="button" onClick={() => setCurrentView("library")}>
                        <IGrid size={12} /> Go to Library
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <aside className={`agent-sidebar ${agentSidebarOpen ? "" : "collapsed"}`}>
                      <div className="agent-sidebar-head">
                        <div className="agent-sidebar-topbar">
                          {agentSidebarOpen ? (
                            <div className="agent-sidebar-copy">
                              <div className="agent-empty-eyebrow">Workspace threads</div>
                              <div className="agent-sidebar-title">{selectedRootFolder?.name || "Agent"}</div>
                              <div className="agent-sidebar-subtitle">
                                {agentWorkspacePapers.length} local paper{agentWorkspacePapers.length === 1 ? "" : "s"} available for grounded comparisons.
                              </div>
                            </div>
                          ) : null}
                          <button
                            className="chat-topbar-btn agent-sidebar-toggle"
                            type="button"
                            onClick={() => setAgentSidebarOpen((open) => !open)}
                            title={agentSidebarOpen ? "Collapse threads" : "Expand threads"}
                            aria-label={agentSidebarOpen ? "Collapse threads" : "Expand threads"}
                          >
                            <IPanel size={14} />
                          </button>
                          {!agentSidebarOpen ? (
                            <button
                              className="chat-topbar-btn agent-sidebar-toggle agent-sidebar-chat-icon"
                              type="button"
                              onClick={() => setAgentSidebarOpen(true)}
                              title="Show chats"
                              aria-label="Show chats"
                            >
                              <IChat size={14} />
                            </button>
                          ) : null}
                        </div>
                        {agentSidebarOpen ? (
                          <div className="agent-sidebar-head-actions">
                            <button className="lib-btn dark" type="button" onClick={startNewAgentChat}>
                              <IPlus size={12} /> New thread
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {agentSidebarOpen ? (
                        <>
                          <div className="agent-context-card">
                            <div className="agent-context-row">
                              <span className="agent-root-badge">{selectedRootFolder?.name || "Workspace"}</span>
                              <span className="agent-context-meta">{selectedRootAgentThreads.length} saved thread{selectedRootAgentThreads.length === 1 ? "" : "s"}</span>
                            </div>
                            <p className="agent-context-copy">
                              Web research, local-paper context, and imported PDFs stay anchored to this writable root so the workspace travels with its <code>.paperview.json</code>.
                            </p>
                          </div>

                          <div className="agent-thread-list">
                            {selectedRootAgentThreads.length === 0 ? (
                              <div className="chat-overview-empty-state">
                                <div className="chat-overview-empty-title">No agent threads yet</div>
                                <div className="chat-overview-empty-copy">Start a thread to search the web, compare papers, and save the conversation with this folder.</div>
                              </div>
                            ) : (
                              selectedRootAgentThreads.map((thread) => (
                                <div key={thread.id} className={`agent-thread-row ${thread.id === activeAgentChatId ? "active" : ""}`}>
                                  <button className="agent-thread-main" type="button" onClick={() => openAgentThread(thread.id)}>
                                    <div className="agent-thread-title" title={thread.title}>{thread.title}</div>
                                  </button>
                                  <button
                                    className="thread-compact-delete"
                                    type="button"
                                    onClick={() => deleteAgentThread(thread.id)}
                                    title="Delete agent thread"
                                    aria-label={`Delete ${thread.title}`}
                                  >
                                    <ITrash size={13} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      ) : null}
                    </aside>

                    <section className="agent-main citation-popover-boundary">
                      <div
                        className={`agent-workspace-body ${hasAgentPreview ? "has-preview" : ""}`}
                        style={hasAgentPreview && agentPreviewWidth
                          ? { gridTemplateColumns: `minmax(0,1fr) 5px minmax(300px, ${agentPreviewWidth}px)` }
                          : undefined}
                      >
                        <div className="agent-conversation-pane">
                          <div className="agent-main-head">
                            <div className="agent-main-copy">
                              <div className="agent-empty-eyebrow">Paperview Agent</div>
                              <div className="agent-main-title">{activeAgentChat?.title || "New thread"}</div>
                              <div className="agent-main-subtitle">{activeAgentSummary}</div>
                            </div>
                            <div className="agent-main-actions">
                              <span className="agent-root-badge">{selectedRootFolder?.name || "Workspace"}</span>
                              <button
                                className="chat-history-btn"
                                type="button"
                                onClick={resetActiveAgentHistory}
                                disabled={!currentAgentMessages.length && !agentInput.trim()}
                              >
                                Reset current
                              </button>
                            </div>
                          </div>
                          <div className="agent-msgs">
                            {currentAgentMessages.length === 0 ? (
                              <div className="agent-empty">
                                <div className="agent-empty-hero">
                                  <div className="agent-empty-icon"><ISpark size={18} /></div>
                                  <div className="agent-empty-copy">
                                    <div className="agent-empty-eyebrow">Research across web + local PDFs</div>
                                    <h2>Search for papers, compare them with your library, and import the best ones to disk.</h2>
                                    <p>Select an Agent tool below to attach a mode to the composer without adding extra instruction text to your message.</p>
                                  </div>
                                </div>

                                <div className="agent-quick-grid">
                                  {agentTools.map((item) => (
                                    <button
                                      key={item.title}
                                      className={`agent-quick-chip ${selectedAgentToolId === item.id ? "active" : ""}`}
                                      type="button"
                                      onClick={() => selectAgentTool(item.id)}
                                    >
                                      <span className="chat-suggestion-icon">{item.icon}</span>
                                      <span className="chat-suggestion-text">
                                        <span className="chat-suggestion-title">{item.title}</span>
                                        <span className="chat-suggestion-meta">{item.meta}</span>
                                      </span>
                                    </button>
                                  ))}
                                </div>

                                <div className="agent-empty-block">
                                  <div className="agent-empty-block-title">Local workspace context</div>
                                  <div className="agent-empty-note">
                                    {agentWorkspacePapers.length
                                      ? `${agentWorkspacePapers.length} paper${agentWorkspacePapers.length === 1 ? "" : "s"} are ready in this root. Attach only the ones you want the agent to search locally.`
                                      : "No local PDFs were found in this root yet. You can still use web search, and imported papers will be saved back into this workspace."}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              currentAgentMessages.map((m) => (
                                <div key={m.id}>
                                  {m.role === "user" ? (
                                    <div className="msg-u">
                                      <div className="msg-u-bubble-wrap">
                                        {m.agentToolTitle ? (
                                          <div className="agent-msg-tool">
                                            <span className="agent-msg-tool-chip">{m.agentToolTitle}</span>
                                          </div>
                                        ) : null}
                                        <div className="msg-u-bubble">{m.content}</div>
                                        {renderUsageMeta(m)}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="msg-a">
                                      <div className="msg-a-row">
                                        <div className="msg-a-avatar">A</div>
                                        <div className="msg-a-bubble-wrap">
                                          {m.thinkingTrace?.length > 0 ? (
                                            <ThinkingTrace
                                              steps={m.thinkingTrace}
                                              isLive={false}
                                              expanded={!!agentThinkingExpanded[m.id]}
                                              onToggle={() => setAgentThinkingExpanded((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                                            />
                                          ) : null}
                                          {renderUsageMeta(m)}
                                          {renderFoundSourcesPanel(m)}
                                          {m.content ? (
                                            <div className="msg-a-bubble">
                                              <InlineCitedAnswer
                                                text={m.content}
                                                citations={m.citations || []}
                                                onCitationClick={handleCitationClick}
                                              />
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}

                            {isAgentLoading ? (
                              <div className="chat-thinking">
                                {agentThinkingSteps.filter((step) => step.chatId === activeAgentChatId).length > 0 ? (
                                  <ThinkingTrace
                                    steps={agentThinkingSteps.filter((step) => step.chatId === activeAgentChatId)}
                                    isLive={true}
                                  />
                                ) : (
                                  <>
                                    <div className="typing"><span /><span /><span /></div>
                                    <span style={{ fontSize: 13, color: "#888", marginLeft: 4 }}>{agentLoadingLabel}</span>
                                  </>
                                )}
                              </div>
                            ) : null}
                            <div ref={agentEndRef} />
                          </div>

                          <div className="agent-input-area">
                        {agentWorkspacePapers.length > 0 ? (
                          <div className="attach-picker attach-picker-inline" ref={agentAttachMenuRef}>
                            <div className="composer-context-row">
                              <button
                                className="composer-context-trigger"
                                type="button"
                                onClick={() => setAgentAttachMenuOpen((value) => !value)}
                                title="Review local paper context"
                              >
                                <IPaperclip size={12} />
                                <span>Local papers</span>
                              </button>
                              <div className="composer-context-list">
                                {agentContextPapers.slice(0, 2).map((paper) => (
                                  <button
                                    key={paper.id}
                                    className="composer-context-pill composer-context-pill-btn"
                                    type="button"
                                    title={paper.name}
                                    onClick={() => openAgentPaper(paper)}
                                  >
                                    <IFile size={11} style={{ flexShrink: 0 }} />
                                    <span className="composer-context-pill-text">{paper.name}</span>
                                  </button>
                                ))}
                                {agentContextPapers.length > 2 ? (
                                  <span className="composer-context-pill composer-context-pill-more">
                                    +{agentContextPapers.length - 2} more
                                  </span>
                                ) : null}
                                {agentContextPapers.length === 0 ? (
                                  <span className="composer-context-pill composer-context-pill-more">No local papers attached</span>
                                ) : null}
                              </div>
                            </div>

                            {agentAttachMenuOpen ? (
                              <div className="attach-menu">
                                <div className="attach-head">
                                  <span className="attach-title">Local paper context</span>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button
                                      className="attach-mini-btn"
                                      type="button"
                                      onClick={() => setSelectedAgentPaperIds(agentWorkspacePapers.map((paper) => paper.id))}
                                    >
                                      All
                                    </button>
                                    <button
                                      className="attach-mini-btn"
                                      type="button"
                                      onClick={() => setSelectedAgentPaperIds([])}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>

                                <div className="attach-list">
                                  {agentWorkspacePapers.map((paper) => {
                                    const checked = selectedAgentPaperIds.includes(paper.id);
                                    return (
                                      <label key={paper.id} className="attach-item">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => {
                                            setSelectedAgentPaperIds((prev) =>
                                              prev.includes(paper.id)
                                                ? prev.filter((id) => id !== paper.id)
                                                : [...prev, paper.id]
                                            );
                                          }}
                                        />
                                        <IFile size={12} style={{ color: "#888", flexShrink: 0 }} />
                                        <span className="attach-name">{paper.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="chat-composer agent-composer">
                          <div className="agent-tool-row" ref={agentToolMenuRef}>
                            <button
                              className={`agent-tool-trigger ${agentToolMenuOpen ? "active" : ""}`}
                              type="button"
                              onClick={() => setAgentToolMenuOpen((value) => !value)}
                              title="Select an Agent tool"
                            >
                              <IPlus size={12} />
                              <span>{selectedAgentTool ? "Change tool" : "Add tool"}</span>
                            </button>

                            {selectedAgentTool ? (
                              <span className="agent-tool-chip">
                                <span className="agent-tool-chip-label">
                                  {selectedAgentTool.icon}
                                  <span>{selectedAgentTool.title}</span>
                                </span>
                                <button
                                  className="agent-tool-chip-clear"
                                  type="button"
                                  onClick={() => setSelectedAgentToolId(null)}
                                  title="Remove selected Agent tool"
                                >
                                  <IClose size={11} />
                                </button>
                              </span>
                            ) : (
                              <span className="agent-tool-hint">No Agent tool selected</span>
                            )}

                            {agentToolMenuOpen ? (
                              <div className="agent-tool-menu">
                                <div className="agent-tool-menu-title">Agent tools</div>
                                <div className="agent-tool-menu-list">
                                  {agentTools.map((tool) => (
                                    <button
                                      key={tool.id}
                                      className={`agent-tool-option ${selectedAgentToolId === tool.id ? "active" : ""}`}
                                      type="button"
                                      onClick={() => selectAgentTool(tool.id)}
                                    >
                                      <span className="agent-tool-option-icon">{tool.icon}</span>
                                      <span className="agent-tool-option-copy">
                                        <span className="agent-tool-option-title">{tool.title}</span>
                                        <span className="agent-tool-option-meta">{tool.meta}</span>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <textarea
                            ref={agentTaRef}
                            rows={1}
                            value={agentInput}
                            onChange={(event) => {
                              setAgentInput(event.target.value);
                              event.target.style.height = "auto";
                              event.target.style.height = `${event.target.scrollHeight}px`;
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                doSendAgent();
                              }
                            }}
                            placeholder={selectedAgentTool?.placeholder || "Search for papers, compare them with your workspace, or import a PDF to this folder..."}
                          />

                          <div className="composer-bottom">
                            <div className="composer-tools">
                              <div className="model-picker" ref={modelMenuRef}>
                                <button
                                  className="model-chip"
                                  title="Model"
                                  onClick={() => setModelMenuOpen((value) => !value)}
                                  type="button"
                                >
                                  {selectedModel} <IChevronDown size={12} />
                                </button>
                                {modelMenuOpen ? (
                                  <div className="model-menu">
                                    {OPENAI_MODELS.map((modelName) => (
                                      <button
                                        key={modelName}
                                        className={`model-option ${selectedModel === modelName ? "active" : ""}`}
                                        onClick={() => {
                                          setSelectedModel(modelName);
                                          setModelMenuOpen(false);
                                        }}
                                        type="button"
                                      >
                                        {modelName}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {agentLoadingState ? (
                              <button
                                className="chat-history-btn composer-stop-btn"
                                onClick={stopAgentRun}
                                title="Stop"
                                type="button"
                              >
                                Stop
                              </button>
                            ) : (
                              <button
                                className="icon-btn send-btn"
                                onClick={() => doSendAgent()}
                                disabled={!agentInput.trim()}
                                title="Send"
                                type="button"
                              >
                                <IArrowUp size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                          </div>
                        </div>

                        {hasAgentPreview ? (
                          <div
                            className="agent-preview-resize-handle"
                            onMouseDown={startAgentPreviewResize}
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize in-chat PDF preview"
                          >
                            <span className="agent-preview-resize-grip" />
                          </div>
                        ) : null}

                        {renderAgentPreviewDrawer()}
                      </div>
                    </section>
                  </>
                )}
              </div>
            ) : activePaper ? (
              <>
                <div className="viewer">
                  <div className="viewer-frame">
                    <div className="viewer-toolbar">
                      <div className="vt-left">
                        <button className="vt-btn" onClick={handleSearchClick} title="Search in this PDF">
                          <ISearch />
                        </button>
                        {viewerSearchOpen && (
                          <div className="vt-search-wrap">
                            <input
                              ref={viewerSearchInputRef}
                              className="vt-search-input"
                              value={viewerSearchQuery}
                              onChange={(e) => {
                                setViewerSearchQuery(e.target.value);
                                setViewerSearchStatus("");
                                setViewerSearchIndex(-1);
                                setViewerSearchMatches([]);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") runViewerSearch(e.shiftKey ? -1 : 1);
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  runViewerSearch(1);
                                }
                                if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  runViewerSearch(-1);
                                }
                                if (e.key === "Escape") setViewerSearchOpen(false);
                              }}
                              placeholder="Find text..."
                            />
                            <div className="vt-search-nav">
                              <button
                                className="vt-btn"
                                onClick={() => runViewerSearch(-1)}
                                disabled={!canRunViewerSearch}
                                title="Previous match"
                              >
                                <IArrowUp size={14} />
                              </button>
                              <button
                                className="vt-btn"
                                onClick={() => runViewerSearch(1)}
                                disabled={!canRunViewerSearch}
                                title="Next match"
                              >
                                <IArrowDown size={14} />
                              </button>
                            </div>
                            {viewerSearchStatus && <span className="vt-search-meta">{viewerSearchStatus}</span>}
                            {!viewerSearchStatus && hasViewerSearchResults && (
                              <span className="vt-search-meta">{viewerSearchIndex + 1}/{viewerSearchMatches.length}</span>
                            )}
                          </div>
                        )}
                        <div className="vt-sep" />
                        <div className="vt-zoom">
                          <button className="vt-btn" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))}><IZoomOut /></button>
                          <span className="vt-zoom-val">{Math.round(scale * 100)}%</span>
                          <button className="vt-btn" onClick={() => setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)))}><IZoomIn /></button>
                        </div>
                        </div>
                        <div className="vt-page">
                          <button className="vt-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}><ILeft /></button>
                          <span className="vt-page-total">{currentPage} of {activePaperTotalPages}</span>
                          <button className="vt-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= activePaperTotalPages}><IRight /></button>
                        </div>
                      </div>

                      <div className={`pdf-scroll ${debugCitations ? "debug-text-layer" : ""}`}>
                        {activePaper.pdfBytes ? (
                        <PdfViewer
                            paperId={activePaper.id}
                            pdfBytes={activePaper.pdfBytes}
                            fileSize={activePaper.fileSize}
                            fileLastModified={activePaper.fileLastModified}
                            scale={scale}
                            onReady={handlePdfReady}
                            onDocumentLoad={handlePdfDocumentLoad}
                            onPageChange={setCurrentPage}
                            debugCitations={debugCitations}
                          annotations={annotations}
                          onAnnotationClick={handleAnnotationClick}
                        />
                      ) : (
                        <TextFallback text={materializeFullText(searchablePageTexts)} />
                      )}
                    </div>
                  </div>
                </div>

                {chatOpen && (
                  <>
                  <div
                    className="chat-resize-handle"
                    onMouseDown={startChatResize}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize chat panel"
                  >
                    <span className="chat-resize-grip" />
                  </div>
                  <div className="chat-panel" style={{ width: chatWidth }}>
                    <div className="chat-topbar">
                      <div className="chat-topbar-copy">
                        <span className="chat-topbar-title">{chatPaneMode === "overview" ? "Recent chats" : chatPaneMode === "notes" ? "Notes" : (activeChat?.title || "Chat")}</span>
                        <span className="chat-topbar-subtitle">{chatPaneMode === "overview" ? "Open, reset, or remove saved conversations." : chatPaneMode === "notes" ? `${annotations.length} annotation${annotations.length === 1 ? '' : 's'}` : activeChatSummary}</span>
                      </div>
                      <div className="chat-topbar-actions">
                        {chatPaneMode === "chat" && (
                          <button className="chat-topbar-btn" onClick={startNewChat} title="Start new chat">
                            <IPlus size={14} />
                          </button>
                        )}
                        {chatPaneMode === "chat" ? (
                          <button
                            className="chat-topbar-btn"
                            onClick={resetActiveChatHistory}
                            title="Reset active chat"
                            disabled={!currentMessages.length && !chip && !input}
                          >
                            <ITrash size={14} />
                          </button>
                        ) : null}
                        <button
                          className={`chat-topbar-btn${chatPaneMode === 'notes' ? ' active' : ''}`}
                          onClick={() => setChatPaneMode((mode) => (mode === "notes" ? "chat" : "notes"))}
                          title={chatPaneMode === "notes" ? "Back to chat" : "Notes"}
                        >
                          <INotes size={14} />
                        </button>
                        <button
                          className="chat-topbar-btn chat-topbar-btn-label"
                          onClick={() => setChatPaneMode((mode) => (mode === "chat" ? "overview" : "chat"))}
                          title={chatPaneMode === "overview" ? "Back to chat" : "View chats"}
                        >
                          <IPanel size={14} />
                          <span>{chatPaneMode === "overview" ? "Back to chat" : "View chats"}</span>
                        </button>
                        <button className="chat-topbar-btn" onClick={() => setChatOpen(false)} title="Collapse chat">
                          <IChevronRightDouble size={14} />
                        </button>
                      </div>
                    </div>

                    {chatPaneMode === "chat" && isActivePaperScanning && (
                      <div className="chat-scan-banner">
                        <div className="chat-scan-banner-top">
                          <div className="chat-scan-banner-copy">
                            <span className="chat-scan-banner-title">Scanning paper for chat</span>
                            <span className="chat-scan-banner-meta">{activePaper?.name || "Current paper"}</span>
                          </div>
                          <span className="chat-scan-banner-badge">{activePaperScanPercent}%</span>
                        </div>
                        <div className="chat-scan-banner-status">{activePaperScanLabel}</div>
                        <div className="chat-scan-progress" aria-hidden="true">
                          <span className="chat-scan-progress-bar" style={{ width: `${activePaperScanPercent}%` }} />
                        </div>
                      </div>
                    )}

                    {chatPaneMode === "overview" ? (
                      <div className="chat-history-panel chat-history-standalone">
                        <div className="chat-overview-shell">
                          <div className="chat-overview-hero">
                            <div className="chat-overview-hero-top">
                              <div className="chat-overview-copy">
                                <div className="chat-overview-eyebrow">Current thread</div>
                                <div className="chat-overview-title">{activeChat?.title || "No active chat"}</div>
                                <div className="chat-overview-subtitle">
                                  {activeChat
                                    ? "Keep this thread focused on the paper you are reading, or branch into a fresh conversation when you need a new line of inquiry."
                                    : "Start a conversation to begin asking grounded questions about this paper."}
                                </div>
                              </div>
                              {activeChat ? <span className="chat-overview-badge">Open now</span> : null}
                            </div>

                            <div className="chat-overview-stats">
                              <div className="chat-overview-stat">
                                <span className="chat-overview-stat-value">{activePaperThreads.length}</span>
                                <span className="chat-overview-stat-label">Thread{activePaperThreads.length === 1 ? "" : "s"} for this paper</span>
                              </div>
                              <div className="chat-overview-stat">
                                <span className="chat-overview-stat-value">{activePaperMessageCount}</span>
                                <span className="chat-overview-stat-label">Total saved messages</span>
                              </div>
                            </div>

                            <div className="chat-overview-primary-actions">
                              {activeChat ? <button className="chat-history-btn" onClick={() => setChatPaneMode("chat")}>Resume chat</button> : null}
                              <button className="chat-history-btn" onClick={startNewChat}>New chat</button>
                              {activeChat ? (
                                <button className="chat-history-btn" onClick={resetActiveChatHistory} disabled={!currentMessages.length}>
                                  Reset current
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="chat-overview-section">
                            <div className="chat-overview-section-head">
                              <div className="chat-overview-section-copy">
                                <div className="chat-overview-section-title">Saved chats</div>
                                <div className="chat-overview-section-subtitle">Re-open an older thread or clean it up before you go back to reading.</div>
                              </div>
                              <div className="chat-overview-count">{savedPaperThreads.length}</div>
                            </div>

                            {savedPaperThreads.length ? (
                              <div className="chat-overview-list">
                                {savedPaperThreads.map((thread) => (
                                  <div key={thread.id} className="chat-overview-row">
                                    <button className="chat-overview-row-main" type="button" onClick={() => openChatThread(thread.id)}>
                                      <span className="chat-overview-row-title" title={thread.title}>{thread.title}</span>
                                    </button>
                                    <button
                                      className="thread-compact-delete"
                                      type="button"
                                      onClick={() => deleteChatThread(thread.id)}
                                      title="Delete chat"
                                      aria-label={`Delete ${thread.title}`}
                                    >
                                      <ITrash size={13}/>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="chat-overview-empty-state">
                                <div className="chat-overview-empty-title">No additional chats yet</div>
                                <div className="chat-overview-empty-copy">Create another thread when you want to explore a new question without losing your current conversation.</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : chatPaneMode === "notes" ? (
                      <div className="notes-panel">
                        {annotations.length === 0 ? (
                          <div className="notes-empty">
                            <div className="notes-empty-icon">📝</div>
                            <h3>No annotations yet</h3>
                            <p>Select text in the PDF and click <b>Highlight</b> to add notes.</p>
                          </div>
                        ) : (
                          (() => {
                            const grouped = {};
                            annotations.forEach((a) => {
                              (grouped[a.pageNum] = grouped[a.pageNum] || []).push(a);
                            });
                            return Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).map((pg) => (
                              <div key={pg} className="notes-group">
                                <div className="notes-group-title">Page {pg}</div>
                                {grouped[pg].sort((a, b) => a.startOffset - b.startOffset).map((ann) => (
                                  <div key={ann.id} className="note-card" onClick={() => goToPage(ann.pageNum)}>
                                    <div className="note-card-text">"{ann.selectedText}"</div>
                                    {ann.comment ? (
                                      <div className="note-card-comment">{ann.comment}</div>
                                    ) : (
                                      <div className="note-card-no-comment">No comment</div>
                                    )}
                                    <div className="note-card-footer">
                                      <span className="note-card-page">Page {ann.pageNum}</span>
                                      <button className="note-card-delete" onClick={(e) => { e.stopPropagation(); deleteAnnotationById(ann.id); }} title="Delete annotation">
                                        <ITrash size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="chat-msgs">
                          {currentMessages.length === 0 ? (
                            <div className="chat-empty">
                              <div className="chat-empty-intro">
                                <div className="chat-empty-icon"><ISpark size={14} /></div>
                                <div className="chat-empty-copy">
                                  <h3>Ask anything about this paper</h3>
                                  <p>Use the task list below or select text in the document to send focused context into chat.</p>
                                </div>
                              </div>

                              <div className="chat-empty-sections">
                                <div className="chat-empty-block">
                                  <div className="chat-empty-block-title">Quick actions</div>
                                  <div className="chat-empty-suggestions">
                                    {chatQuickActions.map((item) => (
                                      <button key={item.title} className="chat-suggestion" type="button" onClick={() => doSend(item.prompt)}>
                                        <span className="chat-suggestion-icon">{item.icon}</span>
                                        <span className="chat-suggestion-text">
                                          <span className="chat-suggestion-title">{item.title}</span>
                                          <span className="chat-suggestion-meta">{item.meta}</span>
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="chat-empty-block">
                                  <div className="chat-empty-block-title">Working set</div>
                                  <div className="chat-empty-note">
                                    {activeFolderPapers.length || openTabs.length} file{(activeFolderPapers.length || openTabs.length) === 1 ? " is" : "s are"} available in the current workspace. Answers stay grounded in the documents you attach through the paper picker.
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            currentMessages.map((m, i) => (
                              <div key={i}>
                                {m.role === "user" ? (
                                  <div className="msg-u">
                                    <div className="msg-u-bubble-wrap">
                                      <div className="msg-u-bubble">{m.content}</div>
                                      {renderUsageMeta(m)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="msg-a">
                                    <div className="msg-a-row">
                                      <div className="msg-a-avatar">A</div>
                                      <div className="msg-a-bubble-wrap">
                                        {m.thinkingTrace?.length > 0 && (
                                          <ThinkingTrace
                                            steps={m.thinkingTrace}
                                            isLive={false}
                                            expanded={!!thinkingExpanded[m.id]}
                                            onToggle={() => setThinkingExpanded(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                                          />
                                        )}
                                        <div className="msg-a-bubble">
                                          <InlineCitedAnswer
                                            text={m.content}
                                            citations={m.citations || []}
                                            fileName={activePaper.name}
                                            onCitationClick={handleCitationClick}
                                          />
                                        </div>
                                        {renderUsageMeta(m)}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}

                          {isChatLoading && (
                            <div className="chat-thinking">
                              {thinkingSteps.filter(s => s.chatId === activeChatId).length > 0 ? (
                                <ThinkingTrace
                                  steps={thinkingSteps.filter(s => s.chatId === activeChatId)}
                                  isLive={true}
                                />
                              ) : (
                                <>
                                  <div className="typing"><span /><span /><span /></div>
                                  <span style={{ fontSize: 13, color: "#888", marginLeft: 4 }}>{chatLoadingLabel}</span>
                                </>
                              )}
                            </div>
                          )}
                          <div ref={endRef} />
                        </div>

                        <div className="chat-input-area">
                          {chip && (
                            <div className="ctx-chip">
                              <span style={{ fontSize: 11, fontWeight: 600 }}>Selected text:</span>
                              <span className="ctx-chip-text">"{chip}"</span>
                              <span className="ctx-chip-x" onClick={() => setChip(null)}><IClose size={12} /></span>
                            </div>
                          )}

                          {(chatContextPapers.length > 0 || activeFolderPapers.length > 0) && (
                            <div className="attach-picker attach-picker-inline" ref={attachMenuRef}>
                              <div className="composer-context-row">
                                <button
                                  className="composer-context-trigger"
                                  type="button"
                                  onClick={() => setAttachMenuOpen((v) => !v)}
                                  title="Review chat context PDFs"
                                >
                                  <IPaperclip size={12} />
                                  <span>Context</span>
                                </button>
                                <div className="composer-context-list">
                                  {chatContextPapers.slice(0, 2).map((paper) => (
                                    <span key={paper.id} className="composer-context-pill" title={paper.name}>
                                      <IFile size={11} style={{ flexShrink: 0 }} />
                                      <span className="composer-context-pill-text">{paper.name}</span>
                                    </span>
                                  ))}
                                  {chatContextPapers.length > 2 && (
                                    <span className="composer-context-pill composer-context-pill-more">
                                      +{chatContextPapers.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </div>
                              {attachMenuOpen && (
                                <div className="attach-menu">
                                  <div className="attach-head">
                                    <span className="attach-title">Chat context PDFs</span>
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <button
                                        className="attach-mini-btn"
                                        type="button"
                                        onClick={() => {
                                          setChatContextMode("manual");
                                          setSelectedChatPaperIds(activeFolderPapers.map((p) => p.id));
                                        }}
                                      >
                                        All
                                      </button>
                                      <button
                                        className="attach-mini-btn"
                                        type="button"
                                        onClick={() => {
                                          setChatContextMode("auto");
                                          setSelectedChatPaperIds(activePaper?.id ? [activePaper.id] : []);
                                        }}
                                      >
                                        Active
                                      </button>
                                    </div>
                                  </div>

                                  {activeFolderPapers.length === 0 ? (
                                    <div className="attach-empty">No PDFs in this folder yet.</div>
                                  ) : (
                                    <div className="attach-list">
                                      {activeFolderPapers.map((paper) => {
                                        const checked = chatContextMode === "auto"
                                          ? paper.id === activePaper?.id
                                          : selectedChatPaperIds.includes(paper.id);
                                        return (
                                          <label key={paper.id} className="attach-item">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() => {
                                                setChatContextMode("manual");
                                                setSelectedChatPaperIds((prev) =>
                                                  prev.includes(paper.id)
                                                    ? prev.filter((id) => id !== paper.id)
                                                    : [...prev, paper.id]
                                                );
                                              }}
                                            />
                                            <IFile size={12} style={{ color: "#888", flexShrink: 0 }} />
                                            <span className="attach-name">{paper.name}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="chat-composer">
                            <textarea
                              ref={taRef}
                              rows={1}
                              value={input}
                              onChange={(e) => {
                                setInput(e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  doSend();
                                }
                                }}
                              placeholder="Ask about this PDF..."
                            />

                            <div className="composer-bottom">
                              <div className="composer-tools">
                                <div className="model-picker" ref={modelMenuRef}>
                                  <button
                                    className="model-chip"
                                    title="Model"
                                    onClick={() => setModelMenuOpen((v) => !v)}
                                    type="button"
                                  >
                                    {selectedModel} <IChevronDown size={12} />
                                  </button>
                                  {modelMenuOpen && (
                                    <div className="model-menu">
                                      {OPENAI_MODELS.map((modelName) => (
                                        <button
                                          key={modelName}
                                          className={`model-option ${selectedModel === modelName ? "active" : ""}`}
                                          onClick={() => {
                                            setSelectedModel(modelName);
                                            setModelMenuOpen(false);
                                          }}
                                          type="button"
                                        >
                                          {modelName}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {chatLoadingState ? (
                                <button
                                  className="chat-history-btn composer-stop-btn"
                                  onClick={stopChatRun}
                                  title="Stop"
                                  type="button"
                                >
                                  Stop
                                </button>
                              ) : (
                                <button className="icon-btn send-btn" onClick={() => doSend()} disabled={!input.trim() && !chip} title="Send" type="button">
                                  <IArrowUp size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  </>
                )}
              </>
            ) : (
              <div className="welcome">
                {!sidebarOpen && (
                  <button className="topbar-btn" onClick={() => setSidebarOpen(true)} style={{ marginBottom: 12 }}>
                    <IChevronRightDouble size={14} /> Library
                  </button>
                )}
                <div style={{ fontSize: 40, opacity: 0.15 }}>📄</div>
                <h2 style={{ fontSize: 20, color: "#333", margin: "14px 0 8px" }}>Welcome to Paperview</h2>
                <p style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 380 }}>Open a folder of PDFs or upload individual papers, then chat with AI-powered citations.</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {typeof window.showDirectoryPicker === 'function' && (
                    <button className="welcome-upload" type="button" onClick={() => setShowFolderPermModal(true)}>
                      <IFolder size={12} /> Open Folder
                    </button>
                  )}
                  <button
                    className="welcome-upload"
                    type="button"
                    style={typeof window.showDirectoryPicker === 'function' ? { background: '#fff', color: '#333', border: '1px solid #d5d3cd' } : {}}
                    onClick={() => {
                      if (activeFolder?.id) setUpFolder(activeFolder.id);
                      else if (folders.length) setUpFolder(folders[0].id);
                      setShowUpload(true);
                    }}
                  >
                    <IUpload size={12} /> Upload PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {popup && (
          <div
            className="sel-pop"
            style={{ left: Math.min(Math.max(popup.x - 130, 8), window.innerWidth - 320), top: Math.max(popup.y - 50, 8) }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="sel-btn pri" onClick={askAI}><ISpark size={13} /> Ask AI</button>
            <button className="sel-btn" onClick={addToChat}><IChat size={13} /> Add to chat</button>
            <button className="sel-btn" onClick={handleHighlight}><IHighlight size={13} /> Highlight</button>
            <button className="sel-btn" onClick={() => { navigator.clipboard?.writeText(popup.text); setPopup(null); }}><ICopy size={13} /> Copy</button>
          </div>
        )}

        {annPopover && (
          <div
            className="ann-popover"
            style={{
              left: Math.min(Math.max(annPopover.x - 150, 8), window.innerWidth - 320),
              top: Math.min(annPopover.y, window.innerHeight - 260),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ann-popover-text">"{annPopover.ann.selectedText}"</div>
            <textarea
              value={annComment}
              onChange={(e) => setAnnComment(e.target.value)}
              placeholder="Add a comment..."
              autoFocus
            />
            <div className="ann-popover-actions">
              <button className="ann-popover-btn danger" onClick={() => deleteAnnotationById(annPopover.ann.id)}>Delete</button>
              <button className="ann-popover-btn" onClick={() => setAnnPopover(null)}>Cancel</button>
              <button className="ann-popover-btn primary" onClick={saveAnnotationComment}>Save</button>
            </div>
          </div>
        )}

        {showUpload && (
          <UploadModal
            folders={folders}
            upFolder={upFolder}
            setUpFolder={setUpFolder}
            upStatus={upStatus}
            upStatusText={upStatusText}
            pendingFile={pendingFile}
            dragOver={dragOver}
            setDragOver={setDragOver}
            fileRef={fileRef}
            fileSelected={fileSelected}
            doUpload={doUpload}
            closeModal={closeModal}
          />
        )}

        {showSettings && (
          <SettingsModal
            apiKey={apiKey}
            apiKeySource={apiKeySource}
            rememberedApiKeyAvailable={rememberedApiKeyAvailable}
            settingsKey={settingsKey}
            setSettingsKey={setSettingsKey}
            settingsKeyVisible={settingsKeyVisible}
            setSettingsKeyVisible={setSettingsKeyVisible}
            rememberApiKey={rememberApiKey}
            setRememberApiKey={setRememberApiKey}
            settingsPassphrase={settingsPassphrase}
            setSettingsPassphrase={setSettingsPassphrase}
            settingsPassphraseVisible={settingsPassphraseVisible}
            setSettingsPassphraseVisible={setSettingsPassphraseVisible}
            unlockPassphrase={unlockPassphrase}
            setUnlockPassphrase={setUnlockPassphrase}
            unlockPassphraseVisible={unlockPassphraseVisible}
            setUnlockPassphraseVisible={setUnlockPassphraseVisible}
            settingsError={settingsError}
            setSettingsError={setSettingsError}
            settingsBusy={settingsBusy}
            closeSettingsModal={closeSettingsModal}
            handleRemoveApiKey={handleRemoveApiKey}
            handleUnlockRememberedApiKey={handleUnlockRememberedApiKey}
            handleSaveSettingsApiKey={handleSaveSettingsApiKey}
            setRememberedApiKeyAvailable={setRememberedApiKeyAvailable}
          />
        )}

        {edgeToast && (
          <div className="edge-toast">
            <span>💡 For the best experience, disable Edge's mini menu: <b>Settings → Appearance → Show mini menu when selecting text → Off</b></span>
            <button onClick={() => { setEdgeToast(false); localStorage.setItem('pv-edge-toast-dismissed', '1'); }}>Got it</button>
          </div>
        )}

        {showFolderPermModal && (
          <FolderPermModal
            onCancel={() => setShowFolderPermModal(false)}
            onConfirm={() => { setShowFolderPermModal(false); handleOpenFolder(); }}
          />
        )}

        {!privacyAccepted && (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
            <div style={{ background:'#fff',borderRadius:16,padding:36,maxWidth:480,width:'100%',boxShadow:'0 8px 48px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize:20,fontWeight:800,letterSpacing:'-0.4px',marginBottom:8 }}>Before you start</div>
              <p style={{ fontSize:13,color:'#4e4b45',lineHeight:1.6,marginBottom:20,fontWeight:500 }}>
                Paperview runs entirely in your browser — there is no server. Here's what you should know:
              </p>
              <div style={{ display:'flex',flexDirection:'column',gap:10,marginBottom:24 }}>
                {[
                  { green:true,  text:'Your PDF files are processed locally and never uploaded to us.' },
                  { green:true,  text:'Chat history and annotations are saved in your browser and synced to a .paperview.json file inside your folder.' },
                  { green:true,  text:'Your API key is kept in memory by default; remembered keys are encrypted in this browser with your passphrase.' },
                  { green:false, text:'PDF text is sent to OpenAI when you send a message.' },
                  { green:false, text:'Your API key is sent from the browser only when you use a client-side key instead of the backend proxy.' },
                ].map((item, i) => (
                  <div key={i} style={{ display:'flex',gap:10,alignItems:'flex-start' }}>
                    <div style={{ width:8,height:8,borderRadius:'50%',background:item.green?'#16a34a':'#dc2626',marginTop:5,flexShrink:0 }} />
                    <span style={{ fontSize:13,color:'#4e4b45',lineHeight:1.5,fontWeight:500 }}>{item.text}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12,color:'#8a867c',marginBottom:24,lineHeight:1.5,fontWeight:500 }}>
                Green = stays on your device. Red = sent to OpenAI over HTTPS. If you deploy the backend proxy, Paperview sends those requests through your own server route instead of directly from the browser.
              </p>
              <button
                style={{ width:'100%',background:'#121212',color:'#fff',border:'none',borderRadius:10,padding:'12px 0',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}
                onClick={() => { localStorage.setItem('pv-privacy-ok','1'); setPrivacyAccepted(true); }}
              >
                I understand — open the app
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
