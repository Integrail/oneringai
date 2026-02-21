/**
 * Snapshot Types — Canonical, serializable representations of agent context state.
 *
 * Used by UI components (Hosea, v25, etc.) to render "Look Inside" panels
 * without reaching into plugin internals directly.
 *
 * Design: `plugins` is an array (not hardcoded fields) enabling auto-discovery
 * of new/custom plugins without code changes.
 */

import type { ContextBudget, ContextFeatures } from './types.js';

// ============================================================================
// Context Snapshot (Main)
// ============================================================================

/**
 * Complete snapshot of an agent's context state.
 * Returned by `AgentContextNextGen.getSnapshot()` and `BaseAgent.getSnapshot()`.
 */
export interface IContextSnapshot {
  /** Whether the context is available (not destroyed) */
  available: boolean;

  /** Agent ID */
  agentId: string;

  /** Model name */
  model: string;

  /** Feature flags */
  features: Required<ContextFeatures>;

  /** Token budget breakdown */
  budget: ContextBudget;

  /** Compaction strategy name */
  strategy: string;

  /** Number of messages in conversation history */
  messagesCount: number;

  /** Number of tool calls in conversation */
  toolCallsCount: number;

  /** System prompt (null if not set) */
  systemPrompt: string | null;

  /** All registered plugins with their current state */
  plugins: IPluginSnapshot[];

  /** All registered tools */
  tools: IToolSnapshot[];
}

// ============================================================================
// Plugin Snapshot
// ============================================================================

/**
 * Snapshot of a single plugin's state.
 * `contents` is the raw data from `plugin.getContents()` (plugin-specific shape).
 * `formattedContent` is the human-readable string from `plugin.getContent()`.
 */
export interface IPluginSnapshot {
  /** Plugin identifier (e.g., 'working_memory') */
  name: string;

  /** Human-readable display name (e.g., 'Working Memory') */
  displayName: string;

  /** Whether this plugin is active */
  enabled: boolean;

  /** Current token size of plugin content */
  tokenSize: number;

  /** Token size of plugin instructions */
  instructionsTokenSize: number;

  /** Whether this plugin supports compaction */
  compactable: boolean;

  /** Raw plugin data (entries, state, etc.) */
  contents: unknown;

  /** Human-readable formatted content (Markdown) */
  formattedContent: string | null;
}

// ============================================================================
// Tool Snapshot
// ============================================================================

/**
 * Snapshot of a single tool's registration state.
 */
export interface IToolSnapshot {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Whether the tool is currently enabled */
  enabled: boolean;

  /** Number of times this tool has been called */
  callCount: number;

  /** Tool namespace (if registered with one) */
  namespace?: string;
}

// ============================================================================
// View Context (Prepared Context Breakdown)
// ============================================================================

/**
 * Human-readable breakdown of the prepared context.
 * Used by "View Full Context" UI panels.
 */
export interface IViewContextData {
  /** Whether the data is available */
  available: boolean;

  /** Ordered list of context components */
  components: IViewContextComponent[];

  /** Total estimated tokens across all components */
  totalTokens: number;

  /** All components concatenated (for "Copy All" functionality) */
  rawContext: string;
}

/**
 * A single component of the prepared context.
 */
export interface IViewContextComponent {
  /** Component name (e.g., 'System Message', 'User Message', 'Tool Call: search') */
  name: string;

  /** Human-readable text content */
  content: string;

  /** Estimated token count for this component */
  tokenEstimate: number;
}

// ============================================================================
// Utility: Plugin name → display name
// ============================================================================

/**
 * Convert a plugin name to a human-readable display name.
 * e.g., 'working_memory' → 'Working Memory'
 */
export function formatPluginDisplayName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
