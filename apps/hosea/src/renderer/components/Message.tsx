import React from 'react';
import { Spinner } from 'react-bootstrap';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface MessageProps {
  message: ChatMessage;
}

export function Message({ message }: MessageProps): React.ReactElement {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Simple markdown-like rendering
  const renderContent = (content: string) => {
    if (!content) {
      return message.isStreaming ? (
        <Spinner animation="border" size="sm" />
      ) : null;
    }

    // Split by code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        // Code block
        const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
        if (match) {
          const [, lang, code] = match;
          return (
            <pre key={index} className="bg-dark text-light p-3 rounded my-2">
              {lang && (
                <small className="text-muted d-block mb-2">{lang}</small>
              )}
              <code>{code.trim()}</code>
            </pre>
          );
        }
      }

      // Regular text - handle inline formatting
      return (
        <span key={index}>
          {part.split('\n').map((line, lineIndex) => (
            <React.Fragment key={lineIndex}>
              {lineIndex > 0 && <br />}
              {renderInlineFormatting(line)}
            </React.Fragment>
          ))}
        </span>
      );
    });
  };

  const renderInlineFormatting = (text: string) => {
    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code
    text = text.replace(/`(.*?)`/g, '<code class="bg-light px-1 rounded">$1</code>');

    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isSystem) {
    return (
      <div className="message-system text-center text-muted my-3">
        <small>{message.content}</small>
      </div>
    );
  }

  return (
    <div
      className={`message d-flex mb-3 ${isUser ? 'justify-content-end' : 'justify-content-start'}`}
    >
      <div
        className={`message-bubble p-3 rounded-3 ${
          isUser ? 'bg-primary text-white' : 'bg-white border'
        }`}
        style={{ maxWidth: '80%' }}
      >
        <div className="message-content">{renderContent(message.content)}</div>
        <div
          className={`message-time mt-1 ${isUser ? 'text-white-50' : 'text-muted'}`}
          style={{ fontSize: '0.75rem' }}
        >
          {formatTime(message.timestamp)}
          {message.isStreaming && (
            <Spinner animation="grow" size="sm" className="ms-2" />
          )}
        </div>
      </div>
    </div>
  );
}
