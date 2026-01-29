/**
 * TaskAgentContextProvider TaskType and Priority Tests
 * Tests for task type detection, specialized prompts, and priority profiles
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TaskAgentContextProvider,
  TaskType,
  PRIORITY_PROFILES,
} from '@/infrastructure/context/providers/TaskAgentContextProvider.js';
import { createPlan } from '@/domain/entities/Task.js';
import type { WorkingMemory } from '@/capabilities/taskAgent/WorkingMemory.js';
import type { HistoryManager } from '@/capabilities/taskAgent/HistoryManager.js';
import { MessageRole } from '@/domain/entities/Message.js';

describe('TaskAgentContextProvider - TaskType and Priorities', () => {
  let mockMemory: WorkingMemory;
  let mockHistoryManager: HistoryManager;

  beforeEach(() => {
    mockMemory = {
      formatIndex: vi.fn().mockResolvedValue('Memory Index:\n- key1: value1'),
      evictLRU: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockHistoryManager = {
      getRecentMessages: vi.fn().mockReturnValue([]),
    } as any;
  });

  describe('PRIORITY_PROFILES', () => {
    it('should define profiles for all task types', () => {
      expect(PRIORITY_PROFILES.research).toBeDefined();
      expect(PRIORITY_PROFILES.coding).toBeDefined();
      expect(PRIORITY_PROFILES.analysis).toBeDefined();
      expect(PRIORITY_PROFILES.general).toBeDefined();
    });

    it('research profile should prioritize tool outputs over conversation', () => {
      const profile = PRIORITY_PROFILES.research;

      // Lower number = higher priority (compacted later)
      expect(profile.tool_outputs).toBeLessThan(profile.conversation_history);
      expect(profile.memory_index).toBeLessThan(profile.tool_outputs);
    });

    it('coding profile should prioritize conversation history', () => {
      const profile = PRIORITY_PROFILES.coding;

      // Conversation history more important than tool outputs in coding
      expect(profile.conversation_history).toBeLessThan(profile.tool_outputs);
    });

    it('general profile should have balanced priorities', () => {
      const profile = PRIORITY_PROFILES.general;

      expect(profile.conversation_history).toBe(6);
      expect(profile.tool_outputs).toBe(10);
      expect(profile.memory_index).toBe(8);
    });
  });

  describe('getTaskType', () => {
    it('should return explicit task type when set', () => {
      const plan = createPlan({
        goal: 'Some goal',
        tasks: [{ name: 'task1', description: 'Task' }],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
        taskType: 'research',
      });

      expect(provider.getTaskType()).toBe('research');
    });

    it('should auto-detect research type from goal', () => {
      const plan = createPlan({
        goal: 'Research the latest AI trends and compile findings',
        tasks: [{ name: 'search', description: 'Search for info' }],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      expect(provider.getTaskType()).toBe('research');
    });

    it('should auto-detect coding type from task descriptions', () => {
      const plan = createPlan({
        goal: 'Update the application',
        tasks: [
          { name: 'implement', description: 'Implement new function to handle requests' },
          { name: 'refactor', description: 'Refactor the old code' },
        ],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      expect(provider.getTaskType()).toBe('coding');
    });

    it('should auto-detect analysis type', () => {
      const plan = createPlan({
        goal: 'Analyze sales data and generate report',
        tasks: [
          { name: 'load', description: 'Load the data' },
          { name: 'analyze', description: 'Calculate statistics and metrics' },
        ],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      expect(provider.getTaskType()).toBe('analysis');
    });

    it('should default to general type when no keywords match', () => {
      const plan = createPlan({
        goal: 'Do some stuff',
        tasks: [{ name: 'task1', description: 'Complete the task' }],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      expect(provider.getTaskType()).toBe('general');
    });

    it('should detect research from web scrape keywords', () => {
      const plan = createPlan({
        goal: 'Gather information',
        tasks: [
          { name: 'scrape', description: 'Scrape websites for content' },
          { name: 'crawl', description: 'Crawl pages for data' },
        ],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      expect(provider.getTaskType()).toBe('research');
    });

    it('should cache detected task type', () => {
      const plan = createPlan({
        goal: 'Research AI',
        tasks: [{ name: 'search', description: 'Search' }],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      // First call detects
      const type1 = provider.getTaskType();
      // Second call uses cache
      const type2 = provider.getTaskType();

      expect(type1).toBe(type2);
      expect(type1).toBe('research');
    });
  });

  describe('getPriorityProfile', () => {
    it('should return correct profile for research', () => {
      const plan = createPlan({ goal: 'Test', tasks: [] });
      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      const profile = provider.getPriorityProfile('research');

      expect(profile).toEqual(PRIORITY_PROFILES.research);
    });

    it('should apply custom priority overrides', () => {
      const plan = createPlan({ goal: 'Test', tasks: [] });
      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
        customPriorityProfile: {
          conversation_history: 1,
        },
      });

      const profile = provider.getPriorityProfile('research');

      expect(profile.conversation_history).toBe(1); // Custom override
      expect(profile.tool_outputs).toBe(PRIORITY_PROFILES.research.tool_outputs); // From base
      expect(profile.memory_index).toBe(PRIORITY_PROFILES.research.memory_index); // From base
    });
  });

  describe('getComponents with task type', () => {
    it('should use research priority profile for research tasks', async () => {
      const plan = createPlan({
        goal: 'Research AI trends',
        tasks: [{ name: 'search', description: 'Search for info' }],
      });

      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        { role: MessageRole.USER, content: 'Search' },
        {
          role: MessageRole.ASSISTANT,
          content: 'Found results',
          metadata: { toolCalls: [{ name: 'web_search', result: { data: 'results' } }] },
        },
      ]);

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      const components = await provider.getComponents();

      // Check conversation_history priority
      const history = components.find((c) => c.name === 'conversation_history');
      expect(history?.priority).toBe(PRIORITY_PROFILES.research.conversation_history); // 10

      // Check tool_outputs priority
      const toolOutputs = components.find((c) => c.name === 'tool_outputs');
      expect(toolOutputs?.priority).toBe(PRIORITY_PROFILES.research.tool_outputs); // 5

      // Check memory_index priority
      const memoryIndex = components.find((c) => c.name === 'memory_index');
      expect(memoryIndex?.priority).toBe(PRIORITY_PROFILES.research.memory_index); // 3
    });

    it('should use summarize strategy for research tasks', async () => {
      const plan = createPlan({
        goal: 'Research topic',
        tasks: [{ name: 'search', description: 'Web search' }],
      });

      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        {
          role: MessageRole.ASSISTANT,
          content: 'Results',
          metadata: { toolCalls: [{ name: 'search', result: {} }] },
        },
      ]);

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
        taskType: 'research',
      });

      const components = await provider.getComponents();

      const history = components.find((c) => c.name === 'conversation_history');
      expect(history?.metadata?.strategy).toBe('summarize');

      const toolOutputs = components.find((c) => c.name === 'tool_outputs');
      expect(toolOutputs?.metadata?.strategy).toBe('summarize');
    });

    it('should use truncate strategy for coding tasks', async () => {
      const plan = createPlan({
        goal: 'Implement feature',
        tasks: [{ name: 'code', description: 'Write function' }],
      });

      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        {
          role: MessageRole.ASSISTANT,
          content: 'Done',
          metadata: { toolCalls: [{ name: 'write_file', result: {} }] },
        },
      ]);

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
        taskType: 'coding',
      });

      const components = await provider.getComponents();

      const history = components.find((c) => c.name === 'conversation_history');
      expect(history?.metadata?.strategy).toBe('truncate');

      const toolOutputs = components.find((c) => c.name === 'tool_outputs');
      expect(toolOutputs?.metadata?.strategy).toBe('truncate');
    });
  });

  describe('System prompts', () => {
    it('should include research protocol in system prompt for research tasks', async () => {
      const plan = createPlan({
        goal: 'Research AI',
        tasks: [{ name: 'search', description: 'Search' }],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
        taskType: 'research',
      });

      const components = await provider.getComponents();
      const systemPrompt = components.find((c) => c.name === 'system_prompt');

      expect(systemPrompt?.content).toContain('Research Protocol');
      expect(systemPrompt?.content).toContain('SEARCH PHASE');
      expect(systemPrompt?.content).toContain('READ PHASE');
      expect(systemPrompt?.content).toContain('SYNTHESIZE PHASE');
      expect(systemPrompt?.content).toContain('CONTEXT MANAGEMENT RULES');
      expect(systemPrompt?.content).toContain('tier');
    });

    it('should include coding protocol for coding tasks', async () => {
      const plan = createPlan({
        goal: 'Implement feature',
        tasks: [{ name: 'code', description: 'Code' }],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
        taskType: 'coding',
      });

      const components = await provider.getComponents();
      const systemPrompt = components.find((c) => c.name === 'system_prompt');

      expect(systemPrompt?.content).toContain('Coding Protocol');
      expect(systemPrompt?.content).toContain('WORKFLOW');
      expect(systemPrompt?.content).toContain('MEMORY USAGE');
    });

    it('should include analysis protocol for analysis tasks', async () => {
      const plan = createPlan({
        goal: 'Analyze data',
        tasks: [{ name: 'analyze', description: 'Analyze' }],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
        taskType: 'analysis',
      });

      const components = await provider.getComponents();
      const systemPrompt = components.find((c) => c.name === 'system_prompt');

      expect(systemPrompt?.content).toContain('Analysis Protocol');
    });

    it('should use custom system prompt when provided', async () => {
      const plan = createPlan({
        goal: 'Research',
        tasks: [{ name: 'search', description: 'Search' }],
      });

      const customPrompt = 'You are a custom agent with special instructions.';

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
        taskType: 'research',
        customSystemPrompt: customPrompt,
      });

      const components = await provider.getComponents();
      const systemPrompt = components.find((c) => c.name === 'system_prompt');

      expect(systemPrompt?.content).toBe(customPrompt);
      expect(systemPrompt?.content).not.toContain('Research Protocol');
    });
  });

  describe('Tool output content type detection', () => {
    it('should detect search_results content type', async () => {
      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        {
          role: MessageRole.ASSISTANT,
          content: 'Results',
          metadata: { toolCalls: [{ name: 'web_search', result: { results: [] } }] },
        },
      ]);

      const plan = createPlan({ goal: 'Test', tasks: [] });
      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      const components = await provider.getComponents();
      const toolOutputs = components.find((c) => c.name === 'tool_outputs');

      expect(toolOutputs?.metadata?.contentType).toBe('search_results');
    });

    it('should detect scrape_results content type', async () => {
      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        {
          role: MessageRole.ASSISTANT,
          content: 'Scraped',
          metadata: { toolCalls: [{ name: 'web_scrape', result: { content: '' } }] },
        },
      ]);

      const plan = createPlan({ goal: 'Test', tasks: [] });
      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      const components = await provider.getComponents();
      const toolOutputs = components.find((c) => c.name === 'tool_outputs');

      expect(toolOutputs?.metadata?.contentType).toBe('scrape_results');
    });

    it('should detect fetch content type', async () => {
      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        {
          role: MessageRole.ASSISTANT,
          content: 'Fetched',
          metadata: { toolCalls: [{ name: 'web_fetch', result: { content: '' } }] },
        },
      ]);

      const plan = createPlan({ goal: 'Test', tasks: [] });
      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      const components = await provider.getComponents();
      const toolOutputs = components.find((c) => c.name === 'tool_outputs');

      expect(toolOutputs?.metadata?.contentType).toBe('scrape_results');
    });

    it('should default to tool_output content type', async () => {
      mockHistoryManager.getRecentMessages = vi.fn().mockReturnValue([
        {
          role: MessageRole.ASSISTANT,
          content: 'Done',
          metadata: { toolCalls: [{ name: 'write_file', result: { success: true } }] },
        },
      ]);

      const plan = createPlan({ goal: 'Test', tasks: [] });
      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      const components = await provider.getComponents();
      const toolOutputs = components.find((c) => c.name === 'tool_outputs');

      expect(toolOutputs?.metadata?.contentType).toBe('tool_output');
    });
  });

  describe('updateConfig', () => {
    it('should reset detected task type when config changes', async () => {
      const researchPlan = createPlan({
        goal: 'Research AI',
        tasks: [{ name: 'search', description: 'Search' }],
      });

      const provider = new TaskAgentContextProvider({
        model: 'gpt-4',
        plan: researchPlan,
        memory: mockMemory,
        historyManager: mockHistoryManager,
      });

      // First detection
      expect(provider.getTaskType()).toBe('research');

      // Update with different plan
      const codingPlan = createPlan({
        goal: 'Implement feature',
        tasks: [{ name: 'code', description: 'Write code' }],
      });

      provider.updateConfig({ plan: codingPlan });

      // Should re-detect
      expect(provider.getTaskType()).toBe('coding');
    });
  });
});
