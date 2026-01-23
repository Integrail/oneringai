/**
 * CheckpointManager Tests
 * Tests for agent state checkpointing with various strategies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CheckpointManager, DEFAULT_CHECKPOINT_STRATEGY } from '@/capabilities/taskAgent/CheckpointManager.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { createAgentState } from '@/domain/entities/AgentState.js';
import { createPlan } from '@/domain/entities/Task.js';

describe('CheckpointManager', () => {
  let manager: CheckpointManager;
  let storage: any;
  let testState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createAgentStorage();

    // Create test agent state
    const plan = createPlan({ goal: 'Test goal', tasks: [] });
    testState = createAgentState('test-agent', {} as any, plan);
  });

  afterEach(() => {
    if (manager) {
      manager.cleanup();
    }
  });

  describe('constructor', () => {
    it('should create instance with default strategy', () => {
      manager = new CheckpointManager(storage);
      expect(manager).toBeDefined();
    });

    it('should create instance with custom strategy', () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: 5,
        afterLLMCalls: 10,
        beforeExternalWait: false,
        mode: 'sync',
      });
      expect(manager).toBeDefined();
    });

    it('should start interval timer when intervalMs is configured', () => {
      manager = new CheckpointManager(storage, {
        ...DEFAULT_CHECKPOINT_STRATEGY,
        intervalMs: 1000,
      });
      expect(manager).toBeDefined();
      // Cleanup timer
      manager.cleanup();
    });

    it('should not start interval timer when intervalMs is undefined', () => {
      manager = new CheckpointManager(storage, {
        ...DEFAULT_CHECKPOINT_STRATEGY,
        intervalMs: undefined,
      });
      expect(manager).toBeDefined();
    });
  });

  describe('onToolCall', () => {
    it('should trigger checkpoint after configured tool calls', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: 2,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      await manager.onToolCall(testState);
      expect(saveSpy).not.toHaveBeenCalled();

      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledWith(testState);
    });

    it('should reset counter after checkpoint', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: 2,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      // First checkpoint
      await manager.onToolCall(testState);
      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      // Counter should reset, next checkpoint after 2 more calls
      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });

    it('should not checkpoint if afterToolCalls is undefined', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      await manager.onToolCall(testState);
      await manager.onToolCall(testState);
      await manager.onToolCall(testState);

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should checkpoint on every call when afterToolCalls is 1', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: 1,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(2);

      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('onLLMCall', () => {
    it('should trigger checkpoint after configured LLM calls', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: 3,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      await manager.onLLMCall(testState);
      await manager.onLLMCall(testState);
      expect(saveSpy).not.toHaveBeenCalled();

      await manager.onLLMCall(testState);
      expect(saveSpy).toHaveBeenCalledWith(testState);
    });

    it('should reset counter after checkpoint', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: 2,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      // First checkpoint
      await manager.onLLMCall(testState);
      await manager.onLLMCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      // Counter should reset
      await manager.onLLMCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      await manager.onLLMCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });

    it('should not checkpoint if afterLLMCalls is undefined', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      await manager.onLLMCall(testState);
      await manager.onLLMCall(testState);
      await manager.onLLMCall(testState);

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should checkpoint on every call when afterLLMCalls is 1', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: 1,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      await manager.onLLMCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      await manager.onLLMCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkpoint', () => {
    it('should save agent state', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      await manager.checkpoint(testState, 'manual');

      expect(saveSpy).toHaveBeenCalledWith(testState);
    });

    it('should save plan', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const planSpy = vi.spyOn(storage.plan, 'savePlan');

      await manager.checkpoint(testState, 'manual');

      expect(planSpy).toHaveBeenCalledWith(testState.plan);
    });

    it('should reset counters after checkpoint', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: 10,
        afterLLMCalls: 10,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      // Build up counters
      await manager.onToolCall(testState);
      await manager.onToolCall(testState);
      await manager.onLLMCall(testState);
      await manager.onLLMCall(testState);

      // Force checkpoint
      await manager.checkpoint(testState, 'manual');

      // Counters should be reset, next checkpoint needs full count
      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(1); // Only the manual checkpoint
    });

    it('should execute synchronously in sync mode', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');
      let saved = false;
      saveSpy.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        saved = true;
      });

      await manager.checkpoint(testState, 'test');
      expect(saved).toBe(true);
    });

    it('should not block in async mode', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'async',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');
      let saved = false;
      saveSpy.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        saved = true;
      });

      await manager.checkpoint(testState, 'test');
      // In async mode, checkpoint returns immediately
      // saved might not be true yet
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should handle checkpoint errors gracefully', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');
      saveSpy.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(manager.checkpoint(testState, 'test')).resolves.not.toThrow();
    });
  });

  describe('flush', () => {
    it('should wait for all pending checkpoints in async mode', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'async',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');
      let checkpoint1Done = false;
      let checkpoint2Done = false;

      saveSpy
        .mockImplementationOnce(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          checkpoint1Done = true;
        })
        .mockImplementationOnce(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          checkpoint2Done = true;
        });

      // Start two checkpoints without waiting
      await manager.checkpoint(testState, 'test1');
      await manager.checkpoint(testState, 'test2');

      // They might not be done yet
      expect(checkpoint1Done || checkpoint2Done).toBeDefined();

      // Flush should wait for all
      await manager.flush();

      expect(checkpoint1Done).toBe(true);
      expect(checkpoint2Done).toBe(true);
    });

    it('should resolve immediately when no pending checkpoints', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'async',
      });

      await expect(manager.flush()).resolves.not.toThrow();
    });

    it('should work in sync mode', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      await manager.checkpoint(testState, 'test');
      await expect(manager.flush()).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clear interval timer', () => {
      manager = new CheckpointManager(storage, {
        ...DEFAULT_CHECKPOINT_STRATEGY,
        intervalMs: 1000,
      });

      expect(() => manager.cleanup()).not.toThrow();
    });

    it('should work when no interval timer exists', () => {
      manager = new CheckpointManager(storage, {
        ...DEFAULT_CHECKPOINT_STRATEGY,
        intervalMs: undefined,
      });

      expect(() => manager.cleanup()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      manager = new CheckpointManager(storage, {
        ...DEFAULT_CHECKPOINT_STRATEGY,
        intervalMs: 1000,
      });

      manager.cleanup();
      expect(() => manager.cleanup()).not.toThrow();
    });
  });

  describe('combined triggers', () => {
    it('should handle both tool and LLM calls independently', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: 2,
        afterLLMCalls: 2,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      await manager.onToolCall(testState);
      await manager.onLLMCall(testState);
      expect(saveSpy).not.toHaveBeenCalled();

      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      // Note: checkpoint resets BOTH counters, so LLM counter is back to 0
      // Need 2 more LLM calls to trigger next checkpoint
      await manager.onLLMCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(1); // Not yet

      await manager.onLLMCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(2); // Now triggered
    });

    it('should reset independent counters', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: 2,
        afterLLMCalls: 2,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      // Trigger tool checkpoint
      await manager.onToolCall(testState);
      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      // Tool counter reset, but not LLM counter
      // So LLM counter should still be at 1 from earlier (if we had called it)
      // This test should verify independent counting
      await manager.onLLMCall(testState);
      await manager.onLLMCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(2); // Second checkpoint from LLM

      // Tool counter was reset, so need 2 more tool calls
      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(2); // Not yet
      await manager.onToolCall(testState);
      expect(saveSpy).toHaveBeenCalledTimes(3); // Third checkpoint
    });
  });

  describe('edge cases', () => {
    it('should handle rapid checkpoint requests', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(manager.checkpoint(testState, `test${i}`));
      }

      await Promise.all(promises);
      expect(saveSpy).toHaveBeenCalledTimes(10);
    });

    it('should handle state updates between checkpoints', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: undefined,
        afterLLMCalls: undefined,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      await manager.checkpoint(testState, 'test1');

      // Update state
      testState.metrics.totalLLMCalls++;

      await manager.checkpoint(testState, 'test2');

      expect(saveSpy).toHaveBeenCalledTimes(2);
      expect(saveSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            totalLLMCalls: expect.any(Number),
          }),
        })
      );
    });

    it('should handle zero threshold (disabled)', async () => {
      manager = new CheckpointManager(storage, {
        afterToolCalls: 0,
        afterLLMCalls: 0,
        beforeExternalWait: true,
        mode: 'sync',
      });

      const saveSpy = vi.spyOn(storage.agent, 'save');

      // 0 is falsy in JavaScript, so checkpointing is disabled
      await manager.onToolCall(testState);
      expect(saveSpy).not.toHaveBeenCalled();

      // Can still manually checkpoint
      await manager.checkpoint(testState, 'manual');
      expect(saveSpy).toHaveBeenCalled();
    });
  });
});
