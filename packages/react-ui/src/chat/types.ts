/**
 * Shared chat UI types.
 * Both apps can use these directly or extend them with app-specific fields.
 */

/** Base message type — apps can extend with their own fields */
export interface IChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number | Date;
  isStreaming?: boolean;
  /** Thinking/reasoning content from the LLM */
  thinking?: string;
  /** Tool calls associated with this message */
  toolCalls?: IToolCallInfo[];
  /** Error message if the response failed */
  error?: string;
}

/** Shared tool call type (superset of both apps) */
export interface IToolCallInfo {
  id: string;
  name: string;
  description?: string;
  args?: Record<string, unknown>;
  status: 'pending' | 'running' | 'complete' | 'error';
  durationMs?: number;
  result?: unknown;
  error?: string;
}

/** Props for StreamingText */
export interface IStreamingTextProps {
  text: string;
  isStreaming?: boolean;
  renderMarkdown?: boolean;
  className?: string;
  showCursor?: boolean;
}

/** Props for ToolCallCard */
export interface IToolCallCardProps {
  tool: IToolCallInfo;
  expanded?: boolean;
  className?: string;
}

/** Props for ExecutionProgress */
export interface IExecutionProgressProps {
  tools: IToolCallInfo[];
  activeCount: number;
  isComplete: boolean;
}

/** Props for ChatControls */
export interface IChatControlsProps {
  isRunning?: boolean;
  isPaused?: boolean;
  hasError?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'lg';
}

/** Props for ExportMessage */
export interface IExportMessageProps {
  messageElement: HTMLElement | null;
  markdownContent?: string;
  onExport?: (format: 'pdf' | 'docx') => Promise<void>;
  className?: string;
  disabled?: boolean;
}

/** Props for ThinkingBlock */
export interface IThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

/** Props for MessageList */
export interface IMessageListProps {
  messages: IChatMessage[];
  streamingText?: string;
  streamingThinking?: string;
  isStreaming?: boolean;
  autoScroll?: boolean;
  hideThinking?: boolean;
  className?: string;
  renderMessage?: (message: IChatMessage, index: number) => React.ReactNode;
  onCopyMessage?: (content: string) => void;
  onExport?: (message: IChatMessage, element: HTMLElement) => void;
}
