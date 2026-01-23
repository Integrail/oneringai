/**
 * Agent state entities for TaskAgent
 *
 * Defines the full agent state needed for persistence and resume.
 */

import { Plan } from './Task.js';

/**
 * Agent execution status
 */
export type AgentStatus =
  | 'idle'         // Created but not started
  | 'running'      // Actively executing
  | 'suspended'    // Paused, can be resumed
  | 'completed'    // Plan finished successfully
  | 'failed'       // Plan failed
  | 'cancelled';   // Manually cancelled

/**
 * Agent configuration (needed for resume)
 */
export interface AgentConfig {
  connectorName: string;
  model: string;
  temperature?: number;
  maxIterations?: number;
  toolNames: string[];            // Tool registry keys
}

/**
 * Conversation message in history
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * Agent execution metrics
 */
export interface AgentMetrics {
  totalLLMCalls: number;
  totalToolCalls: number;
  totalTokensUsed: number;
  totalCost: number;
}

/**
 * Full agent state - everything needed to resume
 */
export interface AgentState {
  id: string;                     // Unique agent instance ID
  status: AgentStatus;

  /** Configuration */
  config: AgentConfig;

  /** Current plan */
  plan: Plan;

  /** Working memory reference */
  memoryId: string;

  /** Conversation history (for context continuity) */
  conversationHistory: ConversationMessage[];

  /** Timestamps */
  createdAt: number;
  startedAt?: number;
  suspendedAt?: number;
  completedAt?: number;
  lastActivityAt: number;

  /** Metrics */
  metrics: AgentMetrics;
}

/**
 * Create initial agent state
 */
export function createAgentState(id: string, config: AgentConfig, plan: Plan): AgentState {
  const now = Date.now();

  return {
    id,
    status: 'idle',
    config,
    plan,
    memoryId: `memory-${id}`,
    conversationHistory: [],
    createdAt: now,
    lastActivityAt: now,
    metrics: {
      totalLLMCalls: 0,
      totalToolCalls: 0,
      totalTokensUsed: 0,
      totalCost: 0,
    },
  };
}

/**
 * Update agent state status
 */
export function updateAgentStatus(state: AgentState, status: AgentStatus): AgentState {
  const now = Date.now();

  const updated: AgentState = {
    ...state,
    status,
    lastActivityAt: now,
  };

  // Set timestamps based on status
  if (status === 'running' && !updated.startedAt) {
    updated.startedAt = now;
  }

  if (status === 'suspended' && !updated.suspendedAt) {
    updated.suspendedAt = now;
  }

  if ((status === 'completed' || status === 'failed' || status === 'cancelled') && !updated.completedAt) {
    updated.completedAt = now;
  }

  return updated;
}
