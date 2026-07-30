import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  saveChat,
  saveAgentChat,
  saveUploadedPdf,
} from './db';
import { clearOcrMemoryCache, terminateTesseractWorkerNow } from './pdfUtils';
import { IFolder, IFolderOpen, IFile, IPlus, ISearch, IUpload, IClose, ICopy, IGrid, IChat, IRight, ISpark, IChevronDown, IChevronLeftDouble, IChevronRightDouble, IGear, IHighlight } from './icons';
import { CSS } from './styles';
import { createAgentChatThreadRecord, createChatThreadRecord, formatChatTimestamp, formatChatMessageCount, derivePageTexts } from './chatUtils';
import { evictUnpinnedPayloads, stripPaperPayload } from './paperPayloadUtils';
import { usePaperPayloads } from './hooks/usePaperPayloads';

import {
  OPENAI_MODEL,
  AGENT_IMPORTS_FOLDER_NAME,
  UPLOADS_FOLDER_ID,
  UPLOADS_FOLDER_NAME,
} from './constants';
import {
  normalizeAgentSourceUrl,
  stripPdfExtension,
  buildAgentImportKey,
  formatSourceAuthors,
  getMessageFoundSources,
  findWorkspacePaperForSource,
} from './agentSources';
import {
  hasExtractedPaperText,
  buildFolderPath,
} from './miscUtils';
import SettingsModal from './components/SettingsModal';
import LibraryView from './components/LibraryView';
import AgentView from './components/AgentView';
import ReaderView from './components/ReaderView';
import ChatPanel from './components/ChatPanel';
import UploadModal from './components/UploadModal';
import FolderPermModal from './components/FolderPermModal';
import { useApiKey } from './hooks/useApiKey';
import { useRequestRuns } from './hooks/useRequestRun';
import { usePanelResize } from './hooks/usePanelResize';
import { useViewerSearch } from './hooks/useViewerSearch';
import { useAnnotations } from './hooks/useAnnotations';
import { useChatThreads } from './hooks/useChatThreads';
import { useChatSend } from './hooks/useChatSend';
import { useAgentThreads } from './hooks/useAgentThreads';
import { useFolders } from './hooks/useFolders';
import { useAgentSend } from './hooks/useAgentSend';

export default function PaperviewApp() {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [input, setInput] = useState("");
  const [agentInput, setAgentInput] = useState("");
  const [chatLoadingState, setChatLoadingState] = useState(null);
  const [agentLoadingState, setAgentLoadingState] = useState(null);
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
  const fileRef = useRef(null);
  const scrollFnRef = useRef(null);
  const modelMenuRef = useRef(null);
  const attachMenuRef = useRef(null);
  const agentAttachMenuRef = useRef(null);
  const agentToolMenuRef = useRef(null);


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
  const browserAgentFolder = folders.find((folder) => folder.id === UPLOADS_FOLDER_ID) || null;
  const agentRootFolderId = hasWritableAgentContext
    ? selectedRootFolderId
    : (browserAgentFolder?.rootFolderId || (browserAgentFolder ? UPLOADS_FOLDER_ID : null));
  const agentRootFolder = hasWritableAgentContext
    ? selectedRootFolder
    : browserAgentFolder;
  const agentWorkspacePapers = useMemo(
    () =>
      agentRootFolderId
        ? folders
            .filter((folder) => folder.rootFolderId === agentRootFolderId)
            .flatMap((folder) => folder.papers.map((paper) => mergePaperRecord({ ...paper, folderId: folder.id })))
        : [],
    [folders, mergePaperRecord, agentRootFolderId]
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

  const clearAgentRemotePapersForThreadRef = useRef(() => {});

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

  const agentSendRef = useRef(null);
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
    syncRootFolderSnapshotRef: { get current() { return syncRootFolderSnapshotRef.current; } },
    agentRequestRef,
    selectedRootFolderId: agentRootFolderId,
    agentLoadingState,
    setAgentLoadingState,
    setAgentInput,
    setSelectedAgentPaperIds,
    setAgentPreviewState: (value) => agentSendRef.current?.setAgentPreviewState(value),
    agentPreviewScrollFnRef: { get current() { return agentSendRef.current?.agentPreviewScrollFnRef.current ?? null; }, set current(v) { if (agentSendRef.current) agentSendRef.current.agentPreviewScrollFnRef.current = v; } },
    clearAgentRemotePapersForThread: (chatId) => clearAgentRemotePapersForThreadRef.current(chatId),
  });

  const activeChat = useMemo(
    () => chatThreads.find((thread) => thread.id === activeChatId) || null,
    [chatThreads, activeChatId]
  );
  const activeAgentChat = useMemo(
    () => agentThreads.find((thread) => thread.id === activeAgentChatId && thread.rootFolderId === agentRootFolderId) || null,
    [agentThreads, activeAgentChatId, agentRootFolderId]
  );
  const currentMessages = activeChat?.messages || [];
  const currentAgentMessages = activeAgentChat?.messages || [];
  const activePaperThreads = useMemo(() => {
    if (!activePaper?.id) return [];
    return chatThreads
      .filter((thread) => thread.paperId === activePaper.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [chatThreads, activePaper?.id]);
  const selectedRootAgentThreads = useMemo(() => {
    if (!agentRootFolderId) return [];
    return agentThreads
      .filter((thread) => thread.rootFolderId === agentRootFolderId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [agentThreads, agentRootFolderId]);
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, activeChatId]);

  useEffect(() => {
    agentEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentAgentMessages, activeAgentChatId]);

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
    if (!agentRootFolderId) {
      setActiveAgentChatId(null);
      return;
    }

    const rootThreads = agentThreads
      .filter((thread) => thread.rootFolderId === agentRootFolderId)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (rootThreads.some((thread) => thread.id === activeAgentChatId)) {
      return;
    }

    if (rootThreads.length) {
      setActiveAgentChatId(rootThreads[0].id);
      return;
    }

    const thread = createAgentChatThreadRecord(agentRootFolderId);
    setAgentThreads((prev) => [thread, ...prev]);
    saveAgentChat(thread)
      .then(() => syncRootFolderSnapshotRef.current?.(agentRootFolderId))
      .catch(() => {});
    setActiveAgentChatId(thread.id);
  }, [agentRootFolderId, activeAgentChatId, agentThreads]);

  const ensureBrowserAgentWorkspace = useCallback(() => {
    setFolders((prev) => {
      if (prev.some((folder) => folder.id === UPLOADS_FOLDER_ID)) return prev;
      return [
        ...prev,
        {
          id: UPLOADS_FOLDER_ID,
          name: UPLOADS_FOLDER_NAME,
          expanded: true,
          papers: [],
          depth: 0,
          directoryHandle: null,
          rootHandle: null,
          rootFolderId: UPLOADS_FOLDER_ID,
          relativePath: "",
          folderPath: buildFolderPath(UPLOADS_FOLDER_NAME),
        },
      ];
    });
    setSelectedFolderId((prev) => prev || UPLOADS_FOLDER_ID);
    setUpFolder((prev) => prev || UPLOADS_FOLDER_ID);
  }, []);

  useEffect(() => {
    if (currentView !== "agent") return;
    if (hasWritableAgentContext) return;
    ensureBrowserAgentWorkspace();
  }, [currentView, ensureBrowserAgentWorkspace, hasWritableAgentContext]);

  const {
    foldersRef,
    newFolder,
    nfName,
    setNfName,
    folderError,
    setFolderError,
    folderHandlesMapRef,
    scanDirHandleRef,
    syncRootFolderSnapshotRef,
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
    folders,
    setFolders,
    selectedFolderId,
    setSelectedFolderId,
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
    openAgentPaper: (...args) => openAgentPaper(...args),
    setUpFolder,
  });

  const {
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
  } = useAgentSend({
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
    selectedRootFolderId: agentRootFolderId,
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
  });
  agentSendRef.current = {
    setAgentPreviewState,
    agentPreviewScrollFnRef,
  };
  clearAgentRemotePapersForThreadRef.current = clearAgentRemotePapersForThread;

  useEffect(() => {
    const pinnedIds = new Set([activeTabId, agentPreviewState?.paperId].filter(Boolean));
    setPaperPayloads((prev) => {
      const evictedIds = Object.keys(prev).filter((paperId) => !pinnedIds.has(paperId));
      if (!evictedIds.length) return prev;
      evictedIds.forEach((paperId) => clearOcrMemoryCache(paperId));
      return evictUnpinnedPayloads(prev, pinnedIds);
    });
  }, [activeTabId, agentPreviewState?.paperId]);


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
    const liveFolders = foldersRef.current?.length ? foldersRef.current : folders;
    const ownerFolder =
      liveFolders.find((f) => f.id === folderId) ||
      liveFolders.find((f) => f.papers.some((p) => p.id === paper.id));
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


  const { doSend, askAI, handleCitationClick, renderUsageMeta } = useChatSend({
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
  });

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
                    disabled={!source.pdfUrl || agentImportStates[importKey]?.status === "loading"}
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
                  {!localPaper && source.pdfUrl && source.hydrationStatus !== "manual_required" ? (
                    <button
                      className="paper-result-btn"
                      type="button"
                      title={hasWritableAgentContext ? `Save into ${AGENT_IMPORTS_FOLDER_NAME}` : `Add to ${UPLOADS_FOLDER_NAME}`}
                      disabled={agentImportStates[importKey]?.status === "loading" || agentImportStates[importKey]?.status === "done"}
                      onClick={() => importPaperResult(source, message.id)}
                    >
                      {agentImportStates[importKey]?.status === "loading"
                        ? "Importing..."
                        : agentImportStates[importKey]?.status === "done"
                          ? (agentImportStates[importKey]?.label || "Imported")
                          : "Import"}
                    </button>
                  ) : null}
                  {agentImportStates[importKey]?.status === "error" ? (
                    <span className="agent-found-source-badge">{agentImportStates[importKey].label}</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }, [activeAgentChatId, activeAgentRemotePapers, agentFolderCheckStates, agentImportStates, agentWorkspacePapers, hasWritableAgentContext, importPaperResult, openAgentPaper, openAgentPreviewPaper, refreshRootFolderContents, selectedRootFolder?.name, selectedRootFolderId]);



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
      updatePaperPayload(paperId, {
        pdfBytes: uint8,
        fileSize: pendingFile.size,
        fileLastModified: pendingFile.lastModified,
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
        // No folder open yet — create an in-memory Uploads folder
        const uploadsId = UPLOADS_FOLDER_ID;
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
            name: UPLOADS_FOLDER_NAME,
            expanded: true,
            papers: [readyPaper],
            depth: 0,
            directoryHandle: null,
            rootHandle: null,
            rootFolderId: uploadsId,
            relativePath: "",
            folderPath: buildFolderPath(UPLOADS_FOLDER_NAME),
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
                      ? (agentRootFolder?.name ? `Agent · ${agentRootFolder.name}` : "Agent")
                      : activeFolder?.name || "Reader"}
                </span>
                <span className="topbar-subtitle">
                  {currentView === "library"
                    ? `${totalPaperCount} paper${totalPaperCount === 1 ? "" : "s"} across ${folders.length} folders`
                    : currentView === "agent"
                      ? `Research across the web and ${agentWorkspacePapers.length} local paper${agentWorkspacePapers.length === 1 ? "" : "s"} in this workspace`
                      : activePaper?.pdfBytes
                        ? "Search, annotate, and verify with source-backed answers"
                        : "Reading from extracted text with chat grounded in the document"}
                </span>
              </div>
            </div>

            <div className="topbar-right">
              {openTabs.length > 0 && <span className="topbar-count">{openTabs.length} file{openTabs.length > 1 ? "s" : ""} open</span>}
              {currentView === "agent" && agentRootFolder && <span className="topbar-mode">{selectedRootAgentThreads.length} thread{selectedRootAgentThreads.length === 1 ? "" : "s"}</span>}
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
              <LibraryView
                newFolder={newFolder}
                nfName={nfName}
                folderError={folderError}
                folders={folders}
                selectedFolderId={selectedFolderId}
                openTabs={openTabs}
                setShowFolderPermModal={setShowFolderPermModal}
                setShowUpload={setShowUpload}
                setNfName={setNfName}
                setFolderError={setFolderError}
                setUpFolder={setUpFolder}
                startNewFolder={startNewFolder}
                createFolder={createFolder}
                cancelNewFolder={cancelNewFolder}
                openFolderTabs={openFolderTabs}
                toggleFolder={toggleFolder}
                openAllPapersInFolder={openAllPapersInFolder}
                deleteFolder={deleteFolder}
                openPaper={openPaper}
                deletePaper={deletePaper}
              />
            ) : currentView === "agent" ? (
              <AgentView
                agentSidebarOpen={agentSidebarOpen}
                agentRootFolder={agentRootFolder}
                agentWorkspacePapers={agentWorkspacePapers}
                selectedRootAgentThreads={selectedRootAgentThreads}
                activeAgentChatId={activeAgentChatId}
                activeAgentChat={activeAgentChat}
                activeAgentSummary={activeAgentSummary}
                hasAgentPreview={hasAgentPreview}
                agentPreviewWidth={agentPreviewWidth}
                currentAgentMessages={currentAgentMessages}
                agentInput={agentInput}
                agentTools={agentTools}
                selectedAgentToolId={selectedAgentToolId}
                selectedAgentTool={selectedAgentTool}
                selectedAgentPaperIds={selectedAgentPaperIds}
                agentContextPapers={agentContextPapers}
                agentThinkingExpanded={agentThinkingExpanded}
                agentThinkingSteps={agentThinkingSteps}
                isAgentLoading={isAgentLoading}
                agentLoadingLabel={agentLoadingLabel}
                agentLoadingState={agentLoadingState}
                agentAttachMenuOpen={agentAttachMenuOpen}
                agentToolMenuOpen={agentToolMenuOpen}
                modelMenuOpen={modelMenuOpen}
                selectedModel={selectedModel}
                setAgentSidebarOpen={setAgentSidebarOpen}
                setAgentInput={setAgentInput}
                setAgentThinkingExpanded={setAgentThinkingExpanded}
                setAgentAttachMenuOpen={setAgentAttachMenuOpen}
                setAgentToolMenuOpen={setAgentToolMenuOpen}
                setSelectedAgentPaperIds={setSelectedAgentPaperIds}
                setSelectedAgentToolId={setSelectedAgentToolId}
                setModelMenuOpen={setModelMenuOpen}
                setSelectedModel={setSelectedModel}
                openAgentThread={openAgentThread}
                deleteAgentThread={deleteAgentThread}
                startNewAgentChat={startNewAgentChat}
                resetActiveAgentHistory={resetActiveAgentHistory}
                selectAgentTool={selectAgentTool}
                renderUsageMeta={renderUsageMeta}
                renderFoundSourcesPanel={renderFoundSourcesPanel}
                renderAgentPreviewDrawer={renderAgentPreviewDrawer}
                handleCitationClick={handleCitationClick}
                openAgentPaper={openAgentPaper}
                doSendAgent={doSendAgent}
                stopAgentRun={stopAgentRun}
                startAgentPreviewResize={startAgentPreviewResize}
                agentEndRef={agentEndRef}
                agentTaRef={agentTaRef}
                agentAttachMenuRef={agentAttachMenuRef}
                agentToolMenuRef={agentToolMenuRef}
                modelMenuRef={modelMenuRef}
              />
            ) : activePaper ? (
              <>
                <ReaderView
                  activePaper={activePaper}
                  scale={scale}
                  currentPage={currentPage}
                  activePaperTotalPages={activePaperTotalPages}
                  annotations={annotations}
                  debugCitations={debugCitations}
                  viewerSearchOpen={viewerSearchOpen}
                  viewerSearchQuery={viewerSearchQuery}
                  viewerSearchStatus={viewerSearchStatus}
                  viewerSearchMatches={viewerSearchMatches}
                  viewerSearchIndex={viewerSearchIndex}
                  canRunViewerSearch={canRunViewerSearch}
                  hasViewerSearchResults={hasViewerSearchResults}
                  searchablePageTexts={searchablePageTexts}
                  chatOpen={chatOpen}
                  setScale={setScale}
                  setCurrentPage={setCurrentPage}
                  setViewerSearchOpen={setViewerSearchOpen}
                  setViewerSearchQuery={setViewerSearchQuery}
                  setViewerSearchStatus={setViewerSearchStatus}
                  setViewerSearchMatches={setViewerSearchMatches}
                  setViewerSearchIndex={setViewerSearchIndex}
                  goToPage={goToPage}
                  handlePdfReady={handlePdfReady}
                  handlePdfDocumentLoad={handlePdfDocumentLoad}
                  handleAnnotationClick={handleAnnotationClick}
                  runViewerSearch={runViewerSearch}
                  handleSearchClick={handleSearchClick}
                  startChatResize={startChatResize}
                  viewerSearchInputRef={viewerSearchInputRef}
                />
                {chatOpen && (
                  <ChatPanel
                    chatWidth={chatWidth}
                    chatPaneMode={chatPaneMode}
                    activeChat={activeChat}
                    activeChatSummary={activeChatSummary}
                    annotations={annotations}
                    currentMessages={currentMessages}
                    chip={chip}
                    input={input}
                    isActivePaperScanning={isActivePaperScanning}
                    activePaper={activePaper}
                    activePaperScanPercent={activePaperScanPercent}
                    activePaperScanLabel={activePaperScanLabel}
                    activePaperThreads={activePaperThreads}
                    activePaperMessageCount={activePaperMessageCount}
                    savedPaperThreads={savedPaperThreads}
                    chatQuickActions={chatQuickActions}
                    activeFolderPapers={activeFolderPapers}
                    openTabs={openTabs}
                    thinkingExpanded={thinkingExpanded}
                    isChatLoading={isChatLoading}
                    thinkingSteps={thinkingSteps}
                    activeChatId={activeChatId}
                    chatLoadingLabel={chatLoadingLabel}
                    chatContextPapers={chatContextPapers}
                    attachMenuOpen={attachMenuOpen}
                    selectedChatPaperIds={selectedChatPaperIds}
                    chatContextMode={chatContextMode}
                    modelMenuOpen={modelMenuOpen}
                    selectedModel={selectedModel}
                    chatLoadingState={chatLoadingState}
                    setChatPaneMode={setChatPaneMode}
                    setChip={setChip}
                    setInput={setInput}
                    setChatOpen={setChatOpen}
                    setThinkingExpanded={setThinkingExpanded}
                    setAttachMenuOpen={setAttachMenuOpen}
                    setChatContextMode={setChatContextMode}
                    setSelectedChatPaperIds={setSelectedChatPaperIds}
                    setModelMenuOpen={setModelMenuOpen}
                    setSelectedModel={setSelectedModel}
                    startNewChat={startNewChat}
                    resetActiveChatHistory={resetActiveChatHistory}
                    openChatThread={openChatThread}
                    deleteChatThread={deleteChatThread}
                    goToPage={goToPage}
                    deleteAnnotationById={deleteAnnotationById}
                    doSend={doSend}
                    renderUsageMeta={renderUsageMeta}
                    handleCitationClick={handleCitationClick}
                    stopChatRun={stopChatRun}
                    endRef={endRef}
                    attachMenuRef={attachMenuRef}
                    taRef={taRef}
                    modelMenuRef={modelMenuRef}
                  />
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
