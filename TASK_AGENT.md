# TaskAgent - Autonomous Task-Based Agents

**Version:** 2.0 (Phase 2)
**Status:** Production Ready
**Updated:** 2026-01-23

## Overview

TaskAgent is an extension to the `@oneringai/agents` library that provides autonomous, task-based agent execution with advanced context management and state persistence for long-running workflows.

**New in Version 2.0:**
- ✨ **PlanningAgent** - AI-driven plan generation from goals
- ✨ **Context Inspection Tools** - 4 tools for agent self-awareness
- ✨ **Enhanced Observability** - Agents can monitor their own state

## Key Features

### 1. **Indexed Working Memory**
- Store/retrieve data with descriptive keys
- Lazy-loading: keys + descriptions always in context, full data retrieved on demand
- Automatic size tracking and LRU eviction
- Scoped memory: task-scoped (cleared after completion) vs persistent

### 2. **Proactive Context Management**
- Token estimation before every LLM call
- Automatic compaction when approaching context limits
- Configurable strategies: truncate tool outputs, summarize history, evict memory
- Prevents context overflow errors

### 3. **Plan-Based Execution**
- Define goals with structured tasks
- Task dependencies (sequential, parallel, conditional)
- External dependencies (webhooks, polling, manual approval, scheduled)
- Dynamic task modification during execution

### 4. **Tool Call Idempotency**
- Automatic caching of tool results
- Prevents duplicate side effects (double emails, double payments)
- Custom cache key generation per tool
- TTL-based expiration

### 5. **Long-Running Agent Support**
- State persistence (plan, memory, conversation)
- Suspend/resume capability
- External event handling
- Crash recovery

### 6. **Extensibility**
- Hooks for all lifecycle events
- Custom storage backends (Redis, Postgres, etc.)
- Simplified KV adapter for persistence
- Event-driven architecture

### 7. **AI-Driven Planning (NEW)**
- PlanningAgent generates task graphs from goals
- Automatic dependency identification
- Complexity estimation
- Plan refinement with feedback
- Separate planning and execution phases

### 8. **Context Inspection Tools (NEW)**
- `context_inspect()` - Monitor context budget
- `context_breakdown()` - Analyze token usage
- `cache_stats()` - Track cache effectiveness
- `memory_stats()` - View working memory state

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TaskAgent                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Hooks & Middleware System                     │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Working Memory  │  Context Manager  │  Plan Executor          │
│  - Indexed KV    │  - Token tracking │  - Task scheduling      │
│  - LRU eviction  │  - Auto-compaction│  - Parallel execution   │
│  - Persistence   │  - Tool truncation│  - Conditional logic    │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```typescript
import { Connector, Vendor, TaskAgent } from '@oneringai/agents';

// Create connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create TaskAgent
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool],
  memoryConfig: {
    maxSizeBytes: 1024 * 1024, // 1MB
  },
});

// Execute a plan
const handle = await agent.start({
  goal: 'Check weather and notify user',
  tasks: [
    { name: 'fetch_weather', description: 'Get weather for SF' },
    { name: 'send_email', description: 'Email user', dependsOn: ['fetch_weather'] },
  ],
});

// Wait for completion
const result = await handle.wait();
console.log('Status:', result.status);
```

## AI-Driven Planning (NEW)

PlanningAgent generates task graphs automatically from high-level goals.

### Basic Usage

```typescript
import { PlanningAgent, TaskAgent } from '@oneringai/agents';

// 1. Create Planning Agent
const planner = PlanningAgent.create({
  connector: 'openai',
  model: 'gpt-3.5-turbo',  // Cheaper model for planning
  availableTools: [searchTool, analysisTool, reportTool]
});

// 2. Generate Plan from Goal
const generated = await planner.generatePlan({
  goal: 'Generate market research report on AI agents',
  context: 'Focus on enterprise use cases and pricing',
  constraints: ['Include 3+ competitors', 'Under 500 words']
});

// 3. Review Generated Plan
console.log(`Tasks generated: ${generated.plan.tasks.length}`);
console.log(`Complexity: ${generated.complexity}`);
console.log(`Reasoning: ${generated.reasoning}`);

// 4. (Optional) Refine Plan
const refined = await planner.refinePlan(generated.plan,
  'Add task to analyze pricing trends'
);

// 5. Execute with TaskAgent
const executor = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',  // More powerful for execution
  tools: [searchTool, analysisTool, reportTool]
});

const result = await executor.start(refined.plan);
```

### Benefits

- **Less Manual Work** - AI breaks down goals automatically
- **Better Task Graphs** - AI identifies optimal dependencies
- **Cost Optimization** - Use cheaper models for planning
- **Iterative Refinement** - Review and adjust before execution
- **Separate Concerns** - Planning phase separate from execution

### API Reference

```typescript
PlanningAgent.create({
  connector: string | Connector,
  model: string,
  maxPlanningIterations?: number,      // Default: 20
  planningTemperature?: number,        // Default: 0.3
  availableTools?: ToolFunction[]      // Inform AI of capabilities
});

planner.generatePlan({
  goal: string,
  context?: string,
  constraints?: string[]
}) => Promise<GeneratedPlan>

planner.refinePlan(
  plan: Plan,
  feedback: string
) => Promise<GeneratedPlan>
```

## Context Inspection Tools (NEW)

TaskAgent includes 4 built-in tools for agents to inspect their own state.

### Available Tools

```typescript
// 1. context_inspect() - Context budget overview
const info = await context_inspect();
// Returns: { total_tokens, used_tokens, available_tokens,
//            utilization_percent, status: 'ok'|'warning'|'critical' }

// 2. context_breakdown() - Detailed token usage
const breakdown = await context_breakdown();
// Returns: { components: [{ name, tokens, percent }, ...] }

// 3. cache_stats() - Idempotency cache metrics
const stats = await cache_stats();
// Returns: { entries, hits, misses, hit_rate, effectiveness }

// 4. memory_stats() - Working memory info
const memory = await memory_stats();
// Returns: { entry_count, entries: [{ key, description }, ...] }
```

### Use Cases

**1. Check Context Before Large Operations**
```typescript
const context = await context_inspect();
if (context.status === 'warning') {
  // Clean up before continuing
  await memory_delete({ key: 'old_data' });
}
```

**2. Debug Context Overflow**
```typescript
const breakdown = await context_breakdown();
const largest = breakdown.components.sort((a,b) => b.tokens - a.tokens)[0];
console.log(`${largest.name} using ${largest.percent}% of context`);
```

**3. Verify Cache Effectiveness**
```typescript
const stats = await cache_stats();
console.log(`Cache preventing ${stats.hits} duplicate calls`);
console.log(`Effectiveness: ${stats.effectiveness}`);
```

**4. Monitor Memory Usage**
```typescript
const memory = await memory_stats();
console.log(`Stored ${memory.entry_count} entries`);
memory.entries.forEach(e => console.log(`- ${e.key}: ${e.description}`));
```

### Benefits

- **Self-Awareness** - Agents understand their own state
- **Proactive** - Prevent issues before they occur
- **Debuggable** - Easy to diagnose resource problems
- **Intelligent** - Make informed decisions about resources

## Working Memory

The agent has indexed working memory with lazy loading:

```typescript
// Memory tools are automatically available to the agent
// The agent calls these during execution:

// Store data (agent decides what to keep)
memory_store({
  key: 'user.profile',
  description: 'User profile with email and preferences',
  value: { email: 'user@example.com', premium: true }
});

// Retrieve data when needed
const profile = memory_retrieve({ key: 'user.profile' });

// Delete to free space
memory_delete({ key: 'old_data' });
```

**In the agent's context:**
```
## Working Memory (42KB / 1MB - 4.2%)

**persistent:**
- `user.auth` (0.2KB): OAuth token, expires 2024-01-15

**task:**
- `user.profile` (0.3KB): User email and preferences
- `api.response` (38KB): Payment API response with transaction ID

Use memory_retrieve("key") to load full content.
```

## Task Types

### Sequential Tasks
```typescript
{
  tasks: [
    { name: 'step1', description: 'First step' },
    { name: 'step2', description: 'Second step', dependsOn: ['step1'] },
    { name: 'step3', description: 'Third step', dependsOn: ['step2'] },
  ]
}
```

### Parallel Tasks
```typescript
{
  concurrency: { maxParallelTasks: 3, strategy: 'fifo' },
  tasks: [
    { name: 'fetch_users', description: '...', execution: { parallel: true } },
    { name: 'fetch_orders', description: '...', execution: { parallel: true } },
    { name: 'fetch_products', description: '...', execution: { parallel: true } },
    { name: 'combine', description: '...', dependsOn: ['fetch_users', 'fetch_orders', 'fetch_products'] },
  ]
}
```

### Conditional Tasks
```typescript
{
  tasks: [
    { name: 'check_premium', description: 'Check if user is premium' },
    {
      name: 'premium_feature',
      description: 'Premium-only feature',
      dependsOn: ['check_premium'],
      condition: {
        memoryKey: 'user.isPremium',
        operator: 'equals',
        value: true,
        onFalse: 'skip',
      },
    },
  ]
}
```

### External Dependencies

**Webhook:**
```typescript
{
  name: 'wait_approval',
  description: 'Wait for manager approval',
  externalDependency: {
    type: 'webhook',
    webhookId: 'approval-123',
    timeoutMs: 86400000, // 24 hours
    state: 'waiting',
  },
}

// Later, trigger from webhook handler:
await agent.triggerExternal('approval-123', { approved: true });
```

**Polling:**
```typescript
{
  name: 'wait_job',
  description: 'Wait for batch job',
  externalDependency: {
    type: 'poll',
    pollConfig: {
      toolName: 'check_job_status',
      toolArgs: { jobId: 'job-123' },
      intervalMs: 30000, // Poll every 30s
      maxAttempts: 60,
    },
    state: 'waiting',
  },
}
```

**Manual:**
```typescript
{
  name: 'manual_review',
  description: 'Requires human review',
  externalDependency: {
    type: 'manual',
    manualDescription: 'Please review the document and approve',
    state: 'waiting',
  },
}

// Complete manually:
await agent.completeTaskManually(taskId, { approved: true, comments: '...' });
```

## Persistence & Resume

```typescript
import { FileAgentStorage } from './custom-storage';

// Create agent with persistent storage
const storage = new FileAgentStorage({ directory: './agent-data' });

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [apiTool],
  storage,
});

// Start execution
const handle = await agent.start({
  goal: 'Long-running workflow',
  tasks: [
    { name: 'step1', description: 'Step 1' },
    {
      name: 'wait_approval',
      description: 'Wait for approval',
      externalDependency: { type: 'webhook', webhookId: 'approval-123', state: 'waiting' },
    },
    { name: 'step2', description: 'Step 2', dependsOn: ['wait_approval'] },
  ],
});

// Agent suspends when hitting webhook wait...

// Later, in a different process or after restart:
const resumedAgent = await TaskAgent.resume(handle.agentId, {
  storage,
  tools: [apiTool], // Tools must be re-provided
});

await resumedAgent.triggerExternal('approval-123', { approved: true });
// Agent continues from where it left off
```

## Tool Idempotency

Mark tools as safe (naturally idempotent) or configure caching:

```typescript
// Safe tool (GET requests, pure functions)
const getTool: ToolFunction = {
  definition: { /* ... */ },
  execute: async (args) => { /* ... */ },
  idempotency: { safe: true }, // No caching needed
};

// Non-safe tool with caching
const createTool: ToolFunction = {
  definition: { /* ... */ },
  execute: async (args) => { /* ... */ },
  idempotency: {
    safe: false,
    keyFn: (args) => `create:${args.userId}:${args.itemId}`, // Custom key
    ttlMs: 3600000, // Cache for 1 hour
  },
};
```

If the agent calls `createTool` twice with the same args, the second call returns the cached result instead of re-executing.

## Context Management

TaskAgent automatically manages context window size:

```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],

  // Context manager is internal, but you can observe it via events
});

agent.on('context:compacted', (log) => {
  console.log('Context was compacted:', log);
  // ["Truncated tool outputs to 4000 tokens", "Evicted 3 memory entries"]
});

agent.on('memory:limit_warning', ({ utilization }) => {
  console.log(`Memory at ${utilization}% capacity`);
});
```

## Hooks

Customize agent behavior with hooks:

```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],

  hooks: {
    beforeTask: async (task) => {
      // Can return 'skip' to skip task
      if (task.name === 'dangerous' && !process.env.ALLOW_DANGEROUS) {
        return 'skip';
      }
    },

    afterTool: async (tool, args, result) => {
      // Log all tool calls
      await auditLog.record({ tool: tool.definition.function.name, args, result });
      return result;
    },

    onError: async (error, context) => {
      // Custom error handling
      await alerting.notify(error);
      return context.task?.attempts < 3 ? 'retry' : 'fail';
    },
  },
});
```

## Custom Storage

Implement simple KV storage for persistence:

```typescript
import { SimpleKVStorage, createStorageFromKV } from '@oneringai/agents';
import Redis from 'ioredis';

const redis = new Redis();

const kvStorage: SimpleKVStorage = {
  get: (key) => redis.get(key),
  set: (key, value) => redis.set(key, value),
  delete: (key) => redis.del(key),
  list: (prefix) => redis.keys(`${prefix}*`),
};

const storage = createStorageFromKV(kvStorage);

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [],
  storage, // Uses Redis for all persistence
});
```

## Implementation Details

### Test Coverage
- **336 tests** for TaskAgent functionality
- **100% pass rate**
- Unit tests for all domain entities
- Integration tests for full workflow
- All tests written BEFORE implementation (TDD)

### Performance Optimizations
- Write-behind caching for state
- Checkpoint strategies (time-based, event-based)
- Lazy loading for memory retrieval
- Parallel task execution
- Tool result caching

### Architecture Patterns
- Clean Architecture (domain, infrastructure, capabilities)
- Unified tool system (same ToolFunction for Agent and TaskAgent)
- Event-driven for observability
- Interface-based for extensibility

## Development Status

### Phase 1: Critical Fixes ✅ COMPLETE
- ✅ Fixed EventEmitter memory leaks
- ✅ Added TTL cleanup to IdempotencyCache
- ✅ Integrated IdempotencyCache with tool execution
- ✅ Fixed CheckpointManager async cleanup
- ✅ Fixed CheckpointManager interval timer

### Phase 2: Architecture Improvements ✅ COMPLETE
- ✅ **PlanningAgent** - AI-driven plan generation
- ✅ **Context Inspection Tools** - 4 new tools (context_inspect, context_breakdown, cache_stats, memory_stats)
- ✅ **Enhanced ToolContext** - contextManager and idempotencyCache fields
- ✅ **ContextManager inspection** - getCurrentBudget, getConfig, getStrategy methods

### Core Features ✅ COMPLETE
- ✅ Domain entities (Memory, Task, AgentState)
- ✅ Storage interfaces & in-memory implementations
- ✅ Working memory with indexed access
- ✅ Context manager with auto-compaction
- ✅ Idempotency cache for tools (fully integrated)
- ✅ Memory tools (store, retrieve, delete, list)
- ✅ **Full TaskAgent orchestration**
- ✅ **PlanExecutor with LLM integration**
- ✅ **ExternalDependencyHandler** (webhooks, polling, scheduled, manual)
- ✅ **HistoryManager** with conversation tracking
- ✅ **CheckpointManager** for state persistence
- ✅ **Complete execution loop** - Full agentic loop with LLM calls

### Phase 3: Production Hardening ⏭️ NEXT
- ⏭️ Rate limiting for tools
- ⏭️ Circuit breaker pattern
- ⏭️ Production observability (structured logging, metrics)
- ⏭️ File-based & Redis storage adapters
- ⏭️ Production deployment guide

### Phase 4: Testing & Validation 🚧 PLANNED
- 🚧 Memory leak tests
- 🚧 Performance benchmarks
- 🚧 OpenTelemetry observability

## How to Run

```bash
# Core TaskAgent examples
npm run example:task-agent        # Basic usage
npm run example:task-agent-demo   # Full feature demo

# Phase 2 examples (NEW)
npm run example:planning-agent-demo      # AI-driven planning
npm run example:context-inspection-demo  # Context inspection tools
```

## Next Steps

1. **Storage Adapters** - File, Redis, Postgres implementations for production
2. **Advanced Execution** - Sub-plans, loops, branching logic
3. **Observability** - OpenTelemetry tracing, metrics dashboards
4. **Performance** - Optimize for high-throughput scenarios
5. **Documentation** - API docs, architecture guide, migration guide

## Files Added

### Domain Layer
- `src/domain/entities/Memory.ts` - Memory data structures
- `src/domain/entities/Task.ts` - Task & Plan entities
- `src/domain/entities/AgentState.ts` - Agent state for persistence
- `src/domain/interfaces/IMemoryStorage.ts` - Memory persistence interface
- `src/domain/interfaces/IPlanStorage.ts` - Plan persistence interface
- `src/domain/interfaces/IAgentStateStorage.ts` - Agent state persistence interface
- `src/domain/interfaces/IToolContext.ts` - Tool execution context

### Infrastructure Layer
- `src/infrastructure/storage/InMemoryStorage.ts` - Default storage implementations

### Capabilities Layer
- `src/capabilities/taskAgent/TaskAgent.ts` - Main orchestrator
- `src/capabilities/taskAgent/WorkingMemory.ts` - Memory management
- `src/capabilities/taskAgent/ContextManager.ts` - Context window management
- `src/capabilities/taskAgent/IdempotencyCache.ts` - Tool call caching
- `src/capabilities/taskAgent/memoryTools.ts` - Built-in memory tools

### Tests (336 tests)
- `tests/unit/taskAgent/*.test.ts` - Unit tests for all components
- `tests/integration/taskAgent/*.test.ts` - Integration tests

## Usage Example

See `examples/task-agent-basic.ts` for a complete working example.

---

**Status:** Core implementation complete with full test coverage. Ready for integration with actual LLM execution loop.
