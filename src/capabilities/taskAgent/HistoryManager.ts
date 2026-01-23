/**
 * HistoryManager - manages conversation history with compaction
 */

import { ConversationMessage } from '../../domain/entities/AgentState.js';

export interface HistoryManagerConfig {
  /** Max messages to keep in full detail */
  maxDetailedMessages: number;

  /** Strategy for older messages */
  compressionStrategy: 'summarize' | 'truncate' | 'drop';

  /** For summarize: how many messages per summary */
  summarizeBatchSize: number;

  /** Max total tokens for history (estimated) */
  maxHistoryTokens?: number;

  /** Keep all tool calls/results or summarize them too */
  preserveToolCalls: boolean;
}

export const DEFAULT_HISTORY_CONFIG: HistoryManagerConfig = {
  maxDetailedMessages: 20,
  compressionStrategy: 'summarize',
  summarizeBatchSize: 10,
  preserveToolCalls: true,
};

/**
 * Manages conversation history with automatic compaction
 */
export class HistoryManager {
  private messages: ConversationMessage[] = [];
  private summaries: Array<{
    content: string;
    coversMessages: number;
    timestamp: number;
  }> = [];
  private config: HistoryManagerConfig;

  constructor(config: HistoryManagerConfig = DEFAULT_HISTORY_CONFIG) {
    this.config = config;
  }

  /**
   * Add a message to history
   */
  addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // Auto-compact if over limit
    if (this.messages.length > this.config.maxDetailedMessages) {
      this.compact();
    }
  }

  /**
   * Get all messages (including summaries as system messages)
   */
  getMessages(): ConversationMessage[] {
    const result: ConversationMessage[] = [];

    // Add summaries as system messages
    for (const summary of this.summaries) {
      result.push({
        role: 'system',
        content: `[Summary of previous conversation]\n${summary.content}`,
        timestamp: summary.timestamp,
      });
    }

    // Add recent messages
    result.push(...this.messages);

    return result;
  }

  /**
   * Get recent messages only (no summaries)
   */
  getRecentMessages(): ConversationMessage[] {
    return [...this.messages];
  }

  /**
   * Compact history (summarize or truncate old messages)
   */
  private compact(): void {
    if (this.config.compressionStrategy === 'truncate') {
      // Keep only recent messages
      const toRemove = this.messages.length - this.config.maxDetailedMessages;
      this.messages = this.messages.slice(toRemove);
    } else if (this.config.compressionStrategy === 'drop') {
      // Drop oldest messages
      const toKeep = this.config.maxDetailedMessages;
      this.messages = this.messages.slice(-toKeep);
    }
    // For 'summarize', would need LLM call - placeholder for now
  }

  /**
   * Summarize history (requires LLM - placeholder)
   */
  async summarize(): Promise<void> {
    // TODO: Implement LLM-based summarization
    // For now, just compact using truncate strategy
    this.compact();
  }

  /**
   * Truncate messages to a limit
   */
  async truncate(messages: ConversationMessage[], limit: number): Promise<ConversationMessage[]> {
    return messages.slice(-limit);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.messages = [];
    this.summaries = [];
  }

  /**
   * Get total message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get history state for persistence
   */
  getState(): { messages: ConversationMessage[]; summaries: Array<{ content: string; coversMessages: number; timestamp: number }> } {
    return {
      messages: [...this.messages],
      summaries: [...this.summaries],
    };
  }

  /**
   * Restore history from state
   */
  restoreState(state: { messages: ConversationMessage[]; summaries: Array<{ content: string; coversMessages: number; timestamp: number }> }): void {
    this.messages = [...state.messages];
    this.summaries = [...state.summaries];
  }
}
