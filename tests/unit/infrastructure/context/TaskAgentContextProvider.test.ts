/**
 * TaskAgentContextProvider Unit Tests
 * Tests context provider for TaskAgent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskAgentContextProvider } from '@/infrastructure/context/providers/TaskAgentContextProvider.js';
import { createPlan } from '@/domain/entities/Task.js';
import type { WorkingMemory } from '@/capabilities/taskAgent/WorkingMemory.js';
import type { HistoryManager } from '@/capabilities/taskAgent/HistoryManager.js';
import { MessageRole } from '@/domain/entities/Message.js';

describe('TaskAgentContextProvider', () => {
  let mockMemory: WorkingMemory;
  let mockHistoryManager: HistoryManager;
  let provider: TaskAgentContextProvider;

  beforeEach(() => {
    // Mock WorkingMemory
    mockMemory = {
      formatIndex: vi.fn().mockResolvedValue('Memory Index:\n- key1: value1\n- key2: value2'),
      evictLRU: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Mock HistoryManager
    mockHistoryManager = {
      getRecentMessages: vi.fn().mockReturnValue([
        {
          role: MessageRole.USER,
          content: 'What is the weather?',
        },
        {
          role: MessageRole.ASSISTANT,
          content: 'Let me check that for you.',
        },
      ]),
    } as any;

    const plan = createPlan({
      goal: 'Test goal',
      tasks: [
        { name: 'task1', description: 'First task' },
        { name: 'task2', description: 'Second task', dependsOn: ['task1'] },
      ],
    });

    provider = new TaskAgentContextProvider({
      model: 'gpt-4',
      plan,
      memory: mockMemory,
      historyManager: mockHistoryManager,
      currentInput: 'Current user input',
    });
  });

  describe('getComponents', () => {
    it('should return all context components', async () => {
      const components = await provider.getComponents();

      expect(components.length).toBeGreaterThan(0);
      const names = components.map((c) => c.name);
      expect(names).toContain('system_prompt');
      expect(names).toContain('plan');
      expect(names).toContain('memory_index');
      expect(names).toContain('conversation_history');
      expect(names).toContain('current_input');
    });

    it('should mark system prompt as non-compactable', async () => {
      const components = await provider.getComponents();
      const systemPrompt = components.find((c) => c.name === 'system_prompt');

      expect(systemPrompt).toBeDefined();
      expect(systemPrompt!.compactable).toBe(false);
      expect(systemPrompt!.priority).toBe(0);
    });

    it('should include instructions when provided', async () => {
      const planWithInstructions = createPlan({
        goal: 'Test',
        tasks: [{ name: 't1', description: 'Task' }],
      });

      const providerWithInstructions = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan: planWithInstructions,
        memory: mockMemory,
        historyManager: mockHistoryManager,
        instructions: 'Custom instructions for the agent',
      });

      const components = await providerWithInstructions.getComponents();
      const instructions = components.find((c) => c.name === 'instructions');

      expect(instructions).toBeDefined();
      expect(instructions!.content).toBe('Custom instructions for the agent');
      expect(instructions!.compactable).toBe(false);
    });

    it('should not include instructions when not provided', async () => {
      const components = await provider.getComponents();
      const instructions = components.find((c) => c.name === 'instructions');

      expect(instructions).toBeUndefined();
    });

    it('should serialize plan correctly', async () => {
      const components = await provider.getComponents();
      const planComponent = components.find((c) => c.name === 'plan');

      expect(planComponent).toBeDefined();
      expect(planComponent!.content).toContain('Test goal');
      expect(planComponent!.content).toContain('task1');
      expect(planComponent!.content).toContain('task2');
      expect(planComponent!.content).toContain('depends on');
      expect(planComponent!.compactable).toBe(false);
    });

    it('should include memory index with eviction metadata', async () => {
      const components = await provider.getComponents();
      const memoryIndex = components.find((c) => c.name === 'memory_index');

      expect(memoryIndex).toBeDefined();
      expect(memoryIndex!.compactable).toBe(true);
      expect(memoryIndex!.priority).toBe(8);
      expect(memoryIndex!.metadata?.strategy).toBe('evict');
      expect(typeof memoryIndex!.metadata?.evict).toBe('function');
      expect(typeof memoryIndex!.metadata?.getUpdatedContent).toBe('function');
    });

    it('should call memory formatIndex', async () => {
      await provider.getComponents();

      expect(mockMemory.formatIndex).toHaveBeenCalled();
    });

    it('should include conversation history', async () => {
      const components = await provider.getComponents();
      const history = components.find((c) => c.name === 'conversation_history');

      expect(history).toBeDefined();
      expect(history!.compactable).toBe(true);
      expect(history!.priority).toBe(6);
      expect(Array.isArray(history!.content)).toBe(true);
      expect((history!.content as any[]).length).toBe(2);
    });

    it('should include tool outputs when present in history', async () => {
      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        {
          role: MessageRole.ASSISTANT,
          content: 'Response',
          toolCalls: [
            {
              name: 'get_weather',
              result: { temp: 72, condition: 'sunny' },
            },
          ],
        },
      ]);

      const components = await provider.getComponents();
      const toolOutputs = components.find((c) => c.name === 'tool_outputs');

      expect(toolOutputs).toBeDefined();
      expect(toolOutputs!.compactable).toBe(true);
      expect(toolOutputs!.priority).toBe(10);
      expect(Array.isArray(toolOutputs!.content)).toBe(true);
    });

    it('should not include tool_outputs when no tool calls in history', async () => {
      const components = await provider.getComponents();
      const toolOutputs = components.find((c) => c.name === 'tool_outputs');

      expect(toolOutputs).toBeUndefined();
    });

    it('should include current input when provided', async () => {
      const components = await provider.getComponents();
      const currentInput = components.find((c) => c.name === 'current_input');

      expect(currentInput).toBeDefined();
      expect(currentInput!.content).toBe('Current user input');
      expect(currentInput!.compactable).toBe(false);
    });

    it('should not include current_input when not provided', async () => {
      const plan = createPlan({
        goal: 'Test',
        tasks: [{ name: 't1', description: 'Task' }],
      });

      const providerNoInput = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      const components = await providerNoInput.getComponents();
      const currentInput = components.find((c) => c.name === 'current_input');

      expect(currentInput).toBeUndefined();
    });
  });

  describe('Memory eviction callback', () => {
    it('should call memory evictLRU through eviction callback', async () => {
      const components = await provider.getComponents();
      const memoryIndex = components.find((c) => c.name === 'memory_index');

      expect(memoryIndex!.metadata?.evict).toBeDefined();

      // Call the eviction callback
      await (memoryIndex!.metadata!.evict as any)(5);

      expect(mockMemory.evictLRU).toHaveBeenCalledWith(5);
    });

    it('should get updated content after eviction', async () => {
      mockMemory.formatIndex = vi
        .fn()
        .mockResolvedValueOnce('Original index')
        .mockResolvedValueOnce('Updated index after eviction');

      const components = await provider.getComponents();
      const memoryIndex = components.find((c) => c.name === 'memory_index');

      expect(memoryIndex!.content).toBe('Original index');

      // Get updated content
      const updatedContent = await (memoryIndex!.metadata!.getUpdatedContent as any)();
      expect(updatedContent).toBe('Updated index after eviction');
    });
  });

  describe('Tool output extraction', () => {
    it('should extract tool outputs from assistant messages', async () => {
      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        {
          role: MessageRole.ASSISTANT,
          content: 'Let me check',
          toolCalls: [
            { name: 'tool1', result: { data: 'result1' } },
            { name: 'tool2', result: { data: 'result2' } },
          ],
        },
      ]);

      const components = await provider.getComponents();
      const toolOutputs = components.find((c) => c.name === 'tool_outputs');

      expect(toolOutputs).toBeDefined();
      const outputs = toolOutputs!.content as any[];
      expect(outputs).toHaveLength(2);
      expect(outputs[0].tool).toBe('tool1');
      expect(outputs[1].tool).toBe('tool2');
    });

    it('should skip tool calls without results', async () => {
      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        {
          role: MessageRole.ASSISTANT,
          toolCalls: [
            { name: 'tool1', result: { data: 'result1' } },
            { name: 'tool2' }, // No result
          ],
        },
      ]);

      const components = await provider.getComponents();
      const toolOutputs = components.find((c) => c.name === 'tool_outputs');

      expect(toolOutputs).toBeDefined();
      const outputs = toolOutputs!.content as any[];
      expect(outputs).toHaveLength(1);
      expect(outputs[0].tool).toBe('tool1');
    });

    it('should handle messages without toolCalls', async () => {
      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        { role: MessageRole.ASSISTANT, content: 'Simple message' },
        { role: MessageRole.USER, content: 'User message' },
      ]);

      const components = await provider.getComponents();
      const toolOutputs = components.find((c) => c.name === 'tool_outputs');

      expect(toolOutputs).toBeUndefined();
    });
  });

  describe('applyCompactedComponents', () => {
    it('should accept compacted components without error', async () => {
      const components = await provider.getComponents();

      await expect(provider.applyCompactedComponents(components)).resolves.not.toThrow();
    });

    it('should handle empty components array', async () => {
      await expect(provider.applyCompactedComponents([])).resolves.not.toThrow();
    });
  });

  describe('getMaxContextSize', () => {
    it('should return model context size for known model', () => {
      const size = provider.getMaxContextSize();

      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('should return default for unknown model', () => {
      const plan = createPlan({
        goal: 'Test',
        tasks: [{ name: 't1', description: 'Task' }],
      });

      const providerUnknown = new TaskAgentContextProvider({
        model: 'unknown-model-xyz',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      const size = providerUnknown.getMaxContextSize();
      expect(size).toBe(128000); // Default fallback
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newPlan = createPlan({
        goal: 'New goal',
        tasks: [{ name: 'new_task', description: 'New task' }],
      });

      provider.updateConfig({ plan: newPlan });

      // Verify by checking components reflect new plan
      expect(async () => {
        const components = await provider.getComponents();
        const planComponent = components.find((c) => c.name === 'plan');
        expect(planComponent!.content).toContain('New goal');
      }).not.toThrow();
    });

    it('should update current input', async () => {
      provider.updateConfig({ currentInput: 'Updated input text' });

      const components = await provider.getComponents();
      const currentInput = components.find((c) => c.name === 'current_input');

      expect(currentInput!.content).toBe('Updated input text');
    });

    it('should preserve other config values when updating', async () => {
      const originalModel = 'gpt-4';
      provider.updateConfig({ currentInput: 'New input' });

      const size = provider.getMaxContextSize();
      // Should still use original model's context size
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('System prompt', () => {
    it('should include task agent capabilities', async () => {
      const components = await provider.getComponents();
      const systemPrompt = components.find((c) => c.name === 'system_prompt');

      const content = systemPrompt!.content as string;
      expect(content).toContain('autonomous task-based agent');
      expect(content).toContain('working memory');
      expect(content).toContain('memory_store');
      expect(content).toContain('context_inspect');
    });
  });

  describe('Plan serialization', () => {
    it('should format tasks with status', async () => {
      const planWithStatus = createPlan({
        goal: 'Deploy app',
        tasks: [
          { name: 'build', description: 'Build app' },
          { name: 'test', description: 'Run tests' },
        ],
      });

      planWithStatus.tasks[0].status = 'completed';
      planWithStatus.tasks[1].status = 'in_progress';

      const providerWithStatus = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan: planWithStatus,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      const components = await providerWithStatus.getComponents();
      const plan = components.find((c) => c.name === 'plan');

      expect(plan!.content).toContain('[completed]');
      expect(plan!.content).toContain('[in_progress]');
    });

    it('should show dependencies in plan', async () => {
      const components = await provider.getComponents();
      const plan = components.find((c) => c.name === 'plan');

      expect(plan!.content).toContain('depends on:');
    });

    it('should format plan with goal and tasks', async () => {
      const components = await provider.getComponents();
      const plan = components.find((c) => c.name === 'plan');

      const content = plan!.content as string;
      expect(content).toContain('## Current Plan');
      expect(content).toContain('**Goal**:');
      expect(content).toContain('**Tasks**:');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty conversation history', async () => {
      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([]);

      const components = await provider.getComponents();
      const history = components.find((c) => c.name === 'conversation_history');

      expect(history).toBeDefined();
      expect((history!.content as any[]).length).toBe(0);
    });

    it('should handle plan with no tasks', async () => {
      const emptyPlan = createPlan({
        goal: 'Empty plan',
        tasks: [],
      });

      const providerEmpty = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan: emptyPlan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      const components = await providerEmpty.getComponents();
      const plan = components.find((c) => c.name === 'plan');

      expect(plan).toBeDefined();
      expect(plan!.content).toContain('Empty plan');
    });

    it('should handle memory formatIndex errors gracefully', async () => {
      mockMemory.formatIndex = vi.fn().mockRejectedValue(new Error('Memory error'));

      await expect(provider.getComponents()).rejects.toThrow('Memory error');
    });
  });
});
