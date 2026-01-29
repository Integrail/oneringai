/**
 * UniversalAgent types and interfaces
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolManager } from '../../core/ToolManager.js';
import type { ISessionStorage } from '../../core/SessionManager.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { Plan, Task } from '../../domain/entities/Task.js';
import type { WorkingMemoryConfig } from '../../domain/entities/Memory.js';

// ============================================================================
// Agent Modes
// ============================================================================

export type AgentMode = 'interactive' | 'planning' | 'executing';

// ============================================================================
// Configuration
// ============================================================================

export interface UniversalAgentSessionConfig {
  /** Storage backend for sessions */
  storage: ISessionStorage;
  /** Resume existing session by ID */
  id?: string;
  /** Auto-save session after each interaction */
  autoSave?: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs?: number;
}

export interface UniversalAgentPlanningConfig {
  /** Enable planning mode. Default: true */
  enabled?: boolean;
  /** Model to use for planning (can be different from execution model) */
  model?: string;
  /** Auto-detect complex tasks and switch to planning mode. Default: true */
  autoDetect?: boolean;
  /** Require user approval before executing plan. Default: true */
  requireApproval?: boolean;
  /** Maximum tasks before requiring approval (if requireApproval is false). Default: 3 */
  maxTasksBeforeApproval?: number;
}

export interface UniversalAgentConfig {
  // Required
  connector: string | Connector;
  model: string;

  // Optional
  name?: string;
  tools?: ToolFunction[];
  instructions?: string;
  temperature?: number;
  maxIterations?: number;

  // Planning configuration
  planning?: UniversalAgentPlanningConfig;

  // Session configuration (opt-in)
  session?: UniversalAgentSessionConfig;

  // Memory configuration
  memoryConfig?: WorkingMemoryConfig;

  // Advanced: provide pre-configured managers
  toolManager?: ToolManager;

  // Tool permission configuration
  /** Permission configuration for tool execution approval. */
  permissions?: import('../../core/permissions/types.js').AgentPermissionsConfig;

  /** AgentContext configuration (optional overrides) */
  context?: Partial<import('../../core/AgentContext.js').AgentContextConfig>;
}

// ============================================================================
// Response Types
// ============================================================================

export interface TaskProgress {
  completed: number;
  total: number;
  current?: Task;
  failed: number;
  skipped: number;
}

export interface UniversalResponse {
  /** Human-readable response text */
  text: string;

  /** Current mode after this response */
  mode: AgentMode;

  /** Plan (if created or modified) */
  plan?: Plan;

  /** Plan status */
  planStatus?: 'pending_approval' | 'approved' | 'executing' | 'completed' | 'failed';

  /** Task progress (if executing) */
  taskProgress?: TaskProgress;

  /** Tool calls made during this interaction */
  toolCalls?: ToolCallResult[];

  /** Token usage */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };

  /** Whether user action is needed */
  needsUserAction?: boolean;

  /** What action is needed */
  userActionType?: 'approve_plan' | 'provide_input' | 'clarify';
}

export interface ToolCallResult {
  name: string;
  args: unknown;
  result: unknown;
  error?: string;
  durationMs: number;
}

// ============================================================================
// Event Types
// ============================================================================

export type UniversalEvent =
  // Text streaming
  | { type: 'text:delta'; delta: string }
  | { type: 'text:done'; text: string }

  // Mode transitions
  | { type: 'mode:changed'; from: AgentMode; to: AgentMode; reason: string }

  // Planning
  | { type: 'plan:analyzing'; goal: string }
  | { type: 'plan:created'; plan: Plan }
  | { type: 'plan:modified'; plan: Plan; changes: PlanChange[] }
  | { type: 'plan:awaiting_approval'; plan: Plan }
  | { type: 'plan:approved'; plan: Plan }
  | { type: 'plan:rejected'; plan: Plan; reason?: string }

  // Execution
  | { type: 'task:started'; task: Task }
  | { type: 'task:progress'; task: Task; status: string }
  | { type: 'task:completed'; task: Task; result: unknown }
  | { type: 'task:failed'; task: Task; error: string }
  | { type: 'task:skipped'; task: Task; reason: string }
  | { type: 'execution:done'; result: ExecutionResult }
  | { type: 'execution:paused'; reason: string }
  | { type: 'execution:resumed' }

  // Tools
  | { type: 'tool:start'; name: string; args: unknown }
  | { type: 'tool:complete'; name: string; result: unknown; durationMs: number }
  | { type: 'tool:error'; name: string; error: string }

  // User interaction
  | { type: 'needs:approval'; plan: Plan }
  | { type: 'needs:input'; prompt: string }
  | { type: 'needs:clarification'; question: string; options?: string[] }

  // Errors
  | { type: 'error'; error: string; recoverable: boolean };

export interface PlanChange {
  type: 'task_added' | 'task_removed' | 'task_updated' | 'task_reordered';
  taskId?: string;
  taskName?: string;
  details?: string;
}

export interface ExecutionResult {
  status: 'completed' | 'failed' | 'cancelled' | 'paused';
  completedTasks: number;
  totalTasks: number;
  failedTasks: number;
  skippedTasks: number;
  error?: string;
}

// ============================================================================
// Internal Types
// ============================================================================

export interface IntentAnalysis {
  /** Detected intent type */
  type: 'simple' | 'complex' | 'plan_modify' | 'status_query' | 'approval' | 'rejection' | 'feedback' | 'interrupt' | 'question';

  /** Confidence score (0-1) */
  confidence: number;

  /** For complex tasks */
  complexity?: 'low' | 'medium' | 'high';
  estimatedSteps?: number;

  /** For plan modifications */
  modification?: {
    action: 'add_task' | 'remove_task' | 'skip_task' | 'reorder' | 'update_task';
    taskName?: string;
    details?: string;
  };

  /** For approvals/rejections */
  feedback?: string;

  /** Raw reasoning from analysis */
  reasoning?: string;
}

export interface ModeState {
  mode: AgentMode;
  enteredAt: Date;
  reason: string;

  // Planning mode state
  pendingPlan?: Plan;
  planApproved?: boolean;

  // Executing mode state
  currentTaskIndex?: number;
  pausedAt?: Date;
  pauseReason?: string;
}

// ============================================================================
// Meta-Tool Types
// ============================================================================

export interface StartPlanningArgs {
  goal: string;
  reasoning: string;
}

export interface ModifyPlanArgs {
  action: 'add_task' | 'remove_task' | 'skip_task' | 'reorder' | 'update_task';
  taskName?: string;
  details: string;
  insertAfter?: string;
}

export interface ReportProgressArgs {
  // No args needed, returns current state
}

export interface RequestApprovalArgs {
  message?: string;
}
