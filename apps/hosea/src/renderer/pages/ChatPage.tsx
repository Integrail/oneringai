/**
 * Chat Page - Main chat interface with the agent
 * Features rich markdown rendering with support for code, diagrams, charts, and math
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { Send, Square, Bot, User, Copy, Share } from 'lucide-react';
import { MarkdownRenderer } from '../components/markdown';
import { ToolCallDisplay, type ToolCallInfo } from '../components/ToolCallDisplay';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: ToolCallInfo[];
}

interface AgentStatus {
  initialized: boolean;
  connector: string | null;
  model: string | null;
  mode: string | null;
}

import { useNavigation } from '../hooks/useNavigation';

export function ChatPage(): React.ReactElement {
  const { navigate } = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AgentStatus>({
    initialized: false,
    connector: null,
    model: null,
    mode: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check agent status on mount and when returning to this page
  useEffect(() => {
    const checkStatus = async () => {
      const s = await window.hosea.agent.status();
      setStatus(s);
    };
    checkStatus();
  }, []);

  // Track active tool calls for the current streaming message
  const [activeToolCalls, setActiveToolCalls] = useState<Map<string, ToolCallInfo>>(new Map());

  // Set up streaming listeners
  useEffect(() => {
    window.hosea.agent.onStreamChunk((chunk) => {
      if (chunk.type === 'text' && chunk.content) {
        setStreamingContent((prev) => prev + chunk.content);
      } else if (chunk.type === 'tool_start') {
        const toolCall: ToolCallInfo = {
          id: `${chunk.tool}-${Date.now()}`,
          name: chunk.tool,
          args: chunk.args,
          description: chunk.description,
          status: 'running',
        };

        setActiveToolCalls((prev) => {
          const newMap = new Map(prev);
          newMap.set(toolCall.id, toolCall);
          return newMap;
        });

        // Update the streaming message to include tool calls
        setMessages((msgs) => {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.isStreaming) {
            const existingToolCalls = lastMsg.toolCalls || [];
            return [
              ...msgs.slice(0, -1),
              { ...lastMsg, toolCalls: [...existingToolCalls, toolCall] },
            ];
          }
          return msgs;
        });
      } else if (chunk.type === 'tool_end') {
        // Update the tool call status to complete
        setMessages((msgs) => {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.isStreaming && lastMsg.toolCalls) {
            const updatedToolCalls = lastMsg.toolCalls.map((tc) =>
              tc.name === chunk.tool && tc.status === 'running'
                ? { ...tc, status: 'complete' as const, durationMs: chunk.durationMs }
                : tc
            );
            return [
              ...msgs.slice(0, -1),
              { ...lastMsg, toolCalls: updatedToolCalls },
            ];
          }
          return msgs;
        });
      } else if (chunk.type === 'tool_error') {
        // Update the tool call status to error
        setMessages((msgs) => {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.isStreaming && lastMsg.toolCalls) {
            const updatedToolCalls = lastMsg.toolCalls.map((tc) =>
              tc.name === chunk.tool && tc.status === 'running'
                ? { ...tc, status: 'error' as const, error: chunk.error }
                : tc
            );
            return [
              ...msgs.slice(0, -1),
              { ...lastMsg, toolCalls: updatedToolCalls },
            ];
          }
          return msgs;
        });
      }
    });

    window.hosea.agent.onStreamEnd(() => {
      setStreamingContent((prev) => {
        if (prev) {
          setMessages((msgs) => {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg?.isStreaming) {
              return [
                ...msgs.slice(0, -1),
                { ...lastMsg, content: prev, isStreaming: false },
              ];
            }
            return msgs;
          });
        }
        return '';
      });
      setActiveToolCalls(new Map());
      setIsLoading(false);
    });

    return () => {
      window.hosea.agent.removeStreamListeners();
    };
  }, []);

  // Update streaming message
  useEffect(() => {
    if (streamingContent) {
      setMessages((msgs) => {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg?.isStreaming) {
          return [
            ...msgs.slice(0, -1),
            { ...lastMsg, content: streamingContent },
          ];
        }
        return msgs;
      });
    }
  }, [streamingContent]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !status.initialized || isLoading) return;

    const content = input.trim();
    setInput('');

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Add placeholder for assistant response
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    setIsLoading(true);
    setStreamingContent('');

    await window.hosea.agent.stream(content);
  }, [input, status.initialized, isLoading]);

  const handleCancel = useCallback(async () => {
    await window.hosea.agent.cancel();
    setIsLoading(false);
  }, []);

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
    <div className="chat">
      <div className={`chat__messages ${messages.length === 0 ? 'chat__messages--empty' : ''}`}>
        {messages.length === 0 ? (
          <div className="chat__welcome">
            <div className="chat__welcome-icon">
              <Bot size={40} />
            </div>
            <h2 className="chat__welcome-title">Welcome to HOSEA</h2>
            <p className="chat__welcome-subtitle">
              {status.initialized
                ? `Connected to ${status.model}. Start a conversation!`
                : 'Configure an LLM provider to get started.'}
            </p>
            {!status.initialized && (
              <Button variant="primary" className="mt-4" onClick={() => navigate('llm-connectors')}>
                Add LLM Provider
              </Button>
            )}
          </div>
        ) : (
          <div className="chat__messages-inner">
            {messages.map(renderMessage)}
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
                status.initialized
                  ? 'Type a message... (Shift+Enter for new line)'
                  : 'Connect to an agent first...'
              }
              disabled={!status.initialized || isLoading}
              rows={1}
            />
            {isLoading ? (
              <button
                className="chat__send-btn chat__send-btn--danger"
                onClick={handleCancel}
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                className="chat__send-btn"
                onClick={handleSend}
                disabled={!input.trim() || !status.initialized}
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
