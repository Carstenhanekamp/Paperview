import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  saveChat,
  saveAgentChat,
  saveUploadedPdf,
} from './db';
import { clearOcrMemoryCache, terminateTesseractWorkerNow } from './pdfUtils';
import { IFolder, IFolderOpen, IFile, IPlus, ISearch, IUpload, IClose, IGrid, IChat, IRight, ILeft, ISpark, IChevronDown, IChevronLeftDouble, IChevronRightDouble, IGear, INotes } from './icons';
import { CSS } from './styles';
import { useScopedStyles } from './hooks/useScopedStyles';
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
import FoundingWelcome from './components/FoundingWelcome';
import AccountMenu from './components/AccountMenu';
import { libraryChromeLabel } from './profileOnboarding';
import LibraryView from './components/LibraryView';
import LibraryPaperDetail from './components/LibraryPaperDetail';
import BibtexPreviewModal from './components/BibtexPreviewModal';
import AgentView from './components/AgentView';
import ReaderView from './components/ReaderView';
import ViewerSearchField from './components/ViewerSearchField';
import ChatPanel from './components/ChatPanel';
import UploadModal from './components/UploadModal';
import FolderPermModal from './components/FolderPermModal';
import EmptyReaderState from './components/EmptyReaderState';
import SelectionToolbar from './components/SelectionToolbar';
import ExplainPopover from './components/ExplainPopover';
import { useAuthContext } from './AuthContext';
import { useWalletContext } from './WalletContext';
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
import { useExplainSelection } from './hooks/useExplainSelection';
import { usePaperMeta } from './hooks/usePaperMeta';
import { useLibraryIndex } from './hooks/useLibraryIndex';
import { getFileSystem } from './platform/fs';

export default function PaperviewApp() {
  const canPickFolder = getFileSystem().canPickFolder();
  // Vite can strip mix-blend-mode from JSX <style>{CSS}</style>; inject critically for PDF highlights.
  useScopedStyles(
    'pv-pdf-highlight',
    `.textLayer,.ocrLayer{mix-blend-mode:multiply;}
.ann-hl{background:color-mix(in srgb,var(--highlight) 72%,#fff)!important;border-radius:2px;cursor:pointer;color:transparent!important;box-decoration-break:clone;-webkit-box-decoration-break:clone;}
.ann-hl::selection{background:rgba(85,105,127,.30);color:transparent;}
.vt-btn.hl-btn:disabled{opacity:.4;cursor:not-allowed;}
.topbar-find{display:flex;align-items:center;gap:2px;height:28px;min-width:126px;max-width:126px;padding:0 4px 0 8px;border-radius:8px;background:#fff;box-shadow:var(--sh-hairline);transition:max-width .22s cubic-bezier(0.32,0.72,0,1),box-shadow .18s cubic-bezier(0.32,0.72,0,1);}
.topbar-find.open{max-width:320px;min-width:220px;box-shadow:var(--sh-hairline),0 0 0 2px color-mix(in srgb,var(--accent) 28%,transparent);}
.topbar-find-ico{display:flex;color:var(--text-4);flex-shrink:0;}
.topbar-find-input{flex:1;min-width:0;height:100%;border:0;outline:none;background:transparent;font-size:12.5px;font-family:inherit;color:var(--ink);padding:0 4px;}
.topbar-find-input::placeholder{color:var(--text-5);}
.topbar-find-input::-webkit-search-cancel-button{display:none;}
.topbar-find-actions{display:flex;align-items:center;gap:1px;flex-shrink:0;}
.topbar-find-meta{font-size:11px;font-weight:600;color:var(--text-4);font-variant-numeric:tabular-nums;padding:0 4px;white-space:nowrap;}
.topbar-find-btn{width:22px;height:22px;border:none;border-radius:5px;background:transparent;color:var(--text-3);cursor:pointer;display:grid;place-items:center;padding:0;}
.topbar-find-btn:hover{background:var(--hover);color:var(--ink);}
.topbar-find-btn:disabled{opacity:.35;cursor:not-allowed;}
.vt-page-current{appearance:none;border:none;background:transparent;padding:0 2px;margin:0;font:inherit;font-variant-numeric:tabular-nums;font-size:12.5px;font-weight:600;color:var(--ink);cursor:text;border-radius:4px;line-height:1;}
.vt-page-current:hover{background:var(--hover);}
.vt-page-input{width:2.75ch;min-width:2.75ch;border:none;outline:none;background:var(--fill-1);border-radius:4px;padding:1px 3px;font:inherit;font-variant-numeric:tabular-nums;font-size:12.5px;font-weight:600;color:var(--ink);text-align:center;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 35%,transparent);}
.sb-folder{margin-bottom:6px;}
.sb-papers{padding:4px 0 2px 18px!important;gap:3px!important;}
:root{--answer:var(--sans);}
.msg-a-bubble,.cited-answer-p,.cited-answer-li{font-family:var(--sans)!important;line-height:1.65!important;}
.agent-view .msg-a-bubble{font-family:var(--sans)!important;}
.msg-a-bubble strong,.cited-answer-body strong{font-weight:600;}
.cited-answer{display:flex;flex-direction:column;gap:14px;}
.cited-sources{display:flex;flex-direction:column;gap:8px;}
.source-card-list{margin-left:0!important;display:flex;align-items:flex-start;gap:10px;text-align:left;width:100%;font:inherit;border:none;cursor:pointer;background:var(--fill-2);border-radius:10px;padding:10px 11px;}
.source-card-list:hover{background:#F1F3F6;}
.source-card-num{min-width:18px;height:18px;padding:0 5px;border-radius:5px;flex-shrink:0;margin-top:1px;background:var(--accent-tint);color:var(--accent-on-tint);font-family:var(--sans);font-size:10px;font-weight:700;line-height:18px;text-align:center;}
.source-card-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;}
.source-card-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:var(--sans);font-size:11.5px;font-weight:500;color:var(--text-3);}
.source-card-meta .source-card-jump{margin-left:auto;font-size:12px;color:var(--accent);font-weight:700;}`
  );

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
  const [readerDetailOpen, setReaderDetailOpen] = useState(false);
  const [readerBibtexPreview, setReaderBibtexPreview] = useState(null);
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
  const { width: sidebarWidth, startResize: startSbResizeBase } = usePanelResize({ initialWidth: 238, min: 200, max: 360, direction: "left" });
  const { startResize: startAgentPreviewResizeBase } = usePanelResize({ initialWidth: 420, min: 300, max: 900, direction: "right" });
  const [currentPage, setCurrentPage] = useState(1);

  const [privacyAccepted, setPrivacyAccepted] = useState(() => !!localStorage.getItem('pv-privacy-ok'));
  const [showFolderPermModal, setShowFolderPermModal] = useState(false);
  const auth = useAuthContext();
  const wallet = useWalletContext();
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
    applyInMemoryApiKey,
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

  const {
    metaById,
    getMeta,
    getTitle,
    getAuthorsLine,
    extractPaperMetaWithAI,
    exportFolderBibtex,
    exportLibraryBibtex,
  } = usePaperMeta({
    folders,
    activePaper,
    getPaperPayload,
    apiKey,
    selectedModel,
    openSettingsModal,
    getOpenAIRequestOptions: wallet.getRequestOptions,
    startPaperTextExtraction,
  });

  const {
    librarySearch,
    setLibrarySearch,
    searchResults,
    searchCorpus,
  } = useLibraryIndex({
    folders,
    metaById,
    apiKey,
    activePaper,
    getPaperPayload,
  });

  const activeFolder =
    folders.find((f) => f.papers.some((p) => p.id === activeTabId)) ||
    selectedFolder ||
    null;
  const activeFolderPapers = activeFolder?.papers || [];
  const allLibraryPapers = useMemo(
    () => folders.flatMap((folder) => (folder.papers || []).map((paper) => mergePaperRecord({ ...paper, folderId: folder.id }))),
    [folders, mergePaperRecord]
  );
  const totalPaperCount = folders.reduce((sum, folder) => sum + folder.papers.length, 0);
  const selectedRootFolderId = selectedFolder?.rootFolderId || null;
  const selectedRootFolder = folders.find((folder) => folder.id === selectedRootFolderId) || null;
  const hasWritableAgentContext = Boolean(selectedRootFolder?.directoryRef && selectedRootFolder?.rootRef);
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
    const byId = new Map([
      ...paperPool.map((paper) => [paper.id, paper]),
      ...allLibraryPapers.map((paper) => [paper.id, paper]),
    ]);
    const explicitlySelected = selectedChatPaperIds.map((id) => byId.get(id)).filter(Boolean);
    if (chatContextMode === "manual") {
      return explicitlySelected.length ? explicitlySelected : (activePaper ? [activePaper] : []);
    }
    if (chatContextMode === "folder") {
      return activeFolderPapers.length ? activeFolderPapers.map((p) => mergePaperRecord(p)) : (activePaper ? [activePaper] : []);
    }
    if (chatContextMode === "library") {
      return allLibraryPapers.length ? allLibraryPapers : (activePaper ? [activePaper] : []);
    }
    return activePaper ? [activePaper] : explicitlySelected;
  }, [activeFolderPapers, openTabs, selectedChatPaperIds, activePaper, chatContextMode, allLibraryPapers, mergePaperRecord]);
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
    const handler = (e) => {
      // Floating/selection chrome preserves the range via preventDefault;
      // don't clear the popup on their mouseup.
      if (e.target?.closest?.('.sel-pop, .hl-btn, .ann-popover, .viewer-float-toolbar')) return;
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
          directoryRef: null,
          rootRef: null,
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
    getOpenAIRequestOptions: wallet.getRequestOptions,
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
    openViewerSearch,
    closeViewerSearch,
    viewerSearchQuery,
    setViewerSearchQuery,
    viewerSearchStatus,
    viewerSearchMatches,
    viewerSearchIndex,
    viewerSearchInputRef,
    canRunViewerSearch,
    runViewerSearch,
  } = useViewerSearch({
    activePaper,
    currentPage,
    goToPage,
    resetKey: activeTabId,
    enabled: currentView === "reader" && Boolean(activePaper),
  });


  const { doSend, handleCitationClick, renderUsageMeta } = useChatSend({
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
    getOpenAIRequestOptions: wallet.getRequestOptions,
    currentMessages,
    chatContextPapers,
    chatContextMode,
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
  });

  const { explainState, explainSelection, dismissExplain } = useExplainSelection({
    apiKey,
    openSettingsModal,
    selectedModel,
    getOpenAIRequestOptions: wallet.getRequestOptions,
  });

  const handleExplainSelection = () => {
    if (!popup) return;
    const snapshot = popup;
    setPopup(null);
    window.getSelection()?.removeAllRanges();
    explainSelection(snapshot);
  };

  const handleExplainAddToChat = (passage) => {
    setChip(passage);
    dismissExplain();
    taRef.current?.focus();
  };
  const renderFoundSourcesPanel = useCallback((message) => {
    const foundSourcesMeta = getMessageFoundSources(message, activeAgentRemotePapers);
    if (!foundSourcesMeta.shown.length) return null;

    return (
      <section className="agent-found-sources">
        <div className="found-label">Found</div>

        <div className="agent-found-sources-list">
          {foundSourcesMeta.shown.map((source, index) => {
            const authorLine = formatSourceAuthors(source.authors);
            const venueLine = [source.venue || source.sourceHost, source.year].filter(Boolean).join(" · ");
            const secondaryLine = venueLine || source.sourceHost || "Source";
            const importKey = buildAgentImportKey(message.id, source);
            const folderCheckState = agentFolderCheckStates[importKey] || null;
            const localPaper = findWorkspacePaperForSource(agentWorkspacePapers, source);
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
                <div className="agent-found-source-copy" style={{ minWidth: 0, flex: 1 }}>
                  <div className="agent-found-source-title">{source.title || `Source ${index + 1}`}</div>
                  {secondaryLine ? (
                    <div className="agent-found-source-meta">
                      {[authorLine, secondaryLine].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                  {source.hydrationError ? (
                    <div className="agent-found-source-summary" style={{ color: "#9a3412" }}>{source.hydrationError}</div>
                  ) : null}
                  {folderCheckState?.label ? (
                    <div className="agent-found-source-summary">{folderCheckState.label}</div>
                  ) : null}
                </div>

                <div className="agent-found-source-actions">
                  {localPaper || agentImportStates[importKey]?.status === "done" ? (
                    <span className="agent-found-source-badge">In library</span>
                  ) : (
                    <button
                      className="save-btn"
                      type="button"
                      disabled={agentImportStates[importKey]?.status === "loading"}
                      onClick={() => {
                        if (source.pdfUrl && source.hydrationStatus !== "manual_required") {
                          importPaperResult(source, message.id);
                          return;
                        }
                        openPdfInBrowser();
                        if (source.hydrationStatus === "manual_required") checkFolderForPaper();
                      }}
                    >
                      {agentImportStates[importKey]?.status === "loading" ? "Saving…" : "+ Save to folder"}
                    </button>
                  )}
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
            directoryRef: null,
            rootRef: null,
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
      <div className="app" onMouseDown={(e) => {
        if (!e.target.closest(".sel-pop, .viewer-float-toolbar, .hl-btn")) setPopup(null);
        if (!e.target.closest(".ann-popover") && !e.target.closest("[data-ann-id]")) setAnnPopover(null);
        if (!e.target.closest(".explain-popover") && !e.target.closest(".sel-pop")) dismissExplain();
      }}>
        <div className={`sb ${sidebarOpen ? "" : "closed"}`} style={sidebarOpen ? { width: sidebarWidth, minWidth: sidebarWidth } : undefined}>
          <div className="sb-inner" style={{ width: sidebarWidth }}>
            <div className="sb-chrome">
              <button type="button" className="sb-workspace" onClick={() => setCurrentView("library")} title="Library">
                <span className="sb-workspace-mark" aria-hidden="true" />
                <span className="sb-workspace-label">{libraryChromeLabel(auth.profile, activeFolder?.name)}</span>
                <span className="sb-workspace-chev"><IChevronDown size={12} /></span>
              </button>
              <button className="sb-tog" onClick={() => setSidebarOpen(false)} title="Collapse">
                <IChevronLeftDouble size={14} />
              </button>
            </div>

            <div className="sb-nav">
              <button className={`sb-nav-item ${currentView === "reader" && chatPaneMode !== "notes" ? "active" : ""}`} onClick={() => { setCurrentView("reader"); setChatPaneMode("chat"); setChatOpen(true); }}>
                <IGrid size={14} /> Reading
              </button>
              <button className={`sb-nav-item ${currentView === "library" ? "active" : ""}`} onClick={() => setCurrentView("library")}>
                <IFolder size={14} /> Library
                <span className="sb-nav-count">{totalPaperCount || ""}</span>
              </button>
              <button className={`sb-nav-item ${currentView === "agent" ? "active" : ""}`} onClick={() => setCurrentView("agent")}>
                <ISpark size={14} /> Research agent
              </button>
              <button
                className={`sb-nav-item ${currentView === "reader" && chatPaneMode === "notes" ? "active" : ""}`}
                onClick={() => { setCurrentView("reader"); setChatPaneMode("notes"); setChatOpen(true); }}
              >
                <INotes size={14} /> Annotations
              </button>
            </div>

            <div className="sb-section">
              <div className="sb-section-hd">
                <IChevronDown size={12} />
                <span className="sb-section-label">Folders</span>
                <button type="button" className="sb-section-add" onClick={startNewFolder} title="New folder"><IPlus size={13} /></button>
              </div>
              {filtered.map((folder, folderIdx) => (
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
                    <span className={`sb-folder-swatch ${folderIdx % 3 === 1 ? "s2" : folderIdx % 3 === 2 ? "s3" : ""}`} aria-hidden="true" />
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

            <div className="sb-footer">
              <div className="sb-footer-row">
                <AccountMenu auth={auth} onOpenSettings={() => openSettingsModal(apiKey)} />
                <button className="sb-footer-gear" onClick={() => openSettingsModal(apiKey)} title="Settings"><IGear size={14} /></button>
              </div>
              <div className="sb-key-status">
                <span className={`sb-key-dot ${apiKey || wallet.hasCredit ? "" : "off"}`} />
                {wallet.hasCredit ? (
                  <button
                    type="button"
                    className="sb-key-label"
                    onClick={() => openSettingsModal(apiKey)}
                    title="Tryout credit remaining"
                    style={{
                      background: 'transparent',
                      border: 0,
                      padding: 0,
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    Credit · {wallet.balanceLabel}
                  </button>
                ) : (
                  <span className="sb-key-label">
                    {apiKey ? `Your key · ••${apiKey.slice(-4)}` : rememberedApiKeyAvailable ? "Key saved (locked)" : "No API key"}
                  </span>
                )}
              </div>
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
                <button className="topbar-icon-btn" onClick={() => setSidebarOpen(true)} title="Show sidebar">
                  <IChevronRightDouble size={14} />
                </button>
              )}
              <div className="topbar-nav-btns">
                <button type="button" className="topbar-icon-btn" disabled title="Back"><ILeft size={14} /></button>
                <button type="button" className="topbar-icon-btn" disabled title="Forward"><IRight size={14} /></button>
              </div>
              {currentView === "reader" && openTabs.length > 0 ? (
                <div className="topbar-tabs">
                  {openTabs.map((tab) => {
                    const active = tab.id === activeTabId;
                    return (
                      <div
                        key={tab.id}
                        className={`tab ${active ? "active" : ""}`}
                        onClick={() => activateReaderTab(tab.id)}
                      >
                        <span className="tab-dot" aria-hidden="true" />
                        <span className="tab-name">{tab.name}</span>
                        <button className="tab-close" onClick={(e) => closeTab(e, tab.id)}><IClose size={10} /></button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="tab-add"
                    title="Upload PDF"
                    onClick={() => { if (folders.length) setUpFolder(folders[0].id); setShowUpload(true); }}
                  >
                    <IPlus size={14} />
                  </button>
                </div>
              ) : (
                <div className="topbar-title-stack">
                  <span className="topbar-folder-name">
                    {currentView === "library"
                      ? "Library"
                      : currentView === "agent"
                        ? (activeAgentChat?.title || "Research agent")
                        : activeFolder?.name || "Reading"}
                  </span>
                  <span className="topbar-subtitle">
                    {currentView === "library"
                      ? `${totalPaperCount} papers · ${folders.length} folders`
                      : currentView === "agent"
                        ? `Research agent · ${agentWorkspacePapers.length} local papers in scope`
                        : `${activeFolder?.name || "Folder"} · ${openTabs.length} open`}
                  </span>
                </div>
              )}
            </div>

            <div className="topbar-right">
              {currentView === "reader" && (
                <span className="topbar-subtitle" style={{ marginRight: 4 }}>
                  {activeFolder?.name ? `${activeFolder.name} · ${openTabs.length} open` : `${openTabs.length} open`}
                </span>
              )}
              {currentView === "library" && (
                <input
                  className="topbar-search lib-wide"
                  placeholder="Search the library"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                />
              )}
              {currentView === "reader" && (
                <ViewerSearchField
                  open={viewerSearchOpen}
                  query={viewerSearchQuery}
                  status={viewerSearchStatus}
                  matchIndex={viewerSearchIndex}
                  matchCount={viewerSearchMatches.length}
                  canSearch={canRunViewerSearch}
                  inputRef={viewerSearchInputRef}
                  onOpen={openViewerSearch}
                  onClose={closeViewerSearch}
                  onQueryChange={setViewerSearchQuery}
                  onFindNext={() => runViewerSearch(1)}
                  onFindPrev={() => runViewerSearch(-1)}
                />
              )}
              {currentView === "library" && (
                <>
                  <button type="button" className="topbar-btn ghost" onClick={() => exportLibraryBibtex?.()}>BibTeX</button>
                  <button
                    type="button"
                    className="topbar-btn primary"
                    onClick={() => (canPickFolder ? setShowFolderPermModal(true) : setShowUpload(true))}
                  >
                    Open folder
                  </button>
                </>
              )}
              {currentView === "agent" && (
                <>
                  {agentRootFolder && (
                    <span className="topbar-btn ghost" style={{ pointerEvents: "none" }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} />
                      ~/{agentRootFolder.name}
                    </span>
                  )}
                  <button type="button" className="topbar-btn primary" onClick={startNewAgentChat}>
                    New thread
                  </button>
                </>
              )}
              {currentView === "reader" && (
                <>
                  {activePaper && (
                    <button
                      className={`topbar-btn ghost ${readerDetailOpen ? "primary" : ""}`}
                      onClick={() => setReaderDetailOpen((v) => !v)}
                      title="Document details"
                    >
                      Details
                    </button>
                  )}
                  <button className={`topbar-btn ${chatOpen ? "primary" : "ghost"}`} onClick={() => setChatOpen((v) => !v)}>
                    Chat
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={`content ${currentView === "reader" ? "content-reader" : ""}`}>
            {currentView === "library" ? (
              <LibraryView
                newFolder={newFolder}
                nfName={nfName}
                folderError={folderError}
                folders={folders}
                selectedFolderId={selectedFolderId}
                openTabs={openTabs}
                setShowUpload={setShowUpload}
                setNfName={setNfName}
                setFolderError={setFolderError}
                setUpFolder={setUpFolder}
                createFolder={createFolder}
                cancelNewFolder={cancelNewFolder}
                openFolderTabs={openFolderTabs}
                toggleFolder={toggleFolder}
                openAllPapersInFolder={openAllPapersInFolder}
                deleteFolder={deleteFolder}
                openPaper={openPaper}
                deletePaper={deletePaper}
                getTitle={getTitle}
                getAuthorsLine={getAuthorsLine}
                getMeta={getMeta}
                exportFolderBibtex={exportFolderBibtex}
                extractPaperMetaWithAI={extractPaperMetaWithAI}
                canPickFolder={canPickFolder}
                apiKey={apiKey}
                hasCredit={wallet.hasCredit}
                onOpenFolder={() => setShowFolderPermModal(true)}
                onNewFolder={startNewFolder}
                onOpenSettings={() => openSettingsModal(apiKey)}
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
                <div className={`reader-shell ${readerDetailOpen ? 'reader-shell-with-detail' : ''}`}>
                  <div className="reader-main">
                    <ReaderView
                      activePaper={activePaper}
                      currentPage={currentPage}
                      activePaperTotalPages={activePaperTotalPages}
                      annotations={annotations}
                      debugCitations={debugCitations}
                      searchablePageTexts={searchablePageTexts}
                      setCurrentPage={setCurrentPage}
                      goToPage={goToPage}
                      handlePdfReady={handlePdfReady}
                      handlePdfDocumentLoad={handlePdfDocumentLoad}
                      handleAnnotationClick={handleAnnotationClick}
                      onHighlightSelection={handleHighlight}
                      canHighlight={Boolean(popup)}
                    />
                  </div>
                  {readerDetailOpen && (
                    <LibraryPaperDetail
                      paper={activePaper}
                      folder={activeFolder}
                      meta={getMeta(activePaper.id)}
                      extractPaperMetaWithAI={extractPaperMetaWithAI}
                      showOpenButton={false}
                      onClose={() => setReaderDetailOpen(false)}
                      onPreviewBibtex={setReaderBibtexPreview}
                    />
                  )}
                </div>
                <BibtexPreviewModal
                  open={Boolean(readerBibtexPreview)}
                  title={readerBibtexPreview?.title}
                  filename={readerBibtexPreview?.filename}
                  content={readerBibtexPreview?.content}
                  onClose={() => setReaderBibtexPreview(null)}
                />
                {chatOpen && (
                  <div
                    className="chat-resize-handle"
                    onMouseDown={startChatResize}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize chat panel"
                  >
                    <span className="chat-resize-grip" />
                  </div>
                )}
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
              <EmptyReaderState
                sidebarOpen={sidebarOpen}
                canPickFolder={canPickFolder}
                hasFolder={folders.some((folder) => folder.id !== UPLOADS_FOLDER_ID)}
                apiKey={apiKey}
                hasCredit={wallet.hasCredit}
                onOpenSidebar={() => setSidebarOpen(true)}
                onOpenFolder={() => setShowFolderPermModal(true)}
                onNewFolder={() => {
                  setSidebarOpen(true);
                  startNewFolder();
                }}
                onUpload={() => {
                  if (activeFolder?.id) setUpFolder(activeFolder.id);
                  else if (folders.length) setUpFolder(folders[0].id);
                  setShowUpload(true);
                }}
                onOpenSettings={() => openSettingsModal(apiKey)}
              />
            )}
          </div>
        </div>

        <SelectionToolbar
          popup={popup}
          onExplain={handleExplainSelection}
          onAddToChat={addToChat}
          onHighlight={handleHighlight}
          onCopy={() => {
            navigator.clipboard?.writeText(popup.text);
            setPopup(null);
          }}
        />

        <ExplainPopover
          state={explainState}
          onDismiss={dismissExplain}
          onAddToChat={handleExplainAddToChat}
        />

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
            auth={auth}
            wallet={wallet}
          />
        )}

        <FoundingWelcome
          auth={auth}
          apiKey={apiKey}
          onOpenSettings={() => openSettingsModal(apiKey)}
          onSaveApiKey={applyInMemoryApiKey}
        />

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
