/**
 * Chat Page - Main chat interface with multi-tab support
 * Features rich markdown rendering with support for code, diagrams, charts, and math
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { Send, Square, Bot, User, Copy, Share } from 'lucide-react';
import { MarkdownRenderer } from '../components/markdown';
import { ToolCallDisplay, type ToolCallInfo } from '../components/ToolCallDisplay';
import { InternalsPanel, INTERNALS_PANEL_DEFAULT_WIDTH } from '../components/InternalsPanel';
import { PlanDisplay } from '../components/plan';
import { TabBar, NewTabModal } from '../components/tabs';
import { TabProvider, useTabContext, type Message, type TabState } from '../hooks/useTabContext';
import type { Plan } from '../../preload/index';
import { useNavigation } from '../hooks/useNavigation';

// ============ Chat Content Component (for active tab) ============

interface ChatContentProps {
  tab: TabState;
  onSend: (content: string) => void;
  onCancel: () => void;
}

function ChatContent({ tab, onSend, onCancel }: ChatContentProps): React.ReactElement {
  const { navigate } = useNavigation();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [planLoading, setPlanLoading] = useState<'approving' | 'rejecting' | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tab.messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !tab.status.initialized || tab.isLoading) return;

    const content = input.trim();
    setInput('');
    onSend(content);
  }, [input, tab.status.initialized, tab.isLoading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Plan handlers that send messages
  const handleApprovePlan = useCallback(() => {
    if (!tab.activePlan) return;
    setPlanLoading('approving');
    onSend('Yes, proceed with the plan.');
    // Reset after a delay (the tab state will be updated by the context)
    setTimeout(() => setPlanLoading(null), 500);
  }, [tab.activePlan, onSend]);

  const handleRejectPlan = useCallback((reason?: string) => {
    if (!tab.activePlan) return;
    setPlanLoading('rejecting');
    const message = reason ? `No, please change the plan: ${reason}` : 'No, please change the plan.';
    onSend(message);
    setTimeout(() => setPlanLoading(null), 500);
  }, [tab.activePlan, onSend]);

  const handlePlanFeedback = useCallback((feedback: string) => {
    if (!tab.activePlan) return;
    onSend(`Feedback on the plan: ${feedback}`);
  }, [tab.activePlan, onSend]);

  const renderUserMessage = (message: Message) => (
    <div key={message.id} className="message message--user">
      <div className="message__content">
        <div className="message__text">{message.content}</div>
        <div className="message__time">{formatTime(message.timestamp)}</div>
      </div>
      <div className="message__avatar">
        <User size={16} />
      </div>
    </div>
  );

  const renderAssistantMessage = (message: Message) => (
    <div key={message.id} className="message message--assistant">
      <div className="message__header">
        <div className="message__avatar">
          <Bot size={16} />
        </div>
      </div>
      <div className="message__content">
        {/* Tool calls section */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="message__tool-calls">
            {message.toolCalls.map((toolCall) => (
              <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {/* Text content */}
        {message.content ? (
          <div className="message__text">
            <MarkdownRenderer content={message.content} isStreaming={message.isStreaming} />
          </div>
        ) : (
          message.isStreaming && !message.toolCalls?.length && (
            <div className="message__streaming-indicator">
              <Spinner animation="border" size="sm" />
              <span>Thinking...</span>
            </div>
          )
        )}
      </div>
      {message.content && !message.isStreaming && (
        <div className="message__actions">
          <button
            className="message__action-btn"
            onClick={() => handleCopyMessage(message.content)}
            title="Copy message"
          >
            <Copy size={14} />
          </button>
          <button className="message__action-btn" title="Share">
            <Share size={14} />
          </button>
        </div>
      )}
      <div className="message__time">{formatTime(message.timestamp)}</div>
    </div>
  );

  const renderSystemMessage = (message: Message) => (
    <div key={message.id} className="message message--system">
      <div className="message__content">
        <div className="message__text">{message.content}</div>
      </div>
    </div>
  );

  const renderMessage = (message: Message) => {
    switch (message.role) {
      case 'user':
        return renderUserMessage(message);
      case 'assistant':
        return renderAssistantMessage(message);
      case 'system':
        return renderSystemMessage(message);
      default:
        return null;
    }
  };

  return (
    <>
      {/* Fixed Plan Display - outside scrollable area */}
      {tab.activePlan && tab.messages.length > 0 && (
        <div className="chat__plan-fixed">
          <PlanDisplay
            plan={tab.activePlan}
            onApprove={tab.activePlan.status === 'pending' ? handleApprovePlan : undefined}
            onReject={tab.activePlan.status === 'pending' ? handleRejectPlan : undefined}
            onFeedback={tab.activePlan.status === 'pending' ? handlePlanFeedback : undefined}
            isApproving={planLoading === 'approving'}
            isRejecting={planLoading === 'rejecting'}
          />
        </div>
      )}

      <div className={`chat__messages ${tab.messages.length === 0 ? 'chat__messages--empty' : ''}`}>
        {tab.messages.length === 0 ? (
          <div className="chat__welcome">
            <div className="chat__welcome-icon">
              <Bot size={40} />
            </div>
            <h2 className="chat__welcome-title">Welcome to HOSEA</h2>
            <p className="chat__welcome-subtitle">
              {tab.status.initialized
                ? `Connected to ${tab.agentName}. Start a conversation!`
                : 'Configure an LLM provider to get started.'}
            </p>
            {!tab.status.initialized && (
              <Button variant="primary" className="mt-4" onClick={() => navigate('llm-connectors')}>
                Add LLM Provider
              </Button>
            )}
          </div>
        ) : (
          <div className="chat__messages-inner">
            {tab.messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="chat__input">
        <div className="chat__input-wrapper">
          <div className="chat__input-form">
            <textarea
              ref={textareaRef}
              className="chat__input-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                tab.status.initialized
                  ? 'Type a message... (Shift+Enter for new line)'
                  : 'Connect to an agent first...'
              }
              disabled={!tab.status.initialized || tab.isLoading}
              rows={1}
            />
            {tab.isLoading ? (
              <button
                className="chat__send-btn chat__send-btn--danger"
                onClick={onCancel}
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                className="chat__send-btn"
                onClick={handleSend}
                disabled={!input.trim() || !tab.status.initialized}
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ Empty State (no tabs) ============

function EmptyTabsState({ onCreateTab }: { onCreateTab: () => void }): React.ReactElement {
  const { navigate } = useNavigation();

  return (
    <div className="chat__welcome">
      <div className="chat__welcome-icon">
        <Bot size={40} />
      </div>
      <h2 className="chat__welcome-title">Welcome to HOSEA</h2>
      <p className="chat__welcome-subtitle">
        Create a new tab to start chatting with an agent.
      </p>
      <div className="d-flex gap-2 mt-4">
        <Button variant="primary" onClick={onCreateTab}>
          New Chat
        </Button>
        <Button variant="outline-secondary" onClick={() => navigate('agents')}>
          Configure Agents
        </Button>
      </div>
    </div>
  );
}

// ============ Main Chat Page Content ============

function ChatPageContent(): React.ReactElement {
  const { tabs, activeTabId, getActiveTab, sendMessage, cancelStream, createTab, tabCount } = useTabContext();

  // Internals panel state
  const [showInternals, setShowInternals] = useState(false);
  const [internalsWidth, setInternalsWidth] = useState(INTERNALS_PANEL_DEFAULT_WIDTH);

  // New tab modal
  const [showNewTabModal, setShowNewTabModal] = useState(false);

  const activeTab = getActiveTab();

  const handleNewTabClick = () => {
    setShowNewTabModal(true);
  };

  const handleSelectAgent = async (agentConfigId: string, agentName: string) => {
    await createTab(agentConfigId, agentName);
  };

  const handleSend = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

  const handleCancel = useCallback(() => {
    cancelStream();
  }, [cancelStream]);

  return (
    <div className="chat-container">
      <div
        className="chat"
        style={{ width: showInternals ? `calc(100% - ${internalsWidth}px)` : '100%' }}
      >
        {/* Tab Bar with toolbar actions */}
        <TabBar
          onNewTabClick={handleNewTabClick}
          showInternals={showInternals}
          onToggleInternals={() => setShowInternals(!showInternals)}
        />

        {/* Chat content */}
        {activeTab ? (
          <ChatContent
            tab={activeTab}
            onSend={handleSend}
            onCancel={handleCancel}
          />
        ) : tabCount === 0 ? (
          <div className="chat__messages chat__messages--empty">
            <EmptyTabsState onCreateTab={handleNewTabClick} />
          </div>
        ) : null}
      </div>

      {/* Internals Panel - pass instanceId */}
      <InternalsPanel
        isOpen={showInternals}
        onClose={() => setShowInternals(false)}
        width={internalsWidth}
        onWidthChange={setInternalsWidth}
        instanceId={activeTab?.instanceId || null}
      />

      {/* New Tab Modal */}
      <NewTabModal
        show={showNewTabModal}
        onHide={() => setShowNewTabModal(false)}
        onSelectAgent={handleSelectAgent}
      />
    </div>
  );
}

// ============ Main Export (with Provider) ============

export function ChatPage(): React.ReactElement {
  const [defaultAgentConfig, setDefaultAgentConfig] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the active agent on mount
  useEffect(() => {
    const loadActiveAgent = async () => {
      try {
        const activeAgent = await window.hosea.agentConfig.getActive();
        if (activeAgent) {
          setDefaultAgentConfig({ id: activeAgent.id, name: activeAgent.name });
        }
      } catch (error) {
        console.error('Failed to load active agent:', error);
      }
      setIsLoading(false);
    };
    loadActiveAgent();
  }, []);

  if (isLoading) {
    return (
      <div className="chat-container">
        <div className="chat d-flex align-items-center justify-content-center">
          <Spinner animation="border" variant="primary" />
        </div>
      </div>
    );
  }

  return (
    <TabProvider
      defaultAgentConfigId={defaultAgentConfig?.id}
      defaultAgentName={defaultAgentConfig?.name}
    >
      <ChatPageContent />
    </TabProvider>
  );
}
