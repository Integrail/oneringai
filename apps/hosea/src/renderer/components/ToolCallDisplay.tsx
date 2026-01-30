/**
 * ToolCallDisplay - Renders tool call information in a pretty format
 *
 * Shows tool name, description, args, and status with appropriate styling
 */

import React from 'react';
import { Wrench, Check, AlertCircle, Loader, Clock } from 'lucide-react';

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  description: string;
  status: 'running' | 'complete' | 'error';
  durationMs?: number;
  error?: string;
}

interface ToolCallDisplayProps {
  toolCall: ToolCallInfo;
}

// Map tool names to categories and colors
const TOOL_CATEGORIES: Record<string, { category: string; color: string }> = {
  // Filesystem tools
  read_file: { category: 'File', color: '#3b82f6' },
  write_file: { category: 'File', color: '#3b82f6' },
  edit_file: { category: 'File', color: '#3b82f6' },
  glob: { category: 'File', color: '#3b82f6' },
  grep: { category: 'File', color: '#3b82f6' },
  list_directory: { category: 'File', color: '#3b82f6' },

  // Shell
  bash: { category: 'Shell', color: '#10b981' },

  // Web tools
  web_search: { category: 'Web', color: '#8b5cf6' },
  web_scrape: { category: 'Web', color: '#8b5cf6' },
  web_fetch: { category: 'Web', color: '#8b5cf6' },

  // Memory tools
  memory_store: { category: 'Memory', color: '#f59e0b' },
  memory_retrieve: { category: 'Memory', color: '#f59e0b' },
  memory_list: { category: 'Memory', color: '#f59e0b' },
  memory_delete: { category: 'Memory', color: '#f59e0b' },

  // Context tools
  context_set: { category: 'Context', color: '#ec4899' },
  context_get: { category: 'Context', color: '#ec4899' },
  context_delete: { category: 'Context', color: '#ec4899' },
  context_list: { category: 'Context', color: '#ec4899' },
};

function getToolInfo(name: string): { category: string; color: string } {
  return TOOL_CATEGORIES[name] || { category: 'Tool', color: '#6b7280' };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps): React.ReactElement {
  const { name, description, status, durationMs, error } = toolCall;
  const { category, color } = getToolInfo(name);

  const statusIcon = {
    running: <Loader size={14} className="tool-call__status-icon tool-call__status-icon--spin" />,
    complete: <Check size={14} className="tool-call__status-icon tool-call__status-icon--success" />,
    error: <AlertCircle size={14} className="tool-call__status-icon tool-call__status-icon--error" />,
  }[status];

  return (
    <div className={`tool-call tool-call--${status}`}>
      <div className="tool-call__header">
        <div className="tool-call__icon" style={{ backgroundColor: color }}>
          <Wrench size={12} />
        </div>
        <span className="tool-call__category" style={{ color }}>
          {category}
        </span>
        <span className="tool-call__name">{name}</span>
        <div className="tool-call__status">
          {statusIcon}
          {status === 'complete' && durationMs !== undefined && (
            <span className="tool-call__duration">
              <Clock size={12} />
              {formatDuration(durationMs)}
            </span>
          )}
        </div>
      </div>

      {description && (
        <div className="tool-call__description">
          {truncateString(description, 100)}
        </div>
      )}

      {error && (
        <div className="tool-call__error">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Inline tool call display for embedding in message content
 */
interface InlineToolCallProps {
  name: string;
  description: string;
  status: 'running' | 'complete' | 'error';
}

export function InlineToolCall({ name, description, status }: InlineToolCallProps): React.ReactElement {
  const { category, color } = getToolInfo(name);

  return (
    <span className={`inline-tool-call inline-tool-call--${status}`}>
      <span className="inline-tool-call__badge" style={{ backgroundColor: color }}>
        <Wrench size={10} />
        <span className="inline-tool-call__category">{category}</span>
      </span>
      <span className="inline-tool-call__name">{name}</span>
      {description && (
        <span className="inline-tool-call__description">
          {truncateString(description, 50)}
        </span>
      )}
      {status === 'running' && (
        <Loader size={12} className="inline-tool-call__spinner" />
      )}
    </span>
  );
}

export default ToolCallDisplay;
