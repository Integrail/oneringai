/**
 * InMemoryHistoryStorage - In-memory implementation of IHistoryStorage
 *
 * Default storage backend for conversation history.
 * For production, users can implement IHistoryStorage with Redis, PostgreSQL, etc.
 */

import type {
  IHistoryStorage,
  HistoryMessage,
  SerializedHistoryState,
} from '../../domain/interfaces/IHistoryManager.js';

/**
 * In-memory history storage implementation
 */
export class InMemoryHistoryStorage implements IHistoryStorage {
  private messages: HistoryMessage[] = [];
  private summaries: Array<{ content: string; coversCount: number; timestamp: number }> = [];

  async addMessage(message: HistoryMessage): Promise<void> {
    this.messages.push(message);
  }

  async getMessages(): Promise<HistoryMessage[]> {
    return [...this.messages];
  }

  async getRecentMessages(count: number): Promise<HistoryMessage[]> {
    return this.messages.slice(-count);
  }

  async removeMessage(id: string): Promise<void> {
    const index = this.messages.findIndex(m => m.id === id);
    if (index >= 0) {
      this.messages.splice(index, 1);
    }
  }

  async removeOlderThan(timestamp: number): Promise<number> {
    const originalLength = this.messages.length;
    this.messages = this.messages.filter(m => m.timestamp >= timestamp);
    return originalLength - this.messages.length;
  }

  async clear(): Promise<void> {
    this.messages = [];
    this.summaries = [];
  }

  async getCount(): Promise<number> {
    return this.messages.length;
  }

  async getState(): Promise<SerializedHistoryState> {
    return {
      version: 1,
      messages: [...this.messages],
      summaries: [...this.summaries],
    };
  }

  async restoreState(state: SerializedHistoryState): Promise<void> {
    this.messages = [...state.messages];
    this.summaries = state.summaries ? [...state.summaries] : [];
  }
}
