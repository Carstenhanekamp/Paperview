import React from 'react';
import {
  IPlus,
  ITrash,
  ISpark,
  IPaperclip,
  IFile,
  IClose,
  IChevronDown,
  IArrowUp,
} from '../icons';
import InlineCitedAnswer from '../InlineCitedAnswer';
import ThinkingTrace from '../ThinkingTrace';
import { OPENAI_MODELS } from '../constants';
import { AGENT_QUARTO_CSS } from '../agentQuartoStyles';
import { useScopedStyles } from '../hooks/useScopedStyles';
import { formatChatTimestamp, formatChatMessageCount } from '../chatUtils';
import '../agentQuarto.css';

export default function AgentView({
  agentSidebarOpen,
  agentRootFolder,
  agentWorkspacePapers,
  selectedRootAgentThreads,
  activeAgentChatId,
  openAgentThread,
  deleteAgentThread,
  hasAgentPreview,
  agentPreviewWidth,
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
  useScopedStyles('pv-agent-quarto', AGENT_QUARTO_CSS);
  const localPaperCount = agentWorkspacePapers?.length || 0;

  return (
              <div className={`agent-view ${agentSidebarOpen ? "" : "sidebar-collapsed"}`}>
                    <aside className={`agent-sidebar ${agentSidebarOpen ? "" : "collapsed"}`}>
                      <div className="agent-sidebar-head">
                        <div className="agent-empty-eyebrow">Workspace threads</div>
                        <div className="agent-sidebar-subtitle">
                          Saved with this folder, not your account.
                        </div>
                      </div>

                      {agentSidebarOpen ? (
                        <>
                          <div className="agent-thread-list">
                            {selectedRootAgentThreads.length === 0 ? (
                              <div className="chat-overview-empty-state" style={{ padding: '12px 9px' }}>
                                <div className="chat-overview-empty-title" style={{ fontSize: 12.5, fontWeight: 600 }}>No threads yet</div>
                                <div className="chat-overview-empty-copy" style={{ fontSize: 11.5, color: 'var(--text-5)', marginTop: 4 }}>
                                  Start a thread from the title bar.
                                </div>
                              </div>
                            ) : (
                              selectedRootAgentThreads.map((thread) => (
                                <div key={thread.id} className={`agent-thread-row ${thread.id === activeAgentChatId ? "active" : ""}`}>
                                  <button className="agent-thread-main" type="button" onClick={() => openAgentThread(thread.id)}>
                                    <div className="agent-thread-title" title={thread.title}>{thread.title}</div>
                                    <div className="agent-thread-meta">
                                      {formatChatMessageCount(thread.messages?.length || 0)}
                                      {thread.updatedAt ? ` · ${formatChatTimestamp(thread.updatedAt)}` : ''}
                                    </div>
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

                          <div className="agent-context-card">
                            <span className="agent-root-badge">Imports land on disk</span>
                            <p className="agent-context-copy">
                              Saved PDFs are written into <strong>{agentRootFolder?.name || "~/papers"}</strong> as real files.
                            </p>
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
                          <div className="agent-msgs">
                            {currentAgentMessages.length === 0 ? (
                              <div className="agent-empty">
                                <div className="agent-empty-hero">
                                  <div className="agent-empty-icon"><ISpark size={16} /></div>
                                  <div className="agent-empty-copy">
                                    <div className="agent-empty-eyebrow">Research across web + local PDFs</div>
                                    <h2>Search for papers, compare them with your library, and import the best ones.</h2>
                                    <p>
                                      Attach a tool in the composer, then ask. Imports land on disk in{' '}
                                      <strong>{agentRootFolder?.name || '~/papers'}</strong>
                                      {localPaperCount ? ` · ${localPaperCount} local paper${localPaperCount === 1 ? '' : 's'} in scope` : ''}.
                                    </p>
                                  </div>
                                </div>

                                <div className="agent-quick-grid">
                                  {agentTools.slice(0, 4).map((item) => (
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
                                        <div className="msg-a-avatar"><ISpark size={12} /></div>
                                        <div className="msg-a-bubble-wrap">
                                          {m.thinkingTrace?.length > 0 ? (
                                            <ThinkingTrace
                                              steps={m.thinkingTrace}
                                              isLive={false}
                                              expanded={!!agentThinkingExpanded[m.id]}
                                              onToggle={() => setAgentThinkingExpanded((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                                            />
                                          ) : null}
                                          {m.content ? (
                                            <div className="msg-a-bubble">
                                              <InlineCitedAnswer
                                                text={m.content}
                                                citations={m.citations || []}
                                                onCitationClick={handleCitationClick}
                                              />
                                            </div>
                                          ) : null}
                                          {renderFoundSourcesPanel(m)}
                                          {renderUsageMeta(m)}
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
                              <div className="attach-menu" role="dialog" aria-label="Local paper context">
                                <div className="attach-menu-bezel">
                                  <div className="attach-menu-core">
                                    <header className="attach-head">
                                      <div className="attach-head-copy">
                                        <span className="attach-eyebrow">Context</span>
                                        <h3 className="attach-title">Local papers</h3>
                                      </div>
                                      <span className="attach-meta">
                                        {agentContextPapers.length}
                                        <span className="attach-meta-label"> selected</span>
                                      </span>
                                    </header>

                                    <div className="attach-modes" role="tablist" aria-label="Selection">
                                      <button
                                        className="attach-mode"
                                        type="button"
                                        onClick={() => setSelectedAgentPaperIds(agentWorkspacePapers.map((paper) => paper.id))}
                                      >
                                        All
                                      </button>
                                      <button
                                        className="attach-mode"
                                        type="button"
                                        onClick={() => setSelectedAgentPaperIds([])}
                                      >
                                        Clear
                                      </button>
                                    </div>

                                    <div className="attach-list">
                                      {agentWorkspacePapers.map((paper) => {
                                        const checked = selectedAgentPaperIds.includes(paper.id);
                                        return (
                                          <label key={paper.id} className={`attach-item${checked ? " is-on" : ""}`}>
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
                                            <span className="attach-check" aria-hidden="true" />
                                            <IFile size={13} className="attach-file-icon" />
                                            <span className="attach-name" title={paper.name}>{paper.name}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="chat-composer agent-composer">
                          <div className="agent-tool-row" ref={agentToolMenuRef}>
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
                              <button
                                className={`agent-tool-trigger ${agentToolMenuOpen ? "active" : ""}`}
                                type="button"
                                onClick={() => setAgentToolMenuOpen((value) => !value)}
                                title="Select an Agent tool"
                              >
                                <IPlus size={12} />
                                <span>Add tool</span>
                              </button>
                            )}

                            <span className="agent-context-chip">
                              {localPaperCount} local paper{localPaperCount === 1 ? '' : 's'}
                            </span>

                            {agentToolMenuOpen && !selectedAgentTool ? (
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
                            placeholder={selectedAgentTool?.placeholder || "Search the literature, compare with your workspace, or import a PDF..."}
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
                                className="composer-send"
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
