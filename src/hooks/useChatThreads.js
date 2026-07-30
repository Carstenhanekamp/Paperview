import { useState, useEffect, useCallback, useRef } from 'react';
import { loadAllChats, saveChat, deleteChat } from '../db';
import { CHAT_TITLE_FALLBACK, createChatThreadRecord, deriveChatTitle } from '../chatUtils';

export function useChatThreads({
  syncFolderForPaper,
  chatRequestRef,
  activePaper,
  chatLoadingState,
  setChatLoadingState,
  setInput,
  setChip,
  setChatPaneMode,
}) {
  const [chatThreads, setChatThreads] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const chatThreadsRef = useRef([]);
  const [thinkingSteps, setThinkingSteps] = useState([]);
  const thinkingStepsRef = useRef([]);
  const [thinkingExpanded, setThinkingExpanded] = useState({});

  useEffect(() => {
    loadAllChats().then((saved) => {
      if (saved.length) {
        setChatThreads(saved);
        setActiveChatId(saved[0]?.id || null);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { chatThreadsRef.current = chatThreads; }, [chatThreads]);

  const pushThinkingStep = (step) => {
    setThinkingSteps(prev => {
      const next = [...prev, step];
      thinkingStepsRef.current = next;
      return next;
    });
  };

  const clearThinkingSteps = (chatId) => {
    setThinkingSteps(prev => {
      const next = prev.filter(s => s.chatId !== chatId);
      thinkingStepsRef.current = next;
      return next;
    });
  };

  function stopChatRun() {
    const activeRun = chatRequestRef.current;
    activeRun.controller?.abort();
    chatRequestRef.current = { controller: null, token: 0, chatId: null };
    if (activeRun.chatId) clearThinkingSteps(activeRun.chatId);
    setChatLoadingState(null);
  }

  const appendMessageToChat = useCallback((chatId, message, options = {}) => {
    const paperId = chatThreadsRef.current.find((t) => t.id === chatId)?.paperId;
    setChatThreads((prev) => {
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
      const updated = next.find((t) => t.id === chatId);
      if (updated) saveChat(updated).catch(() => {});
      return next;
    });
    if (paperId) syncFolderForPaper(paperId);
  }, []);

  const updateMessageInChat = useCallback((chatId, messageId, updater) => {
    if (!chatId || !messageId || typeof updater !== "function") return;
    const paperId = chatThreadsRef.current.find((t) => t.id === chatId)?.paperId;
    setChatThreads((prev) => {
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
        return changed
          ? {
              ...thread,
              messages,
              updatedAt: Date.now(),
            }
          : thread;
      });
      const updated = next.find((t) => t.id === chatId);
      if (updated) saveChat(updated).catch(() => {});
      return next;
    });
    if (paperId) syncFolderForPaper(paperId);
  }, []);

  const startNewChat = useCallback((options = {}) => {
    const scopeType = options.scopeType || 'paper';
    const scopeId =
      options.scopeId ||
      (scopeType === 'folder' ? options.folderId : null) ||
      (scopeType === 'library' ? 'library' : null) ||
      activePaper?.id;
    if (!scopeId && !activePaper?.id) return;
    if (chatLoadingState) stopChatRun();
    const thread = createChatThreadRecord(activePaper?.id || scopeId, {
      scopeType,
      scopeId: scopeId || activePaper?.id,
    });
    setChatThreads((prev) => [thread, ...prev]);
    saveChat(thread).catch(() => {});
    syncFolderForPaper(thread.paperId);
    setActiveChatId(thread.id);
    setChatPaneMode("chat");
    setInput("");
    setChip(null);
  }, [activePaper?.id, chatLoadingState, stopChatRun]);

  const openChatThread = useCallback((threadId) => {
    if (chatLoadingState) stopChatRun();
    setActiveChatId(threadId);
    setChatPaneMode("chat");
  }, [chatLoadingState, stopChatRun]);

  const resetActiveChatHistory = useCallback(() => {
    if (!activeChatId) return;
    const paperId = chatThreadsRef.current.find((t) => t.id === activeChatId)?.paperId;
    setChatThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === activeChatId
          ? { ...thread, title: CHAT_TITLE_FALLBACK, messages: [], updatedAt: Date.now() }
          : thread
      );
      const updated = next.find((t) => t.id === activeChatId);
      if (updated) saveChat(updated).catch(() => {});
      return next;
    });
    if (paperId) syncFolderForPaper(paperId);
    if (chatLoadingState?.chatId === activeChatId) stopChatRun();
    setInput("");
    setChip(null);
  }, [activeChatId, chatLoadingState, stopChatRun]);

  const resetChatThreadById = useCallback(
    (threadId) => {
      const paperId = chatThreadsRef.current.find((t) => t.id === threadId)?.paperId;
      setChatThreads((prev) => {
        const next = prev.map((thread) =>
          thread.id === threadId
            ? { ...thread, title: CHAT_TITLE_FALLBACK, messages: [], updatedAt: Date.now() }
            : thread
        );
        const updated = next.find((t) => t.id === threadId);
        if (updated) saveChat(updated).catch(() => {});
        return next;
      });
      if (paperId) syncFolderForPaper(paperId);
      if (chatLoadingState?.chatId === threadId) stopChatRun();
      if (activeChatId === threadId) {
        setInput("");
        setChip(null);
      }
    },
    [activeChatId, chatLoadingState, stopChatRun]
  );

  const deleteChatThread = useCallback(
    (threadId) => {
      setChatThreads((prev) => prev.filter((thread) => thread.id !== threadId));
      deleteChat(threadId).catch(() => {});
      if (activeChatId === threadId) {
        setActiveChatId(null);
        setInput("");
        setChip(null);
      }
      if (chatLoadingState?.chatId === threadId) stopChatRun();
    },
    [activeChatId, chatLoadingState, stopChatRun]
  );

  return {
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
  };
}
