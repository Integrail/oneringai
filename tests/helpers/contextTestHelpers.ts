/**
 * Context Test Helpers
 *
 * Utilities for testing context management features with deterministic behavior
 */

import type { ContextBudget, IContextComponent, ITokenEstimator } from '@/core/context/types.js';
import { AgentContext } from '@/core/AgentContext.js';
import type { AgentContextConfig, AgentContextFeatures } from '@/core/AgentContext.js';
import { vi } from 'vitest';

// ============================================================================
// Budget Helpers
// ============================================================================

/**
 * Create a mock ContextBudget at a specific utilization level
 *
 * @param utilizationPercent - Target utilization (0-100)
 * @param total - Total tokens (default: 100000)
 * @param reserved - Reserved tokens for response (default: 15% of total)
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

  // Calculate status based on overall utilization
  const overallUtilization = (used + reservedTokens) / total;
  let status: 'ok' | 'warning' | 'critical';

  if (overallUtilization >= 0.9) {
    status = 'critical';
  } else if (overallUtilization >= 0.75) {
    status = 'warning';
  } else {
    status = 'ok';
  }

  return {
    total,
    reserved: reservedTokens,
    used,
    available,
    utilizationPercent,
    status,
    breakdown: {},
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
// Component Helpers
// ============================================================================

/**
 * Create a mock IContextComponent
 *
 * @param name - Component name
 * @param content - Component content
 * @param options - Additional options
 */
export function createMockComponent(
  name: string,
  content: string | unknown,
  options: Partial<Omit<IContextComponent, 'name' | 'content'>> = {}
): IContextComponent {
  return {
    name,
    content,
    priority: options.priority ?? 5,
    compactable: options.compactable ?? true,
    metadata: options.metadata,
  };
}

/**
 * Create multiple mock components
 */
export function createMockComponents(count: number, prefix: string = 'component'): IContextComponent[] {
  return Array.from({ length: count }, (_, i) => createMockComponent(
    `${prefix}_${i}`,
    `Content for ${prefix}_${i}`,
    { priority: i }
  ));
}

/**
 * Create a component that can be truncated
 */
export function createTruncatableComponent(name: string, size: number): IContextComponent {
  return createMockComponent(name, 'x'.repeat(size), {
    compactable: true,
    metadata: { strategy: 'truncate', truncatable: true },
  });
}

/**
 * Create a component with eviction support
 */
export function createEvictableComponent(
  name: string,
  content: string,
  evictFn: (count: number) => Promise<void>,
  getUpdatedContentFn: () => Promise<string>
): IContextComponent {
  return createMockComponent(name, content, {
    compactable: true,
    metadata: {
      strategy: 'evict',
      avgEntrySize: 100,
      evict: evictFn,
      getUpdatedContent: getUpdatedContentFn,
    },
  });
}

/**
 * Create a summarizable component
 */
export function createSummarizableComponent(name: string, content: string): IContextComponent {
  return createMockComponent(name, content, {
    compactable: true,
    metadata: { strategy: 'summarize' },
  });
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
// AgentContext Helpers
// ============================================================================

/**
 * Feature presets for common test scenarios
 */
export const FEATURE_PRESETS = {
  /** All features disabled - minimal context */
  minimal: {
    memory: false,
    inContextMemory: false,
    history: false,
    permissions: false,
    persistentInstructions: false,
  } satisfies AgentContextFeatures,

  /** Default features - memory, history, permissions */
  default: {
    memory: true,
    inContextMemory: false,
    history: true,
    permissions: true,
    persistentInstructions: false,
  } satisfies AgentContextFeatures,

  /** All features enabled */
  full: {
    memory: true,
    inContextMemory: true,
    history: true,
    permissions: true,
    persistentInstructions: true,
  } satisfies AgentContextFeatures,

  /** Memory only - no history or permissions */
  memoryOnly: {
    memory: true,
    inContextMemory: false,
    history: false,
    permissions: false,
    persistentInstructions: false,
  } satisfies AgentContextFeatures,

  /** History only - no memory or permissions */
  historyOnly: {
    memory: false,
    inContextMemory: false,
    history: true,
    permissions: false,
    persistentInstructions: false,
  } satisfies AgentContextFeatures,

  /** InContextMemory only */
  inContextOnly: {
    memory: false,
    inContextMemory: true,
    history: false,
    permissions: false,
    persistentInstructions: false,
  } satisfies AgentContextFeatures,
};

/**
 * Create a minimal AgentContext with all features disabled
 * Good for testing specific features in isolation
 */
export function createMinimalContext(config?: Partial<AgentContextConfig>): AgentContext {
  return AgentContext.create({
    model: 'gpt-4',
    features: FEATURE_PRESETS.minimal,
    ...config,
  });
}

/**
 * Create a full-featured AgentContext with all features enabled
 */
export function createFullContext(config?: Partial<AgentContextConfig>): AgentContext {
  return AgentContext.create({
    model: 'gpt-4',
    features: FEATURE_PRESETS.full,
    agentId: config?.agentId ?? 'test-agent', // Required for persistentInstructions
    ...config,
  });
}

/**
 * Create an AgentContext with specific features enabled
 */
export function createContextWithFeatures(
  features: AgentContextFeatures,
  config?: Partial<AgentContextConfig>
): AgentContext {
  return AgentContext.create({
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
  config?: Partial<AgentContextConfig>
): AgentContext {
  const ctx = AgentContext.create({
    model: 'gpt-4',
    features: { ...FEATURE_PRESETS.default, history: true },
    ...config,
  });

  for (let i = 0; i < messageCount; i++) {
    ctx.addMessageSync('user', `Message ${i} from user`);
    ctx.addMessageSync('assistant', `Response ${i} from assistant`);
  }

  return ctx;
}

// ============================================================================
// Test Assertions Helpers
// ============================================================================

/**
 * Verify budget is at expected status
 */
export function expectBudgetStatus(budget: ContextBudget, expected: 'ok' | 'warning' | 'critical'): void {
  if (budget.status !== expected) {
    throw new Error(
      `Expected budget status '${expected}' but got '${budget.status}' ` +
      `(utilization: ${budget.utilizationPercent}%, used: ${budget.used}, total: ${budget.total})`
    );
  }
}

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
// Strategy Testing Helpers
// ============================================================================

/**
 * Create mock compactor that tracks calls
 */
export function createMockCompactor(name: string = 'mock-compactor') {
  const calls: Array<{ component: IContextComponent; targetTokens: number }> = [];

  return {
    compactor: {
      name,
      priority: 10,
      canCompact: vi.fn((_component: IContextComponent) => true),
      compact: vi.fn(async (component: IContextComponent, targetTokens: number) => {
        calls.push({ component, targetTokens });
        // Return a compacted version
        return {
          ...component,
          content: 'compacted',
          metadata: { ...component.metadata, compacted: true },
        };
      }),
      estimateSavings: vi.fn(() => 100),
    },
    calls,
    reset: () => {
      calls.length = 0;
    },
  };
}

// ============================================================================
// Context Manager Config Helpers
// ============================================================================

/**
 * Create a context manager config for testing
 */
export function createTestContextConfig(overrides: Record<string, unknown> = {}) {
  return {
    maxContextTokens: 100000,
    compactionThreshold: 0.75,
    hardLimit: 0.9,
    responseReserve: 0.15,
    estimator: 'approximate' as const,
    autoCompact: true,
    strategy: 'proactive' as const,
    strategyOptions: {},
    ...overrides,
  };
}

// ============================================================================
// Memory Test Helpers
// ============================================================================

/**
 * Fill memory with test entries
 */
export async function fillMemory(
  ctx: AgentContext,
  count: number,
  options: { keyPrefix?: string; valueSize?: number } = {}
): Promise<void> {
  const { keyPrefix = 'test_key', valueSize = 100 } = options;
  const memory = ctx.memory;
  if (!memory) {
    throw new Error('Memory is not enabled on this context');
  }

  for (let i = 0; i < count; i++) {
    await memory.store(
      `${keyPrefix}_${i}`,
      `Test entry ${i}`,
      { data: 'x'.repeat(valueSize) }
    );
  }
}

/**
 * Fill memory with entries at different priorities
 */
export async function fillMemoryWithPriorities(
  ctx: AgentContext,
  counts: { low?: number; normal?: number; high?: number; critical?: number }
): Promise<void> {
  const memory = ctx.memory;
  if (!memory) {
    throw new Error('Memory is not enabled on this context');
  }

  const tiers = [
    { tier: 'findings' as const, count: counts.critical ?? 0 },
    { tier: 'intermediate' as const, count: counts.high ?? 0 },
    { tier: 'context' as const, count: counts.normal ?? 0 },
    { tier: 'raw' as const, count: counts.low ?? 0 },
  ];

  for (const { tier, count } of tiers) {
    for (let i = 0; i < count; i++) {
      await memory.store(
        `${tier}_${i}`,
        `${tier} entry ${i}`,
        { data: `${tier}_value_${i}` },
        { tier }
      );
    }
  }
}

// ============================================================================
// Cleanup Helpers
// ============================================================================

/**
 * Safely destroy a context (handles already-destroyed contexts)
 */
export function safeDestroy(ctx: AgentContext | null | undefined): void {
  if (ctx && !ctx.isDestroyed) {
    ctx.destroy();
  }
}

/**
 * Create a cleanup function for test afterEach
 */
export function createCleanupFn(): { add: (ctx: AgentContext) => void; cleanup: () => void } {
  const contexts: AgentContext[] = [];

  return {
    add: (ctx: AgentContext) => contexts.push(ctx),
    cleanup: () => {
      contexts.forEach(safeDestroy);
      contexts.length = 0;
    },
  };
}
