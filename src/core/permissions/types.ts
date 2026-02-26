/**
 * Tool Permission Types
 *
 * Defines permission scopes, risk levels, and approval state for tool execution control.
 *
 * Works with ALL agent types:
 * - Agent (basic)
 * - TaskAgent (task-based)
 * - UniversalAgent (mode-fluid)
 */

import type { ToolCall } from '../../domain/entities/Tool.js';

// ============================================================================
// Permission Scopes
// ============================================================================

/**
 * Permission scope defines when approval is required for a tool
 *
 * - `once` - Require approval for each tool call (most restrictive)
 * - `session` - Approve once, valid for entire session
 * - `always` - Auto-approve (allowlisted, no prompts)
 * - `never` - Always blocked (blocklisted, tool cannot execute)
 */
export type PermissionScope = 'once' | 'session' | 'always' | 'never';

/**
 * Risk level classification for tools
 *
 * Used to help users understand the potential impact of approving a tool.
 * Can be used by UI to show different approval dialogs.
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Tool Permission Configuration
// ============================================================================

/**
 * Permission configuration for a tool
 *
 * Can be set on the tool definition or overridden at registration time.
 */
export interface ToolPermissionConfig {
  /**
   * When approval is required.
   * @default 'once'
   */
  scope?: PermissionScope;

  /**
   * Risk classification for the tool.
   * @default 'low'
   */
  riskLevel?: RiskLevel;

  /**
   * Custom message shown in approval UI.
   * Should explain what the tool does and any potential risks.
   */
  approvalMessage?: string;

  /**
   * Argument names that should be highlighted in approval UI.
   * E.g., ['path', 'url'] for file/network operations.
   */
  sensitiveArgs?: string[];

  /**
   * Optional expiration time for session approvals (milliseconds).
   * If set, session approvals expire after this duration.
   */
  sessionTTLMs?: number;
}

// ============================================================================
// Permission Check Context (passed to approval hooks)
// ============================================================================

/**
 * Context passed to approval callbacks/hooks
 */
export interface PermissionCheckContext {
  /** The tool call being checked */
  toolCall: ToolCall;

  /** Parsed arguments (for display/inspection) */
  parsedArgs: Record<string, unknown>;

  /** The tool's permission config */
  config: ToolPermissionConfig;

  /** Current execution context ID */
  executionId: string;

  /** Current iteration (if in agentic loop) */
  iteration: number;

  /** Agent type (for context-specific handling) */
  agentType: 'agent' | 'task-agent' | 'universal-agent';

  /** Optional task name (for TaskAgent/UniversalAgent) */
  taskName?: string;
}

// ============================================================================
// Approval State (Runtime)
// ============================================================================

/**
 * Entry in the approval cache representing an approved tool
 */
export interface ApprovalCacheEntry {
  /** Name of the approved tool */
  toolName: string;

  /** The scope that was approved */
  scope: PermissionScope;

  /** When the approval was granted */
  approvedAt: Date;

  /** Optional identifier of who approved (for audit) */
  approvedBy?: string;

  /** When this approval expires (for session/TTL approvals) */
  expiresAt?: Date;

  /** Arguments hash if approval was for specific arguments */
  argsHash?: string;
}

/**
 * Serialized approval state for session persistence
 */
export interface SerializedApprovalState {
  /** Version for future migrations */
  version: number;

  /** Map of tool name to approval entry */
  approvals: Record<string, SerializedApprovalEntry>;

  /** Tools that are always blocked (persisted blocklist) */
  blocklist: string[];

  /** Tools that are always allowed (persisted allowlist) */
  allowlist: string[];
}

/**
 * Serialized version of ApprovalCacheEntry (with ISO date strings)
 */
export interface SerializedApprovalEntry {
  toolName: string;
  scope: PermissionScope;
  approvedAt: string; // ISO date string
  approvedBy?: string;
  expiresAt?: string; // ISO date string
  argsHash?: string;
}

// ============================================================================
// Permission Check Results
// ============================================================================

/**
 * Result of checking if a tool needs approval
 */
export interface PermissionCheckResult {
  /** Whether the tool can execute without prompting */
  allowed: boolean;

  /** Whether approval is needed (user should be prompted) */
  needsApproval: boolean;

  /** Whether the tool is blocked (cannot execute at all) */
  blocked: boolean;

  /** Reason for the decision */
  reason: string;

  /** The tool's permission config (for UI display) */
  config?: ToolPermissionConfig;
}

/**
 * Result from approval UI/hook
 */
export interface ApprovalDecision {
  /** Whether the tool was approved */
  approved: boolean;

  /** Scope of the approval (may differ from requested) */
  scope?: PermissionScope;

  /** Reason for denial (if not approved) */
  reason?: string;

  /** Optional identifier of who approved */
  approvedBy?: string;

  /** Whether to remember this decision for future calls */
  remember?: boolean;
}

// ============================================================================
// Agent Configuration (works with ALL agent types)
// ============================================================================

/**
 * Permission configuration for any agent type.
 *
 * Used in:
 * - Agent.create({ permissions: {...} })
 * - TaskAgent.create({ permissions: {...} })
 * - UniversalAgent.create({ permissions: {...} })
 */
export interface AgentPermissionsConfig {
  /**
   * Default permission scope for tools without explicit config.
   * @default 'once'
   */
  defaultScope?: PermissionScope;

  /**
   * Default risk level for tools without explicit config.
   * @default 'low'
   */
  defaultRiskLevel?: RiskLevel;

  /**
   * Tools that are always allowed (never prompt).
   * Array of tool names.
   */
  allowlist?: string[];

  /**
   * Tools that are always blocked (cannot execute).
   * Array of tool names.
   */
  blocklist?: string[];

  /**
   * Per-tool permission overrides.
   * Keys are tool names, values are permission configs.
   */
  tools?: Record<string, ToolPermissionConfig>;

  /**
   * Callback invoked when a tool needs approval.
   * Return an ApprovalDecision to approve/deny.
   *
   * If not provided, the existing `approve:tool` hook system is used.
   * This callback runs BEFORE hooks, providing a first-pass check.
   */
  onApprovalRequired?: (context: PermissionCheckContext) => Promise<ApprovalDecision>;

  /**
   * Whether to inherit permission state from parent session.
   * Only applies when resuming from a session.
   * @default true
   */
  inheritFromSession?: boolean;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Events emitted by ToolPermissionManager
 */
export type PermissionManagerEvent =
  | 'tool:approved'
  | 'tool:denied'
  | 'tool:blocked'
  | 'tool:revoked'
  | 'allowlist:added'
  | 'allowlist:removed'
  | 'blocklist:added'
  | 'blocklist:removed'
  | 'session:cleared';

// ============================================================================
// Constants
// ============================================================================

/**
 * Current version of serialized approval state
 */
export const APPROVAL_STATE_VERSION = 1;

/**
 * Default permission config applied when no config is specified
 */
export const DEFAULT_PERMISSION_CONFIG: Required<Pick<ToolPermissionConfig, 'scope' | 'riskLevel'>> = {
  scope: 'once',
  riskLevel: 'low',
};

/**
 * Default allowlist - tools that never require user confirmation.
 *
 * These tools are safe to execute without user approval:
 * - Read-only operations (filesystem reads, searches)
 * - Internal state management (memory tools)
 * - Introspection tools (context stats)
 * - In-context memory tools
 * - Persistent instructions tools
 * - Meta-tools for agent coordination
 *
 * All other tools (write operations, shell commands, external requests)
 * require explicit user approval by default.
 */
export const DEFAULT_ALLOWLIST: readonly string[] = [
  // Filesystem read-only tools
  'read_file',
  'glob',
  'grep',
  'list_directory',

  // Memory management (internal state - safe)
  'memory_store',
  'memory_retrieve',
  'memory_delete',
  'memory_query',
  'memory_cleanup_raw',

  // Context introspection (unified tool)
  'context_stats',

  // In-context memory tools
  'context_set',
  'context_delete',
  'context_list',

  // Persistent instructions tools
  'instructions_set',
  'instructions_remove',
  'instructions_list',
  'instructions_clear',

  // User info tools (user-specific data - safe)
  'user_info_set',
  'user_info_get',
  'user_info_remove',
  'user_info_clear',

  // TODO tools (user-specific data - safe)
  'todo_add',
  'todo_update',
  'todo_remove',

  // Tool catalog tools (browsing and loading — safe)
  'tool_catalog_search',
  'tool_catalog_load',
  'tool_catalog_unload',

  // Meta-tools (internal coordination)
  '_start_planning',
  '_modify_plan',
  '_report_progress',
  '_request_approval', // CRITICAL: Must be allowlisted to avoid circular dependency!
] as const;

/**
 * Type for default allowlisted tools
 */
export type DefaultAllowlistedTool = (typeof DEFAULT_ALLOWLIST)[number];
