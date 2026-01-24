/**
 * Context Management Demo
 *
 * Demonstrates the new universal context management system with strategies
 */

import {
  Connector,
  Vendor,
  ContextManager,
  TaskAgentContextProvider,
  ApproximateTokenEstimator,
  TruncateCompactor,
  MemoryEvictionCompactor,
  ProactiveCompactionStrategy,
  AggressiveCompactionStrategy,
  RollingWindowStrategy,
  AdaptiveStrategy,
} from '../src/index.js';
import { Plan } from '../src/domain/entities/Task.js';
import { WorkingMemory } from '../src/capabilities/taskAgent/WorkingMemory.js';
import { HistoryManager } from '../src/capabilities/taskAgent/HistoryManager.js';
import { createAgentStorage } from '../src/infrastructure/storage/InMemoryStorage.js';

// Setup
const storage = createAgentStorage({});
const memory = new WorkingMemory(storage.memory);
const historyManager = new HistoryManager({ maxMessages: 100 });

const plan: Plan = {
  id: 'plan-1',
  goal: 'Demo context management',
  tasks: [
    {
      id: 'task-1',
      name: 'test',
      description: 'Test task',
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    },
  ],
  status: 'running',
  createdAt: Date.now(),
  lastUpdatedAt: Date.now(),
};

// Example 1: Proactive Strategy (Default)
console.log('=== Example 1: Proactive Strategy ===\n');

const provider1 = new TaskAgentContextProvider({
  model: 'gpt-4',
  instructions: 'You are a helpful agent',
  plan,
  memory,
  historyManager,
  currentInput: 'Hello world',
});

const estimator = new ApproximateTokenEstimator();
const compactors = [
  new TruncateCompactor(estimator),
  new MemoryEvictionCompactor(estimator),
];

const contextManager1 = new ContextManager(
  provider1,
  {
    maxContextTokens: 128000,
    compactionThreshold: 0.75,
    strategy: 'proactive', // Default strategy
  },
  compactors,
  estimator
);

// Monitor events
contextManager1.on('compacting', ({ reason, strategy }) => {
  console.log(`⚠️  Compacting: ${reason} (using ${strategy})`);
});

contextManager1.on('compacted', ({ log, tokensFreed }) => {
  console.log(`✓ Compacted: freed ${tokensFreed} tokens`);
  log.forEach((entry) => console.log(`  - ${entry}`));
});

const prepared1 = await contextManager1.prepare();
console.log(`Status: ${prepared1.budget.status}`);
console.log(`Used: ${prepared1.budget.used} / ${prepared1.budget.total} tokens`);
console.log(`Utilization: ${prepared1.budget.utilizationPercent.toFixed(1)}%`);
console.log();

// Example 2: Aggressive Strategy
console.log('=== Example 2: Aggressive Strategy ===\n');

const provider2 = new TaskAgentContextProvider({
  model: 'gpt-4',
  instructions: 'You are a helpful agent',
  plan,
  memory,
  historyManager,
  currentInput: 'Hello world',
});

const contextManager2 = new ContextManager(
  provider2,
  {
    maxContextTokens: 128000,
    strategy: 'aggressive',
    strategyOptions: {
      threshold: 0.55, // Compact at 55%
      target: 0.45, // Target 45% utilization
    },
  },
  compactors,
  estimator
);

const prepared2 = await contextManager2.prepare();
console.log(`Status: ${prepared2.budget.status}`);
console.log(`Strategy: ${contextManager2.getStrategy().name}`);
console.log();

// Example 3: Rolling Window Strategy
console.log('=== Example 3: Rolling Window Strategy ===\n');

const provider3 = new TaskAgentContextProvider({
  model: 'gpt-4',
  instructions: 'You are a helpful agent',
  plan,
  memory,
  historyManager,
  currentInput: 'Hello world',
});

const contextManager3 = new ContextManager(
  provider3,
  {
    maxContextTokens: 128000,
    strategy: 'rolling-window',
    strategyOptions: {
      maxMessages: 15, // Keep only last 15 messages
    },
  },
  compactors,
  estimator
);

const prepared3 = await contextManager3.prepare();
console.log(`Status: ${prepared3.budget.status}`);
console.log(`Strategy: ${contextManager3.getStrategy().name}`);
console.log();

// Example 4: Adaptive Strategy
console.log('=== Example 4: Adaptive Strategy ===\n');

const provider4 = new TaskAgentContextProvider({
  model: 'gpt-4',
  instructions: 'You are a helpful agent',
  plan,
  memory,
  historyManager,
  currentInput: 'Hello world',
});

const contextManager4 = new ContextManager(
  provider4,
  {
    maxContextTokens: 128000,
    strategy: 'adaptive',
    strategyOptions: {
      learningWindow: 20,
      switchThreshold: 5,
    },
  },
  compactors,
  estimator
);

contextManager4.on('strategy_switched', ({ from, to, reason }) => {
  console.log(`🔄 Strategy switched: ${from} → ${to} (${reason})`);
});

const prepared4 = await contextManager4.prepare();
console.log(`Status: ${prepared4.budget.status}`);
console.log(`Current strategy: ${contextManager4.getStrategy().name}`);
const metrics4 = contextManager4.getStrategyMetrics();
console.log(`Metrics:`, metrics4);
console.log();

// Example 5: Runtime Strategy Switching
console.log('=== Example 5: Runtime Strategy Switching ===\n');

const provider5 = new TaskAgentContextProvider({
  model: 'gpt-4',
  instructions: 'You are a helpful agent',
  plan,
  memory,
  historyManager,
  currentInput: 'Hello world',
});

const contextManager5 = new ContextManager(
  provider5,
  {
    maxContextTokens: 128000,
    strategy: 'proactive',
  },
  compactors,
  estimator
);

console.log(`Initial strategy: ${contextManager5.getStrategy().name}`);

// Switch to aggressive for a resource-intensive task
contextManager5.setStrategy('aggressive');
console.log(`Switched to: ${contextManager5.getStrategy().name}`);

// Switch to adaptive for automatic optimization
contextManager5.setStrategy('adaptive');
console.log(`Switched to: ${contextManager5.getStrategy().name}`);
console.log();

// Example 6: Custom Strategy
console.log('=== Example 6: Custom Strategy ===\n');

import type { IContextStrategy, IContextComponent, ContextBudget, IContextCompactor, ITokenEstimator } from '../src/index.js';

class CustomBurstStrategy implements IContextStrategy {
  readonly name = 'custom-burst';

  shouldCompact(budget: ContextBudget): boolean {
    // Custom logic: compact only during "burst" windows
    const hour = new Date().getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;

    // More aggressive during business hours
    return isBusinessHours
      ? budget.utilizationPercent > 60
      : budget.utilizationPercent > 85;
  }

  async compact(
    components: IContextComponent[],
    budget: ContextBudget,
    compactors: IContextCompactor[],
    estimator: ITokenEstimator
  ) {
    console.log('Custom burst compaction logic');
    return { components, log: ['Custom compaction'], tokensFreed: 0 };
  }
}

const provider6 = new TaskAgentContextProvider({
  model: 'gpt-4',
  instructions: 'You are a helpful agent',
  plan,
  memory,
  historyManager,
  currentInput: 'Hello world',
});

const contextManager6 = new ContextManager(
  provider6,
  { maxContextTokens: 128000 },
  compactors,
  estimator,
  new CustomBurstStrategy() // Use custom strategy
);

console.log(`Custom strategy: ${contextManager6.getStrategy().name}`);
console.log();

console.log('=== Demo Complete ===');
