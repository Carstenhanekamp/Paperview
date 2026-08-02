import React from 'react';
import { IPlus, ITrash, INotes, IChats, IChevronRightDouble, ISpark, IClose, IPaperclip, IFile, IChevronDown, IArrowUp } from '../icons';
import InlineCitedAnswer from '../InlineCitedAnswer';
import ThinkingTrace from '../ThinkingTrace';
import { OPENAI_MODELS } from '../constants';

export default function ChatPanel({
  chatWidth,
  chatPaneMode,
  setChatPaneMode,
  activeChat,
  activeChatSummary,
  annotations,
  startNewChat,
  resetActiveChatHistory,
  currentMessages,
  chip,
  setChip,
  input,
  setInput,
  setChatOpen,
  isActivePaperScanning,
  activePaper,
  activePaperScanPercent,
  activePaperScanLabel,
  activePaperThreads,
  activePaperMessageCount,
  savedPaperThreads,
  openChatThread,
  deleteChatThread,
  goToPage,
  deleteAnnotationById,
  chatQuickActions,
  doSend,
  activeFolderPapers,
  openTabs,
  renderUsageMeta,
  thinkingExpanded,
  setThinkingExpanded,
  handleCitationClick,
  isChatLoading,
  thinkingSteps,
  activeChatId,
  chatLoadingLabel,
  endRef,
  chatContextPapers,
  attachMenuRef,
  attachMenuOpen,
  setAttachMenuOpen,
  setChatContextMode,
  setSelectedChatPaperIds,
  selectedChatPaperIds,
  chatContextMode,
  taRef,
  modelMenuRef,
  modelMenuOpen,
  setModelMenuOpen,
  selectedModel,
  setSelectedModel,
  chatLoadingState,
  stopChatRun,
}) {
  return (
    <div className="chat-panel" style={{ width: chatWidth }}>
      <div className="chat-topbar">
        <div className="chat-topbar-copy">
          <span className="chat-topbar-title">{chatPaneMode === "overview" ? "Recent chats" : chatPaneMode === "notes" ? "Notes" : (activeChat?.title || "Chat")}</span>
          <span className="chat-topbar-subtitle">{chatPaneMode === "overview" ? "Open, reset, or remove saved conversations." : chatPaneMode === "notes" ? `${annotations.length} annotation${annotations.length === 1 ? '' : 's'}` : activeChatSummary}</span>
        </div>
        <div className="chat-topbar-actions">
          <div className="chat-topbar-island" aria-label="Chat actions">
            <div className="chat-topbar-island-inner">
              {chatPaneMode === "chat" && (
                <button className="chat-topbar-btn" onClick={startNewChat} data-tooltip="New chat" aria-label="New chat">
                  <IPlus size={14} />
                </button>
              )}
              {chatPaneMode === "chat" ? (
                <button
                  className="chat-topbar-btn"
                  onClick={resetActiveChatHistory}
                  data-tooltip="Reset chat"
                  aria-label="Reset chat"
                  disabled={!currentMessages.length && !chip && !input}
                >
                  <ITrash size={14} />
                </button>
              ) : null}
              <button
                className={`chat-topbar-btn${chatPaneMode === "notes" ? " on" : ""}`}
                onClick={() => setChatPaneMode((mode) => (mode === "notes" ? "chat" : "notes"))}
                data-tooltip={chatPaneMode === "notes" ? "Back to chat" : "Notes"}
                aria-label={chatPaneMode === "notes" ? "Back to chat" : "Notes"}
                aria-pressed={chatPaneMode === "notes"}
              >
                <INotes size={14} />
              </button>
              <button
                className={`chat-topbar-btn${chatPaneMode === "overview" ? " on" : ""}`}
                onClick={() => setChatPaneMode((mode) => (mode === "overview" ? "chat" : "overview"))}
                data-tooltip={chatPaneMode === "overview" ? "Back to chat" : "View chats"}
                aria-label={chatPaneMode === "overview" ? "Back to chat" : "View chats"}
                aria-pressed={chatPaneMode === "overview"}
              >
                <IChats size={14} />
              </button>
            </div>
          </div>
          <button
            className="chat-topbar-btn chat-topbar-collapse"
            onClick={() => setChatOpen(false)}
            data-tooltip="Collapse"
            aria-label="Collapse chat"
          >
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
                        <div className="msg-a-avatar"><ISpark size={12} /></div>
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
                  <div className="attach-menu" role="dialog" aria-label="Chat context papers">
                    <div className="attach-menu-bezel">
                      <div className="attach-menu-core">
                        <header className="attach-head">
                          <div className="attach-head-copy">
                            <span className="attach-eyebrow">Context</span>
                            <h3 className="attach-title">Papers for this chat</h3>
                          </div>
                          <span className="attach-meta">
                            {chatContextPapers.length}
                            <span className="attach-meta-label"> selected</span>
                          </span>
                        </header>

                        <div className="attach-modes" role="tablist" aria-label="Context scope">
                          <button
                            className={`attach-mode${chatContextMode === "manual" ? " on" : ""}`}
                            type="button"
                            role="tab"
                            aria-selected={chatContextMode === "manual"}
                            onClick={() => {
                              setChatContextMode("manual");
                              setSelectedChatPaperIds(activeFolderPapers.map((p) => p.id));
                            }}
                          >
                            All
                          </button>
                          <button
                            className={`attach-mode${chatContextMode === "folder" ? " on" : ""}`}
                            type="button"
                            role="tab"
                            aria-selected={chatContextMode === "folder"}
                            title="Ask across this folder (ranked)"
                            onClick={() => {
                              setChatContextMode("folder");
                              setSelectedChatPaperIds(activeFolderPapers.map((p) => p.id));
                            }}
                          >
                            Folder
                          </button>
                          <button
                            className={`attach-mode${chatContextMode === "library" ? " on" : ""}`}
                            type="button"
                            role="tab"
                            aria-selected={chatContextMode === "library"}
                            title="Ask across the whole library (ranked)"
                            onClick={() => {
                              setChatContextMode("library");
                            }}
                          >
                            Library
                          </button>
                          <button
                            className={`attach-mode${chatContextMode === "auto" ? " on" : ""}`}
                            type="button"
                            role="tab"
                            aria-selected={chatContextMode === "auto"}
                            onClick={() => {
                              setChatContextMode("auto");
                              setSelectedChatPaperIds(activePaper?.id ? [activePaper.id] : []);
                            }}
                          >
                            Active
                          </button>
                        </div>

                        {activeFolderPapers.length === 0 ? (
                          <div className="attach-empty">No PDFs in this folder yet.</div>
                        ) : (
                          <div className="attach-list">
                            {activeFolderPapers.map((paper) => {
                              const checked =
                                chatContextMode === "auto"
                                  ? paper.id === activePaper?.id
                                  : chatContextMode === "folder" || chatContextMode === "library"
                                    ? true
                                    : selectedChatPaperIds.includes(paper.id);
                              return (
                                <label key={paper.id} className={`attach-item${checked ? " is-on" : ""}`}>
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
                                  <span className="attach-check" aria-hidden="true" />
                                  <IFile size={13} className="attach-file-icon" />
                                  <span className="attach-name" title={paper.name}>{paper.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
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
                  <button className="composer-send" onClick={() => doSend()} disabled={!input.trim() && !chip} title="Send" type="button">
                    <IArrowUp size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
