/**
 * Chat Page - Main chat interface with the agent
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { Send, Square, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface AgentStatus {
  initialized: boolean;
  connector: string | null;
  model: string | null;
  mode: string | null;
}

interface ChatPageProps {
  onOpenSetup: () => void;
}

export function ChatPage({ onOpenSetup }: ChatPageProps): React.ReactElement {
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

  // Check agent status on mount
  useEffect(() => {
    const checkStatus = async () => {
      const s = await window.hosea.agent.status();
      setStatus(s);
      if (!s.initialized) {
        onOpenSetup();
      }
    };
    checkStatus();
  }, [onOpenSetup]);

  // Set up streaming listeners
  useEffect(() => {
    window.hosea.agent.onStreamChunk((chunk) => {
      if (chunk.type === 'text' && chunk.content) {
        setStreamingContent((prev) => prev + chunk.content);
      } else if (chunk.type === 'tool_start' && chunk.tool) {
        setStreamingContent((prev) => prev + `\n\n*Using tool: ${chunk.tool}...*\n\n`);
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

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
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
                : 'Set up a connector to get started.'}
            </p>
            {!status.initialized && (
              <Button variant="primary" className="mt-4" onClick={onOpenSetup}>
                Connect Now
              </Button>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message message--${message.role}`}>
              {message.role === 'assistant' && (
                <div className="message__avatar">
                  <Bot size={18} />
                </div>
              )}
              <div className="message__content">
                <div className="message__text">
                  {message.content || (
                    message.isStreaming && (
                      <span className="message__streaming-indicator">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Thinking...
                      </span>
                    )
                  )}
                </div>
                <div className="message__time">{formatTime(message.timestamp)}</div>
              </div>
              {message.role === 'user' && (
                <div className="message__avatar">
                  <User size={18} />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat__input">
        <Form className="chat__input-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
          <Form.Control
            as="textarea"
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
            <Button
              variant="danger"
              className="chat__send-btn"
              onClick={handleCancel}
            >
              <Square size={20} />
            </Button>
          ) : (
            <Button
              variant="primary"
              type="submit"
              className="chat__send-btn"
              disabled={!input.trim() || !status.initialized}
            >
              <Send size={20} />
            </Button>
          )}
        </Form>
      </div>
    </div>
  );
}
