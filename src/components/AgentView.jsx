import React from 'react';
import {
  IPanel,
  IChat,
  IPlus,
  ITrash,
  ISpark,
  IPaperclip,
  IFile,
  IClose,
  IChevronDown,
  IArrowUp,
} from '../icons';
import TextFallback from '../TextFallback';
import InlineCitedAnswer from '../InlineCitedAnswer';
import ThinkingTrace from '../ThinkingTrace';
import { OPENAI_MODELS } from '../constants';

export default function AgentView({
  agentSidebarOpen,
  setAgentSidebarOpen,
  agentRootFolder,
  agentWorkspacePapers,
  selectedRootAgentThreads,
  activeAgentChatId,
  openAgentThread,
  deleteAgentThread,
  startNewAgentChat,
  hasAgentPreview,
  agentPreviewWidth,
  activeAgentChat,
  activeAgentSummary,
  resetActiveAgentHistory,
  currentAgentMessages,
  agentInput,
  agentTools,
  selectedAgentToolId,
  selectAgentTool,
  renderUsageMeta,
  renderFoundSourcesPanel,
  agentThinkingExpanded,
  setAgentThinkingExpanded,
  handleCitationClick,
  isAgentLoading,
  agentThinkingSteps,
  agentLoadingLabel,
  agentEndRef,
  agentAttachMenuRef,
  setAgentAttachMenuOpen,
  agentContextPapers,
  openAgentPaper,
  agentAttachMenuOpen,
  setSelectedAgentPaperIds,
  selectedAgentPaperIds,
  agentToolMenuRef,
  agentToolMenuOpen,
  setAgentToolMenuOpen,
  selectedAgentTool,
  setSelectedAgentToolId,
  agentTaRef,
  setAgentInput,
  doSendAgent,
  modelMenuRef,
  setModelMenuOpen,
  selectedModel,
  modelMenuOpen,
  setSelectedModel,
  agentLoadingState,
  stopAgentRun,
  startAgentPreviewResize,
  renderAgentPreviewDrawer,
}) {
  return (
              <div className={`agent-view ${agentSidebarOpen ? "" : "sidebar-collapsed"}`}>
                    <aside className={`agent-sidebar ${agentSidebarOpen ? "" : "collapsed"}`}>
                      <div className="agent-sidebar-head">
                        <div className="agent-sidebar-topbar">
                          {agentSidebarOpen ? (
                            <div className="agent-sidebar-copy">
                              <div className="agent-empty-eyebrow">Workspace threads</div>
                              <div className="agent-sidebar-title">{agentRootFolder?.name || "Agent"}</div>
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
                              <span className="agent-root-badge">{agentRootFolder?.name || "Workspace"}</span>
                              <span className="agent-context-meta">{selectedRootAgentThreads.length} saved thread{selectedRootAgentThreads.length === 1 ? "" : "s"}</span>
                            </div>
                            <p className="agent-context-copy">
                              Web research, local papers, and imports stay with this workspace so your threads remain easy to pick up later.
                            </p>
                          </div>

                          <div className="agent-thread-list">
                            {selectedRootAgentThreads.length === 0 ? (
                              <div className="chat-overview-empty-state">
                                <div className="chat-overview-empty-title">No agent threads yet</div>
                                <div className="chat-overview-empty-copy">Start a thread to search the web, compare papers, and save the conversation with this workspace.</div>
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
                              <span className="agent-root-badge">{agentRootFolder?.name || "Workspace"}</span>
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
                                    <h2>Search for papers, compare them with your library, and import the best ones.</h2>
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
              </div>
  );
}
