/**
 * HistoryManagement Mock Tests
 *
 * Deterministic tests for history management behavior:
 * - Message adding (async vs sync)
 * - History truncation with preserveRecent
 * - Disabled history feature behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createContextWithFeatures, FEATURE_PRESETS, createMockEstimator } from '../../helpers/contextTestHelpers.js';

// ============================================================================
// Message Adding Tests
// ============================================================================

describe('Message Adding', () => {
  describe('addMessage (async)', () => {
    it('should add user message and return HistoryMessage', async () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

      const msg = await ctx.addMessage('user', 'Hello world');

      expect(msg).not.toBeNull();
      expect(msg!.role).toBe('user');
      expect(msg!.content).toBe('Hello world');
      expect(msg!.id).toBeDefined();
      expect(msg!.timestamp).toBeGreaterThan(0);

      ctx.destroy();
    });

    it('should add assistant message correctly', async () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

      const msg = await ctx.addMessage('assistant', 'Hi there!');

      expect(msg).not.toBeNull();
      expect(msg!.role).toBe('assistant');
      expect(msg!.content).toBe('Hi there!');

      ctx.destroy();
    });

    it('should add system message correctly', async () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

      const msg = await ctx.addMessage('system', 'You are a helpful assistant');

      expect(msg).not.toBeNull();
      expect(msg!.role).toBe('system');
      expect(msg!.content).toBe('You are a helpful assistant');

      ctx.destroy();
    });

    it('should add tool message correctly', async () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

      const msg = await ctx.addMessage('tool', '{"result": "success"}');

      expect(msg).not.toBeNull();
      expect(msg!.role).toBe('tool');
      expect(msg!.content).toBe('{"result": "success"}');

      ctx.destroy();
    });

    it('should emit message:added event', async () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);
      const eventHandler = vi.fn();
      ctx.on('message:added', eventHandler);

      await ctx.addMessage('user', 'Test message');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            role: 'user',
            content: 'Test message',
          }),
        })
      );

      ctx.destroy();
    });

    it('should include metadata in message', async () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

      const msg = await ctx.addMessage('user', 'With metadata', { source: 'test' });

      expect(msg!.metadata).toEqual({ source: 'test' });

      ctx.destroy();
    });

    it('should check capacity for large messages (>1000 tokens)', async () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);
      const ensureCapacitySpy = vi.spyOn(ctx, 'ensureCapacity');

      // Large message (assume 1 char ≈ 0.25 tokens, so 5000 chars ≈ 1250 tokens)
      const largeContent = 'x'.repeat(5000);
      await ctx.addMessage('tool', largeContent);

      expect(ensureCapacitySpy).toHaveBeenCalled();

      ctx.destroy();
    });

    it('should NOT check capacity for small messages', async () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);
      const ensureCapacitySpy = vi.spyOn(ctx, 'ensureCapacity');

      // Small message
      await ctx.addMessage('user', 'Short message');

      expect(ensureCapacitySpy).not.toHaveBeenCalled();

      ctx.destroy();
    });
  });

  describe('addMessageSync (sync)', () => {
    it('should add message synchronously', () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

      const msg = ctx.addMessageSync('user', 'Sync message');

      expect(msg).not.toBeNull();
      expect(msg!.role).toBe('user');
      expect(msg!.content).toBe('Sync message');

      ctx.destroy();
    });

    it('should NOT check capacity for large content', () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);
      const ensureCapacitySpy = vi.spyOn(ctx, 'ensureCapacity');

      // Even large messages don't trigger capacity check in sync mode
      const largeContent = 'x'.repeat(10000);
      ctx.addMessageSync('tool', largeContent);

      expect(ensureCapacitySpy).not.toHaveBeenCalled();

      ctx.destroy();
    });

    it('should emit message:added event', () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);
      const eventHandler = vi.fn();
      ctx.on('message:added', eventHandler);

      ctx.addMessageSync('user', 'Sync event test');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            role: 'user',
            content: 'Sync event test',
          }),
        })
      );

      ctx.destroy();
    });

    it('should include metadata in message', () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

      const msg = ctx.addMessageSync('assistant', 'Response', { model: 'gpt-4' });

      expect(msg!.metadata).toEqual({ model: 'gpt-4' });

      ctx.destroy();
    });
  });

  describe('addToolResult', () => {
    it('should stringify non-string results', async () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

      const result = await ctx.addToolResult({ success: true, data: [1, 2, 3] });

      expect(result).not.toBeNull();
      expect(result!.role).toBe('tool');
      expect(result!.content).toContain('success');

      ctx.destroy();
    });

    it('should add string results directly', async () => {
      const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

      const result = await ctx.addToolResult('Plain text result');

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Plain text result');

      ctx.destroy();
    });
  });
});

// ============================================================================
// History Truncation Tests
// ============================================================================

describe('History Truncation', () => {
  it('should preserve recent messages during compaction', async () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly, {
      history: {
        maxMessages: 100,
        preserveRecent: 3,
      },
    });

    // Add 10 messages
    for (let i = 0; i < 10; i++) {
      ctx.addMessageSync('user', `Message ${i}`);
    }

    // Verify history has 10 messages
    const before = ctx.getHistory();
    expect(before).toHaveLength(10);

    // Trigger compaction via private method (test internal behavior)
    // In real usage, this is triggered by context management
    (ctx as any).compactHistory();

    // Should preserve last 3 messages
    const after = ctx.getHistory();
    expect(after.length).toBeLessThanOrEqual(3);

    // Most recent messages should be preserved
    const lastMessage = after[after.length - 1];
    expect(lastMessage.content).toBe('Message 9');

    ctx.destroy();
  });

  it('should NOT compact if message count is below preserveRecent', async () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly, {
      history: {
        maxMessages: 100,
        preserveRecent: 10,
      },
    });

    // Add only 5 messages (less than preserveRecent)
    for (let i = 0; i < 5; i++) {
      ctx.addMessageSync('user', `Message ${i}`);
    }

    const before = ctx.getHistory();
    expect(before).toHaveLength(5);

    (ctx as any).compactHistory();

    // No compaction should occur
    const after = ctx.getHistory();
    expect(after).toHaveLength(5);

    ctx.destroy();
  });

  it('should emit history:compacted event', async () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly, {
      history: {
        maxMessages: 100,
        preserveRecent: 2,
      },
    });

    const eventHandler = vi.fn();
    ctx.on('history:compacted', eventHandler);

    // Add 5 messages
    for (let i = 0; i < 5; i++) {
      ctx.addMessageSync('user', `Message ${i}`);
    }

    (ctx as any).compactHistory();

    expect(eventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        removedCount: expect.any(Number),
      })
    );
    expect(eventHandler.mock.calls[0][0].removedCount).toBeGreaterThan(0);

    ctx.destroy();
  });

  it('should NOT emit event when no messages are compacted', async () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly, {
      history: {
        maxMessages: 100,
        preserveRecent: 10,
      },
    });

    const eventHandler = vi.fn();
    ctx.on('history:compacted', eventHandler);

    // Add only 3 messages (less than preserveRecent)
    for (let i = 0; i < 3; i++) {
      ctx.addMessageSync('user', `Message ${i}`);
    }

    (ctx as any).compactHistory();

    expect(eventHandler).not.toHaveBeenCalled();

    ctx.destroy();
  });

  it('should clear history completely', async () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

    // Add messages
    ctx.addMessageSync('user', 'Message 1');
    ctx.addMessageSync('assistant', 'Message 2');

    expect(ctx.getHistory()).toHaveLength(2);

    // Clear all
    ctx.clearHistory('test cleanup');

    expect(ctx.getHistory()).toHaveLength(0);

    ctx.destroy();
  });

  it('should emit history:cleared event with reason', async () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);
    const eventHandler = vi.fn();
    ctx.on('history:cleared', eventHandler);

    ctx.addMessageSync('user', 'Message');
    ctx.clearHistory('manual clear');

    expect(eventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'manual clear',
      })
    );

    ctx.destroy();
  });
});

// ============================================================================
// Disabled History Feature Tests
// ============================================================================

describe('Disabled History Feature', () => {
  it('should return null from addMessage when history is disabled', async () => {
    const ctx = createContextWithFeatures({
      ...FEATURE_PRESETS.minimal,
      history: false,
    });

    const result = await ctx.addMessage('user', 'Hello');

    expect(result).toBeNull();

    ctx.destroy();
  });

  it('should return null from addMessageSync when history is disabled', () => {
    const ctx = createContextWithFeatures({
      ...FEATURE_PRESETS.minimal,
      history: false,
    });

    const result = ctx.addMessageSync('user', 'Hello');

    expect(result).toBeNull();

    ctx.destroy();
  });

  it('should return null from addToolResult when history is disabled', async () => {
    const ctx = createContextWithFeatures({
      ...FEATURE_PRESETS.minimal,
      history: false,
    });

    const result = await ctx.addToolResult({ data: 'test' });

    expect(result).toBeNull();

    ctx.destroy();
  });

  it('should NOT emit message:added event when history is disabled', async () => {
    const ctx = createContextWithFeatures({
      ...FEATURE_PRESETS.minimal,
      history: false,
    });

    const eventHandler = vi.fn();
    ctx.on('message:added', eventHandler);

    await ctx.addMessage('user', 'Test');
    ctx.addMessageSync('assistant', 'Response');

    expect(eventHandler).not.toHaveBeenCalled();

    ctx.destroy();
  });

  it('should return empty history when disabled', () => {
    const ctx = createContextWithFeatures({
      ...FEATURE_PRESETS.minimal,
      history: false,
    });

    const history = ctx.getHistory();

    expect(history).toEqual([]);

    ctx.destroy();
  });

  it('should handle clearHistory gracefully when disabled', () => {
    const ctx = createContextWithFeatures({
      ...FEATURE_PRESETS.minimal,
      history: false,
    });

    // Should not throw
    expect(() => ctx.clearHistory()).not.toThrow();

    ctx.destroy();
  });
});

// ============================================================================
// History Retrieval Tests
// ============================================================================

describe('History Retrieval', () => {
  it('should return messages in order', () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

    ctx.addMessageSync('user', 'First');
    ctx.addMessageSync('assistant', 'Second');
    ctx.addMessageSync('user', 'Third');

    const history = ctx.getHistory();

    expect(history).toHaveLength(3);
    expect(history[0].content).toBe('First');
    expect(history[1].content).toBe('Second');
    expect(history[2].content).toBe('Third');

    ctx.destroy();
  });

  it('should generate unique IDs for each message', () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

    ctx.addMessageSync('user', 'Message 1');
    ctx.addMessageSync('user', 'Message 2');
    ctx.addMessageSync('user', 'Message 3');

    const history = ctx.getHistory();
    const ids = history.map(m => m.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);

    ctx.destroy();
  });

  it('should track timestamps correctly', async () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

    const beforeTime = Date.now();
    await ctx.addMessage('user', 'Timestamped message');
    const afterTime = Date.now();

    const history = ctx.getHistory();
    const msg = history[0];

    expect(msg.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(msg.timestamp).toBeLessThanOrEqual(afterTime);

    ctx.destroy();
  });
});

// ============================================================================
// Conversation Format Tests
// ============================================================================

describe('Conversation Format', () => {
  it('should convert history to conversation format', () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

    ctx.addMessageSync('user', 'Hello');
    ctx.addMessageSync('assistant', 'Hi there');

    const conversation = ctx.getConversation();

    expect(conversation).toHaveLength(2);
    // Conversation uses new Message format
    expect(conversation[0]).toHaveProperty('role');
    expect(conversation[0]).toHaveProperty('content');

    ctx.destroy();
  });

  it('should clear conversation and history together', () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly);

    ctx.addMessageSync('user', 'Message');

    expect(ctx.getConversation()).toHaveLength(1);
    expect(ctx.getHistory()).toHaveLength(1);

    ctx.clearConversation('clear test');

    expect(ctx.getConversation()).toHaveLength(0);
    expect(ctx.getHistory()).toHaveLength(0);

    ctx.destroy();
  });
});
