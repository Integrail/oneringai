import React$1, { ReactNode, Component, ErrorInfo } from 'react';
import { IPluginSnapshot, IContextSnapshot, IViewContextData, ContextBudget, IToolSnapshot } from '@everworker/oneringai';
export { IContextSnapshot, IPluginSnapshot, IToolSnapshot, IViewContextComponent, IViewContextData } from '@everworker/oneringai';
import * as react_jsx_runtime from 'react/jsx-runtime';

/**
 * UI prop types for Look Inside components.
 * Re-exports snapshot types from core library for convenience.
 */

/**
 * Renderer component for a specific plugin type.
 */
type PluginRenderer = React.ComponentType<PluginRendererProps>;
/**
 * Props passed to plugin renderer components.
 */
interface PluginRendererProps {
    /** Plugin snapshot data */
    plugin: IPluginSnapshot;
    /** Whether the section is currently expanded */
    expanded?: boolean;
    /** Optional CSS class */
    className?: string;
    /** Optional callback when a memory/entry item is clicked (for lazy value loading) */
    onEntryClick?: (key: string) => void;
    /** Optional map of loaded entry values (key → value) */
    entryValues?: Map<string, unknown>;
    /** Key currently being loaded */
    loadingEntryKey?: string | null;
}
/**
 * Props for the main LookInsidePanel component.
 */
interface LookInsidePanelProps {
    /** Context snapshot (null while loading or unavailable) */
    snapshot: IContextSnapshot | null;
    /** Loading state */
    loading?: boolean;
    /** Agent display name */
    agentName?: string;
    /** App-specific header actions (buttons, etc.) */
    headerActions?: ReactNode;
    /** Callback when "View Full Context" is requested */
    onViewFullContext?: () => void;
    /** Callback when "Force Compaction" is requested */
    onForceCompaction?: () => void;
    /** Optional CSS class */
    className?: string;
    /** Custom plugin renderers (keyed by plugin name) */
    pluginRenderers?: Record<string, PluginRenderer>;
    /** Section names to expand by default */
    defaultExpanded?: string[];
    /** Callback when a Working Memory entry is clicked (for lazy value loading) */
    onMemoryEntryClick?: (key: string) => void;
    /** Loaded memory entry values */
    memoryEntryValues?: Map<string, unknown>;
    /** Memory entry key currently being loaded */
    loadingMemoryKey?: string | null;
}
/**
 * Props for ViewContextContent component.
 */
interface ViewContextContentProps {
    /** View context data (from agent.getViewContext()) */
    data: IViewContextData | null;
    /** Loading state */
    loading?: boolean;
    /** Error message */
    error?: string | null;
    /** Callback when "Copy All" is clicked */
    onCopyAll?: () => void;
    /** Optional CSS class */
    className?: string;
}
/**
 * Props for CollapsibleSection component.
 */
interface CollapsibleSectionProps {
    /** Section title */
    title: string;
    /** Section identifier (for expand/collapse state) */
    id: string;
    /** Whether the section starts expanded (uncontrolled mode) */
    defaultExpanded?: boolean;
    /** Controlled expanded state (overrides defaultExpanded) */
    expanded?: boolean;
    /** Callback when toggled (for controlled mode) */
    onToggle?: (id: string) => void;
    /** Optional badge text (shown next to title) */
    badge?: string | number;
    /** Optional icon (ReactNode — app provides its own) */
    icon?: ReactNode;
    /** Children content */
    children: ReactNode;
    /** Optional CSS class */
    className?: string;
}

/**
 * LookInsidePanel — Main container that auto-renders plugin sections.
 *
 * Takes a serializable IContextSnapshot and renders all sections.
 * Plugin sections are auto-discovered from the snapshot — no hardcoding.
 */

declare const LookInsidePanel: React$1.FC<LookInsidePanelProps>;

/**
 * ViewContextContent — "View Full Context" content (no modal wrapper).
 *
 * Renders the prepared context breakdown with named components,
 * token estimates, and a "Copy All" button. Apps provide their own modal.
 */

declare const ViewContextContent: React$1.FC<ViewContextContentProps>;

/**
 * CollapsibleSection — Reusable expand/collapse wrapper.
 * Supports both uncontrolled (defaultExpanded) and controlled (expanded + onToggle) modes.
 */

declare const CollapsibleSection: React$1.FC<CollapsibleSectionProps>;

/**
 * ContextWindowSection — Progress bar + token stats.
 */

interface ContextWindowSectionProps {
    budget: ContextBudget;
    messagesCount: number;
    toolCallsCount: number;
    strategy: string;
}
declare const ContextWindowSection: React$1.FC<ContextWindowSectionProps>;

/**
 * TokenBreakdownSection — Bar chart from budget.breakdown.
 */

interface TokenBreakdownSectionProps {
    budget: ContextBudget;
}
declare const TokenBreakdownSection: React$1.FC<TokenBreakdownSectionProps>;

/**
 * SystemPromptSection — Code block display for system prompt.
 */

interface SystemPromptSectionProps {
    content: string | null;
}
declare const SystemPromptSection: React$1.FC<SystemPromptSectionProps>;

/**
 * ToolsSection — Tool list with enabled/disabled badges and call counts.
 */

interface ToolsSectionProps {
    tools: IToolSnapshot[];
}
declare const ToolsSection: React$1.FC<ToolsSectionProps>;

/**
 * GenericPluginSection — Fallback renderer for plugins without a custom renderer.
 * Shows formatted content (if available) or raw JSON contents.
 */

declare const GenericPluginSection: React$1.FC<PluginRendererProps>;

/**
 * WorkingMemoryRenderer — Displays working memory entries with key, scope, priority.
 * Supports optional click-to-expand for lazy value loading (e.g., via IPC in Hosea).
 */

declare const WorkingMemoryRenderer: React$1.FC<PluginRendererProps>;

/**
 * InContextMemoryRenderer — Displays in-context memory entries with priority badges.
 */

declare const InContextMemoryRenderer: React$1.FC<PluginRendererProps>;

/**
 * PersistentInstructionsRenderer — Displays persistent instruction entries.
 */

declare const PersistentInstructionsRenderer: React$1.FC<PluginRendererProps>;

/**
 * UserInfoRenderer — Displays user info entries.
 */

declare const UserInfoRenderer: React$1.FC<PluginRendererProps>;

/**
 * Plugin Renderer Registry — Maps plugin names to custom renderer components.
 *
 * Built-in renderers are registered by default. Apps can register
 * additional renderers for custom plugins.
 */

/**
 * Register a custom plugin renderer.
 */
declare function registerPluginRenderer(name: string, renderer: PluginRenderer): void;
/**
 * Get the renderer for a plugin (or null for fallback to GenericPluginSection).
 */
declare function getPluginRenderer(name: string): PluginRenderer | null;
/**
 * Get all registered renderer names.
 */
declare function getRegisteredPluginNames(): string[];

/**
 * Utility functions for Look Inside components.
 */
/**
 * Format bytes to a human-readable string.
 */
declare function formatBytes(bytes: number): string;
/**
 * Format a number with comma separators.
 */
declare function formatNumber(n: number): string;
/**
 * Get a CSS color class name based on utilization percentage.
 */
declare function getUtilizationColor(percent: number): string;
/**
 * Get a utilization label.
 */
declare function getUtilizationLabel(percent: number): string;
/**
 * Truncate text with ellipsis.
 */
declare function truncateText(text: string, maxLength: number): string;
/**
 * Format a plugin name to display name.
 * e.g., 'working_memory' → 'Working Memory'
 */
declare function formatPluginName(name: string): string;
/**
 * Format a timestamp to a relative or absolute string.
 */
declare function formatTimestamp(ts: number): string;

/**
 * Shared types for the markdown rendering components.
 */
interface MarkdownRendererProps {
    /** The markdown content string to render */
    content?: string;
    /** Alternate way to pass content (backwards compat with v25 pattern) */
    children?: string;
    /** Additional CSS class name */
    className?: string;
    /** Whether the content is currently being streamed (delays special block rendering) */
    isStreaming?: boolean;
}
interface CodeBlockProps {
    /** Programming language identifier */
    language: string;
    /** The code string content */
    code: string;
    /** Whether the parent markdown is streaming */
    isStreaming?: boolean;
}
interface MermaidDiagramProps {
    /** Mermaid diagram code */
    code: string;
    /** Callback when rendering fails */
    onError?: (error: Error) => void;
}
interface VegaChartProps {
    /** Vega or Vega-Lite JSON specification string */
    code: string;
    /** Whether the spec is Vega-Lite (default: true) */
    isLite?: boolean;
    /** Callback when rendering fails */
    onError?: (error: Error) => void;
}
interface MarkmapRendererProps {
    /** Markdown content for the mindmap */
    code: string;
    /** Callback when rendering fails */
    onError?: (error: Error) => void;
}
interface RenderErrorBoundaryProps {
    children: React.ReactNode;
    /** Message shown when rendering fails */
    fallbackMessage?: string;
    /** Label for the renderer type (e.g. "mermaid diagram") */
    rendererType?: string;
}

/**
 * Rich Markdown Renderer with support for:
 * - GitHub Flavored Markdown (tables, strikethrough, autolinks)
 * - Syntax-highlighted code blocks with special renderers
 * - LaTeX math (inline and block) with robust preprocessing
 * - Mermaid diagrams, Markmap mindmaps, Vega/Vega-Lite charts
 *
 * Merged from Hosea (streaming context, audio/video detection, clean structure)
 * and v25 (advanced math preprocessing, box-drawing table conversion, pipe escaping).
 */

interface MarkdownContextValue {
    isStreaming: boolean;
}
declare const useMarkdownContext: () => MarkdownContextValue;
declare const MarkdownRenderer: React$1.NamedExoticComponent<MarkdownRendererProps>;

/**
 * Code Block Component with syntax highlighting and special renderers.
 *
 * Supports: standard code, mermaid diagrams, vega/vega-lite charts, markmap mindmaps.
 * Special blocks (vega, mermaid, markmap) only render after streaming completes
 * to avoid parse errors from incomplete JSON/syntax.
 *
 * Based on Hosea's CodeBlock (streaming-aware, lazy-loaded special renderers)
 * with Hosea's copy button UX.
 */

declare function CodeBlock({ language, code, isStreaming }: CodeBlockProps): React$1.ReactElement;

/**
 * Mermaid Diagram Renderer
 * Renders mermaid diagram code into SVG.
 *
 * Requires `mermaid` as an optional peer dependency.
 */

declare function MermaidDiagram({ code, onError }: MermaidDiagramProps): React$1.ReactElement;

/**
 * Vega/Vega-Lite Chart Renderer
 * Renders Vega or Vega-Lite JSON specifications as interactive charts.
 *
 * Requires `react-vega` and `vega-lite` as optional peer dependencies.
 */

declare function VegaChart({ code, isLite, onError, }: VegaChartProps): React$1.ReactElement;

/**
 * Markmap Mindmap Renderer
 * Renders markdown content as an interactive mindmap.
 *
 * Requires `markmap-lib` and `markmap-view` as optional peer dependencies.
 */

declare function MarkmapRenderer({ code, onError, }: MarkmapRendererProps): React$1.ReactElement;

interface Props {
    children: ReactNode;
    fallbackMessage?: string;
    rendererType?: string;
}
interface State {
    hasError: boolean;
    error?: Error;
}
declare class RenderErrorBoundary extends Component<Props, State> {
    constructor(props: Props);
    static getDerivedStateFromError(error: Error): State;
    componentDidCatch(error: Error, _errorInfo: ErrorInfo): void;
    private isBenignError;
    render(): string | number | boolean | Iterable<React$1.ReactNode> | react_jsx_runtime.JSX.Element | null | undefined;
}

/**
 * Shared chat UI types.
 * Both apps can use these directly or extend them with app-specific fields.
 */
/** Base message type — apps can extend with their own fields */
interface IChatMessage {
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
interface IToolCallInfo {
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
interface IStreamingTextProps {
    text: string;
    isStreaming?: boolean;
    renderMarkdown?: boolean;
    className?: string;
    showCursor?: boolean;
}
/** Props for ToolCallCard */
interface IToolCallCardProps {
    tool: IToolCallInfo;
    expanded?: boolean;
    className?: string;
}
/** Props for ExecutionProgress */
interface IExecutionProgressProps {
    tools: IToolCallInfo[];
    activeCount: number;
    isComplete: boolean;
}
/** Props for ChatControls */
interface IChatControlsProps {
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
interface IExportMessageProps {
    messageElement: HTMLElement | null;
    markdownContent?: string;
    onExport?: (format: 'pdf' | 'docx') => Promise<void>;
    className?: string;
    disabled?: boolean;
}
/** Props for ThinkingBlock */
interface IThinkingBlockProps {
    content: string;
    isStreaming?: boolean;
    defaultCollapsed?: boolean;
    className?: string;
}
/** Props for MessageList */
interface IMessageListProps {
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

/**
 * MessageList — Displays a list of chat messages with rich rendering.
 *
 * Features:
 * - Markdown rendering with math, diagrams, charts, code highlighting
 * - Streaming text support with animated cursor
 * - ThinkingBlock for thinking-capable models
 * - Tool call display
 * - Copy message content
 * - Auto-scroll to bottom
 *
 * Merged from v25 (standalone component) + Hosea (smart auto-scroll).
 */

/**
 * Main message list component.
 */
declare const MessageList: React$1.FC<IMessageListProps>;

/**
 * StreamingText — Renders streaming text with a typing indicator.
 *
 * Displays text that accumulates in real-time during streaming,
 * with an animated cursor to indicate active streaming.
 */

declare const StreamingText: React$1.FC<IStreamingTextProps>;

/**
 * ToolCallCard — Displays tool call information.
 *
 * Merged from:
 * - Hosea's ToolCallDisplay (category colors, icons, inline variant)
 * - v25's ToolCallCard (expandable details, args/result display)
 */

declare const ToolCallCard: React$1.FC<IToolCallCardProps>;
/**
 * Inline tool call display for embedding in message content.
 */
interface InlineToolCallProps {
    name: string;
    description: string;
    status: 'pending' | 'running' | 'complete' | 'error';
}
declare function InlineToolCall({ name, description, status }: InlineToolCallProps): React$1.ReactElement;

/**
 * ExecutionProgress — Inline progress indicator for agent execution.
 *
 * Shows dynamic header with running tool name or cycling status messages.
 * Collapsed by default, expandable to show full ToolCallCard list.
 *
 * From v25, adapted to use framework-agnostic CSS classes.
 */

declare const ExecutionProgress: React$1.FC<IExecutionProgressProps>;

/**
 * ChatControls — Execution control buttons for chat.
 *
 * Provides pause/resume/cancel controls for agent execution.
 * Framework-agnostic: uses plain HTML buttons with CSS classes.
 */

declare const ChatControls: React$1.FC<IChatControlsProps>;

/**
 * ExportMessage — Export button with dropdown for PDF/DOCX export.
 *
 * The actual export logic is injectable via `onExport` prop so each app
 * can provide its own PDF/DOCX generation (v25 has corporate templates, Hosea may differ).
 * If no onExport is provided, the button is hidden.
 */

declare const ExportMessage: React$1.FC<IExportMessageProps>;

/**
 * ThinkingBlock — Collapsible display for LLM thinking/reasoning content.
 *
 * NEW component that surfaces the thinking text from thinking-capable models
 * (Claude with extended thinking, OpenAI with reasoning, etc.).
 *
 * - Collapsed: Shows "Thinking..." with chevron, animated dots while streaming
 * - Expanded: Grey-tinted scrollable block with the thinking text
 * - Uses CSS variables on `.thinking-block` for easy theming
 */

declare const ThinkingBlock: React$1.FC<IThinkingBlockProps>;

export { ChatControls, CodeBlock, type CodeBlockProps, CollapsibleSection, type CollapsibleSectionProps, ContextWindowSection, ExecutionProgress, ExportMessage, GenericPluginSection, type IChatControlsProps, type IChatMessage, type IExecutionProgressProps, type IExportMessageProps, type IMessageListProps, type IStreamingTextProps, type IThinkingBlockProps, type IToolCallCardProps, type IToolCallInfo, InContextMemoryRenderer, InlineToolCall, LookInsidePanel, type LookInsidePanelProps, MarkdownRenderer, type MarkdownRendererProps, MarkmapRenderer, type MarkmapRendererProps, MermaidDiagram, type MermaidDiagramProps, MessageList, PersistentInstructionsRenderer, type PluginRenderer, type PluginRendererProps, RenderErrorBoundary, type RenderErrorBoundaryProps, StreamingText, SystemPromptSection, ThinkingBlock, TokenBreakdownSection, ToolCallCard, ToolsSection, UserInfoRenderer, VegaChart, type VegaChartProps, ViewContextContent, type ViewContextContentProps, WorkingMemoryRenderer, formatBytes, formatNumber, formatPluginName, formatTimestamp, getPluginRenderer, getRegisteredPluginNames, getUtilizationColor, getUtilizationLabel, registerPluginRenderer, truncateText, useMarkdownContext };
