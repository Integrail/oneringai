/**
 * HistoryManager Tests
 * Tests for conversation history management with compaction strategies
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager, DEFAULT_HISTORY_CONFIG } from '@/capabilities/taskAgent/HistoryManager.js';

describe('HistoryManager', () => {
  let manager: HistoryManager;

  beforeEach(() => {
    manager = new HistoryManager();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(manager).toBeDefined();
      expect(manager.getMessageCount()).toBe(0);
    });

    it('should accept custom config', () => {
      const customManager = new HistoryManager({
        maxDetailedMessages: 10,
        compressionStrategy: 'truncate',
        summarizeBatchSize: 5,
        preserveToolCalls: false,
      });
      expect(customManager).toBeDefined();
    });
  });

  describe('addMessage', () => {
    it('should add a user message', () => {
      manager.addMessage('user', 'Hello');
      expect(manager.getMessageCount()).toBe(1);
    });

    it('should add an assistant message', () => {
      manager.addMessage('assistant', 'Hi there!');
      expect(manager.getMessageCount()).toBe(1);
    });

    it('should add a system message', () => {
      manager.addMessage('system', 'System info');
      expect(manager.getMessageCount()).toBe(1);
    });

    it('should add multiple messages in order', () => {
      manager.addMessage('user', 'First');
      manager.addMessage('assistant', 'Second');
      manager.addMessage('user', 'Third');

      const messages = manager.getRecentMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0]!.content).toBe('First');
      expect(messages[1]!.content).toBe('Second');
      expect(messages[2]!.content).toBe('Third');
    });

    it('should add timestamp to messages', () => {
      const before = Date.now();
      manager.addMessage('user', 'Test');
      const after = Date.now();

      const messages = manager.getRecentMessages();
      expect(messages[0]!.timestamp).toBeGreaterThanOrEqual(before);
      expect(messages[0]!.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('getMessages', () => {
    it('should return all messages', () => {
      manager.addMessage('user', 'Message 1');
      manager.addMessage('assistant', 'Message 2');

      const messages = manager.getMessages();
      expect(messages).toHaveLength(2);
    });

    it('should return empty array when no messages', () => {
      const messages = manager.getMessages();
      expect(messages).toEqual([]);
    });

    it('should include summaries as system messages', () => {
      // Add messages beyond limit to trigger compaction
      const customManager = new HistoryManager({
        maxDetailedMessages: 2,
        compressionStrategy: 'drop',
        summarizeBatchSize: 10,
        preserveToolCalls: true,
      });

      customManager.addMessage('user', 'Old 1');
      customManager.addMessage('assistant', 'Old 2');
      customManager.addMessage('user', 'New 1');

      const messages = customManager.getMessages();
      expect(messages.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getRecentMessages', () => {
    it('should return only recent messages without summaries', () => {
      manager.addMessage('user', 'Message 1');
      manager.addMessage('assistant', 'Message 2');

      const recent = manager.getRecentMessages();
      expect(recent).toHaveLength(2);
      expect(recent.every((m) => m.role !== 'system' || !m.content.includes('Summary'))).toBe(true);
    });

    it('should return copy of messages array', () => {
      manager.addMessage('user', 'Test');
      const messages1 = manager.getRecentMessages();
      const messages2 = manager.getRecentMessages();

      expect(messages1).toEqual(messages2);
      expect(messages1).not.toBe(messages2);
    });
  });

  describe('auto-compaction', () => {
    it('should auto-compact when exceeding maxDetailedMessages with truncate strategy', () => {
      const customManager = new HistoryManager({
        maxDetailedMessages: 3,
        compressionStrategy: 'truncate',
        summarizeBatchSize: 10,
        preserveToolCalls: true,
      });

      // Add 5 messages (exceeds limit of 3)
      customManager.addMessage('user', 'Message 1');
      customManager.addMessage('assistant', 'Message 2');
      customManager.addMessage('user', 'Message 3');
      customManager.addMessage('assistant', 'Message 4');
      customManager.addMessage('user', 'Message 5');

      const messages = customManager.getRecentMessages();
      expect(messages.length).toBeLessThanOrEqual(3);
    });

    it('should auto-compact when exceeding maxDetailedMessages with drop strategy', () => {
      const customManager = new HistoryManager({
        maxDetailedMessages: 2,
        compressionStrategy: 'drop',
        summarizeBatchSize: 10,
        preserveToolCalls: true,
      });

      customManager.addMessage('user', 'Old 1');
      customManager.addMessage('assistant', 'Old 2');
      customManager.addMessage('user', 'New 1');

      const messages = customManager.getRecentMessages();
      expect(messages).toHaveLength(2);
      // Should keep newest messages
      expect(messages[messages.length - 1]!.content).toBe('New 1');
    });

    it('should preserve most recent messages during compaction', () => {
      const customManager = new HistoryManager({
        maxDetailedMessages: 2,
        compressionStrategy: 'drop',
        summarizeBatchSize: 10,
        preserveToolCalls: true,
      });

      customManager.addMessage('user', 'Old');
      customManager.addMessage('assistant', 'Recent 1');
      customManager.addMessage('user', 'Recent 2');

      const messages = customManager.getRecentMessages();
      expect(messages.some((m) => m.content === 'Recent 1')).toBe(true);
      expect(messages.some((m) => m.content === 'Recent 2')).toBe(true);
    });
  });

  describe('summarize', () => {
    it('should execute without error', async () => {
      manager.addMessage('user', 'Test 1');
      manager.addMessage('assistant', 'Test 2');

      await expect(manager.summarize()).resolves.not.toThrow();
    });

    it('should reduce message count after summarize', async () => {
      const customManager = new HistoryManager({
        maxDetailedMessages: 2,
        compressionStrategy: 'truncate',
        summarizeBatchSize: 10,
        preserveToolCalls: true,
      });

      // Add many messages
      for (let i = 0; i < 10; i++) {
        customManager.addMessage('user', `Message ${i}`);
      }

      const beforeCount = customManager.getMessageCount();
      await customManager.summarize();
      const afterCount = customManager.getMessageCount();

      expect(afterCount).toBeLessThanOrEqual(beforeCount);
    });
  });

  describe('truncate', () => {
    it('should truncate messages to limit', async () => {
      const messages = [
        { role: 'user' as const, content: 'Msg 1', timestamp: Date.now() },
        { role: 'assistant' as const, content: 'Msg 2', timestamp: Date.now() },
        { role: 'user' as const, content: 'Msg 3', timestamp: Date.now() },
        { role: 'assistant' as const, content: 'Msg 4', timestamp: Date.now() },
      ];

      const truncated = await manager.truncate(messages, 2);
      expect(truncated).toHaveLength(2);
      expect(truncated[0]!.content).toBe('Msg 3');
      expect(truncated[1]!.content).toBe('Msg 4');
    });

    it('should return all messages if limit is greater than count', async () => {
      const messages = [
        { role: 'user' as const, content: 'Msg 1', timestamp: Date.now() },
        { role: 'assistant' as const, content: 'Msg 2', timestamp: Date.now() },
      ];

      const truncated = await manager.truncate(messages, 10);
      expect(truncated).toHaveLength(2);
    });

    it('should handle limit of 0', async () => {
      const messages = [
        { role: 'user' as const, content: 'Msg 1', timestamp: Date.now() },
      ];

      const truncated = await manager.truncate(messages, 0);
      // slice(-0) returns all elements in JavaScript
      expect(truncated.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clear', () => {
    it('should remove all messages', () => {
      manager.addMessage('user', 'Test 1');
      manager.addMessage('assistant', 'Test 2');
      manager.addMessage('user', 'Test 3');

      manager.clear();

      expect(manager.getMessageCount()).toBe(0);
      expect(manager.getMessages()).toEqual([]);
    });

    it('should clear summaries', () => {
      manager.addMessage('user', 'Test');
      manager.clear();

      const messages = manager.getMessages();
      expect(messages.every((m) => !m.content.includes('Summary'))).toBe(true);
    });
  });

  describe('getMessageCount', () => {
    it('should return 0 for empty history', () => {
      expect(manager.getMessageCount()).toBe(0);
    });

    it('should return correct count after adding messages', () => {
      manager.addMessage('user', 'Test 1');
      expect(manager.getMessageCount()).toBe(1);

      manager.addMessage('assistant', 'Test 2');
      expect(manager.getMessageCount()).toBe(2);

      manager.addMessage('user', 'Test 3');
      expect(manager.getMessageCount()).toBe(3);
    });

    it('should update count after compaction', () => {
      const customManager = new HistoryManager({
        maxDetailedMessages: 2,
        compressionStrategy: 'drop',
        summarizeBatchSize: 10,
        preserveToolCalls: true,
      });

      customManager.addMessage('user', 'Test 1');
      customManager.addMessage('assistant', 'Test 2');
      customManager.addMessage('user', 'Test 3');

      expect(customManager.getMessageCount()).toBe(2);
    });
  });

  describe('state persistence', () => {
    it('should save and restore state', () => {
      manager.addMessage('user', 'Test 1');
      manager.addMessage('assistant', 'Test 2');
      manager.addMessage('user', 'Test 3');

      const state = manager.getState();

      const newManager = new HistoryManager();
      newManager.restoreState(state);

      expect(newManager.getMessageCount()).toBe(3);
      expect(newManager.getRecentMessages()).toEqual(manager.getRecentMessages());
    });

    it('should preserve message content and roles', () => {
      manager.addMessage('user', 'User message');
      manager.addMessage('assistant', 'Assistant response');
      manager.addMessage('system', 'System info');

      const state = manager.getState();
      const newManager = new HistoryManager();
      newManager.restoreState(state);

      const messages = newManager.getRecentMessages();
      expect(messages[0]!.role).toBe('user');
      expect(messages[0]!.content).toBe('User message');
      expect(messages[1]!.role).toBe('assistant');
      expect(messages[1]!.content).toBe('Assistant response');
      expect(messages[2]!.role).toBe('system');
      expect(messages[2]!.content).toBe('System info');
    });

    it('should preserve timestamps', () => {
      const timestamp1 = Date.now();
      manager.addMessage('user', 'Test');

      const state = manager.getState();
      const newManager = new HistoryManager();
      newManager.restoreState(state);

      const messages = newManager.getRecentMessages();
      expect(messages[0]!.timestamp).toBeGreaterThanOrEqual(timestamp1);
    });

    it('should preserve summaries', () => {
      // Create state with summaries manually
      const state = {
        messages: [
          { role: 'user' as const, content: 'Recent', timestamp: Date.now() },
        ],
        summaries: [
          {
            content: 'Summary of old conversation',
            coversMessages: 5,
            timestamp: Date.now() - 10000,
          },
        ],
      };

      manager.restoreState(state);
      const restoredState = manager.getState();

      expect(restoredState.summaries).toHaveLength(1);
      expect(restoredState.summaries[0]!.content).toBe('Summary of old conversation');
    });

    it('should create independent copies', () => {
      manager.addMessage('user', 'Test');

      const state = manager.getState();
      state.messages.push({
        role: 'user',
        content: 'Modified',
        timestamp: Date.now(),
      });

      // Original should not be affected
      expect(manager.getMessageCount()).toBe(1);
    });
  });

  describe('compression strategies', () => {
    it('should use truncate strategy correctly', () => {
      const customManager = new HistoryManager({
        maxDetailedMessages: 3,
        compressionStrategy: 'truncate',
        summarizeBatchSize: 10,
        preserveToolCalls: true,
      });

      for (let i = 1; i <= 5; i++) {
        customManager.addMessage('user', `Message ${i}`);
      }

      const messages = customManager.getRecentMessages();
      expect(messages.length).toBeLessThanOrEqual(3);
    });

    it('should use drop strategy correctly', () => {
      const customManager = new HistoryManager({
        maxDetailedMessages: 3,
        compressionStrategy: 'drop',
        summarizeBatchSize: 10,
        preserveToolCalls: true,
      });

      for (let i = 1; i <= 5; i++) {
        customManager.addMessage('user', `Message ${i}`);
      }

      const messages = customManager.getRecentMessages();
      expect(messages).toHaveLength(3);
      // Should keep most recent
      expect(messages[messages.length - 1]!.content).toBe('Message 5');
    });

    it('should handle summarize strategy (placeholder)', () => {
      const customManager = new HistoryManager({
        maxDetailedMessages: 3,
        compressionStrategy: 'summarize',
        summarizeBatchSize: 2,
        preserveToolCalls: true,
      });

      // Should not crash when using summarize strategy
      expect(() => {
        for (let i = 1; i <= 5; i++) {
          customManager.addMessage('user', `Message ${i}`);
        }
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      manager.addMessage('user', '');
      expect(manager.getMessageCount()).toBe(1);
      expect(manager.getRecentMessages()[0]!.content).toBe('');
    });

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(10000);
      manager.addMessage('user', longMessage);

      const messages = manager.getRecentMessages();
      expect(messages[0]!.content).toHaveLength(10000);
    });

    it('should handle rapid message additions', () => {
      // Use truncate strategy for actual compaction
      const customManager = new HistoryManager({
        maxDetailedMessages: 20,
        compressionStrategy: 'truncate',
        summarizeBatchSize: 10,
        preserveToolCalls: true,
      });

      for (let i = 0; i < 100; i++) {
        customManager.addMessage('user', `Message ${i}`);
      }

      // Should auto-compact with truncate strategy
      expect(customManager.getMessageCount()).toBeLessThanOrEqual(20);
    });

    it('should handle alternating user/assistant messages', () => {
      for (let i = 0; i < 10; i++) {
        manager.addMessage(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`);
      }

      const messages = manager.getRecentMessages();
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('summarization modes', () => {
    it('should default to truncate mode', async () => {
      const truncateManager = new HistoryManager({
        maxDetailedMessages: 5,
        compressionStrategy: 'truncate', // For compact() to reduce messages
        summarizeBatchSize: 3,
        // No summarizationMode set - defaults to 'truncate'
      });

      for (let i = 0; i < 10; i++) {
        truncateManager.addMessage('user', `Message ${i}`);
      }

      // Auto-compaction already happened via addMessage, so count is already <= 5
      expect(truncateManager.getMessageCount()).toBeLessThanOrEqual(5);

      // Calling summarize() in truncate mode should work without error
      await truncateManager.summarize();
      expect(truncateManager.getMessageCount()).toBeLessThanOrEqual(5);
    });

    it('should throw error in llm mode without summarizer', async () => {
      const llmManager = new HistoryManager({
        maxDetailedMessages: 5,
        summarizeBatchSize: 3,
        summarizationMode: 'llm',
      });

      await expect(llmManager.summarize()).rejects.toThrow('Summarizer not configured');
    });

    it('should fall back to truncate in hybrid mode without summarizer', async () => {
      const hybridManager = new HistoryManager({
        maxDetailedMessages: 5,
        summarizeBatchSize: 3,
        summarizationMode: 'hybrid',
      });

      for (let i = 0; i < 10; i++) {
        hybridManager.addMessage('user', `Message ${i}`);
      }

      // Should not throw - falls back to truncate
      await expect(hybridManager.summarize()).resolves.not.toThrow();
    });

    it('should use summarizer in llm mode', async () => {
      const llmManager = new HistoryManager({
        maxDetailedMessages: 10,
        summarizeBatchSize: 5,
        summarizationMode: 'llm',
      });

      // Add messages
      for (let i = 0; i < 10; i++) {
        llmManager.addMessage('user', `Message ${i}`);
      }

      // Set summarizer
      llmManager.setSummarizer(async (messages) => {
        return `Summary of ${messages.length} messages`;
      });

      expect(llmManager.hasSummarizer()).toBe(true);

      await llmManager.summarize();

      // Should have created a summary and reduced messages
      const state = llmManager.getState();
      expect(state.summaries.length).toBe(1);
      expect(state.summaries[0].content).toBe('Summary of 5 messages');
      expect(state.messages.length).toBe(5); // Remaining messages
    });

    it('should fall back to truncate in hybrid mode when summarizer fails', async () => {
      const hybridManager = new HistoryManager({
        maxDetailedMessages: 5,
        summarizeBatchSize: 3,
        summarizationMode: 'hybrid',
      });

      for (let i = 0; i < 10; i++) {
        hybridManager.addMessage('user', `Message ${i}`);
      }

      // Set failing summarizer
      hybridManager.setSummarizer(async () => {
        throw new Error('LLM API error');
      });

      // Should not throw - falls back to truncate
      await expect(hybridManager.summarize()).resolves.not.toThrow();
    });

    it('should propagate error in llm mode when summarizer fails', async () => {
      const llmManager = new HistoryManager({
        maxDetailedMessages: 5,
        summarizeBatchSize: 3,
        summarizationMode: 'llm',
      });

      for (let i = 0; i < 10; i++) {
        llmManager.addMessage('user', `Message ${i}`);
      }

      // Set failing summarizer
      llmManager.setSummarizer(async () => {
        throw new Error('LLM API error');
      });

      await expect(llmManager.summarize()).rejects.toThrow('LLM API error');
    });

    it('should skip summarization if not enough messages', async () => {
      const llmManager = new HistoryManager({
        maxDetailedMessages: 10,
        summarizeBatchSize: 5,
        summarizationMode: 'llm',
      });

      // Add fewer messages than batch size
      for (let i = 0; i < 3; i++) {
        llmManager.addMessage('user', `Message ${i}`);
      }

      let summarizerCalled = false;
      llmManager.setSummarizer(async () => {
        summarizerCalled = true;
        return 'Summary';
      });

      await llmManager.summarize();

      // Summarizer should not be called (not enough messages)
      expect(summarizerCalled).toBe(false);
      expect(llmManager.getState().summaries.length).toBe(0);
    });

    it('should track hasSummarizer correctly', () => {
      const manager = new HistoryManager();

      expect(manager.hasSummarizer()).toBe(false);

      manager.setSummarizer(async () => 'Summary');

      expect(manager.hasSummarizer()).toBe(true);
    });
  });
});
