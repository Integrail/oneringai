/**
 * ConversationHistoryManager - Default implementation of IHistoryManager
 *
 * Features:
 * - Pluggable storage via IHistoryStorage interface
 * - Event emission for all operations
 * - Configurable compaction strategies
 * - Token-aware context formatting
 */

import { EventEmitter } from 'eventemitter3';
import { randomUUID } from 'crypto';
import type {
  IHistoryManager,
  IHistoryStorage,
  HistoryMessage,
  IHistoryManagerConfig,
  HistoryManagerEvents,
  SerializedHistoryState,
} from '../../domain/interfaces/IHistoryManager.js';
import { DEFAULT_HISTORY_MANAGER_CONFIG } from '../../domain/interfaces/IHistoryManager.js';
import { InMemoryHistoryStorage } from '../../infrastructure/storage/InMemoryHistoryStorage.js';

/**
 * Configuration for ConversationHistoryManager
 */
export interface ConversationHistoryManagerConfig extends IHistoryManagerConfig {
  /** Storage backend (defaults to in-memory) */
  storage?: IHistoryStorage;
}

/**
 * Default conversation history manager implementation
 */
export class ConversationHistoryManager
  extends EventEmitter<HistoryManagerEvents>
  implements IHistoryManager
{
  private storage: IHistoryStorage;
  private config: Required<IHistoryManagerConfig>;

  constructor(config: ConversationHistoryManagerConfig = {}) {
    super();
    this.storage = config.storage ?? new InMemoryHistoryStorage();
    this.config = {
      ...DEFAULT_HISTORY_MANAGER_CONFIG,
      ...config,
    };
  }

  /**
   * Add a message to history
   */
  async addMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<HistoryMessage> {
    const message: HistoryMessage = {
      id: randomUUID(),
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };

    await this.storage.addMessage(message);
    this.emit('message:added', { message });

    // Check if compaction needed
    const count = await this.storage.getCount();
    if (count > this.config.maxMessages) {
      await this.compact();
    }

    return message;
  }

  /**
   * Get all messages
   */
  async getMessages(): Promise<HistoryMessage[]> {
    return this.storage.getMessages();
  }

  /**
   * Get recent messages
   */
  async getRecentMessages(count?: number): Promise<HistoryMessage[]> {
    const limit = count ?? this.config.preserveRecentCount;
    return this.storage.getRecentMessages(limit);
  }

  /**
   * Format history for LLM context
   */
  async formatForContext(options?: {
    maxTokens?: number;
    includeMetadata?: boolean;
  }): Promise<string> {
    const maxTokens = options?.maxTokens ?? this.config.maxTokens;
    const messages = await this.storage.getMessages();

    if (messages.length === 0) {
      return '';
    }

    // Build context string, respecting token limit
    const parts: string[] = [];
    let estimatedTokens = 0;
    const headerTokens = 50; // Reserve for header

    // Start from most recent, work backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      const roleLabel = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
      const line = `**${roleLabel}**: ${msg.content}`;
      const lineTokens = Math.ceil(line.length / 4);

      if (estimatedTokens + lineTokens + headerTokens > maxTokens) {
        break;
      }

      parts.unshift(line);
      estimatedTokens += lineTokens;
    }

    if (parts.length === 0) {
      return '';
    }

    return `## Conversation History\n\n${parts.join('\n\n')}`;
  }

  /**
   * Compact history based on strategy
   */
  async compact(): Promise<void> {
    const count = await this.storage.getCount();
    if (count <= this.config.maxMessages) {
      return;
    }

    const toRemove = count - this.config.maxMessages + this.config.preserveRecentCount;

    switch (this.config.compactionStrategy) {
      case 'truncate':
      case 'sliding-window': {
        // Remove oldest messages, keeping recent ones
        const messages = await this.storage.getMessages();
        const cutoffIndex = Math.min(toRemove, messages.length - this.config.preserveRecentCount);
        const cutoffMsg = cutoffIndex > 0 ? messages[cutoffIndex - 1] : undefined;

        if (cutoffMsg) {
          const cutoffTimestamp = cutoffMsg.timestamp + 1;
          const removed = await this.storage.removeOlderThan(cutoffTimestamp);
          this.emit('history:compacted', { removedCount: removed, strategy: this.config.compactionStrategy });
        }
        break;
      }

      case 'summarize': {
        // TODO: Would need LLM access for summarization
        // For now, fall back to truncate
        const messages = await this.storage.getMessages();
        const cutoffIndex = Math.min(toRemove, messages.length - this.config.preserveRecentCount);
        const cutoffMsg = cutoffIndex > 0 ? messages[cutoffIndex - 1] : undefined;

        if (cutoffMsg) {
          const cutoffTimestamp = cutoffMsg.timestamp + 1;
          const removed = await this.storage.removeOlderThan(cutoffTimestamp);
          this.emit('history:compacted', { removedCount: removed, strategy: 'truncate' });
        }
        break;
      }
    }
  }

  /**
   * Clear all history
   */
  async clear(): Promise<void> {
    await this.storage.clear();
    this.emit('history:cleared', {});
  }

  /**
   * Get message count
   */
  async getMessageCount(): Promise<number> {
    return this.storage.getCount();
  }

  /**
   * Get state for persistence
   */
  async getState(): Promise<SerializedHistoryState> {
    return this.storage.getState();
  }

  /**
   * Restore from saved state
   */
  async restoreState(state: SerializedHistoryState): Promise<void> {
    await this.storage.restoreState(state);
    const count = await this.storage.getCount();
    this.emit('history:restored', { messageCount: count });
  }

  /**
   * Get configuration
   */
  getConfig(): IHistoryManagerConfig {
    return { ...this.config };
  }
}
