/**
 * Agent state storage interface for full agent state persistence.
 * Required for resume capability.
 */

import { AgentState, AgentStatus } from '../entities/AgentState.js';

export interface IAgentStateStorage {
  /**
   * Save agent state
   */
  save(state: AgentState): Promise<void>;

  /**
   * Load agent state
   */
  load(agentId: string): Promise<AgentState | undefined>;

  /**
   * Delete agent state
   */
  delete(agentId: string): Promise<void>;

  /**
   * List agents by status
   */
  list(filter?: { status?: AgentStatus[] }): Promise<AgentState[]>;

  /**
   * Update specific fields (partial update for efficiency)
   */
  patch(agentId: string, updates: Partial<AgentState>): Promise<void>;
}
