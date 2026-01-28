/**
 * HistoryManager - manages conversation history with compaction
 */

import { ConversationMessage } from '../../domain/entities/AgentState.js';

export interface HistoryManagerConfig {
  /** Max messages to keep in full detail */
  maxDetailedMessages: number;

  /** Strategy for older messages (used in compact()) */
  compressionStrategy: 'summarize' | 'truncate' | 'drop';

  /** For summarize: how many messages per summary */
  summarizeBatchSize: number;

  /** Max total tokens for history (estimated) */
  maxHistoryTokens?: number;

  /** Keep all tool calls/results or summarize them too */
  preserveToolCalls: boolean;

  /**
   * Mode for summarize() method:
   * - 'llm': Use injected summarizer function (requires setSummarizer())
   * - 'truncate': Just truncate old messages (default)
   * - 'hybrid': Try LLM, fall back to truncate on error
   */
  summarizationMode?: 'llm' | 'truncate' | 'hybrid';

  /** Custom system prompt for LLM summarization */
  summarizationPrompt?: string;
}

export const DEFAULT_HISTORY_CONFIG: HistoryManagerConfig = {
  maxDetailedMessages: 20,
  compressionStrategy: 'summarize',
  summarizeBatchSize: 10,
  preserveToolCalls: true,
  summarizationMode: 'truncate',
};

/**
 * Default prompt for LLM-based summarization
 */
export const DEFAULT_SUMMARIZATION_PROMPT = `Summarize the following conversation concisely, preserving:
1. Key decisions and outcomes
2. Important data/values mentioned
3. Any errors or failures and their resolutions
4. Critical context needed for future tasks

Keep the summary under 500 tokens. Focus on information that would be needed to continue the conversation.`;

/**
 * Function type for external summarizer (injected by TaskAgent)
 */
export type SummarizerFunction = (messages: ConversationMessage[]) => Promise<string>;

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
  private summarizer?: SummarizerFunction;

  constructor(config: Partial<HistoryManagerConfig> = {}) {
    this.config = { ...DEFAULT_HISTORY_CONFIG, ...config };
  }

  /**
   * Set the summarizer function (typically injected by TaskAgent)
   *
   * @param fn - Function that takes messages and returns a summary string
   */
  setSummarizer(fn: SummarizerFunction): void {
    this.summarizer = fn;
  }

  /**
   * Check if summarizer is configured
   */
  hasSummarizer(): boolean {
    return !!this.summarizer;
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
   * Summarize history using configured mode
   *
   * Modes:
   * - 'truncate': Just truncate old messages (fast, no LLM)
   * - 'llm': Use injected summarizer (requires setSummarizer())
   * - 'hybrid': Try LLM, fall back to truncate on error
   */
  async summarize(): Promise<void> {
    const mode = this.config.summarizationMode ?? 'truncate';

    if (mode === 'truncate') {
      this.compact();
      return;
    }

    if (mode === 'llm' || mode === 'hybrid') {
      if (!this.summarizer) {
        if (mode === 'hybrid') {
          // Fallback to truncate
          this.compact();
          return;
        }
        throw new Error('Summarizer not configured. Call setSummarizer() first.');
      }

      try {
        await this.summarizeWithLLM();
      } catch (error) {
        if (mode === 'hybrid') {
          console.warn('LLM summarization failed, falling back to truncate:', error);
          this.compact();
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Perform LLM-based summarization on oldest messages
   * @internal
   */
  private async summarizeWithLLM(): Promise<void> {
    if (!this.summarizer || this.messages.length < this.config.summarizeBatchSize) {
      return;
    }

    // Get oldest messages to summarize
    const toSummarize = this.messages.slice(0, this.config.summarizeBatchSize);
    const toKeep = this.messages.slice(this.config.summarizeBatchSize);

    // Call summarizer to get summary
    const summary = await this.summarizer(toSummarize);

    // Store summary and update messages
    this.summaries.push({
      content: summary,
      coversMessages: toSummarize.length,
      timestamp: Date.now(),
    });

    this.messages = toKeep;
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
