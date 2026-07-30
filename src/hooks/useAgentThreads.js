import { useState, useEffect, useCallback, useRef } from 'react';
import { loadAllAgentChats, saveAgentChat, deleteAgentChat } from '../db';
import { CHAT_TITLE_FALLBACK, createAgentChatThreadRecord, deriveChatTitle } from '../chatUtils';

export function useAgentThreads({
  syncRootFolderSnapshotRef,
  agentRequestRef,
  selectedRootFolderId,
  agentLoadingState,
  setAgentLoadingState,
  setAgentInput,
  setSelectedAgentPaperIds,
  setAgentPreviewState,
  agentPreviewScrollFnRef,
  clearAgentRemotePapersForThread,
}) {
  const [agentThreads, setAgentThreads] = useState([]);
  const [activeAgentChatId, setActiveAgentChatId] = useState(null);
  const agentThreadsRef = useRef([]);
  const [agentThinkingSteps, setAgentThinkingSteps] = useState([]);
  const agentThinkingStepsRef = useRef([]);
  const [agentThinkingExpanded, setAgentThinkingExpanded] = useState({});

  useEffect(() => {
    loadAllAgentChats().then((saved) => {
      if (saved.length) {
        setAgentThreads(saved);
        setActiveAgentChatId(saved[0]?.id || null);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { agentThreadsRef.current = agentThreads; }, [agentThreads]);

  const pushAgentThinkingStep = (step) => {
    setAgentThinkingSteps((prev) => {
      const next = [...prev, step];
      agentThinkingStepsRef.current = next;
      return next;
    });
  };

  const clearAgentThinkingSteps = (chatId) => {
    setAgentThinkingSteps((prev) => {
      const next = prev.filter((step) => step.chatId !== chatId);
      agentThinkingStepsRef.current = next;
      return next;
    });
  };

  function stopAgentRun() {
    const activeRun = agentRequestRef.current;
    activeRun.controller?.abort();
    agentRequestRef.current = { controller: null, token: 0, chatId: null };
    if (activeRun.chatId) clearAgentThinkingSteps(activeRun.chatId);
    setAgentLoadingState(null);
  }

  const appendMessageToAgentChat = useCallback((chatId, message, options = {}) => {
    const rootFolderId = agentThreadsRef.current.find((thread) => thread.id === chatId)?.rootFolderId;
    setAgentThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== chatId) return thread;
        const shouldRename = options.renameFromUser && (thread.title === CHAT_TITLE_FALLBACK || thread.messages.length === 0);
        return {
          ...thread,
          title: shouldRename ? deriveChatTitle(options.renameFromUser) : thread.title,
          messages: [...thread.messages, message],
          updatedAt: Date.now(),
        };
      });
      const updated = next.find((thread) => thread.id === chatId);
      if (updated) {
        saveAgentChat(updated)
          .then(() => {
            if (rootFolderId) syncRootFolderSnapshotRef.current?.(rootFolderId)?.catch(() => {});
          })
          .catch(() => {});
      }
      return next;
    });
  }, []);

  const updateMessageInAgentChat = useCallback((chatId, messageId, updater) => {
    if (!chatId || !messageId || typeof updater !== "function") return;
    const rootFolderId = agentThreadsRef.current.find((thread) => thread.id === chatId)?.rootFolderId;
    setAgentThreads((prev) => {
      const next = prev.map((thread) => {
        if (thread.id !== chatId) return thread;
        let changed = false;
        const messages = thread.messages.map((message) => {
          if (message?.id !== messageId) return message;
          const updatedMessage = updater(message);
          if (updatedMessage === message) return message;
          changed = true;
          return updatedMessage;
        });
        return changed ? { ...thread, messages, updatedAt: Date.now() } : thread;
      });
      const updated = next.find((thread) => thread.id === chatId);
      if (updated) {
        saveAgentChat(updated)
          .then(() => {
            if (rootFolderId) syncRootFolderSnapshotRef.current?.(rootFolderId)?.catch(() => {});
          })
          .catch(() => {});
      }
      return next;
    });
  }, []);

  const startNewAgentChat = useCallback(() => {
    if (!selectedRootFolderId) return;
    if (agentLoadingState) stopAgentRun();
    const thread = createAgentChatThreadRecord(selectedRootFolderId);
    setAgentThreads((prev) => [thread, ...prev]);
    saveAgentChat(thread)
      .then(() => syncRootFolderSnapshotRef.current?.(selectedRootFolderId))
      .catch(() => {});
    setActiveAgentChatId(thread.id);
    setAgentInput("");
    setSelectedAgentPaperIds([]);
    setAgentPreviewState(null);
    agentPreviewScrollFnRef.current = null;
  }, [selectedRootFolderId, agentLoadingState, stopAgentRun]);

  const openAgentThread = useCallback((threadId) => {
    if (agentLoadingState) stopAgentRun();
    setActiveAgentChatId(threadId);
    setAgentInput("");
  }, [agentLoadingState, stopAgentRun]);

  const resetActiveAgentHistory = useCallback(() => {
    if (!activeAgentChatId) return;
    const rootFolderId = agentThreadsRef.current.find((thread) => thread.id === activeAgentChatId)?.rootFolderId;
    setAgentThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === activeAgentChatId
          ? { ...thread, title: CHAT_TITLE_FALLBACK, messages: [], updatedAt: Date.now() }
          : thread
      );
      const updated = next.find((thread) => thread.id === activeAgentChatId);
      if (updated) {
        saveAgentChat(updated)
          .then(() => {
            if (rootFolderId) syncRootFolderSnapshotRef.current?.(rootFolderId)?.catch(() => {});
          })
          .catch(() => {});
      }
      return next;
    });
    if (agentLoadingState?.chatId === activeAgentChatId) stopAgentRun();
    setAgentInput("");
    setSelectedAgentPaperIds([]);
    clearAgentRemotePapersForThread(activeAgentChatId);
    setAgentPreviewState(null);
    agentPreviewScrollFnRef.current = null;
  }, [activeAgentChatId, agentLoadingState, clearAgentRemotePapersForThread, stopAgentRun]);

  const resetAgentThreadById = useCallback((threadId) => {
    const rootFolderId = agentThreadsRef.current.find((thread) => thread.id === threadId)?.rootFolderId;
    setAgentThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === threadId
          ? { ...thread, title: CHAT_TITLE_FALLBACK, messages: [], updatedAt: Date.now() }
          : thread
      );
      const updated = next.find((thread) => thread.id === threadId);
      if (updated) {
        saveAgentChat(updated)
          .then(() => {
            if (rootFolderId) syncRootFolderSnapshotRef.current?.(rootFolderId)?.catch(() => {});
          })
          .catch(() => {});
      }
      return next;
    });
    if (agentLoadingState?.chatId === threadId) stopAgentRun();
    if (activeAgentChatId === threadId) {
      setAgentInput("");
      setSelectedAgentPaperIds([]);
      setAgentPreviewState(null);
      agentPreviewScrollFnRef.current = null;
    }
    clearAgentRemotePapersForThread(threadId);
  }, [activeAgentChatId, agentLoadingState, clearAgentRemotePapersForThread, stopAgentRun]);

  const deleteAgentThread = useCallback((threadId) => {
    const rootFolderId = agentThreadsRef.current.find((thread) => thread.id === threadId)?.rootFolderId;
    setAgentThreads((prev) => prev.filter((thread) => thread.id !== threadId));
    deleteAgentChat(threadId)
      .then(() => {
        if (rootFolderId) syncRootFolderSnapshotRef.current?.(rootFolderId)?.catch(() => {});
      })
      .catch(() => {});
    if (activeAgentChatId === threadId) {
      setActiveAgentChatId(null);
      setAgentInput("");
      setSelectedAgentPaperIds([]);
      setAgentPreviewState(null);
      agentPreviewScrollFnRef.current = null;
    }
    if (agentLoadingState?.chatId === threadId) stopAgentRun();
    clearAgentRemotePapersForThread(threadId);
  }, [activeAgentChatId, agentLoadingState, clearAgentRemotePapersForThread, stopAgentRun]);

  return {
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
  };
}
