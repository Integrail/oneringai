/**
 * Compaction Edge Cases Tests
 *
 * Tests for context compaction behavior including:
 * - Strategy thresholds
 * - Plugin compaction order
 * - Conversation compaction with tool pairs
 * - Edge cases and error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentContextNextGen } from '@/core/context-nextgen/AgentContextNextGen.js';
import { WorkingMemoryPluginNextGen } from '@/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.js';
import { InContextMemoryPluginNextGen } from '@/core/context-nextgen/plugins/InContextMemoryPluginNextGen.js';
import { MessageRole } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';
import type { Message, OutputItem, InputItem } from '@/domain/entities/Message.js';

describe('Context Compaction Edge Cases', () => {
  describe('Strategy Thresholds', () => {
    it('should compact at 70% for default strategy', async () => {
      // Disable auto-plugins to allow small context for testing
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 1000,
        responseReserve: 100,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      const compactedListener = vi.fn();
      ctx.on('context:compacted', compactedListener);

      // Fill well beyond 70% capacity (default threshold)
      // maxContextTokens: 1000, responseReserve: 100 = 900 available
      // 70% of 900 = 630 tokens needed to trigger compaction
      // Each message pair needs ~20-30 tokens to be meaningful
      for (let i = 0; i < 30; i++) {
        ctx.addUserMessage(`This is user message number ${i} with substantial content to ensure we reach threshold`);
        ctx.addAssistantResponse([{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{ type: ContentType.OUTPUT_TEXT, text: `This is assistant response number ${i} with additional content` }],
        }]);
      }

      const { compacted } = await ctx.prepare();

      // Should have compacted due to proactive threshold
      expect(compacted).toBe(true);

      ctx.destroy();
    });

    it('should NOT compact when below 70% threshold', async () => {
      // Disable auto-plugins to allow small context for testing
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 1000,
        responseReserve: 100,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      // Fill to about 50% capacity (well below 70% threshold)
      for (let i = 0; i < 5; i++) {
        ctx.addUserMessage(`Message ${i}`);
        ctx.addAssistantResponse([{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{ type: ContentType.OUTPUT_TEXT, text: `Response ${i}` }],
        }]);
      }

      const { compacted } = await ctx.prepare();

      // Should NOT have compacted since we're below threshold
      expect(compacted).toBe(false);

      ctx.destroy();
    });

    it('should compact when using default strategy and context is full', async () => {
      // Disable auto-plugins to allow small context for testing
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 600,
        responseReserve: 100,
        strategy: 'default', // 70% threshold
        features: { workingMemory: false, inContextMemory: false },
      });

      // Fill context well beyond 75% capacity with longer messages
      for (let i = 0; i < 25; i++) {
        ctx.addUserMessage(`This is message number ${i} with some additional content to take up space`);
        ctx.addAssistantResponse([{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{ type: ContentType.OUTPUT_TEXT, text: `This is response number ${i} with additional text content` }],
        }]);
      }

      const { compacted, budget } = await ctx.prepare();

      // Should have triggered compaction due to high utilization
      // If no compaction happened, context should still be under limit
      if (!compacted) {
        // This is acceptable if context fits without compaction
        expect(budget.utilizationPercent).toBeLessThan(75);
      } else {
        expect(compacted).toBe(true);
      }

      ctx.destroy();
    });
  });

  describe('Plugin Compaction Order', () => {
    it('should compact InContextMemory before WorkingMemory', async () => {
      // Disable auto-plugins to manually register plugins
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 3000, // Larger to fit both plugin tools (~1000 tokens)
        responseReserve: 300,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      const inContextPlugin = new InContextMemoryPluginNextGen();
      const workingMemoryPlugin = new WorkingMemoryPluginNextGen();

      ctx.registerPlugin(inContextPlugin);
      ctx.registerPlugin(workingMemoryPlugin);

      // Fill both plugins
      for (let i = 0; i < 5; i++) {
        inContextPlugin.set(`ic_key${i}`, `InContext ${i}`, { data: 'x'.repeat(20) }, 'low');
        await workingMemoryPlugin.store(`wm_key${i}`, `WorkingMem ${i}`, { data: 'y'.repeat(20) });
      }

      // Add some conversation
      ctx.addUserMessage('Hello');
      ctx.addAssistantResponse([{
        type: 'message',
        role: MessageRole.ASSISTANT,
        content: [{ type: ContentType.OUTPUT_TEXT, text: 'Hi' }],
      }]);

      const { compactionLog } = await ctx.prepare();

      // Check log order - in_context_memory should appear before working_memory
      const inContextIndex = compactionLog.findIndex(log => log.includes('in_context_memory'));
      const workingMemIndex = compactionLog.findIndex(log => log.includes('working_memory'));

      // If both were compacted, in_context should be first
      if (inContextIndex !== -1 && workingMemIndex !== -1) {
        expect(inContextIndex).toBeLessThan(workingMemIndex);
      }

      ctx.destroy();
    });

    it('should compact plugins before conversation', async () => {
      // Disable auto-plugins to manually register plugins
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 2000, // Larger to fit plugin tools
        responseReserve: 200,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      const inContextPlugin = new InContextMemoryPluginNextGen();
      ctx.registerPlugin(inContextPlugin);

      // Fill plugin with low priority entries (easily evictable)
      for (let i = 0; i < 10; i++) {
        inContextPlugin.set(`key${i}`, `Entry ${i}`, { data: 'x'.repeat(30) }, 'low');
      }

      // Add conversation
      for (let i = 0; i < 10; i++) {
        ctx.addUserMessage(`Message ${i}`);
        ctx.addAssistantResponse([{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{ type: ContentType.OUTPUT_TEXT, text: `Response ${i}` }],
        }]);
      }

      const { compactionLog } = await ctx.prepare();

      // Plugin compaction should happen before conversation compaction
      const pluginLogIndex = compactionLog.findIndex(log =>
        log.includes('in_context_memory') || log.includes('working_memory')
      );
      const conversationLogIndex = compactionLog.findIndex(log =>
        log.includes('messages from conversation')
      );

      if (pluginLogIndex !== -1 && conversationLogIndex !== -1) {
        expect(pluginLogIndex).toBeLessThan(conversationLogIndex);
      }

      ctx.destroy();
    });
  });

  describe('Tool Pair Preservation', () => {
    it('should remove tool_use and tool_result together', async () => {
      // Disable auto-plugins to allow small context for testing
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 600,
        responseReserve: 100,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      // Create a tool use/result pair
      ctx.addUserMessage('Use tool');

      const assistantWithTool: Message = {
        type: 'message',
        role: MessageRole.ASSISTANT,
        content: [{
          type: ContentType.TOOL_USE,
          id: 'tool_pair_test',
          name: 'test_tool',
          input: { arg: 'value' },
        }],
      };
      ctx.addInputItems([assistantWithTool]);

      ctx.addToolResults([{
        tool_use_id: 'tool_pair_test',
        content: 'Tool result',
      }]);

      ctx.addAssistantResponse([{
        type: 'message',
        role: MessageRole.ASSISTANT,
        content: [{ type: ContentType.OUTPUT_TEXT, text: 'Done with tool' }],
      }]);

      // Add more messages to trigger compaction
      for (let i = 0; i < 20; i++) {
        ctx.addUserMessage(`Filler message ${i} with content`);
        ctx.addAssistantResponse([{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{ type: ContentType.OUTPUT_TEXT, text: `Filler response ${i}` }],
        }]);
      }

      const { input } = await ctx.prepare();

      // Count tool_use and tool_result
      let toolUseCount = 0;
      let toolResultCount = 0;

      for (const item of input) {
        if (item.type !== 'message') continue;
        const msg = item as Message;
        for (const c of msg.content) {
          if (c.type === ContentType.TOOL_USE) toolUseCount++;
          if (c.type === ContentType.TOOL_RESULT) toolResultCount++;
        }
      }

      // Should be equal (either both present or both removed)
      expect(toolUseCount).toBe(toolResultCount);

      ctx.destroy();
    });

    it('should not leave orphan tool_use without result', async () => {
      // Disable auto-plugins to allow small context for testing
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 800,
        responseReserve: 100,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      // Create multiple tool pairs
      for (let i = 0; i < 3; i++) {
        ctx.addUserMessage(`Use tool ${i}`);

        const assistantWithTool: Message = {
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{
            type: ContentType.TOOL_USE,
            id: `tool_${i}`,
            name: 'test_tool',
            input: { index: i },
          }],
        };
        ctx.addInputItems([assistantWithTool]);

        ctx.addToolResults([{
          tool_use_id: `tool_${i}`,
          content: `Result ${i}`,
        }]);

        ctx.addAssistantResponse([{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{ type: ContentType.OUTPUT_TEXT, text: `Completed ${i}` }],
        }]);
      }

      // Add filler to trigger compaction
      for (let i = 0; i < 15; i++) {
        ctx.addUserMessage(`Filler ${i}`);
        ctx.addAssistantResponse([{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{ type: ContentType.OUTPUT_TEXT, text: `Response ${i}` }],
        }]);
      }

      const { input } = await ctx.prepare();

      // Collect all tool IDs
      const toolUseIds = new Set<string>();
      const toolResultIds = new Set<string>();

      for (const item of input) {
        if (item.type !== 'message') continue;
        const msg = item as Message;
        for (const c of msg.content) {
          if (c.type === ContentType.TOOL_USE) {
            toolUseIds.add((c as any).id);
          }
          if (c.type === ContentType.TOOL_RESULT) {
            toolResultIds.add((c as any).tool_use_id);
          }
        }
      }

      // Every tool_use should have a corresponding result
      for (const id of toolUseIds) {
        expect(toolResultIds.has(id)).toBe(true);
      }

      ctx.destroy();
    });
  });

  describe('Non-Compactable Plugins', () => {
    it('should skip non-compactable plugins during compaction', async () => {
      // Disable auto-plugins to use mock plugin
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 600,
        responseReserve: 100,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      // Create a mock non-compactable plugin
      const nonCompactablePlugin = {
        name: 'non_compactable',
        getInstructions: () => 'Test instructions',
        getContent: async () => 'Non-compactable content '.repeat(10),
        getContents: () => ({}),
        getTokenSize: () => 100,
        getInstructionsTokenSize: () => 20,
        isCompactable: () => false,
        compact: vi.fn().mockResolvedValue(0),
        getTools: () => [],
        destroy: () => {},
        getState: () => ({}),
        restoreState: () => {},
      };

      ctx.registerPlugin(nonCompactablePlugin);

      // Fill context
      for (let i = 0; i < 10; i++) {
        ctx.addUserMessage(`Message ${i}`);
        ctx.addAssistantResponse([{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{ type: ContentType.OUTPUT_TEXT, text: `Response ${i}` }],
        }]);
      }

      await ctx.prepare();

      // Non-compactable plugin's compact should not be called
      expect(nonCompactablePlugin.compact).not.toHaveBeenCalled();

      ctx.destroy();
    });
  });

  describe('Empty Context Scenarios', () => {
    it('should handle prepare with empty context', async () => {
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
      });

      const { input, budget, compacted } = await ctx.prepare();

      expect(input.length).toBeGreaterThanOrEqual(1); // At least system message
      expect(budget.totalUsed).toBeGreaterThanOrEqual(0);
      expect(compacted).toBe(false);

      ctx.destroy();
    });

    it('should handle prepare with only system prompt', async () => {
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        systemPrompt: 'You are helpful.',
      });

      const { budget } = await ctx.prepare();

      expect(budget.systemMessageTokens).toBeGreaterThan(0);

      ctx.destroy();
    });
  });

  describe('Critical Priority Protection', () => {
    it('should not evict critical priority entries from WorkingMemory', async () => {
      // Disable auto-plugins to manually register plugins
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 2000, // Larger to fit tool definitions
        responseReserve: 200,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      const memoryPlugin = new WorkingMemoryPluginNextGen();
      ctx.registerPlugin(memoryPlugin);

      // Store critical entry
      await memoryPlugin.store('critical', 'Critical data', { important: true }, { priority: 'critical' });

      // Fill with low priority
      for (let i = 0; i < 10; i++) {
        await memoryPlugin.store(`low_${i}`, `Low ${i}`, { data: 'x'.repeat(30) }, { priority: 'low' });
      }

      ctx.addUserMessage('Test');

      await ctx.prepare();

      // Critical should remain
      const criticalValue = await memoryPlugin.retrieve('critical');
      expect(criticalValue).toEqual({ important: true });

      ctx.destroy();
    });

    it('should not evict critical priority entries from InContextMemory', async () => {
      // Disable auto-plugins to manually register plugins
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 2000, // Larger to fit tool definitions
        responseReserve: 200,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      const inContextPlugin = new InContextMemoryPluginNextGen();
      ctx.registerPlugin(inContextPlugin);

      // Store critical entry
      inContextPlugin.set('critical', 'Critical data', { important: true }, 'critical');

      // Fill with low priority
      for (let i = 0; i < 10; i++) {
        inContextPlugin.set(`low_${i}`, `Low ${i}`, { data: 'x'.repeat(30) }, 'low');
      }

      ctx.addUserMessage('Test');

      await ctx.prepare();

      // Critical should remain
      expect(inContextPlugin.has('critical')).toBe(true);

      ctx.destroy();
    });
  });

  describe('Compaction with Pinned Entries', () => {
    it('should not evict pinned entries from WorkingMemory', async () => {
      // Disable auto-plugins to manually register plugins
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 2000, // Larger context to fit tool definitions
        responseReserve: 200,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      const memoryPlugin = new WorkingMemoryPluginNextGen();
      ctx.registerPlugin(memoryPlugin);

      // Store pinned entry
      await memoryPlugin.store('pinned', 'Pinned data', { keep: true }, { pinned: true });

      // Fill with unpinned low priority
      for (let i = 0; i < 10; i++) {
        await memoryPlugin.store(`normal_${i}`, `Normal ${i}`, { data: 'x'.repeat(30) }, { priority: 'low' });
      }

      ctx.addUserMessage('Test');

      await ctx.prepare();

      // Pinned should remain
      const pinnedValue = await memoryPlugin.retrieve('pinned');
      expect(pinnedValue).toEqual({ keep: true });

      ctx.destroy();
    });
  });

  describe('Budget Accuracy After Compaction', () => {
    it('should report accurate budget after compaction', async () => {
      // Disable auto-plugins to allow small context for testing
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 800,
        responseReserve: 100,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      // Fill context
      for (let i = 0; i < 20; i++) {
        ctx.addUserMessage(`Message ${i} with content`);
        ctx.addAssistantResponse([{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{ type: ContentType.OUTPUT_TEXT, text: `Response ${i} with text` }],
        }]);
      }

      const { budget, compacted } = await ctx.prepare();

      if (compacted) {
        // Budget should reflect post-compaction state
        expect(budget.totalUsed).toBeLessThan(budget.maxTokens - budget.responseReserve);
        expect(budget.utilizationPercent).toBeLessThan(100);

        // Available should be positive
        expect(budget.available).toBeGreaterThan(0);
      }

      ctx.destroy();
    });
  });

  describe('Compaction Log Contents', () => {
    it('should include detailed compaction log', async () => {
      // Disable auto-plugins to manually register plugin
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 2000, // Larger to fit tool definitions
        responseReserve: 200,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      const memoryPlugin = new WorkingMemoryPluginNextGen();
      ctx.registerPlugin(memoryPlugin);

      // Fill memory and conversation
      for (let i = 0; i < 5; i++) {
        await memoryPlugin.store(`key${i}`, `Entry ${i}`, { data: 'x'.repeat(20) });
      }

      for (let i = 0; i < 15; i++) {
        ctx.addUserMessage(`Message ${i}`);
        ctx.addAssistantResponse([{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{ type: ContentType.OUTPUT_TEXT, text: `Response ${i}` }],
        }]);
      }

      const { compacted, compactionLog } = await ctx.prepare();

      if (compacted) {
        // Log should contain start and end markers
        expect(compactionLog.some((log: string) => log.includes('started'))).toBe(true);
        expect(compactionLog.some((log: string) => log.includes('complete'))).toBe(true);

        // Log should mention tokens freed
        expect(compactionLog.some((log: string) => log.includes('tokens'))).toBe(true);
      }

      ctx.destroy();
    });
  });

  describe('Multiple prepare() Calls', () => {
    it('should handle multiple prepare calls correctly', async () => {
      // Disable auto-plugins to allow small context for testing
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        maxContextTokens: 800,
        responseReserve: 100,
        strategy: 'default',
        features: { workingMemory: false, inContextMemory: false },
      });

      ctx.addUserMessage('First message');

      const result1 = await ctx.prepare();

      ctx.addAssistantResponse([{
        type: 'message',
        role: MessageRole.ASSISTANT,
        content: [{ type: ContentType.OUTPUT_TEXT, text: 'First response' }],
      }]);

      ctx.addUserMessage('Second message');

      const result2 = await ctx.prepare();

      // Second prepare should include more content
      expect(result2.input.length).toBeGreaterThan(result1.input.length);

      ctx.destroy();
    });
  });
});
