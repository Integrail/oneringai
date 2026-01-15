# Hooks & Events Guide

Complete guide to controlling agent execution with hooks and events.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Events (Monitoring)](#events-monitoring)
- [Hooks (Control)](#hooks-control)
- [Pause/Resume/Cancel](#pauseresumecancel)
- [Metrics & Introspection](#metrics--introspection)
- [Enterprise Configuration](#enterprise-configuration)
- [Complete Examples](#complete-examples)

---

## Overview

### What Are Hooks and Events?

**Events** = Notifications (async, fire-and-forget)
- Listen to what's happening
- Log to database, send to UI, monitor performance
- Cannot block or modify execution

**Hooks** = Interceptors (sync/async, can block)
- Control what happens
- Approve/reject tools, modify data, add retry logic
- Can pause, skip, or modify execution

### Why Use Them?

- **Real-time UI updates** - Stream progress to web dashboards
- **Human-in-the-loop** - Require approval before dangerous actions
- **Logging & monitoring** - Track everything for debugging
- **Custom logic** - Add retry, caching, rate limiting
- **Compliance** - Audit trail for regulated industries

---

## Quick Start

### Basic Event Listening

```typescript
import { Connector, Agent, Vendor } from '@oneringai/agents';

Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
});

// Listen to tool execution
agent.on('tool:start', ({ toolCall }) => {
  console.log(`Starting: ${toolCall.function.name}`);
});

agent.on('tool:complete', ({ result }) => {
  console.log(`Completed in ${result.executionTime}ms`);
});

const response = await agent.run('Do something');
```

### Basic Hook Usage

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],

  // Add hooks
  hooks: {
    'before:tool': async ({ toolCall }) => {
      console.log(`About to execute: ${toolCall.function.name}`);
      return {};  // Continue normally
    },

    'after:tool': async ({ result }) => {
      console.log(`Tool returned:`, result.content);
      return {};
    }
  }
});
```

---

## Events (Monitoring)

### Available Events

| Event | When | Payload | Use Case |
|-------|------|---------|----------|
| `execution:start` | Agent starts running | `{ executionId, config }` | Initialize UI |
| `execution:complete` | Agent finishes | `{ response, duration }` | Show results |
| `execution:error` | Agent fails | `{ error }` | Error handling |
| `execution:paused` | Execution paused | `{ reason }` | Update UI state |
| `execution:resumed` | Execution resumed | `{}` | Update UI state |
| `iteration:start` | New iteration begins | `{ iteration }` | Progress indicator |
| `iteration:complete` | Iteration done | `{ response }` | Track progress |
| `llm:request` | Before LLM call | `{ options }` | Log API calls |
| `llm:response` | After LLM call | `{ response, duration }` | Track latency |
| `llm:error` | LLM call fails | `{ error }` | Error tracking |
| `tool:detected` | Tools found in response | `{ toolCalls[] }` | Show tool list |
| `tool:start` | Tool execution starts | `{ toolCall }` | Show spinner |
| `tool:complete` | Tool succeeds | `{ toolCall, result }` | Log success |
| `tool:error` | Tool fails | `{ toolCall, error }` | Log failure |
| `tool:timeout` | Tool times out | `{ toolCall, timeout }` | Log timeout |
| `hook:error` | Hook fails | `{ hookName, error }` | Debug hooks |

### Event Listener Examples

#### Example 1: Real-Time UI Updates

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4', tools: [myTool] });

// Send progress to WebSocket
agent.on('iteration:start', ({ iteration }) => {
  websocket.send(JSON.stringify({
    type: 'progress',
    iteration,
    message: `Processing step ${iteration}...`
  }));
});

agent.on('tool:start', ({ toolCall }) => {
  websocket.send(JSON.stringify({
    type: 'tool-progress',
    tool: toolCall.function.name,
    status: 'executing'
  }));
});

agent.on('tool:complete', ({ toolCall, result }) => {
  websocket.send(JSON.stringify({
    type: 'tool-progress',
    tool: toolCall.function.name,
    status: 'completed',
    result: result.content,
    duration: result.executionTime
  }));
});
```

#### Example 2: Comprehensive Logging

```typescript
agent.on('execution:start', ({ executionId, config }) => {
  logger.info('Agent execution started', {
    executionId,
    model: config.model,
    toolCount: config.tools.length
  });
});

agent.on('llm:request', ({ options, iteration }) => {
  logger.debug('LLM request', {
    iteration,
    model: options.model,
    hasTools: options.tools && options.tools.length > 0
  });
});

agent.on('tool:start', ({ toolCall, iteration }) => {
  logger.info('Tool execution started', {
    iteration,
    tool: toolCall.function.name,
    args: toolCall.function.arguments
  });
});

agent.on('tool:complete', ({ toolCall, result }) => {
  logger.info('Tool execution completed', {
    tool: toolCall.function.name,
    duration: result.executionTime,
    state: result.state
  });
});

agent.on('tool:error', ({ toolCall, error }) => {
  logger.error('Tool execution failed', {
    tool: toolCall.function.name,
    error: error.message
  });
});

agent.on('execution:complete', ({ duration }) => {
  logger.info('Agent execution completed', { duration });
});
```

---

## Hooks (Control)

### Available Hooks

| Hook | When | Can Return | Use Case |
|------|------|------------|----------|
| `before:execution` | Before agent starts | `void` | Initialize resources |
| `after:execution` | After agent completes | `void` | Cleanup, logging |
| `before:llm` | Before LLM call | `{ modified?, skip? }` | Modify prompts, rate limit |
| `after:llm` | After LLM call | `{}` | Log responses |
| `before:tool` | Before tool execution | `{ modified?, skip?, mockResult? }` | Cache, validation |
| `after:tool` | After tool execution | `{ modified?, retry? }` | Cache, retry logic |
| `approve:tool` | Before executing tool | `{ approved, reason? }` | Human approval |
| `pause:check` | Each iteration | `{ shouldPause, reason? }` | Custom pause logic |

### Hook Examples

#### Example 1: Tool Approval (Human-in-the-Loop)

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [deleteTool, updateTool],

  hooks: {
    'approve:tool': async ({ toolCall }) => {
      // Dangerous tools require approval
      if (toolCall.function.name === 'delete_database') {
        console.log('\n DANGEROUS OPERATION DETECTED');
        console.log(`Tool: ${toolCall.function.name}`);
        console.log(`Args:`, JSON.parse(toolCall.function.arguments));

        // In real app: show UI dialog, wait for user
        const approved = await showApprovalDialog(toolCall);

        return {
          approved,
          reason: approved ? 'Approved by admin' : 'Rejected by admin'
        };
      }

      // Auto-approve safe tools
      return { approved: true };
    }
  }
});
```

#### Example 2: Result Caching

```typescript
import Redis from 'ioredis';
const redis = new Redis();

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [expensiveTool],

  hooks: {
    'before:tool': async ({ toolCall }) => {
      // Create cache key from tool name + args
      const cacheKey = `tool:${toolCall.function.name}:${toolCall.function.arguments}`;

      // Check cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`Cache hit: ${toolCall.function.name}`);
        return {
          skip: true,
          mockResult: JSON.parse(cached),
          reason: 'Cached result'
        };
      }

      return {};
    },

    'after:tool': async ({ toolCall, result }) => {
      // Only cache successful results
      if (result.state === 'completed') {
        const cacheKey = `tool:${toolCall.function.name}:${toolCall.function.arguments}`;

        // Cache for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(result.content));
        console.log(`Cached: ${toolCall.function.name}`);
      }

      return {};
    }
  }
});
```

#### Example 3: Rate Limiting

```typescript
const rateLimiter = {
  lastCall: 0,
  minInterval: 1000  // 1 second between LLM calls
};

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],

  hooks: {
    'before:llm': async ({ options }) => {
      const now = Date.now();
      const timeSinceLastCall = now - rateLimiter.lastCall;

      if (timeSinceLastCall < rateLimiter.minInterval) {
        const waitTime = rateLimiter.minInterval - timeSinceLastCall;
        console.log(`Rate limiting: waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      rateLimiter.lastCall = Date.now();
      return {};
    }
  }
});
```

---

## Pause/Resume/Cancel

### Manual Control

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4', tools: [myTool] });

// Start execution (non-blocking)
const responsePromise = agent.run('Long running task');

// Pause from another thread (e.g., button click)
setTimeout(() => {
  agent.pause('User clicked pause button');
  console.log('Paused');
}, 2000);

// Resume later
setTimeout(() => {
  agent.resume();
  console.log('Resumed');
}, 5000);

const response = await responsePromise;
```

### Auto-Pause After N Iterations

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],

  hooks: {
    'pause:check': async ({ iteration }) => {
      // Pause every 5 iterations
      if (iteration > 0 && iteration % 5 === 0) {
        return {
          shouldPause: true,
          reason: `Checkpoint at iteration ${iteration}`
        };
      }
      return { shouldPause: false };
    }
  }
});

// Listen for pause
agent.on('execution:paused', ({ reason }) => {
  console.log(`Paused: ${reason}`);
  // Auto-resume after 1 second
  setTimeout(() => agent.resume(), 1000);
});

await agent.run('Task');
```

### Cancel Execution

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4', tools: [myTool] });
const responsePromise = agent.run('Long task');

// Cancel from button or timeout
setTimeout(() => {
  agent.cancel('User clicked cancel');
}, 5000);

try {
  await responsePromise;
} catch (error) {
  console.log('Execution was cancelled');
}
```

---

## Metrics & Introspection

### Get Execution Metrics

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4', tools: [myTool] });
const response = await agent.run('Process data');

const metrics = agent.getMetrics();

console.log('Metrics:');
console.log(`  Total Duration: ${metrics.totalDuration}ms`);
console.log(`  LLM Duration: ${metrics.llmDuration}ms`);
console.log(`  Tool Duration: ${metrics.toolDuration}ms`);
console.log(`  Hook Duration: ${metrics.hookDuration}ms`);
console.log(`  Iterations: ${metrics.iterationCount}`);
console.log(`  Tool Calls: ${metrics.toolCallCount}`);
console.log(`  Tool Success: ${metrics.toolSuccessCount}/${metrics.toolCallCount}`);
console.log(`  Tokens: ${metrics.totalTokens} (${metrics.inputTokens} in, ${metrics.outputTokens} out)`);
console.log(`  Errors: ${metrics.errors.length}`);
```

### Get Audit Trail

```typescript
const audit = agent.getAuditTrail();

console.log('Audit Trail:');
audit.forEach(entry => {
  console.log(`${entry.timestamp.toISOString()} - ${entry.type}`);
  if (entry.toolName) console.log(`  Tool: ${entry.toolName}`);
  if (entry.details) console.log(`  Details:`, entry.details);
});
```

### Check Agent State

```typescript
// During execution
if (agent.isRunning()) {
  console.log('Agent is currently executing');
}

if (agent.isPaused()) {
  console.log('Agent is paused - waiting for resume');
  agent.resume();
}

if (agent.isCancelled()) {
  console.log('Agent execution was cancelled');
}
```

---

## Enterprise Configuration

### Full Configuration Example

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tool1, tool2, tool3],
  instructions: 'You are a helpful assistant',

  // === RESOURCE LIMITS ===
  limits: {
    maxExecutionTime: 300000,   // 5 minutes max
    maxToolCalls: 100,          // Max 100 tool calls
    maxContextSize: 10485760,   // 10MB context limit
  },

  // === HISTORY MODE (Memory Management) ===
  historyMode: 'summary',  // Options: 'none', 'summary', 'full'

  // === ERROR HANDLING ===
  errorHandling: {
    hookFailureMode: 'warn',       // 'fail' | 'warn' | 'ignore'
    toolFailureMode: 'fail',       // 'fail' | 'warn' | 'continue'
    maxConsecutiveErrors: 3        // Abort after N consecutive errors
  },

  // === HOOKS ===
  hooks: {
    'approve:tool': async (ctx) => {
      return { approved: true };
    },

    'before:tool': async (ctx) => {
      return {};
    },

    'after:tool': async (ctx) => {
      return {};
    },

    // Hook timeout (global setting)
    hookTimeout: 5000,        // 5 seconds per hook
    parallelHooks: false      // Execute hooks sequentially
  }
});
```

### Memory Management Modes

**Mode: `none`** (No history stored)
- Fastest
- Lowest memory
- No audit trail or replay
- Use for: High-throughput production

**Mode: `summary`** (Recommended)
- Stores lightweight summaries
- ~1KB per iteration vs ~10-100KB
- Metrics and audit trail available
- Use for: Most production scenarios

**Mode: `full`** (Complete history)
- Stores everything
- Useful for debugging
- Can use significant memory
- Use for: Development, debugging

```typescript
// Example: Different modes for different environments
const historyMode = process.env.NODE_ENV === 'production' ? 'summary' : 'full';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
  historyMode
});
```

---

## Complete Examples

### Example 1: Production Agent with Full Monitoring

```typescript
import { Connector, Agent, Vendor, tools } from '@oneringai/agents';
import { logger } from './logger';
import { metrics } from './metrics';

Connector.create({
  name: 'anthropic',
  vendor: Vendor.Anthropic,
  auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY! },
});

const agent = Agent.create({
  connector: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',
  tools: [tools.jsonManipulator],

  // Enterprise config
  limits: {
    maxExecutionTime: 180000,  // 3 minutes
    maxToolCalls: 50
  },
  historyMode: 'summary',
  errorHandling: {
    hookFailureMode: 'warn',
    toolFailureMode: 'fail',
    maxConsecutiveErrors: 3
  },

  // Hooks
  hooks: {
    'before:tool': async ({ toolCall }) => {
      metrics.increment('tool.started', {
        tool: toolCall.function.name
      });
      return {};
    },

    'after:tool': async ({ toolCall, result }) => {
      metrics.timing('tool.duration', result.executionTime || 0, {
        tool: toolCall.function.name,
        state: result.state
      });

      metrics.increment(`tool.${result.state}`, {
        tool: toolCall.function.name
      });

      return {};
    }
  }
});

// Event listeners for logging
agent.on('execution:start', ({ executionId }) => {
  logger.info('Agent started', { executionId });
});

agent.on('execution:complete', ({ duration }) => {
  logger.info('Agent completed', { duration });
  metrics.timing('agent.total_duration', duration);
});

agent.on('execution:error', ({ error }) => {
  logger.error('Agent failed', { error: error.message });
  metrics.increment('agent.error');
});

// Execute
try {
  const response = await agent.run('Process customer data');

  // Report metrics
  const executionMetrics = agent.getMetrics();
  logger.info('Execution metrics', executionMetrics);

} finally {
  agent.destroy();  // Always cleanup
}
```

### Example 2: Interactive Agent with Approval

```typescript
import readline from 'readline';
import { Connector, Agent, Vendor } from '@oneringai/agents';

async function askUserApproval(toolCall: ToolCall): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(`\n Approve tool execution?`);
    console.log(`   Tool: ${toolCall.function.name}`);
    console.log(`   Args: ${toolCall.function.arguments}`);

    rl.question('   Approve? (y/n): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [dangerousTool],

  hooks: {
    'approve:tool': async ({ toolCall }) => {
      const approved = await askUserApproval(toolCall);

      return {
        approved,
        reason: approved ? 'User approved' : 'User rejected'
      };
    }
  }
});

// Agent will pause and ask for approval before each tool
const response = await agent.run('Delete old records');
```

---

## Best Practices

### 1. Always Cleanup

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4', tools: [myTool] });

try {
  const response = await agent.run('Task');
  // Use response
} finally {
  agent.destroy();  // Remove event listeners, free memory
}
```

### 2. Use Summary Mode in Production

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
  historyMode: process.env.NODE_ENV === 'production' ? 'summary' : 'full',
});
```

### 3. Set Resource Limits

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
  limits: {
    maxExecutionTime: 300000,  // Prevent infinite loops
    maxToolCalls: 100,         // Prevent tool spam
    maxContextSize: 10485760   // Prevent memory issues
  },
});
```

### 4. Handle Hook Errors Gracefully

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
  errorHandling: {
    hookFailureMode: 'warn',  // Don't crash on hook errors
    maxConsecutiveErrors: 3
  },
  hooks: {
    'after:tool': async ({ toolCall, result }) => {
      try {
        await externalService.log(result);
      } catch (error) {
        // Hook will emit 'hook:error' but won't crash
        console.error('Logging failed:', error);
      }
      return {};
    }
  }
});

// Listen to hook errors
agent.on('hook:error', ({ hookName, error }) => {
  console.error(`Hook ${hookName} failed:`, error.message);
});
```

### 5. Use Events for Monitoring, Hooks for Control

```typescript
// Good: Events for logging
agent.on('tool:complete', ({ result }) => {
  logger.info('Tool completed', result);
});

// Good: Hooks for control
hooks: {
  'approve:tool': async (ctx) => ({ approved: await checkPermissions() })
}

// Bad: Don't use hooks for logging only
hooks: {
  'after:tool': async ({ result }) => {
    logger.info('Tool completed', result);  // Use events for this!
    return {};
  }
}
```

---

## Troubleshooting

### Hook Timeout Errors

**Error**: `Hook timeout`

**Cause**: Hook took longer than 5 seconds

**Fix**: Increase timeout or optimize hook
```typescript
hooks: {
  hookTimeout: 10000,  // 10 seconds
  'after:tool': async (ctx) => { ... }
}
```

### Memory Issues

**Error**: `Context size limit exceeded`

**Cause**: Too much data stored in history

**Fix**: Use summary mode
```typescript
historyMode: 'summary',  // or 'none'
```

### Too Many Hook Errors

**Error**: `Too many consecutive hook failures`

**Cause**: Hook failing repeatedly

**Fix**: Debug the hook or increase threshold
```typescript
errorHandling: {
  hookFailureMode: 'warn',
  maxConsecutiveErrors: 5  // Increase from default 3
}
```

---

## Examples

Run the example to see hooks in action:

```bash
npm run example:hooks
```

This demonstrates:
- Event listeners
- Tool approval
- Result caching
- Metrics collection
- Audit trail
- Resource cleanup

---

**Version**: 0.3.0
**Added**: Hooks & Events system
**Breaking Changes**: None (fully backward compatible)
