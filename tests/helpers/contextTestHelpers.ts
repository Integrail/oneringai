/**
 * Context Test Helpers
 *
 * Utilities for testing context management features with deterministic behavior
 * Updated for NextGen context architecture.
 */

import type { ContextBudget, ITokenEstimator, ContextFeatures, AgentContextNextGenConfig } from '@/core/context-nextgen/types.js';
import { AgentContextNextGen } from '@/core/context-nextgen/AgentContextNextGen.js';
import { vi } from 'vitest';

// ============================================================================
// Budget Helpers
// ============================================================================

/**
 * Create a mock ContextBudget at a specific utilization level
 */
export function createBudgetAtUtilization(
  utilizationPercent: number,
  total: number = 100000,
  reserved?: number
): ContextBudget {
  const reservedTokens = reserved ?? Math.floor(total * 0.15);
  const effectiveTotal = total - reservedTokens;
  const used = Math.floor((effectiveTotal * utilizationPercent) / 100);
  const available = effectiveTotal - used;

  return {
    maxTokens: total,
    responseReserve: reservedTokens,
    systemMessageTokens: Math.floor(used * 0.2),
    toolsTokens: Math.floor(used * 0.1),
    conversationTokens: Math.floor(used * 0.6),
    currentInputTokens: Math.floor(used * 0.1),
    totalUsed: used,
    available,
    utilizationPercent,
    breakdown: {
      systemPrompt: Math.floor(used * 0.1),
      persistentInstructions: 0,
      pluginInstructions: Math.floor(used * 0.05),
      pluginContents: {},
      tools: Math.floor(used * 0.1),
      conversation: Math.floor(used * 0.6),
      currentInput: Math.floor(used * 0.1),
    },
  };
}

/**
 * Create a budget at each threshold level for testing status transitions
 */
export function createBudgetAtStatus(status: 'ok' | 'warning' | 'critical', total: number = 100000): ContextBudget {
  const targetUtilization = {
    ok: 50,
    warning: 80,
    critical: 95,
  }[status];

  return createBudgetAtUtilization(targetUtilization, total);
}

// ============================================================================
// Token Estimator Helpers
// ============================================================================

/**
 * Create a mock token estimator with configurable behavior
 *
 * @param charsPerToken - Characters per token ratio (default: 4)
 */
export function createMockEstimator(charsPerToken: number = 4): ITokenEstimator {
  return {
    estimateTokens: vi.fn((text: string) => Math.ceil(text.length / charsPerToken)),
    estimateDataTokens: vi.fn((data: unknown) => {
      if (typeof data === 'string') {
        return Math.ceil(data.length / charsPerToken);
      }
      return Math.ceil(JSON.stringify(data).length / charsPerToken);
    }),
  };
}

// ============================================================================
// AgentContextNextGen Helpers
// ============================================================================

/**
 * Feature presets for common test scenarios
 */
export const FEATURE_PRESETS = {
  /** All features disabled - minimal context */
  minimal: {
    workingMemory: false,
    inContextMemory: false,
    persistentInstructions: false,
  } satisfies ContextFeatures,

  /** Default features */
  default: {
    workingMemory: true,
    inContextMemory: false,
    persistentInstructions: false,
  } satisfies ContextFeatures,

  /** All features enabled */
  full: {
    workingMemory: true,
    inContextMemory: true,
    persistentInstructions: true,
  } satisfies ContextFeatures,

  /** Memory only */
  memoryOnly: {
    workingMemory: true,
    inContextMemory: false,
    persistentInstructions: false,
  } satisfies ContextFeatures,

  /** InContextMemory only */
  inContextOnly: {
    workingMemory: false,
    inContextMemory: true,
    persistentInstructions: false,
  } satisfies ContextFeatures,
};

/**
 * Create a minimal AgentContextNextGen with all features disabled
 */
export function createMinimalContext(config?: Partial<AgentContextNextGenConfig>): AgentContextNextGen {
  return AgentContextNextGen.create({
    model: 'gpt-4',
    features: FEATURE_PRESETS.minimal,
    ...config,
  });
}

/**
 * Create a full-featured AgentContextNextGen with all features enabled
 */
export function createFullContext(config?: Partial<AgentContextNextGenConfig>): AgentContextNextGen {
  return AgentContextNextGen.create({
    model: 'gpt-4',
    features: FEATURE_PRESETS.full,
    agentId: config?.agentId ?? 'test-agent',
    ...config,
  });
}

/**
 * Create an AgentContextNextGen with specific features enabled
 */
export function createContextWithFeatures(
  features: ContextFeatures,
  config?: Partial<AgentContextNextGenConfig>
): AgentContextNextGen {
  return AgentContextNextGen.create({
    model: 'gpt-4',
    features,
    ...config,
  });
}

/**
 * Create a context pre-filled with conversation history
 */
export function createContextWithHistory(
  messageCount: number,
  config?: Partial<AgentContextNextGenConfig>
): AgentContextNextGen {
  const ctx = AgentContextNextGen.create({
    model: 'gpt-4',
    features: FEATURE_PRESETS.default,
    ...config,
  });

  for (let i = 0; i < messageCount; i++) {
    // Add user message
    ctx.addMessage('user', `Message ${i} from user`);
    // Add assistant response to move user message to conversation
    ctx.addAssistantResponse([{
      type: 'message',
      role: 'assistant' as const,
      content: [{ type: 'output_text' as const, text: `Response ${i} from assistant` }],
    }]);
  }

  return ctx;
}

// ============================================================================
// Test Assertions Helpers
// ============================================================================

/**
 * Verify budget utilization is within expected range
 */
export function expectUtilizationInRange(
  budget: ContextBudget,
  minPercent: number,
  maxPercent: number
): void {
  if (budget.utilizationPercent < minPercent || budget.utilizationPercent > maxPercent) {
    throw new Error(
      `Expected utilization between ${minPercent}% and ${maxPercent}% ` +
      `but got ${budget.utilizationPercent}%`
    );
  }
}

// ============================================================================
// Cleanup Helpers
// ============================================================================

/**
 * Safely destroy a context (handles already-destroyed contexts)
 */
export function safeDestroy(ctx: AgentContextNextGen | null | undefined): void {
  if (ctx && !ctx.isDestroyed) {
    ctx.destroy();
  }
}

/**
 * Create a cleanup function for test afterEach
 */
export function createCleanupFn(): { add: (ctx: AgentContextNextGen) => void; cleanup: () => void } {
  const contexts: AgentContextNextGen[] = [];

  return {
    add: (ctx: AgentContextNextGen) => contexts.push(ctx),
    cleanup: () => {
      contexts.forEach(safeDestroy);
      contexts.length = 0;
    },
  };
}
