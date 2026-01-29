/**
 * Context provider for TaskAgent
 *
 * Provides context components for the unified ContextManager.
 * Works with IHistoryManager interface for history management.
 */

import type { IContextProvider, IContextComponent } from '../../../core/context/types.js';
import type { Plan } from '../../../domain/entities/Task.js';
import type { WorkingMemory } from '../../../capabilities/taskAgent/WorkingMemory.js';
import type { IHistoryManager, HistoryMessage } from '../../../domain/interfaces/IHistoryManager.js';
import { getModelInfo } from '../../../domain/entities/Model.js';

export interface TaskAgentContextProviderConfig {
  model: string;
  instructions?: string;
  plan: Plan;
  memory: WorkingMemory;
  historyManager: IHistoryManager;
  currentInput?: string;
}

/**
 * Context provider for TaskAgent
 */
export class TaskAgentContextProvider implements IContextProvider {
  private config: TaskAgentContextProviderConfig;

  constructor(config: TaskAgentContextProviderConfig) {
    this.config = config;
  }

  async getComponents(): Promise<IContextComponent[]> {
    const components: IContextComponent[] = [];

    // System prompt (never compact)
    components.push({
      name: 'system_prompt',
      content: this.buildSystemPrompt(),
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

    // Memory index (can evict)
    const memoryIndex = await this.config.memory.formatIndex();
    components.push({
      name: 'memory_index',
      content: memoryIndex,
      priority: 8,
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

    // Conversation history (can truncate) - use async IHistoryManager
    const messages = await this.config.historyManager.getRecentMessages();
    components.push({
      name: 'conversation_history',
      content: messages.map((m: HistoryMessage) => ({
        role: m.role,
        content: m.content,
      })),
      priority: 6,
      compactable: true,
      metadata: {
        strategy: 'truncate',
        truncatable: true,
      },
    });

    // Tool outputs from history (highest priority to compact)
    const toolOutputs = this.extractToolOutputs(messages);
    if (toolOutputs.length > 0) {
      components.push({
        name: 'tool_outputs',
        content: toolOutputs,
        priority: 10,
        compactable: true,
        metadata: {
          strategy: 'truncate',
          truncatable: true,
          maxTokens: 4000,
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
  }

  /**
   * Build system prompt for TaskAgent
   */
  private buildSystemPrompt(): string {
    return `You are an autonomous task-based agent executing a plan.

Your capabilities:
- Access to working memory (use memory_store, memory_retrieve, memory_delete tools)
- Tool execution for completing tasks
- Context awareness (use context_inspect, context_breakdown tools)

Guidelines:
- Complete each task as specified in the plan
- Store important information in memory for later tasks
- Use tools efficiently
- Be concise but thorough
- Monitor your context usage`;
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
    const deps = t.dependsOn && t.dependsOn.length > 0 ? ` (depends on: ${t.dependsOn.join(', ')})` : '';
    return `${i + 1}. [${status}] ${t.name}: ${t.description}${deps}`;
  })
  .join('\n')}`;
  }

  /**
   * Extract tool outputs from conversation history
   * Looks for tool results stored in message metadata
   */
  private extractToolOutputs(messages: HistoryMessage[]): Array<{ tool: string; output: unknown }> {
    const toolOutputs: Array<{ tool: string; output: unknown }> = [];

    for (const msg of messages) {
      // Look for tool call results in message metadata
      if (msg.role === 'assistant' && msg.metadata?.toolCalls) {
        const toolCalls = msg.metadata.toolCalls as Array<{ name: string; result?: unknown }>;
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
}
