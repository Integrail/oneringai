# TaskAgent - Complete User Guide

**Version:** 2.0 (Phase 2 - with AI Planning & Context Inspection)
**Date:** 2026-01-23
**Audience:** Developers using the `@oneringai/agents` library

**What's New in Version 2.0:**
- ✨ **PlanningAgent** - AI-driven plan generation
- ✨ **Context Inspection Tools** - 4 new tools for agent self-awareness
- ✨ **Enhanced Observability** - Agents can monitor their own state

---

## Table of Contents

1. [Introduction](#introduction)
2. [When to Use TaskAgent](#when-to-use-taskagent)
3. [Getting Started](#getting-started)
4. [AI-Driven Planning with PlanningAgent](#ai-driven-planning-with-planningagent) **NEW**
5. [Planning Your Tasks](#planning-your-tasks)
6. [Working Memory Guide](#working-memory-guide)
7. [Context Management](#context-management)
   - [Context Inspection Tools](#context-inspection-tools) **NEW**
8. [Tool Best Practices](#tool-best-practices)
9. [External Dependencies](#external-dependencies)
10. [Persistence & Resume](#persistence--resume)
11. [Error Handling](#error-handling)
12. [Performance Tuning](#performance-tuning)
13. [Production Deployment](#production-deployment)
14. [Troubleshooting](#troubleshooting)
15. [Real-World Examples](#real-world-examples)
16. [Migration Guide](#migration-guide)

---

## Introduction

TaskAgent extends the basic `Agent` class with advanced features for long-running, complex workflows:

**Key Differences:**

| Feature | Basic Agent | TaskAgent |
|---------|-------------|-----------|
| Execution model | Single prompt/response | Multi-task plan |
| Memory | Conversation history only | Indexed working memory |
| Context management | Manual | Automatic compaction |
| Long-running | No (single session) | Yes (suspend/resume) |
| External events | No | Yes (webhooks, polling) |
| State persistence | No | Yes (checkpoints) |

**Use TaskAgent when:**
- Workflow has multiple distinct steps
- Need to store intermediate results
- Execution takes > 5 minutes
- Need to wait for external events
- Want to resume after interruption

**Use Basic Agent when:**
- Simple request/response
- No state between calls
- Execution < 1 minute
- No external dependencies

---

## When to Use TaskAgent

### ✅ Good Use Cases

#### 1. Multi-Step Workflows
```typescript
// Research report generation
const plan = {
  goal: 'Generate market research report',
  tasks: [
    { name: 'gather_data', description: 'Search web for market data' },
    { name: 'analyze_trends', description: 'Analyze data for trends', dependsOn: ['gather_data'] },
    { name: 'create_visualizations', description: 'Generate charts', dependsOn: ['analyze_trends'] },
    { name: 'write_report', description: 'Write final report', dependsOn: ['create_visualizations'] }
  ]
};
```

#### 2. Long-Running Operations
```typescript
// Video processing pipeline
const plan = {
  goal: 'Process uploaded video',
  tasks: [
    { name: 'upload', description: 'Upload to storage' },
    { name: 'transcode', description: 'Wait for transcoding',
      externalDependency: { type: 'poll', pollConfig: { /* ... */ } } },
    { name: 'generate_thumbnails', description: 'Create thumbnails' },
    { name: 'extract_metadata', description: 'Extract video metadata' }
  ]
};
```

#### 3. Approval Workflows
```typescript
// Purchase order approval
const plan = {
  goal: 'Process purchase order',
  tasks: [
    { name: 'validate_order', description: 'Check inventory and pricing' },
    { name: 'await_approval', description: 'Wait for manager approval',
      externalDependency: { type: 'webhook', webhookId: 'po-approval-123' } },
    { name: 'place_order', description: 'Submit to vendor', dependsOn: ['await_approval'] },
    { name: 'notify_user', description: 'Send confirmation email' }
  ]
};
```

#### 4. Data Pipeline
```typescript
// ETL pipeline
const plan = {
  goal: 'Import and transform customer data',
  tasks: [
    { name: 'extract_from_api', description: 'Fetch data from API' },
    { name: 'validate_data', description: 'Check data quality' },
    { name: 'transform_schema', description: 'Convert to target schema' },
    { name: 'load_to_db', description: 'Insert into database' },
    { name: 'send_report', description: 'Email summary to admin' }
  ]
};
```

### ❌ Poor Use Cases

#### 1. Simple Q&A (Use Basic Agent)
```typescript
// DON'T use TaskAgent for this
const agent = TaskAgent.create({ /* ... */ });
await agent.start({
  goal: 'What is the weather in Paris?',  // Overkill
  tasks: [{ name: 'get_weather', description: 'Check weather' }]
});

// DO use Basic Agent
const agent = Agent.create({ /* ... */ });
const response = await agent.run('What is the weather in Paris?');
```

#### 2. Single API Call (Use Basic Agent)
```typescript
// DON'T use TaskAgent
await taskAgent.start({
  goal: 'Get user profile',
  tasks: [{ name: 'fetch', description: 'Call /users/me' }]
});

// DO use Basic Agent
const response = await agent.run('Call the get_user_profile tool');
```

#### 3. Real-Time Chat (Use Basic Agent with Streaming)
```typescript
// DON'T use TaskAgent for chat
// DO use streaming Agent
for await (const chunk of agent.stream('Hello, how are you?')) {
  process.stdout.write(chunk.delta);
}
```

---

## Getting Started

### Installation

```bash
npm install @oneringai/agents
```

### Basic Setup

```typescript
import {
  Connector,
  Vendor,
  TaskAgent,
  ToolFunction
} from '@oneringai/agents';

// 1. Create connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! }
});

// 2. Define tools
const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' }
        },
        required: ['location']
      }
    }
  },
  execute: async (args) => {
    // Your implementation
    return { temp: 72, condition: 'sunny', location: args.location };
  },
  idempotency: { safe: true }  // Read-only operation
};

// 3. Create TaskAgent
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
  memoryConfig: {
    maxSizeBytes: 1024 * 1024  // 1MB
  }
});

// 4. Execute plan
const handle = await agent.start({
  goal: 'Check weather and provide recommendation',
  context: 'User is planning outdoor activities',
  tasks: [
    {
      name: 'fetch_weather',
      description: 'Get weather for San Francisco'
    },
    {
      name: 'make_recommendation',
      description: 'Based on weather, suggest activities',
      dependsOn: ['fetch_weather']
    }
  ]
});

// 5. Wait for completion
const result = await handle.wait();
console.log('Status:', result.status);
console.log('Completed:', result.metrics.completedTasks);
```

---

## AI-Driven Planning with PlanningAgent

### Overview

**NEW in Phase 2:** The `PlanningAgent` class provides AI-driven plan generation. Instead of manually creating task graphs, let the AI analyze your goal and generate a structured plan.

**Key Benefits:**
- **Less manual work** - AI breaks down goals automatically
- **Better task graphs** - AI identifies optimal dependencies
- **Separate concerns** - Planning phase separate from execution
- **Cost optimization** - Use cheaper models for planning
- **Iterative refinement** - Review and adjust plans before execution

### When to Use PlanningAgent

**Use PlanningAgent when:**
- ✅ Goal is complex or has many steps
- ✅ You want AI to figure out the task breakdown
- ✅ Need to review plan before execution
- ✅ Want to iterate on the plan design

**Skip PlanningAgent when:**
- ❌ Task structure is simple and obvious
- ❌ You already have a well-defined plan
- ❌ Single-step workflows

### Basic Usage

```typescript
import { PlanningAgent, TaskAgent, Connector, Vendor } from '@oneringai/agents';

// 1. Create Planning Agent
const planner = PlanningAgent.create({
  connector: 'openai',
  model: 'gpt-3.5-turbo',  // Cheaper model for planning
  planningTemperature: 0.3,  // Lower = more deterministic
  availableTools: [searchTool, analysisTool, reportTool]  // Inform AI what's available
});

// 2. Generate Plan
const generated = await planner.generatePlan({
  goal: 'Generate a market research report on AI agents',
  context: 'Focus on enterprise use cases, competitive landscape, pricing',
  constraints: [
    'Must include at least 3 competitors',
    'Budget: $50 for API calls',
    'Complete within 30 minutes'
  ]
});

// 3. Review the Plan
console.log('Generated Plan:');
console.log(`Goal: ${generated.plan.goal}`);
console.log(`Complexity: ${generated.complexity}`);
console.log(`Tasks: ${generated.plan.tasks.length}`);
console.log('\nReasoning:', generated.reasoning);

generated.plan.tasks.forEach((task, i) => {
  console.log(`${i + 1}. ${task.name}: ${task.description}`);
  if (task.dependsOn.length > 0) {
    console.log(`   Dependencies: ${task.dependsOn.join(', ')}`);
  }
});

// 4. Execute the Plan
const executor = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',  // More powerful model for execution
  tools: [searchTool, analysisTool, reportTool]
});

const handle = await executor.start(generated.plan);
const result = await handle.wait();
```

### Plan Refinement

If the generated plan needs adjustments, use `refinePlan()`:

```typescript
// Initial plan
const generated = await planner.generatePlan({
  goal: 'Analyze customer feedback',
  context: 'We have 5000 feedback entries'
});

// Review and provide feedback
const refined = await planner.refinePlan(generated.plan,
  'Add a task to filter out spam/invalid entries before analysis'
);

// Execute refined plan
await executor.start(refined.plan);
```

### Planning vs Manual Design

**PlanningAgent (AI-Driven):**
```typescript
// Simple input
const generated = await planner.generatePlan({
  goal: 'Process customer orders for shipment',
  context: 'E-commerce platform with inventory management'
});

// AI generates:
// 1. validate_orders - Check order data validity
// 2. check_inventory - Verify items in stock
// 3. reserve_items - Reserve inventory for orders
// 4. calculate_shipping - Calculate shipping costs
// 5. generate_labels - Create shipping labels
// 6. send_notifications - Notify customers
```

**Manual Design (Traditional):**
```typescript
// Must specify everything
await taskAgent.start({
  goal: 'Process customer orders',
  tasks: [
    { name: 'validate_orders', description: '...' },
    { name: 'check_inventory', description: '...', dependsOn: ['validate_orders'] },
    { name: 'reserve_items', description: '...', dependsOn: ['check_inventory'] },
    // ... manually define all tasks and dependencies
  ]
});
```

### Configuration Options

```typescript
PlanningAgent.create({
  // Required
  connector: 'openai' | Connector,
  model: string,

  // Optional
  maxPlanningIterations?: number,       // Default: 20
  planningTemperature?: number,         // Default: 0.3 (low for structured output)
  availableTools?: ToolFunction[],      // Helps AI understand capabilities
});
```

### Complexity Estimation

PlanningAgent automatically estimates plan complexity:

```typescript
const { complexity } = await planner.generatePlan({ /* ... */ });

switch (complexity) {
  case 'low':    // 1-3 tasks, no dependencies
  case 'medium': // 4-10 tasks, simple dependencies
  case 'high':   // 10+ tasks, conditionals, external deps
}
```

Use this to:
- Decide on execution timeout
- Choose appropriate model for execution
- Set checkpoint frequency

### Cost Optimization

**Strategy: Use cheap model for planning, expensive for execution**

```typescript
// Planning: $0.0005 per plan (gpt-3.5-turbo)
const planner = PlanningAgent.create({
  model: 'gpt-3.5-turbo'
});

// Execution: Varies by task complexity (gpt-4)
const executor = TaskAgent.create({
  model: 'gpt-4'
});

// Savings: ~80% on planning phase
// Planning only happens once, execution may take many calls
```

### Best Practices

#### 1. **Provide Context**
```typescript
// ❌ Vague
await planner.generatePlan({
  goal: 'Process data'
});

// ✅ Clear
await planner.generatePlan({
  goal: 'Process customer survey data',
  context: 'CSV file with 10,000 responses, need sentiment analysis and summary'
});
```

#### 2. **List Available Tools**
```typescript
// Helps AI understand what's possible
PlanningAgent.create({
  model: 'gpt-3.5-turbo',
  availableTools: [csvParser, sentimentAnalysis, summarizer, emailer]
});
```

#### 3. **Review Before Execution**
```typescript
const generated = await planner.generatePlan({ /* ... */ });

// ALWAYS review the plan
console.log(generated.plan.tasks);

// Can modify manually if needed
generated.plan.tasks.push({
  name: 'additional_step',
  description: 'Something AI missed'
});

// Then execute
await executor.start(generated.plan);
```

#### 4. **Iterate on Complex Goals**
```typescript
// Start with high-level plan
const v1 = await planner.generatePlan({
  goal: 'Build analytics dashboard'
});

// Refine based on review
const v2 = await planner.refinePlan(v1.plan,
  'Split data_processing into separate ETL tasks'
);

// Final refinement
const v3 = await planner.refinePlan(v2.plan,
  'Add error handling and retry logic'
);
```

### Limitations

**Current Limitations:**
- Planning tools are simplified (not fully interactive yet)
- No multi-turn planning negotiation
- Can't directly modify plan during execution (must use `updatePlan()`)

**Workarounds:**
- Use `allowDynamicTasks: true` for agents to modify during execution
- Use `refinePlan()` for iterative improvements
- Manual adjustments after generation

### Example: Research Report Generation

```typescript
const planner = PlanningAgent.create({
  connector: 'openai',
  model: 'gpt-3.5-turbo',
  availableTools: [webSearch, scraper, analyzer, writer, editor]
});

const generated = await planner.generatePlan({
  goal: 'Generate comprehensive research report on quantum computing trends',
  context: `
    Target audience: Technology executives
    Length: 20 pages
    Must include: market size, key players, recent breakthroughs, predictions
  `,
  constraints: [
    'Use only reputable sources',
    'Include citations',
    'Complete within 2 hours'
  ]
});

// AI might generate:
// 1. research_topic - Initial web research on quantum computing
// 2. identify_sources - Find reputable academic and industry sources
// 3. extract_market_data - Gather market size and growth data
// 4. analyze_competitors - Research key players and their offerings
// 5. compile_breakthroughs - Collect recent technological advances
// 6. synthesize_predictions - Analyze trends for future predictions
// 7. create_outline - Structure the report
// 8. write_sections - Write each section (parallel tasks)
// 9. compile_citations - Generate bibliography
// 10. edit_and_format - Final editing pass

// Execute the generated plan
const executor = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [webSearch, scraper, analyzer, writer, editor]
});

const result = await executor.start(generated.plan);
```

---

## Planning Your Tasks

### Task Design Principles

#### 1. **Single Responsibility**
Each task should do ONE thing well.

```typescript
// ❌ BAD: Task does too much
{
  name: 'process_order',
  description: 'Validate order, check inventory, charge payment, send confirmation'
}

// ✅ GOOD: Break into separate tasks
[
  { name: 'validate_order', description: 'Check order data is valid' },
  { name: 'check_inventory', description: 'Verify items in stock' },
  { name: 'charge_payment', description: 'Process payment' },
  { name: 'send_confirmation', description: 'Email order confirmation' }
]
```

#### 2. **Clear Dependencies**
Tasks should have explicit dependencies, not implicit.

```typescript
// ❌ BAD: Implicit dependency
[
  { name: 'analyze_data', description: 'Analyze sales data (assumes it was fetched)' }
]

// ✅ GOOD: Explicit dependency
[
  { name: 'fetch_sales_data', description: 'Get sales data from API' },
  { name: 'analyze_data', description: 'Analyze sales trends',
    dependsOn: ['fetch_sales_data'] }
]
```

#### 3. **Descriptive Names**
Task names should clearly indicate what they do.

```typescript
// ❌ BAD: Vague names
{ name: 'task1', description: 'Do the first thing' }
{ name: 'process', description: 'Process stuff' }

// ✅ GOOD: Clear, descriptive names
{ name: 'fetch_user_preferences', description: 'Retrieve user preferences from database' }
{ name: 'generate_personalized_email', description: 'Create email based on preferences' }
```

#### 4. **Appropriate Granularity**
Balance between too fine and too coarse.

```typescript
// ❌ TOO FINE: 20 micro-tasks
{ name: 'open_file', description: 'Open the file' }
{ name: 'read_first_line', description: 'Read first line' }
{ name: 'parse_first_line', description: 'Parse first line' }
// ... etc

// ❌ TOO COARSE: One mega-task
{ name: 'do_everything', description: 'Complete entire workflow' }

// ✅ JUST RIGHT: Logical groupings
{ name: 'load_data', description: 'Load and parse input file' }
{ name: 'transform_data', description: 'Apply business rules and transformations' }
{ name: 'save_results', description: 'Write results to output' }
```

### Task Execution Patterns

#### Sequential Tasks
```typescript
{
  tasks: [
    { name: 'step1', description: '...' },
    { name: 'step2', description: '...', dependsOn: ['step1'] },
    { name: 'step3', description: '...', dependsOn: ['step2'] }
  ]
}
```

**Visualization:**
```
step1 → step2 → step3
```

#### Parallel Tasks
```typescript
{
  concurrency: { maxParallelTasks: 3, strategy: 'fifo' },
  tasks: [
    { name: 'fetch_users', description: '...', execution: { parallel: true } },
    { name: 'fetch_orders', description: '...', execution: { parallel: true } },
    { name: 'fetch_products', description: '...', execution: { parallel: true } },
    { name: 'combine_data', description: '...',
      dependsOn: ['fetch_users', 'fetch_orders', 'fetch_products'] }
  ]
}
```

**Visualization:**
```
fetch_users  ┐
fetch_orders ├─→ combine_data
fetch_products ┘
```

#### Fan-Out / Fan-In
```typescript
{
  tasks: [
    { name: 'prepare_input', description: 'Load input file' },

    // Fan out - parallel processing
    { name: 'process_chunk_1', description: '...', dependsOn: ['prepare_input'] },
    { name: 'process_chunk_2', description: '...', dependsOn: ['prepare_input'] },
    { name: 'process_chunk_3', description: '...', dependsOn: ['prepare_input'] },

    // Fan in - combine results
    { name: 'merge_results', description: '...',
      dependsOn: ['process_chunk_1', 'process_chunk_2', 'process_chunk_3'] }
  ]
}
```

**Visualization:**
```
                 ┌─→ process_chunk_1 ─┐
prepare_input ──┼─→ process_chunk_2 ─┼─→ merge_results
                 └─→ process_chunk_3 ─┘
```

#### Conditional Execution
```typescript
{
  tasks: [
    { name: 'check_user_tier', description: 'Determine if user is premium' },

    // Only for premium users
    { name: 'premium_feature', description: 'Premium-only analysis',
      condition: {
        memoryKey: 'user.isPremium',
        operator: 'equals',
        value: true,
        onFalse: 'skip'
      }
    },

    // Always runs
    { name: 'basic_analysis', description: 'Standard analysis' }
  ]
}
```

---

## Working Memory Guide

### Understanding Memory Scopes

#### Task-Scoped Memory
Automatically cleared after task completion. Use for:
- Intermediate results
- Temporary calculations
- Large API responses

```typescript
// Agent stores during task execution:
await memory_store({
  key: 'api.raw_response',
  description: 'Raw API response from weather service',
  value: { temp: 72, humidity: 65, /* ... */ }
  // scope: 'task' is default
});

// After task completes → DELETED automatically
```

#### Persistent Memory
Survives across tasks. Use for:
- User preferences
- Authentication tokens
- Configuration data

```typescript
// Agent stores and persists:
await memory_store({
  key: 'user.auth_token',
  description: 'OAuth token for API access',
  value: { token: 'abc123', expires: 1234567890 }
  // Agent must explicitly set scope: 'persistent'
});

// Persists even after task completes
```

### Memory Access Patterns

#### Lazy Loading (Recommended)
```typescript
// Memory index always in context (lightweight):
// ## Working Memory (42KB / 1MB - 4.2%)
//
// **persistent:**
// - `user.auth` (0.2KB): OAuth token
//
// **task:**
// - `api.response` (38KB): API response with 500 items
//
// Use memory_retrieve("key") to load full content.

// Agent only loads when needed:
const fullData = await memory_retrieve({ key: 'api.response' });
```

#### Eager Loading (Not Recommended)
```typescript
// ❌ BAD: Loads everything into context immediately
const allData = {
  user: await memory_retrieve({ key: 'user.profile' }),
  api: await memory_retrieve({ key: 'api.response' }),
  config: await memory_retrieve({ key: 'config.settings' })
};
// Context now bloated with 38KB+ of data
```

### Memory Size Management

```typescript
// Listen for memory warnings
agent.on('memory:limit_warning', ({ utilization }) => {
  console.warn(`Memory at ${utilization}% - consider cleaning up`);
});

// Agent can check memory state:
const stats = await memory_stats();
// {
//   total_size: '512KB',
//   utilization_percent: 82.5,
//   entry_count: 15,
//   entries_by_scope: { persistent: 3, task: 12 }
// }

// Agent can delete old entries:
await memory_delete({ key: 'old_data' });
```

### Best Practices

#### ✅ DO: Store Large Tool Outputs
```typescript
const searchResults = await search_web({ query: 'market trends' });
// Results are 50KB

// Store with descriptive key
await memory_store({
  key: 'search.market_trends',
  description: 'Web search results for market trends (50 items)',
  value: searchResults
});
```

#### ✅ DO: Use Descriptive Keys
```typescript
// GOOD: Hierarchical, descriptive
'user.profile.email'
'api.weather.current'
'analysis.trends.quarterly'

// BAD: Flat, vague
'data1'
'temp'
'result'
```

#### ❌ DON'T: Store Redundant Data
```typescript
// BAD: Storing same data multiple times
await memory_store({ key: 'user_data', value: userData });
await memory_store({ key: 'user_backup', value: userData });  // Duplicate!

// GOOD: Single source of truth
await memory_store({ key: 'user.profile', value: userData });
```

#### ❌ DON'T: Store Secrets
```typescript
// BAD: Storing raw passwords
await memory_store({
  key: 'user.password',
  value: 'hunter2'  // Never store passwords!
});

// GOOD: Store tokens (with expiration)
await memory_store({
  key: 'user.session',
  value: { token: 'abc123', expires: Date.now() + 3600000 }
});
```

---

## Context Management

### Understanding Context Windows

```
┌────────────────────────────────────────────────┐
│            Model Context Window                 │
│               (128,000 tokens)                  │
├────────────────────────────────────────────────┤
│  System Prompt (2,000 tokens)                  │
├────────────────────────────────────────────────┤
│  Instructions (500 tokens)                     │
├────────────────────────────────────────────────┤
│  Memory Index (5,000 tokens)                   │
│  - Keys + descriptions only                    │
│  - Full data retrieved on demand               │
├────────────────────────────────────────────────┤
│  Conversation History (30,000 tokens)          │
│  - Previous task prompts                       │
│  - LLM responses                               │
│  - Tool call results                           │
├────────────────────────────────────────────────┤
│  Current Task Prompt (1,000 tokens)            │
├────────────────────────────────────────────────┤
│  Reserved for Response (19,200 tokens - 15%)   │
└────────────────────────────────────────────────┘

Total Used: 38,500 tokens (30%)
Available: 70,300 tokens
Status: ✅ OK
```

### Automatic Compaction

When context approaches limits (75%), TaskAgent automatically compacts:

**Priority Order (configurable):**
1. **Tool Outputs** - Truncate large outputs first
2. **Conversation History** - Summarize or truncate old messages
3. **Memory Entries** - Evict task-scoped entries (LRU)

```typescript
// Compaction triggered automatically
agent.on('context:compacting', ({ reason }) => {
  console.log('Compacting:', reason);
  // "Context at 76.2%"
});

agent.on('context:compacted', ({ log }) => {
  console.log('Compaction log:', log);
  // ["Truncated tool outputs to 4000 tokens",
  //  "Evicted 3 memory entries: api.old1, api.old2, temp.cache"]
});
```

### Context Inspection Tools

**NEW in Phase 2:** TaskAgent now includes 4 built-in tools for agents to inspect their own state. These tools provide **self-awareness** - agents can monitor resources and make intelligent decisions.

#### Available Tools

| Tool | Purpose | Returns |
|------|---------|---------|
| `context_inspect()` | Context budget overview | Total/used/available tokens, status |
| `context_breakdown()` | Detailed token usage | Token breakdown by component |
| `cache_stats()` | Idempotency cache metrics | Hit rate, entries, effectiveness |
| `memory_stats()` | Working memory info | Entry count, size, list |

#### 1. `context_inspect()` - Context Budget Overview

**Purpose:** Get high-level overview of context usage

```typescript
const info = await context_inspect();
console.log(info);
// Returns:
{
  total_tokens: 128000,
  reserved_tokens: 19200,
  used_tokens: 38500,
  available_tokens: 70300,
  utilization_percent: 30.0,
  status: 'ok',  // 'ok' | 'warning' | 'critical'
  warning: null  // Message if status is warning/critical
}
```

**Status Levels:**
- `ok` - Under 75% utilization
- `warning` - 75-90% utilization (compaction may trigger)
- `critical` - Over 90% utilization (compaction will trigger)

**Use Cases:**
```typescript
// Example: Agent checks before storing large data
const context = await context_inspect();
if (context.status === 'warning') {
  // Clean up old entries first
  await memory_delete({ key: 'old_temp_data' });
}
// Now safe to store
await memory_store({ key: 'new_data', description: '...', value: largeData });
```

#### 2. `context_breakdown()` - Detailed Token Usage

**Purpose:** Understand exactly what's consuming context space

```typescript
const breakdown = await context_breakdown();
console.log(breakdown);
// Returns:
{
  total_used: 38500,
  breakdown: {
    systemPrompt: 2000,
    instructions: 500,
    memoryIndex: 5000,
    conversationHistory: 30000,
    currentInput: 1000
  },
  components: [
    { name: 'system_prompt', tokens: 2000, percent: 5.2 },
    { name: 'instructions', tokens: 500, percent: 1.3 },
    { name: 'memory_index', tokens: 5000, percent: 13.0 },
    { name: 'conversation_history', tokens: 30000, percent: 77.9 },
    { name: 'current_input', tokens: 1000, percent: 2.6 }
  ]
}
```

**Use Cases:**
```typescript
// Example: Debug why context is full
const breakdown = await context_breakdown();
const largest = breakdown.components.reduce((max, c) =>
  c.tokens > max.tokens ? c : max
);
console.log(`Largest component: ${largest.name} (${largest.percent}%)`);

if (largest.name === 'conversation_history' && largest.percent > 70) {
  // History is dominating - adjust compaction strategy
  console.log('Consider increasing history compaction frequency');
}
```

#### 3. `cache_stats()` - Idempotency Cache Metrics

**Purpose:** Monitor cache effectiveness and prevent duplicate operations

```typescript
const stats = await cache_stats();
console.log(stats);
// Returns:
{
  entries: 15,
  hits: 42,
  misses: 8,
  hit_rate: 84.0,
  hit_rate_percent: '84%',
  effectiveness: 'high'  // 'high' | 'medium' | 'low' | 'none'
}
```

**Effectiveness Levels:**
- `high` - Hit rate > 50%
- `medium` - Hit rate 20-50%
- `low` - Hit rate < 20%
- `none` - No hits yet

**Use Cases:**
```typescript
// Example: Verify idempotency is working
const stats = await cache_stats();
console.log(`Cache hit rate: ${stats.hit_rate_percent}`);

if (stats.effectiveness === 'low') {
  console.log('Warning: Low cache effectiveness');
  console.log('Consider adjusting tool idempotency settings');
}

// After adding idempotency to a tool
const before = await cache_stats();
// ... perform operations ...
const after = await cache_stats();
console.log(`Prevented ${after.hits - before.hits} duplicate calls`);
```

#### 4. `memory_stats()` - Working Memory Info

**Purpose:** Monitor memory utilization and entry count

```typescript
const memory = await memory_stats();
console.log(memory);
// Returns:
{
  entry_count: 12,
  entries_by_scope: { total: 12 },
  entries: [
    { key: 'user.profile', description: 'User email and preferences' },
    { key: 'api.response', description: 'API response with 500 items' },
    // ... all entries
  ]
}
```

**Use Cases:**
```typescript
// Example: List all stored data
const memory = await memory_stats();
console.log(`Stored ${memory.entry_count} entries:`);
memory.entries.forEach(entry => {
  console.log(`- ${entry.key}: ${entry.description}`);
});

// Example: Check if specific data exists
const memory = await memory_stats();
const hasUserData = memory.entries.some(e => e.key.startsWith('user.'));
if (!hasUserData) {
  // Fetch user data first
  await fetchUserProfile();
}
```

#### Proactive Resource Management

Agents can use these tools to **manage their own resources**:

```typescript
// Smart agent that monitors itself
await agent.start({
  goal: 'Process large dataset',
  tasks: [
    {
      name: 'load_data',
      description: 'Load dataset from API'
    },
    {
      name: 'check_resources',
      description: 'Verify we have enough space for processing'
    },
    {
      name: 'process_data',
      description: 'Process the data if resources available'
    }
  ]
});

// During check_resources task, agent calls:
// 1. Check context space
const context = await context_inspect();
if (context.utilization_percent > 80) {
  // Clean up conversation history
  console.log('Context at 80%, cleaning up...');
}

// 2. Check memory usage
const memory = await memory_stats();
if (memory.entry_count > 20) {
  // Delete old temporary entries
  await memory_delete({ key: 'temp_cache' });
}

// 3. Check cache effectiveness
const cache = await cache_stats();
if (cache.effectiveness === 'low') {
  console.log('Note: Cache not helping much, may want to adjust');
}
```

#### Debugging with Inspection Tools

**Problem:** Context overflow errors

```typescript
// Add inspection task before problematic operation
await agent.start({
  goal: 'Debug context issue',
  tasks: [
    { name: 'inspect_before', description: 'Check context before operation' },
    { name: 'large_operation', description: 'Operation that causes overflow' },
  ]
});

// Agent calls context_breakdown() and discovers:
// "conversation_history is using 85% of context!"
// Solution: Increase compaction frequency or use larger model
```

**Problem:** Duplicate API calls

```typescript
// Check if idempotency is working
const stats = await cache_stats();
console.log(`Cache effectiveness: ${stats.effectiveness}`);
console.log(`Prevented ${stats.hits} duplicate calls`);

if (stats.effectiveness === 'none') {
  // Idempotency not configured correctly
  console.log('Tool idempotency settings need adjustment');
}
```

#### Best Practices

**1. Check Context Before Large Operations**
```typescript
// ✅ Good practice
const context = await context_inspect();
if (context.available_tokens < 10000) {
  // Not enough space for large response
  await cleanup_old_data();
}
```

**2. Monitor Cache Effectiveness**
```typescript
// ✅ Check periodically
const stats = await cache_stats();
if (stats.hit_rate < 20) {
  // Cache not helping, investigate why
}
```

**3. Use for Debugging**
```typescript
// ✅ Add inspection tasks when debugging
{
  name: 'debug_context',
  description: 'Get detailed context breakdown to diagnose issue'
}
```

**4. Don't Over-Use**
```typescript
// ❌ Bad: Checking every iteration
for (let i = 0; i < 100; i++) {
  const context = await context_inspect();  // Wasteful
  // ...
}

// ✅ Good: Check when needed
if (errorOccurred && errorMessage.includes('context')) {
  const context = await context_inspect();
  console.log('Context state:', context);
}
```

### Model Selection for Context

| Model | Context Window | Best For |
|-------|----------------|----------|
| gpt-4 | 8K | Short tasks, tight budgets |
| gpt-4-turbo | 128K | Long tasks, complex history |
| gpt-4-32k | 32K | Medium tasks |
| claude-3-opus | 200K | Very long tasks |
| claude-3-sonnet | 200K | Long tasks, lower cost |

**Rule of Thumb:**
- Tasks with < 10 steps: 8K-32K models
- Tasks with 10-50 steps: 128K models
- Tasks with > 50 steps: 200K models

---

## Tool Best Practices

### Idempotency Configuration

```typescript
// Read-only tools (safe to cache)
const getTool: ToolFunction = {
  definition: { /* ... */ },
  execute: async (args) => { /* GET request */ },
  idempotency: {
    safe: true  // No caching needed, naturally idempotent
  }
};

// Write tools (cache to prevent duplicates)
const sendEmailTool: ToolFunction = {
  definition: { /* ... */ },
  execute: async (args) => { /* Send email */ },
  idempotency: {
    safe: false,
    keyFn: (args) => `email:${args.to}:${args.subject}`,
    ttlMs: 3600000  // Cache for 1 hour
  }
};

// If called twice with same args within 1 hour → returns cached result
// Prevents sending duplicate emails
```

### Tool Design Guidelines

#### ✅ DO: Single Purpose Tools
```typescript
// GOOD: Each tool does one thing
const get_user: ToolFunction = { /* ... */ };
const update_user: ToolFunction = { /* ... */ };
const delete_user: ToolFunction = { /* ... */ };

// BAD: One tool does everything
const manage_user: ToolFunction = {
  // Has 'action' parameter: 'get' | 'update' | 'delete'
  // Harder to cache, harder to reason about
};
```

#### ✅ DO: Return Structured Data
```typescript
// GOOD: Structured, easy to work with
execute: async (args) => {
  return {
    success: true,
    data: { id: 123, name: 'John' },
    timestamp: Date.now()
  };
}

// BAD: String response
execute: async (args) => {
  return "User ID is 123 and name is John";
  // Agent has to parse this
}
```

#### ❌ DON'T: Mix Concerns
```typescript
// BAD: Tool that reads AND writes
const process_order: ToolFunction = {
  execute: async (args) => {
    const order = await db.getOrder(args.id);  // Read
    await emailService.send(order.email);      // Write
    return order;
  }
};

// GOOD: Separate tools
const get_order: ToolFunction = { /* read only */ };
const send_order_email: ToolFunction = { /* write only */ };
```

### Tool Context Access

```typescript
const myTool: ToolFunction = {
  definition: { /* ... */ },
  execute: async (args, context) => {
    // Access agent context
    if (context?.memory) {
      const userData = await context.memory.get('user.profile');
    }

    if (context?.agentId) {
      console.log('Called by agent:', context.agentId);
    }

    return { /* ... */ };
  }
};
```

---

## External Dependencies

### Webhook Pattern

**Use Case:** Wait for external callback (payment processing, human approval, etc.)

```typescript
// 1. Define task with webhook
{
  name: 'wait_payment',
  description: 'Wait for payment confirmation',
  externalDependency: {
    type: 'webhook',
    webhookId: 'payment-abc123',
    timeoutMs: 600000,  // 10 minutes
    state: 'waiting'
  }
}

// 2. Agent suspends when reaching this task

// 3. Your webhook handler receives callback
app.post('/webhooks/payment', async (req, res) => {
  const { orderId, status } = req.body;

  // Resume agent
  await agent.triggerExternal('payment-abc123', {
    orderId,
    status,
    amount: 99.99
  });

  res.send('OK');
});

// 4. Agent resumes and continues with next task
```

### Polling Pattern

**Use Case:** Wait for async job to complete (video transcoding, batch processing, etc.)

```typescript
// 1. Define polling task
{
  name: 'wait_transcoding',
  description: 'Wait for video transcoding to complete',
  externalDependency: {
    type: 'poll',
    pollConfig: {
      toolName: 'check_transcode_status',
      toolArgs: { jobId: 'job-xyz789' },
      intervalMs: 30000,    // Poll every 30 seconds
      maxAttempts: 60,      // Max 30 minutes
      successCondition: { status: 'completed' }
    }
  }
}

// 2. Define the polling tool
const checkTranscodeStatus: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'check_transcode_status',
      parameters: {
        type: 'object',
        properties: {
          jobId: { type: 'string' }
        }
      }
    }
  },
  execute: async (args) => {
    const response = await fetch(`/api/jobs/${args.jobId}`);
    const job = await response.json();

    // Return truthy when complete
    return job.status === 'completed' ? job : null;
  }
};

// 3. Agent automatically polls every 30s until complete or timeout
```

### Manual Approval Pattern

**Use Case:** Human intervention required (document review, compliance check, etc.)

```typescript
// 1. Define manual task
{
  name: 'human_review',
  description: 'Document requires human review',
  externalDependency: {
    type: 'manual',
    manualDescription: 'Please review the attached document and approve',
    state: 'waiting'
  }
}

// 2. Agent suspends and shows pending task to admin

// 3. Admin reviews and approves
await agent.completeTaskManually(taskId, {
  approved: true,
  reviewer: 'john@company.com',
  comments: 'Looks good, approved'
});

// 4. Agent resumes
```

### Scheduled Pattern

**Use Case:** Wait until specific time (daily report, scheduled notification, etc.)

```typescript
// 1. Define scheduled task
{
  name: 'send_daily_report',
  description: 'Send report at 9am tomorrow',
  externalDependency: {
    type: 'scheduled',
    scheduledAt: tomorrow9am.getTime(),
    state: 'waiting'
  }
}

// 2. Agent suspends until scheduled time
// 3. Automatically resumes at specified time
```

---

## Persistence & Resume

### Why Persistence Matters

Without persistence:
- Crash = lost progress
- Server restart = lost state
- External wait = blocked process

With persistence:
- Checkpoints saved automatically
- Resume from any point
- Survive crashes and restarts

### Storage Options

#### 1. In-Memory (Development Only)
```typescript
// Default - no configuration needed
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  // storage: undefined (uses in-memory)
});

// ⚠️ WARNING: State lost on process exit
```

#### 2. File-Based (Simple Production)
```typescript
import { FileStorage } from '@oneringai/agents';

const storage = new FileStorage({
  directory: './agent-data',
  pretty: true  // Pretty-print JSON (for debugging)
});

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  storage
});

// State persisted to:
// ./agent-data/agents/agent-123.json
// ./agent-data/plans/plan-456.json
// ./agent-data/memory/memory-789.json
```

#### 3. Redis (Recommended Production)
```typescript
import { RedisStorage } from '@oneringai/agents';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const storage = new RedisStorage({
  client: redis,
  keyPrefix: 'taskagent:',
  ttl: 86400  // 24 hours
});

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  storage
});
```

#### 4. Custom (Database, S3, etc.)
```typescript
import { IAgentStorage } from '@oneringai/agents';

class PostgresStorage implements IAgentStorage {
  async saveState(state: AgentState): Promise<void> {
    await db.query(
      'INSERT INTO agent_states (id, data) VALUES ($1, $2)',
      [state.id, JSON.stringify(state)]
    );
  }

  async loadState(id: string): Promise<AgentState | null> {
    const result = await db.query(
      'SELECT data FROM agent_states WHERE id = $1',
      [id]
    );
    return result.rows[0]?.data || null;
  }

  // ... implement other methods
}

const storage = new PostgresStorage(dbConfig);
const agent = TaskAgent.create({ /* ... */, storage });
```

### Checkpoint Strategies

```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  storage,
  checkpointStrategy: {
    afterToolCalls: 1,         // After every tool call
    afterLLMCalls: 1,          // After every LLM call
    intervalMs: 30000,         // Every 30 seconds
    beforeExternalWait: true,  // Before webhook/polling
    mode: 'async'              // Don't block execution
  }
});
```

**Strategies:**

| Strategy | Latency | Safety | Use Case |
|----------|---------|--------|----------|
| `mode: 'sync'` | High | Maximum | Financial transactions |
| `mode: 'async'` | Low | Good | Most use cases |
| `afterToolCalls: 1` | Medium | High | Critical workflows |
| `afterToolCalls: 5` | Low | Medium | Fast, low-risk tasks |
| `intervalMs: 30000` | None | Good | Background safety net |

### Resume Workflow

```typescript
// 1. Start agent
const agent = TaskAgent.create({ /* ... */ });
const handle = await agent.start({ /* plan */ });

// Save handle.agentId somewhere (database, session, etc.)
await db.saveSession({ userId: 'user123', agentId: handle.agentId });

// 2. Process crashes / restarts...

// 3. Later, resume from storage
const session = await db.getSession({ userId: 'user123' });

const resumedAgent = await TaskAgent.resume(session.agentId, {
  storage,
  tools: [/* must re-provide tools */],
  hooks: {/* optional hooks */}
});

// 4. Continue execution
const result = await resumedAgent.wait();
```

### Handling Long Waits

```typescript
// Agent hits webhook wait
const handle = await agent.start({
  goal: 'Process order',
  tasks: [
    { name: 'validate', description: 'Validate order' },
    { name: 'wait_payment', description: 'Wait for payment',
      externalDependency: { type: 'webhook', webhookId: 'pay-123' } },
    { name: 'fulfill', description: 'Ship order' }
  ]
});

// Agent suspends at wait_payment
console.log(handle.status());  // 'suspended'

// Days later, webhook arrives
await agent.triggerExternal('pay-123', { paid: true });

// Agent automatically resumes and completes
```

---

## Error Handling

### Hook-Based Error Handling

```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [/* ... */],
  hooks: {
    onError: async (error, context) => {
      // Log error
      logger.error({
        task: context.task?.name,
        phase: context.phase,
        error: error.message
      });

      // Decide action
      if (error.message.includes('rate limit')) {
        // Wait and retry
        await sleep(60000);
        return 'retry';
      }

      if (context.task?.attempts < 3) {
        return 'retry';  // Try again
      }

      if (error.message.includes('not found')) {
        return 'skip';  // Skip this task
      }

      return 'fail';  // Give up
    }
  }
});
```

### Per-Task Retry Configuration

```typescript
{
  name: 'flaky_api_call',
  description: 'Call unreliable external API',
  maxAttempts: 5,  // Try up to 5 times
  retryDelayMs: 5000  // Wait 5s between retries
}
```

### Circuit Breaker Pattern

```typescript
import { CircuitBreaker } from '@oneringai/agents';

const breaker = new CircuitBreaker({
  threshold: 5,      // Open after 5 failures
  resetMs: 60000     // Try again after 1 minute
});

const apiTool: ToolFunction = {
  definition: { /* ... */ },
  execute: async (args) => {
    return breaker.execute('external_api', async () => {
      return await fetch('https://api.example.com/data');
    });
  }
};
```

### Graceful Degradation

```typescript
{
  tasks: [
    { name: 'fetch_premium_data', description: 'Get premium data source',
      condition: {
        onFalse: 'skip'  // Skip if not available
      }
    },
    { name: 'fetch_fallback_data', description: 'Get free data source' },
    { name: 'analyze', description: 'Analyze whatever data we have' }
  ]
}
```

---

## Performance Tuning

### Model Selection

| Task Complexity | Model | Context | Speed | Cost |
|----------------|-------|---------|-------|------|
| Simple (API calls, data fetch) | gpt-3.5-turbo | 16K | Fast | Low |
| Medium (analysis, transformation) | gpt-4 | 8K | Medium | Medium |
| Complex (reasoning, planning) | gpt-4-turbo | 128K | Slow | High |
| Very Complex (multi-step logic) | claude-3-opus | 200K | Slow | Highest |

**Optimization Tip:** Use cheaper models for simple tasks:
```typescript
// Planning phase (cheap, fast)
const planningAgent = PlanningAgent.create({
  model: 'gpt-3.5-turbo'  // Good enough for planning
});

// Execution phase (more powerful)
const taskAgent = TaskAgent.create({
  model: 'gpt-4'  // Better for complex reasoning
});
```

### Parallel Task Execution

```typescript
{
  concurrency: {
    maxParallelTasks: 5,          // Run 5 tasks concurrently
    strategy: 'fifo'              // First-in-first-out
  },
  tasks: [
    // Mark tasks that can run in parallel
    { name: 'fetch_1', execution: { parallel: true } },
    { name: 'fetch_2', execution: { parallel: true } },
    { name: 'fetch_3', execution: { parallel: true } },
    // Waits for all above to complete
    { name: 'combine', dependsOn: ['fetch_1', 'fetch_2', 'fetch_3'] }
  ]
}
```

### Memory Optimization

```typescript
// 1. Set appropriate memory limits
const agent = TaskAgent.create({
  memoryConfig: {
    maxSizeBytes: 512 * 1024,   // 512KB (smaller is faster)
    softLimitPercent: 80         // Warn at 80%
  }
});

// 2. Clean up after tasks
agent.on('task:complete', async ({ task }) => {
  // Delete task-scoped memory explicitly
  await memory.clearScope('task');
});

// 3. Use task scope by default (auto-cleanup)
await memory_store({
  key: 'temp.data',
  description: 'Temporary data',
  value: largeData
  // scope: 'task' is default - will be deleted
});
```

### Context Window Tuning

```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4-turbo',  // 128K context
  contextConfig: {
    compactionThreshold: 0.80,    // Start compacting at 80%
    historyStrategy: 'truncate',  // Drop old messages (faster than summarize)
    toolOutputMaxSize: 2000       // Limit tool outputs to 2K tokens
  }
});
```

### Caching Strategy

```typescript
// Cache expensive, idempotent operations
const expensiveTool: ToolFunction = {
  definition: { /* ... */ },
  execute: async (args) => {
    // Expensive computation
    return await complexAnalysis(args);
  },
  idempotency: {
    safe: false,
    ttlMs: 3600000,  // Cache for 1 hour
    keyFn: (args) => `analysis:${args.dataId}:${args.type}`
  }
};

// Second call with same args = instant (from cache)
```

---

## Production Deployment

### Health Checks

```typescript
const agent = TaskAgent.create({ /* ... */ });

app.get('/health/agent/:agentId', async (req, res) => {
  const state = await agent.getState();
  res.json({
    status: state.status,
    plan: {
      completed: state.plan.tasks.filter(t => t.status === 'completed').length,
      total: state.plan.tasks.length
    },
    memory: {
      used: state.memory.used,
      total: state.memory.total
    },
    uptime: Date.now() - state.startedAt
  });
});
```

### Monitoring

```typescript
import { metrics } from './metrics';

agent.on('task:start', ({ task }) => {
  metrics.increment('taskagent.tasks.started', { task: task.name });
});

agent.on('task:complete', ({ task, result }) => {
  metrics.increment('taskagent.tasks.completed', { task: task.name });
  metrics.timing('taskagent.tasks.duration', Date.now() - task.startedAt);
});

agent.on('task:failed', ({ task, error }) => {
  metrics.increment('taskagent.tasks.failed', { task: task.name });
  logger.error({ task: task.name, error }, 'Task failed');
});

agent.on('memory:limit_warning', ({ utilization }) => {
  metrics.gauge('taskagent.memory.utilization', utilization);
  if (utilization > 90) {
    alerts.send('Memory critically high', { utilization });
  }
});
```

### Graceful Shutdown

```typescript
let agent: TaskAgent;

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // 1. Stop accepting new work
  server.close();

  // 2. Wait for current task to finish (with timeout)
  const timeout = setTimeout(() => {
    logger.warn('Shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    // 3. Save final checkpoint
    await agent.checkpoint();

    // 4. Cleanup resources
    await agent.destroy();

    clearTimeout(timeout);
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
});
```

### Horizontal Scaling

```typescript
// Use shared storage (Redis) for state
const storage = new RedisStorage({
  client: redis,
  keyPrefix: 'taskagent:'
});

// Multiple workers can resume same agent
// Worker 1 starts agent
const agent1 = TaskAgent.create({ storage });
const handle = await agent1.start(plan);

// Worker 2 can resume if Worker 1 crashes
const agent2 = await TaskAgent.resume(handle.agentId, { storage, tools });
```

---

## Troubleshooting

### Common Issues

#### Issue: Context Overflow
**Symptom:** Error "Context window exceeded"

**Solution:**
```typescript
// 1. Check context utilization
const context = await context_inspect();
console.log(context.utilizationPercent);

// 2. Tune compaction
agent.updateContextConfig({
  compactionThreshold: 0.70,  // Start earlier
  toolOutputMaxSize: 2000     // Smaller outputs
});

// 3. Use larger model
model: 'gpt-4-turbo'  // 128K instead of 8K
```

#### Issue: Memory Limit Exceeded
**Symptom:** Error "Memory limit exceeded: 1024000 bytes > 524288 bytes"

**Solution:**
```typescript
// 1. Check memory utilization
const stats = await memory_stats();
console.log(stats);

// 2. Increase limit
memoryConfig: {
  maxSizeBytes: 2 * 1024 * 1024  // 2MB
}

// 3. Clean up old entries
await memory.clearScope('task');
```

#### Issue: Task Stuck in "in_progress"
**Symptom:** Task never completes

**Solution:**
```typescript
// 1. Add timeout
{
  name: 'slow_task',
  execution: {
    timeoutMs: 60000  // 1 minute max
  }
}

// 2. Check logs for errors
agent.on('task:failed', ({ task, error }) => {
  console.error('Task failed:', task.name, error);
});

// 3. Manually fail and skip
await agent.updatePlan({
  updateTasks: [{
    id: stuckTaskId,
    status: 'failed'
  }]
});
```

#### Issue: Idempotency Cache Not Working
**Symptom:** Duplicate side effects (double emails, etc.)

**Solution:**
```typescript
// 1. Check tool configuration
const tool: ToolFunction = {
  idempotency: {
    safe: false,  // Must be false for caching
    keyFn: (args) => `email:${args.to}:${args.subject}`
  }
};

// 2. Check cache stats
const stats = await cache_stats();
console.log(stats.hitRate);  // Should be > 0 if working

// 3. Verify cache integration
// (See TASKAGENT_IMPROVEMENT_PLAN.md Issue #3)
```

---

## Real-World Examples

### Example 1: Content Generation Pipeline

```typescript
const contentPipeline = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [
    researchTool,
    outlineTool,
    writeTool,
    editTool,
    publishTool
  ]
});

await contentPipeline.start({
  goal: 'Create blog post about AI agents',
  context: 'Target audience: developers, 1500 words',
  tasks: [
    { name: 'research', description: 'Research AI agents topic' },
    { name: 'outline', description: 'Create article outline', dependsOn: ['research'] },
    { name: 'draft', description: 'Write first draft', dependsOn: ['outline'] },
    { name: 'edit', description: 'Edit and refine', dependsOn: ['draft'] },
    { name: 'review', description: 'Human review',
      externalDependency: { type: 'manual', manualDescription: 'Review article' } },
    { name: 'publish', description: 'Publish to CMS', dependsOn: ['review'] }
  ]
});
```

### Example 2: E-commerce Order Processing

```typescript
const orderAgent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-3.5-turbo',  // Fast, cheap
  tools: [
    validateOrderTool,
    checkInventoryTool,
    reserveInventoryTool,
    chargePaymentTool,
    shipOrderTool,
    sendEmailTool
  ]
});

await orderAgent.start({
  goal: `Process order #${orderId}`,
  context: JSON.stringify(order),
  tasks: [
    { name: 'validate', description: 'Validate order data' },
    { name: 'check_inventory', description: 'Check item availability' },
    { name: 'reserve', description: 'Reserve items', dependsOn: ['check_inventory'] },
    { name: 'charge', description: 'Charge payment', dependsOn: ['reserve'] },
    { name: 'wait_payment', description: 'Wait for payment confirmation',
      externalDependency: { type: 'webhook', webhookId: `payment-${orderId}` } },
    { name: 'ship', description: 'Create shipping label', dependsOn: ['wait_payment'] },
    { name: 'notify', description: 'Send confirmation email', dependsOn: ['ship'] }
  ]
});
```

### Example 3: Data Pipeline with Fan-Out

```typescript
const dataAgent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [
    fetchDataTool,
    validateTool,
    transformTool,
    loadTool,
    reportTool
  ]
});

await dataAgent.start({
  goal: 'Import customer data from 3 sources',
  concurrency: { maxParallelTasks: 3 },
  tasks: [
    // Fan-out: parallel fetching
    { name: 'fetch_salesforce', description: 'Get Salesforce data',
      execution: { parallel: true } },
    { name: 'fetch_hubspot', description: 'Get HubSpot data',
      execution: { parallel: true } },
    { name: 'fetch_stripe', description: 'Get Stripe data',
      execution: { parallel: true } },

    // Fan-in: combine and process
    { name: 'merge', description: 'Merge data from all sources',
      dependsOn: ['fetch_salesforce', 'fetch_hubspot', 'fetch_stripe'] },
    { name: 'validate', description: 'Validate data quality', dependsOn: ['merge'] },
    { name: 'transform', description: 'Transform to target schema', dependsOn: ['validate'] },
    { name: 'load', description: 'Load into database', dependsOn: ['transform'] },
    { name: 'report', description: 'Email summary report', dependsOn: ['load'] }
  ]
});
```

---

## Migration Guide

### From Basic Agent to TaskAgent

**Before (Basic Agent):**
```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool]
});

const response = await agent.run('Check weather in SF and email me');
```

**After (TaskAgent):**
```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool]
});

await agent.start({
  goal: 'Check weather and send email',
  tasks: [
    { name: 'check_weather', description: 'Get weather for SF' },
    { name: 'send_email', description: 'Email user with weather',
      dependsOn: ['check_weather'] }
  ]
});
```

**When to Migrate:**
- Need multi-step workflow
- Need to store intermediate results
- Need to handle external events
- Need crash recovery

---

## Summary

TaskAgent is powerful for complex, long-running workflows. Key takeaways:

1. **Plan Carefully** - Break work into logical tasks with clear dependencies
2. **Use Memory Wisely** - Store large results, use descriptive keys, clean up
3. **Monitor Context** - Use inspection tools, tune compaction strategy
4. **Handle Errors** - Use hooks, retries, circuit breakers
5. **Persist State** - Use Redis/DB storage for production
6. **Optimize Performance** - Right model, parallel tasks, caching

For simple tasks, use Basic Agent. For complex workflows, TaskAgent shines.

---

**Next:** See [TASKAGENT_PRODUCTION_GUIDE.md](./TASKAGENT_PRODUCTION_GUIDE.md) for deployment best practices.
