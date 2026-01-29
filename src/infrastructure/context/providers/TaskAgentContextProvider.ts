/**
 * Context provider for TaskAgent
 *
 * Provides context components for the unified ContextManager.
 * Works with IHistoryManager interface for history management.
 *
 * Supports task type detection with specialized system prompts
 * for different task categories (research, coding, analysis, general).
 */

import type { IContextProvider, IContextComponent } from '../../../core/context/types.js';
import type { Plan } from '../../../domain/entities/Task.js';
import type { WorkingMemory } from '../../../capabilities/taskAgent/WorkingMemory.js';
import type { IHistoryManager, HistoryMessage } from '../../../domain/interfaces/IHistoryManager.js';
import { getModelInfo } from '../../../domain/entities/Model.js';

/**
 * Task type determines which system prompt and priority profile to use
 */
export type TaskType = 'research' | 'coding' | 'analysis' | 'general';

/**
 * Component priority profile for different task types
 * Lower priority = compacted first
 */
export interface ComponentPriorityProfile {
  conversation_history: number;
  tool_outputs: number;
  memory_index: number;
}

/**
 * Priority profiles for different task types
 *
 * Research tasks: Preserve tool outputs (search/scrape results) longer
 * Coding tasks: Conversation history more important, tool outputs less critical
 * General: Balanced approach
 */
export const PRIORITY_PROFILES: Record<TaskType, ComponentPriorityProfile> = {
  research: {
    conversation_history: 10, // Compact first (old chat not critical in research)
    tool_outputs: 5,          // Preserve longer (contains research data!)
    memory_index: 3,          // Preserve longest (summaries live here)
  },
  coding: {
    conversation_history: 8,  // Keep more context
    tool_outputs: 10,         // Code output less critical once executed
    memory_index: 5,
  },
  analysis: {
    conversation_history: 7,
    tool_outputs: 6,          // Analysis results important
    memory_index: 4,
  },
  general: {
    conversation_history: 6,  // Current defaults (balanced)
    tool_outputs: 10,
    memory_index: 8,
  },
};

/**
 * Specialized system prompts for different task types
 */
const TASK_TYPE_PROMPTS: Record<TaskType, string> = {
  research: `## Research Protocol

You are conducting research. Follow this workflow to preserve findings:

### 1. SEARCH PHASE
- Execute searches to find relevant sources
- After EACH search, immediately store key findings:
  \`memory_store({ key: "search.{topic}.summary", description: "Search findings for {topic}", value: {summary}, tier: "summary", priority: "normal" })\`

### 2. READ PHASE
For each promising result:
- Read/scrape the content
- Extract key points (2-3 sentences per source)
- Store IMMEDIATELY:
  \`memory_store({ key: "finding.{source_name}", description: "Key points from {source}", value: {summary}, tier: "findings", priority: "high" })\`
- Do NOT keep full articles in conversation - only summaries

### 3. SYNTHESIZE PHASE
Before writing final report:
- Use \`memory_list()\` to see all stored findings
- Retrieve relevant findings with \`memory_retrieve(key)\`
- Cross-reference and consolidate

### 4. CONTEXT MANAGEMENT RULES
- Your context may be compacted automatically
- Always store important findings in memory IMMEDIATELY after receiving them
- Stored summaries survive compaction; conversation history may not
- Use \`context_inspect()\` to check context usage when near limits
- Tier hierarchy: "raw" (low priority) → "summary" (normal) → "findings" (high priority)
- Never leave important search results only in conversation - they WILL be lost`,

  coding: `## Coding Protocol

You are implementing code changes. Follow these guidelines:

### WORKFLOW
1. Understand requirements from the plan
2. Read relevant files before making changes
3. Implement incrementally, testing as you go
4. Store key design decisions in memory

### MEMORY USAGE
- Store design decisions: \`memory_store({ key: "design.{feature}", ... })\`
- Store API contracts: \`memory_store({ key: "api.{endpoint}", ... })\`
- Store error patterns: \`memory_store({ key: "error.{issue}", ... })\`

### CONTEXT MANAGEMENT
- Code file contents are large - don't keep full files in conversation
- Summarize code structure after reading
- Focus on the specific sections being modified`,

  analysis: `## Analysis Protocol

You are performing data analysis. Follow these guidelines:

### WORKFLOW
1. Load and examine data sources
2. Perform analysis steps
3. Store intermediate results in memory
4. Synthesize findings

### MEMORY USAGE
- Store data summaries: \`memory_store({ key: "data.{source}.summary", ... })\`
- Store intermediate calculations: \`memory_store({ key: "calc.{step}", ... })\`
- Store final findings: \`memory_store({ key: "finding.{topic}", tier: "findings", ... })\`

### CONTEXT MANAGEMENT
- Raw data is large - summarize immediately after loading
- Store statistical summaries, not raw numbers
- Keep only essential context for current analysis step`,

  general: `## Task Execution Guidelines

### MEMORY USAGE
- Store important information using \`memory_store()\`
- Retrieve stored data with \`memory_retrieve(key)\`
- Check what's stored with \`memory_list()\`

### CONTEXT AWARENESS
- Your context window is limited
- Store important findings in memory before they're compacted
- Use \`context_inspect()\` to check usage`,
};

export interface TaskAgentContextProviderConfig {
  model: string;
  instructions?: string;
  plan: Plan;
  memory: WorkingMemory;
  historyManager: IHistoryManager;
  currentInput?: string;
  /** Task type for specialized prompts and priorities (default: auto-detect) */
  taskType?: TaskType;
  /** Custom system prompt (overrides task type prompt) */
  customSystemPrompt?: string;
  /** Custom priority profile (overrides task type profile) */
  customPriorityProfile?: Partial<ComponentPriorityProfile>;
}

/**
 * Context provider for TaskAgent
 */
export class TaskAgentContextProvider implements IContextProvider {
  private config: TaskAgentContextProviderConfig;
  private detectedTaskType?: TaskType;

  constructor(config: TaskAgentContextProviderConfig) {
    this.config = config;
  }

  async getComponents(): Promise<IContextComponent[]> {
    const components: IContextComponent[] = [];

    // Detect task type if not explicitly set
    const taskType = this.getTaskType();
    const priorities = this.getPriorityProfile(taskType);

    // System prompt (never compact)
    components.push({
      name: 'system_prompt',
      content: this.buildSystemPrompt(taskType),
      priority: 0,
      compactable: false,
    });

    // Instructions (never compact)
    if (this.config.instructions) {
      components.push({
        name: 'instructions',
        content: this.config.instructions,
        priority: 0,
        compactable: false,
      });
    }

    // Plan (never compact)
    components.push({
      name: 'plan',
      content: this.serializePlan(this.config.plan),
      priority: 1,
      compactable: false,
    });

    // Memory index (can evict) - priority from profile
    const memoryIndex = await this.config.memory.formatIndex();
    components.push({
      name: 'memory_index',
      content: memoryIndex,
      priority: priorities.memory_index,
      compactable: true,
      metadata: {
        strategy: 'evict',
        evict: async (count: number) => {
          await this.config.memory.evictLRU(count);
        },
        getUpdatedContent: async () => {
          return await this.config.memory.formatIndex();
        },
      },
    });

    // Conversation history - priority from profile, use summarize strategy for research
    const messages = await this.config.historyManager.getRecentMessages();
    components.push({
      name: 'conversation_history',
      content: messages.map((m: HistoryMessage) => ({
        role: m.role,
        content: m.content,
      })),
      priority: priorities.conversation_history,
      compactable: true,
      metadata: {
        strategy: taskType === 'research' ? 'summarize' : 'truncate',
        truncatable: true,
        contentType: 'conversation',
      },
    });

    // Tool outputs from history - priority from profile, use summarize for research
    const toolOutputs = this.extractToolOutputs(messages);
    if (toolOutputs.length > 0) {
      components.push({
        name: 'tool_outputs',
        content: toolOutputs,
        priority: priorities.tool_outputs,
        compactable: true,
        metadata: {
          strategy: taskType === 'research' ? 'summarize' : 'truncate',
          truncatable: true,
          maxTokens: 4000,
          contentType: this.detectToolOutputContentType(toolOutputs),
        },
      });
    }

    // Current input (never compact)
    if (this.config.currentInput) {
      components.push({
        name: 'current_input',
        content: this.config.currentInput,
        priority: 0,
        compactable: false,
      });
    }

    return components;
  }

  async applyCompactedComponents(components: IContextComponent[]): Promise<void> {
    // Update conversation history if it was compacted
    const historyComponent = components.find((c) => c.name === 'conversation_history');
    if (historyComponent && Array.isArray(historyComponent.content)) {
      // The history manager will be updated through the eviction callbacks
      // No need to do anything here as compaction already happened
    }

    // Memory eviction already happened through the callback
  }

  getMaxContextSize(): number {
    const modelInfo = getModelInfo(this.config.model);
    return modelInfo?.features.input.tokens ?? 128000;
  }

  /**
   * Update configuration (e.g., when task changes)
   */
  updateConfig(updates: Partial<TaskAgentContextProviderConfig>): void {
    this.config = { ...this.config, ...updates };
    // Reset detected task type if config changes
    this.detectedTaskType = undefined;
  }

  /**
   * Get the current task type (explicit or detected)
   */
  getTaskType(): TaskType {
    // Use explicit task type if set
    if (this.config.taskType) {
      return this.config.taskType;
    }

    // Use cached detection
    if (this.detectedTaskType) {
      return this.detectedTaskType;
    }

    // Auto-detect from plan goal and task descriptions
    this.detectedTaskType = this.detectTaskType();
    return this.detectedTaskType;
  }

  /**
   * Get priority profile for task type
   */
  getPriorityProfile(taskType: TaskType): ComponentPriorityProfile {
    const baseProfile = PRIORITY_PROFILES[taskType];

    // Apply custom overrides if set
    if (this.config.customPriorityProfile) {
      return { ...baseProfile, ...this.config.customPriorityProfile };
    }

    return baseProfile;
  }

  /**
   * Auto-detect task type from plan content
   */
  private detectTaskType(): TaskType {
    const goal = this.config.plan.goal.toLowerCase();
    const taskDescriptions = this.config.plan.tasks
      .map((t) => `${t.name} ${t.description}`)
      .join(' ')
      .toLowerCase();
    const combined = `${goal} ${taskDescriptions}`;

    // Research indicators
    const researchKeywords = [
      'research',
      'search',
      'find',
      'investigate',
      'discover',
      'explore',
      'gather information',
      'look up',
      'scrape',
      'web search',
      'crawl',
      'collect data',
      'survey',
      'study',
    ];
    if (researchKeywords.some((kw) => combined.includes(kw))) {
      return 'research';
    }

    // Coding indicators
    const codingKeywords = [
      'code',
      'implement',
      'develop',
      'program',
      'function',
      'class',
      'refactor',
      'debug',
      'fix bug',
      'write code',
      'api',
      'endpoint',
      'module',
      'component',
      'typescript',
      'javascript',
      'python',
    ];
    if (codingKeywords.some((kw) => combined.includes(kw))) {
      return 'coding';
    }

    // Analysis indicators
    const analysisKeywords = [
      'analyze',
      'analysis',
      'calculate',
      'compute',
      'evaluate',
      'assess',
      'compare',
      'statistics',
      'metrics',
      'measure',
      'data',
      'report',
      'chart',
      'graph',
    ];
    if (analysisKeywords.some((kw) => combined.includes(kw))) {
      return 'analysis';
    }

    return 'general';
  }

  /**
   * Build system prompt for TaskAgent
   */
  private buildSystemPrompt(taskType: TaskType): string {
    // Use custom prompt if provided
    if (this.config.customSystemPrompt) {
      return this.config.customSystemPrompt;
    }

    const basePrompt = `You are an autonomous task-based agent executing a plan.

Your capabilities:
- Access to working memory (use memory_store, memory_retrieve, memory_delete, memory_list tools)
- Tool execution for completing tasks
- Context awareness (use context_inspect, context_breakdown tools)

Base guidelines:
- Complete each task as specified in the plan
- Store important information in memory for later tasks
- Use tools efficiently
- Be concise but thorough
- Monitor your context usage`;

    const taskTypePrompt = TASK_TYPE_PROMPTS[taskType];

    return `${basePrompt}

${taskTypePrompt}`;
  }

  /**
   * Serialize plan for context
   */
  private serializePlan(plan: Plan): string {
    return `## Current Plan

**Goal**: ${plan.goal}

**Tasks**:
${plan.tasks
  .map((t, i) => {
    const status = t.status || 'pending';
    const deps =
      t.dependsOn && t.dependsOn.length > 0
        ? ` (depends on: ${t.dependsOn.join(', ')})`
        : '';
    return `${i + 1}. [${status}] ${t.name}: ${t.description}${deps}`;
  })
  .join('\n')}`;
  }

  /**
   * Extract tool outputs from conversation history
   * Looks for tool results stored in message metadata
   */
  private extractToolOutputs(
    messages: HistoryMessage[]
  ): Array<{ tool: string; output: unknown }> {
    const toolOutputs: Array<{ tool: string; output: unknown }> = [];

    for (const msg of messages) {
      // Look for tool call results in message metadata
      if (msg.role === 'assistant' && msg.metadata?.toolCalls) {
        const toolCalls = msg.metadata.toolCalls as Array<{
          name: string;
          result?: unknown;
        }>;
        for (const toolCall of toolCalls) {
          if (toolCall.result) {
            toolOutputs.push({
              tool: toolCall.name,
              output: toolCall.result,
            });
          }
        }
      }
    }

    return toolOutputs;
  }

  /**
   * Detect content type from tool outputs for better summarization
   */
  private detectToolOutputContentType(
    toolOutputs: Array<{ tool: string; output: unknown }>
  ): string {
    const toolNames = toolOutputs.map((t) => t.tool.toLowerCase());

    if (toolNames.some((n) => n.includes('search') || n.includes('web_search'))) {
      return 'search_results';
    }

    if (
      toolNames.some(
        (n) =>
          n.includes('scrape') || n.includes('fetch') || n.includes('web_fetch')
      )
    ) {
      return 'scrape_results';
    }

    return 'tool_output';
  }
}
