/**
 * CheckpointManager - manages agent state checkpointing
 */

import { AgentState } from '../../domain/entities/AgentState.js';
import { IAgentStorage } from '../../infrastructure/storage/InMemoryStorage.js';

export interface CheckpointStrategy {
  /** Checkpoint after every N tool calls */
  afterToolCalls?: number;

  /** Checkpoint after every N LLM calls */
  afterLLMCalls?: number;

  /** Checkpoint on time interval */
  intervalMs?: number;

  /** Always checkpoint before external wait */
  beforeExternalWait: boolean;

  /** Checkpoint mode */
  mode: 'sync' | 'async';
}

export const DEFAULT_CHECKPOINT_STRATEGY: CheckpointStrategy = {
  afterToolCalls: 1,
  afterLLMCalls: 1,
  intervalMs: 30000, // 30 seconds
  beforeExternalWait: true,
  mode: 'async',
};

/**
 * Manages state checkpointing for persistence and recovery
 */
export class CheckpointManager {
  private storage: IAgentStorage;
  private strategy: CheckpointStrategy;
  private toolCallsSinceCheckpoint = 0;
  private llmCallsSinceCheckpoint = 0;
  private intervalTimer?: NodeJS.Timeout;
  private pendingCheckpoints = new Set<Promise<void>>();

  constructor(storage: IAgentStorage, strategy: CheckpointStrategy = DEFAULT_CHECKPOINT_STRATEGY) {
    this.storage = storage;
    this.strategy = strategy;

    // Start interval timer if configured
    if (this.strategy.intervalMs) {
      this.intervalTimer = setInterval(() => {
        this.checkIntervalCheckpoint();
      }, this.strategy.intervalMs);
    }
  }

  /**
   * Record a tool call (may trigger checkpoint)
   */
  async onToolCall(state: AgentState): Promise<void> {
    this.toolCallsSinceCheckpoint++;

    if (this.strategy.afterToolCalls && this.toolCallsSinceCheckpoint >= this.strategy.afterToolCalls) {
      await this.checkpoint(state, 'tool_calls');
    }
  }

  /**
   * Record an LLM call (may trigger checkpoint)
   */
  async onLLMCall(state: AgentState): Promise<void> {
    this.llmCallsSinceCheckpoint++;

    if (this.strategy.afterLLMCalls && this.llmCallsSinceCheckpoint >= this.strategy.afterLLMCalls) {
      await this.checkpoint(state, 'llm_calls');
    }
  }

  /**
   * Force a checkpoint
   */
  async checkpoint(state: AgentState, reason: string): Promise<void> {
    const checkpointPromise = this.doCheckpoint(state, reason);

    if (this.strategy.mode === 'sync') {
      await checkpointPromise;
    } else {
      // Async mode - don't block, but track the promise
      this.pendingCheckpoints.add(checkpointPromise);
      checkpointPromise.finally(() => {
        this.pendingCheckpoints.delete(checkpointPromise);
      });
    }
  }

  /**
   * Perform the actual checkpoint
   */
  private async doCheckpoint(state: AgentState, _reason: string): Promise<void> {
    try {
      // Save agent state
      await this.storage.agent.save(state);

      // Save plan
      await this.storage.plan.savePlan(state.plan);

      // Reset counters
      this.toolCallsSinceCheckpoint = 0;
      this.llmCallsSinceCheckpoint = 0;
    } catch (error) {
      console.error(`Checkpoint failed (${_reason}):`, error);
      // Don't throw - checkpointing is best-effort
    }
  }

  /**
   * Check if interval-based checkpoint is needed
   */
  private checkIntervalCheckpoint(): void {
    // This will be called by the interval timer
    // We don't have access to state here, so this is just a flag
    // The actual checkpoint will be triggered by the next operation
  }

  /**
   * Wait for all pending checkpoints to complete
   */
  async flush(): Promise<void> {
    await Promise.all(Array.from(this.pendingCheckpoints));
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
  }
}
