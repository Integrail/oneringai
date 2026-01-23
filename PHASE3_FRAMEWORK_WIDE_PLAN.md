# Phase 3: Framework-Wide Production Hardening

**Date:** 2026-01-23
**Scope:** ENTIRE @oneringai/agents framework (not just TaskAgent)
**Duration:** 2-3 weeks
**Priority:** HIGH for production deployments

---

## Executive Summary

Phase 3 adds **framework-wide resilience and observability** across all components:
- Circuit Breaker pattern for LLM providers and tools
- Comprehensive observability system (logging, metrics, tracing)
- Framework-level integration (not TaskAgent-specific)

**Key Insight:** These are **cross-cutting concerns** that should be at the framework level, not bolted onto TaskAgent.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    User Application                             │
└──────────────────────┬─────────────────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────────────────┐
│              Framework-Wide Resilience Layer                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ Circuit Breaker  │  │  Observability   │  │   Metrics    │ │
│  │   (generic)      │  │ (logging/events) │  │ (collection) │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
└────────────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   Agent      │ │ Provider │ │ TaskAgent    │
│              │ │          │ │              │
│ Uses CB for: │ │ Uses CB  │ │ Uses CB for: │
│ - Tools      │ │ for LLM  │ │ - Tools      │
│              │ │ calls    │ │ - Planning   │
└──────────────┘ └──────────┘ └──────────────┘
```

---

## Component 1: Generic Circuit Breaker

### Design Philosophy

**Generic, Reusable Pattern**
- Works for ANY async operation
- Not tied to specific component
- Configurable per use case
- Event-driven for observability

### Location

`src/infrastructure/resilience/CircuitBreaker.ts` (~350 lines)

### Core API

```typescript
/**
 * Generic circuit breaker for any async operation
 */
export class CircuitBreaker<T = any> {
  /**
   * Create a circuit breaker
   * @param name - Identifier for this breaker (e.g., 'openai-llm', 'tool:send_email')
   * @param config - Configuration
   */
  constructor(
    public readonly name: string,
    config: CircuitBreakerConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute(
    fn: () => Promise<T>,
    options?: { timeout?: number; retries?: number }
  ): Promise<T> {}

  /**
   * Get current state
   */
  getState(): CircuitState {}

  /**
   * Get metrics
   */
  getMetrics(): CircuitBreakerMetrics {}

  /**
   * Manually reset (force close)
   */
  reset(): void {}

  /**
   * Subscribe to state changes
   */
  on(event: 'open' | 'half-open' | 'closed', handler: (data) => void): void {}
}
```

### Configuration

```typescript
export interface CircuitBreakerConfig {
  /** Failures before opening */
  failureThreshold: number;

  /** Successes to close from half-open */
  successThreshold: number;

  /** Time in open state (ms) */
  resetTimeoutMs: number;

  /** Time window for failure counting (ms) */
  windowMs: number;

  /** Error classifier - which errors count as failures */
  isRetryable?: (error: Error) => boolean;

  /** Backoff strategy */
  backoff?: BackoffConfig;
}

export interface BackoffConfig {
  strategy: 'exponential' | 'linear' | 'constant';
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier?: number;  // For exponential
  jitter?: boolean;     // Add randomness
}
```

### State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                   Circuit Breaker States                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CLOSED (Normal Operation)                                       │
│    • All requests pass through                                   │
│    • Track failures in rolling window                            │
│    • Reset counters on success                                   │
│    │                                                              │
│    ├─ [failureThreshold exceeded] ──────────────────┐           │
│    │                                                  │           │
│    ▼                                                  │           │
│  OPEN (Fast Fail)                                     │           │
│    • All requests fail immediately                    │           │
│    • No actual execution                              │           │
│    • Wait for resetTimeoutMs                          │           │
│    │                                                  │           │
│    ├─ [resetTimeout expired] ───────────────────┐   │           │
│    │                                             │   │           │
│    ▼                                             │   │           │
│  HALF-OPEN (Trial Mode)                          │   │           │
│    • Allow ONE request through                   │   │           │
│    • If success → track success count            │   │           │
│    • If failure → back to OPEN                   │   │           │
│    │                               │              │   │           │
│    ├─ [successThreshold met] ─────┼──────────────┘   │           │
│    │                               │                  │           │
│    ▼                               ▼                  │           │
│  CLOSED                         OPEN ◄────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Error Classification

**Retryable Errors** (count toward CB):
- 429 Rate Limit
- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable
- 504 Gateway Timeout
- Network timeouts
- Connection errors

**Non-Retryable Errors** (bypass CB):
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 413 Context Length Exceeded
- Invalid arguments

### Metrics

```typescript
export interface CircuitBreakerMetrics {
  name: string;
  state: CircuitState;

  // Counters
  totalRequests: number;
  successCount: number;
  failureCount: number;
  rejectedCount: number;  // Rejected by open circuit

  // Current window
  recentFailures: number;
  consecutiveSuccesses: number;

  // Timestamps
  lastFailureTime?: number;
  lastSuccessTime?: number;
  lastStateChange?: number;
  nextRetryTime?: number;  // When circuit will try half-open

  // Rates
  failureRate: number;     // % failures in window
  successRate: number;     // % successes in window
}
```

---

## Component 2: Framework-Wide Observability

### Philosophy

**Observability as First-Class Concern**
- Not bolted on, but designed in
- Consistent across all components
- Pluggable backends
- Zero-config defaults

### 2.1: Structured Logging

**Location:** `src/infrastructure/observability/Logger.ts` (~150 lines)

**Design:**
```typescript
export interface LoggerConfig {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  pretty?: boolean;
  destination?: 'stdout' | 'stderr' | 'file' | WritableStream;
  context?: Record<string, any>;  // Default context (e.g., serviceName)
}

export class FrameworkLogger {
  private logger: pino.Logger;

  /**
   * Create logger with context
   */
  constructor(config: LoggerConfig = {}) {
    this.logger = pino({
      level: config.level || 'info',
      base: config.context || {},
      transport: config.pretty ? { target: 'pino-pretty' } : undefined
    });
  }

  /**
   * Child logger with additional context
   */
  child(context: Record<string, any>): FrameworkLogger {
    return new FrameworkLogger({
      ...this.config,
      context: { ...this.context, ...context }
    });
  }

  // Standard methods
  trace(obj: any, msg: string): void {}
  debug(obj: any, msg: string): void {}
  info(obj: any, msg: string): void {}
  warn(obj: any, msg: string): void {}
  error(obj: any, msg: string): void {}
}

// Global singleton
export const logger = new FrameworkLogger({
  level: process.env.LOG_LEVEL as any || 'info'
});
```

**Integration Points:**

1. **Agent Class** (`src/core/Agent.ts`):
```typescript
export class Agent {
  private logger: FrameworkLogger;

  private constructor(...) {
    this.logger = logger.child({
      component: 'Agent',
      agentId: this.id,
      model: config.model
    });
  }

  async run(input: string): Promise<LLMResponse> {
    this.logger.info({ input: input.substring(0, 100) }, 'Agent run started');

    try {
      const response = await this.loop.execute(...);
      this.logger.info({
        tokens: response.usage?.total_tokens,
        duration: response.duration
      }, 'Agent run completed');
      return response;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Agent run failed');
      throw error;
    }
  }
}
```

2. **Providers** (`src/infrastructure/providers/base/BaseTextProvider.ts`):
```typescript
export abstract class BaseTextProvider {
  protected logger: FrameworkLogger;

  constructor(config: ProviderConfig) {
    this.logger = logger.child({
      component: 'Provider',
      provider: this.name,
      model: config.model
    });
  }

  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    this.logger.debug({ messages: options.messages.length }, 'LLM call started');

    try {
      const response = await this.client.create(...);
      this.logger.info({
        tokens: response.usage?.total_tokens,
        finishReason: response.finish_reason
      }, 'LLM call completed');
      return response;
    } catch (error) {
      this.logger.error({
        error: error.message,
        status: error.status
      }, 'LLM call failed');
      throw error;
    }
  }
}
```

3. **ToolRegistry** (`src/capabilities/agents/ToolRegistry.ts`):
```typescript
export class ToolRegistry {
  private logger: FrameworkLogger;

  constructor() {
    this.logger = logger.child({ component: 'ToolRegistry' });
  }

  async execute(toolName: string, args: any): Promise<any> {
    this.logger.debug({ toolName, args }, 'Tool execution started');

    try {
      const result = await tool.execute(args);
      this.logger.debug({ toolName, success: true }, 'Tool execution completed');
      return result;
    } catch (error) {
      this.logger.error({
        toolName,
        error: error.message
      }, 'Tool execution failed');
      throw error;
    }
  }
}
```

4. **TaskAgent** (already has events, add logging):
```typescript
export class TaskAgent {
  private logger: FrameworkLogger;

  private constructor(...) {
    this.logger = logger.child({
      component: 'TaskAgent',
      agentId: this.id
    });
  }

  async executePlan(): Promise<PlanResult> {
    this.logger.info({
      planId: this.state.plan.id,
      taskCount: this.state.plan.tasks.length
    }, 'Plan execution started');

    // ... execution ...
  }
}
```

### 2.2: Metrics Collection

**Location:** `src/infrastructure/observability/Metrics.ts` (~200 lines)

**Design:**
```typescript
/**
 * Generic metrics collector interface
 */
export interface MetricsCollector {
  increment(metric: string, value?: number, tags?: Tags): void;
  gauge(metric: string, value: number, tags?: Tags): void;
  timing(metric: string, duration: number, tags?: Tags): void;
  histogram(metric: string, value: number, tags?: Tags): void;
}

export type Tags = Record<string, string | number | boolean>;

/**
 * No-op collector (default)
 */
export class NoOpMetrics implements MetricsCollector {
  increment() {}
  gauge() {}
  timing() {}
  histogram() {}
}

/**
 * Console metrics (development)
 */
export class ConsoleMetrics implements MetricsCollector {
  increment(metric: string, value = 1, tags?: Tags): void {
    console.log(`[METRIC] ${metric}:${value}`, tags || {});
  }
  // ... other methods
}

/**
 * Prometheus metrics (production)
 */
export class PrometheusMetrics implements MetricsCollector {
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();
  private histograms = new Map<string, Histogram>();

  constructor(private registry: Registry) {}

  increment(metric: string, value = 1, tags?: Tags): void {
    let counter = this.counters.get(metric);
    if (!counter) {
      counter = new Counter({
        name: metric,
        help: `Counter for ${metric}`,
        labelNames: Object.keys(tags || {}),
        registers: [this.registry]
      });
      this.counters.set(metric, counter);
    }
    counter.inc(tags, value);
  }
  // ... other methods
}

/**
 * Global metrics singleton
 */
export const metrics: MetricsCollector = createMetricsCollector();

function createMetricsCollector(): MetricsCollector {
  const type = process.env.METRICS_COLLECTOR || 'noop';

  switch (type) {
    case 'console': return new ConsoleMetrics();
    case 'prometheus': return new PrometheusMetrics(register);
    default: return new NoOpMetrics();
  }
}
```

**Framework Metrics:**

```typescript
// Agent metrics
metrics.increment('agent.created', 1, { model, connector });
metrics.increment('agent.run.started', 1, { model });
metrics.increment('agent.run.completed', 1, { model, status });
metrics.timing('agent.run.duration', duration, { model });
metrics.gauge('agent.active_count', activeAgents);

// Provider metrics
metrics.increment('provider.llm.request', 1, { provider, model });
metrics.increment('provider.llm.response', 1, { provider, model, status });
metrics.timing('provider.llm.latency', latency, { provider, model });
metrics.histogram('provider.llm.tokens', tokens, { provider, model, type: 'input' });
metrics.gauge('provider.llm.cost', cost, { provider, model });

// Tool metrics
metrics.increment('tool.executed', 1, { tool: toolName });
metrics.increment('tool.success', 1, { tool: toolName });
metrics.increment('tool.failed', 1, { tool: toolName, reason });
metrics.timing('tool.duration', duration, { tool: toolName });
metrics.increment('tool.timeout', 1, { tool: toolName });

// Circuit breaker metrics
metrics.increment('circuit_breaker.opened', 1, { breaker: name, reason });
metrics.increment('circuit_breaker.closed', 1, { breaker: name });
metrics.gauge('circuit_breaker.state', stateValue, { breaker: name });
metrics.gauge('circuit_breaker.failure_count', count, { breaker: name });

// TaskAgent specific
metrics.increment('taskagent.plan.started', 1, { agentId });
metrics.increment('taskagent.plan.completed', 1, { agentId, status });
metrics.gauge('taskagent.memory.utilization', percent, { agentId });
metrics.gauge('taskagent.context.utilization', percent, { agentId });
```

### 2.3: Event System Extension

**Current State:** Events already exist (16+ types)

**Enhancement:** Add circuit breaker events

**Location:** `src/capabilities/agents/types/EventTypes.ts`

**Add Events:**
```typescript
export interface AgenticLoopEvents {
  // ... existing 16 events ...

  // NEW: Circuit breaker events
  'circuit:opened': CircuitOpenedEvent;
  'circuit:half-open': CircuitHalfOpenEvent;
  'circuit:closed': CircuitClosedEvent;
  'backoff:started': BackoffStartedEvent;
  'backoff:completed': BackoffCompletedEvent;
}

export interface CircuitOpenedEvent {
  executionId: string;
  breakerName: string;
  failureCount: number;
  lastError: string;
  nextRetryTime: number;
}

export interface CircuitHalfOpenEvent {
  executionId: string;
  breakerName: string;
  timestamp: number;
}

export interface CircuitClosedEvent {
  executionId: string;
  breakerName: string;
  successCount: number;
  timestamp: number;
}

export interface BackoffStartedEvent {
  executionId: string;
  attempt: number;
  delayMs: number;
  reason: string;
}

export interface BackoffCompletedEvent {
  executionId: string;
  attempt: number;
  actualDelayMs: number;
}
```

---

## Component 3: Integration Plan

### 3.1: LLM Provider Circuit Breaker

**Location:** `src/infrastructure/providers/base/BaseTextProvider.ts`

**Implementation:**
```typescript
export abstract class BaseTextProvider implements ITextProvider {
  protected circuitBreaker: CircuitBreaker;
  protected logger: FrameworkLogger;

  constructor(config: ProviderConfig) {
    // Create circuit breaker for this provider
    this.circuitBreaker = new CircuitBreaker(
      `provider:${this.name}:${config.model}`,
      config.circuitBreaker || DEFAULT_PROVIDER_CB_CONFIG
    );

    // Create logger
    this.logger = logger.child({
      component: 'Provider',
      provider: this.name,
      model: config.model
    });

    // Forward CB events to metrics
    this.circuitBreaker.on('opened', (data) => {
      this.logger.warn(data, 'Circuit breaker opened');
      metrics.increment('circuit_breaker.opened', 1, {
        breaker: data.breakerName,
        reason: 'failures'
      });
    });
  }

  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    this.logger.debug({ messageCount: options.messages.length }, 'Generate started');

    // Execute with circuit breaker protection
    return this.circuitBreaker.execute(
      async () => {
        const startTime = Date.now();

        try {
          const response = await this.internalGenerate(options);

          const duration = Date.now() - startTime;
          metrics.timing('provider.llm.latency', duration, {
            provider: this.name,
            model: options.model
          });

          this.logger.info({
            tokens: response.usage?.total_tokens,
            finishReason: response.finish_reason,
            duration
          }, 'Generate completed');

          return response;
        } catch (error) {
          this.logger.error({
            error: error.message,
            status: error.status
          }, 'Generate failed');

          metrics.increment('provider.llm.error', 1, {
            provider: this.name,
            model: options.model,
            error: error.name
          });

          throw error;
        }
      },
      {
        timeout: this.getTimeout(),
        retries: this.getMaxRetries()
      }
    );
  }

  // Subclasses implement this instead of generate()
  protected abstract internalGenerate(options: TextGenerateOptions): Promise<LLMResponse>;
}
```

**Default CB Config for Providers:**
```typescript
const DEFAULT_PROVIDER_CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,      // Open after 5 failures
  successThreshold: 2,      // Close after 2 successes
  resetTimeoutMs: 30000,    // 30 seconds
  windowMs: 60000,          // 1 minute window

  isRetryable: (error) => {
    if (error instanceof ProviderAuthError) return false;  // Don't retry auth
    if (error instanceof ProviderContextLengthError) return false;  // Don't retry context
    if (error instanceof ProviderRateLimitError) return true;  // Retry rate limits
    return true;  // Retry other errors
  },

  backoff: {
    strategy: 'exponential',
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    multiplier: 2,
    jitter: true
  }
};
```

### 3.2: Tool Circuit Breaker

**Location:** `src/capabilities/agents/ToolRegistry.ts`

**Implementation:**
```typescript
export class ToolRegistry implements IToolExecutor {
  private tools: Map<string, ToolFunction>;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private logger: FrameworkLogger;

  constructor(tools: ToolFunction[] = []) {
    this.tools = new Map(tools.map(t => [t.definition.function.name, t]));
    this.circuitBreakers = new Map();
    this.logger = logger.child({ component: 'ToolRegistry' });
  }

  async execute(toolName: string, args: any, context?: ToolContext): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }

    // Get or create circuit breaker for this tool
    let breaker = this.circuitBreakers.get(toolName);
    if (!breaker) {
      breaker = new CircuitBreaker(
        `tool:${toolName}`,
        tool.circuitBreaker || DEFAULT_TOOL_CB_CONFIG
      );
      this.circuitBreakers.set(toolName, breaker);

      // Forward CB events
      breaker.on('opened', (data) => {
        this.logger.warn(data, `Tool circuit breaker opened for ${toolName}`);
        metrics.increment('circuit_breaker.opened', 1, {
          breaker: data.breakerName,
          tool: toolName
        });
      });
    }

    this.logger.debug({ toolName, args }, 'Tool execution started');

    // Execute with circuit breaker
    return breaker.execute(
      async () => {
        const startTime = Date.now();

        try {
          const result = await tool.execute(args, context);

          const duration = Date.now() - startTime;
          metrics.timing('tool.duration', duration, { tool: toolName });
          metrics.increment('tool.success', 1, { tool: toolName });

          this.logger.debug({ toolName, duration }, 'Tool execution completed');

          return result;
        } catch (error) {
          this.logger.error({
            toolName,
            error: error.message
          }, 'Tool execution failed');

          metrics.increment('tool.failed', 1, {
            tool: toolName,
            error: error.name
          });

          throw error;
        }
      }
    );
  }

  /**
   * Get circuit breaker state for all tools
   */
  getCircuitBreakerStates(): Map<string, CircuitState> {
    const states = new Map<string, CircuitState>();
    for (const [toolName, breaker] of this.circuitBreakers) {
      states.set(toolName, breaker.getState());
    }
    return states;
  }
}
```

**Default CB Config for Tools:**
```typescript
const DEFAULT_TOOL_CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,      // More sensitive than LLM
  successThreshold: 2,
  resetTimeoutMs: 60000,    // 1 minute
  windowMs: 300000,         // 5 minutes

  backoff: {
    strategy: 'exponential',
    initialDelayMs: 500,
    maxDelayMs: 15000,
    multiplier: 2,
    jitter: true
  }
};
```

### 3.3: AgenticLoop Integration

**Location:** `src/capabilities/agents/AgenticLoop.ts`

**Modifications:**

1. **Emit CB events through agent events**:
```typescript
// Line ~160: generateWithHooks()
try {
  const response = await this.provider.generate(options);
  // Circuit breaker successful, emit success
  this.emit('circuit:closed', { breakerName: 'llm', timestamp: Date.now() });
} catch (error) {
  if (error instanceof CircuitOpenError) {
    // Circuit breaker opened, emit event
    this.emit('circuit:opened', {
      executionId: this.context.id,
      breakerName: 'llm',
      failureCount: error.failureCount,
      lastError: error.lastError,
      nextRetryTime: error.nextRetryTime
    });
  }
  throw error;
}
```

2. **Track CB metrics in ExecutionMetrics**:
```typescript
// src/capabilities/agents/ExecutionContext.ts
export interface ExecutionMetrics {
  // ... existing metrics ...

  // NEW: Circuit breaker metrics
  circuitBreakers: Map<string, CircuitBreakerMetrics>;
}
```

3. **Add CB audit trail**:
```typescript
// ExecutionContext.addAuditEntry()
this.auditTrail.push({
  type: 'circuit_breaker_opened',
  timestamp: Date.now(),
  data: { breakerName, failureCount, nextRetryTime }
});
```

### 3.4: Connector Observability

**Location:** `src/core/Connector.ts`

**Add Logging:**
```typescript
export class Connector {
  private static logger = logger.child({ component: 'Connector' });

  static create(config: ConnectorConfig): void {
    this.logger.info({
      name: config.name,
      vendor: config.vendor
    }, 'Connector created');

    // ... existing code ...

    metrics.increment('connector.created', 1, { vendor: config.vendor });
  }

  static get(name: string): Connector | undefined {
    const connector = this.registry.get(name);
    if (!connector) {
      this.logger.warn({ name }, 'Connector not found');
    }
    return connector;
  }
}
```

---

## Component 4: Configuration Architecture

### 4.1: Framework-Level Config

**Location:** `src/config/FrameworkConfig.ts` (NEW FILE)

```typescript
export interface FrameworkConfig {
  /** Logging configuration */
  logging?: {
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    pretty?: boolean;
    destination?: string;
  };

  /** Metrics configuration */
  metrics?: {
    collector?: 'noop' | 'console' | 'prometheus' | 'datadog';
    prefix?: string;
    tags?: Record<string, string>;
  };

  /** Circuit breaker defaults */
  circuitBreaker?: {
    enabled?: boolean;

    providers?: CircuitBreakerConfig;  // Default for all providers
    tools?: CircuitBreakerConfig;      // Default for all tools
  };
}

/**
 * Global framework configuration
 */
class FrameworkConfigManager {
  private config: FrameworkConfig = {};

  configure(config: Partial<FrameworkConfig>): void {
    this.config = { ...this.config, ...config };

    // Apply config to subsystems
    if (config.logging) {
      logger.updateConfig(config.logging);
    }

    if (config.metrics) {
      metrics.updateConfig(config.metrics);
    }
  }

  get(): FrameworkConfig {
    return { ...this.config };
  }
}

export const frameworkConfig = new FrameworkConfigManager();
```

**Usage:**
```typescript
import { frameworkConfig } from '@oneringai/agents';

// Configure once at app startup
frameworkConfig.configure({
  logging: {
    level: 'info',
    pretty: process.env.NODE_ENV === 'development'
  },

  metrics: {
    collector: 'prometheus',
    prefix: 'oneringai',
    tags: { service: 'my-app', environment: 'production' }
  },

  circuitBreaker: {
    enabled: true,
    providers: {
      failureThreshold: 5,
      resetTimeoutMs: 30000
    },
    tools: {
      failureThreshold: 3,
      resetTimeoutMs: 60000
    }
  }
});
```

### 4.2: Per-Component Overrides

**Agent-level:**
```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],

  // Override framework defaults
  circuitBreaker: {
    enabled: false  // Disable for this agent
  },

  logLevel: 'debug'  // Override global log level
});
```

**Provider-level:**
```typescript
// In provider config
const provider = createProvider({
  connector,
  circuitBreaker: {
    failureThreshold: 10  // More lenient for this provider
  }
});
```

**Tool-level:**
```typescript
const myTool: ToolFunction = {
  definition: { /* ... */ },
  execute: async (args) => { /* ... */ },

  circuitBreaker: {
    failureThreshold: 2,    // Strict for this tool
    resetTimeoutMs: 120000  // 2 minute timeout
  }
};
```

---

## Implementation Plan

### Phase 3.1: Core Infrastructure (Week 1)

**Files to Create:**

1. `src/infrastructure/resilience/CircuitBreaker.ts` (~350 lines)
   - Generic CircuitBreaker class
   - State machine (closed/open/half-open)
   - Failure counting & window tracking
   - Exponential backoff
   - Event emission
   - Metrics integration

2. `src/infrastructure/resilience/BackoffStrategy.ts` (~150 lines)
   - Exponential backoff
   - Linear backoff
   - Constant backoff
   - Jitter support

3. `src/infrastructure/observability/Logger.ts` (~150 lines)
   - FrameworkLogger class
   - pino integration
   - Child logger support
   - Global singleton

4. `src/infrastructure/observability/Metrics.ts` (~250 lines)
   - MetricsCollector interface
   - NoOpMetrics (default)
   - ConsoleMetrics (dev)
   - PrometheusMetrics (production)
   - Global singleton

5. `src/config/FrameworkConfig.ts` (~100 lines)
   - FrameworkConfig interface
   - Global configuration manager
   - Environment-based defaults

**Total Lines:** ~1,000

### Phase 3.2: Provider Integration (Week 2, Days 1-3)

**Files to Modify:**

1. `src/infrastructure/providers/base/BaseTextProvider.ts`
   - Add circuitBreaker property
   - Add logger property
   - Wrap generate() with CB
   - Wrap streamGenerate() with CB
   - Add metrics collection
   - Forward CB events

2. `src/infrastructure/providers/base/ProviderErrorMapper.ts`
   - Add isRetryable() method
   - Export for CB configuration

3. `src/infrastructure/providers/openai/OpenAITextProvider.ts`
   - Update to use BaseTextProvider.internalGenerate()

4. `src/infrastructure/providers/anthropic/AnthropicTextProvider.ts`
   - Update to use BaseTextProvider.internalGenerate()

5. `src/infrastructure/providers/google/GoogleTextProvider.ts`
   - Update to use BaseTextProvider.internalGenerate()

**Total Lines Modified:** ~200

### Phase 3.3: Tool Integration (Week 2, Days 4-5)

**Files to Modify:**

1. `src/capabilities/agents/ToolRegistry.ts`
   - Add circuitBreakers Map
   - Add logger
   - Wrap execute() with CB
   - Add getCircuitBreakerStates() method
   - Emit CB events
   - Collect metrics

2. `src/domain/entities/Tool.ts`
   - Add optional circuitBreaker config to ToolFunction

**Total Lines Modified:** ~100

### Phase 3.4: AgenticLoop Integration (Week 3, Days 1-2)

**Files to Modify:**

1. `src/capabilities/agents/AgenticLoop.ts`
   - Forward CB events from provider
   - Track CB metrics in ExecutionContext
   - Add CB state to getMetrics()

2. `src/capabilities/agents/ExecutionContext.ts`
   - Add circuitBreakers to ExecutionMetrics
   - Add CB audit trail entries

3. `src/capabilities/agents/types/EventTypes.ts`
   - Add circuit breaker event types

**Total Lines Modified:** ~150

### Phase 3.5: Core Agent Integration (Week 3, Day 3)

**Files to Modify:**

1. `src/core/Agent.ts`
   - Add logger property
   - Log major lifecycle events
   - Forward CB events from loop
   - Add getCircuitBreakerMetrics() method

2. `src/core/Connector.ts`
   - Add static logger
   - Log connector operations

**Total Lines Modified:** ~80

### Phase 3.6: TaskAgent Integration (Week 3, Day 4)

**Files to Modify:**

1. `src/capabilities/taskAgent/TaskAgent.ts`
   - Add logger property
   - Log plan execution events
   - Integrate with framework metrics
   - CB already works via tool wrapping

2. `src/capabilities/taskAgent/PlanExecutor.ts`
   - Add structured logging
   - Emit metrics

**Total Lines Modified:** ~100

### Phase 3.7: Testing (Week 3, Day 5)

**Files to Create:**

1. `tests/unit/resilience/CircuitBreaker.test.ts` (~250 lines)
   - State transitions
   - Failure counting
   - Window tracking
   - Backoff delays
   - Error classification

2. `tests/unit/resilience/BackoffStrategy.test.ts` (~100 lines)
   - Exponential backoff calculations
   - Jitter randomness
   - Max delay caps

3. `tests/unit/observability/Logger.test.ts` (~100 lines)
   - Log levels
   - Child loggers
   - Context propagation

4. `tests/unit/observability/Metrics.test.ts` (~150 lines)
   - Collector interface
   - Counter/gauge/timing/histogram
   - Tag handling

5. `tests/integration/resilience/ProviderCircuitBreaker.test.ts` (~200 lines)
   - Provider CB integration
   - Actual failures handled
   - Recovery scenarios

6. `tests/integration/resilience/ToolCircuitBreaker.test.ts` (~150 lines)
   - Tool CB integration
   - Per-tool isolation
   - State tracking

**Total Test Lines:** ~950

---

## File Structure

```
src/
├── config/                               (NEW)
│   └── FrameworkConfig.ts               (~100 lines)
│
├── infrastructure/
│   ├── resilience/                      (NEW)
│   │   ├── CircuitBreaker.ts           (~350 lines)
│   │   ├── BackoffStrategy.ts          (~150 lines)
│   │   └── index.ts                    (~20 lines)
│   │
│   ├── observability/                   (NEW)
│   │   ├── Logger.ts                   (~150 lines)
│   │   ├── Metrics.ts                  (~250 lines)
│   │   └── index.ts                    (~20 lines)
│   │
│   └── providers/
│       └── base/
│           ├── BaseTextProvider.ts      (MODIFY: +100 lines)
│           └── ProviderErrorMapper.ts   (MODIFY: +30 lines)
│
├── core/
│   ├── Agent.ts                         (MODIFY: +50 lines)
│   └── Connector.ts                     (MODIFY: +30 lines)
│
├── capabilities/
│   ├── agents/
│   │   ├── AgenticLoop.ts              (MODIFY: +80 lines)
│   │   ├── ToolRegistry.ts             (MODIFY: +100 lines)
│   │   ├── ExecutionContext.ts         (MODIFY: +50 lines)
│   │   └── types/EventTypes.ts         (MODIFY: +40 lines)
│   │
│   └── taskAgent/
│       ├── TaskAgent.ts                 (MODIFY: +50 lines)
│       └── PlanExecutor.ts              (MODIFY: +30 lines)
│
└── domain/
    └── entities/
        └── Tool.ts                       (MODIFY: +10 lines)

tests/
├── unit/
│   ├── resilience/                      (NEW)
│   │   ├── CircuitBreaker.test.ts      (~250 lines)
│   │   └── BackoffStrategy.test.ts     (~100 lines)
│   │
│   └── observability/                   (NEW)
│       ├── Logger.test.ts              (~100 lines)
│       └── Metrics.test.ts             (~150 lines)
│
└── integration/
    └── resilience/                      (NEW)
        ├── ProviderCircuitBreaker.test.ts   (~200 lines)
        └── ToolCircuitBreaker.test.ts       (~150 lines)
```

**Total:**
- **New Files:** 10 files, ~1,540 lines
- **Modified Files:** 11 files, ~570 lines
- **Test Files:** 6 files, ~950 lines
- **Grand Total:** ~3,060 lines

---

## Benefits of Framework-Wide Approach

### vs TaskAgent-Only Approach

| Aspect | TaskAgent-Only | Framework-Wide |
|--------|----------------|----------------|
| Coverage | Only TaskAgent users benefit | All users benefit |
| Consistency | Different patterns per component | Unified pattern |
| Maintenance | Duplicate code | Single source of truth |
| Configuration | Complex (per-component) | Simple (global + override) |
| Testing | Fragmented | Comprehensive |
| Documentation | Multiple guides | Unified guide |

### Real-World Impact

**Scenario 1: Basic Agent User**
```typescript
// Gets circuit breaker protection automatically
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [unreliableTool]
});

// If OpenAI API fails 5 times → CB opens
// Next calls fail fast instead of retrying
```

**Scenario 2: TaskAgent User**
```typescript
// Inherits all framework protections
const taskAgent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [apiTool]
});

// LLM calls: Protected by provider CB
// Tool calls: Protected by tool CB
// No extra configuration needed
```

**Scenario 3: Custom Provider**
```typescript
class CustomProvider extends BaseTextProvider {
  // Automatically gets:
  // - Circuit breaker
  // - Structured logging
  // - Metrics collection
  // Just implement internalGenerate()
}
```

---

## Backward Compatibility

### Default Behavior (No Breaking Changes)

**Without Configuration:**
```typescript
// Existing code works unchanged
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4'
});

// Circuit breaker enabled by default with sensible defaults
// Logging at 'info' level
// Metrics to no-op collector
```

**To Disable:**
```typescript
// Opt out if needed
frameworkConfig.configure({
  circuitBreaker: { enabled: false }
});
```

### Configuration Migration

**Before (no configuration):**
```typescript
const agent = Agent.create({ /* ... */ });
```

**After (optional tuning):**
```typescript
// Global configuration
frameworkConfig.configure({
  circuitBreaker: {
    providers: { failureThreshold: 10 }  // More lenient
  }
});

// Or per-agent
const agent = Agent.create({
  /* ... */,
  circuitBreaker: {
    failureThreshold: 3  // More strict
  }
});
```

---

## Integration with Existing Patterns

### 1. Leverage HookManager Pattern

**Observation:** HookManager already implements manual circuit breaker!

**File:** `src/capabilities/agents/HookManager.ts` (lines 212-237)

```typescript
// Current code (manual circuit breaker):
const errorCount = this.errorCounts.get(key) || 0;
if (errorCount >= this.maxConsecutiveErrors) {
  this.disabledHooks.add(key);
  console.warn(`Hook "${key}" disabled after ${errorCount} consecutive errors`);
}
```

**Refactor:**
```typescript
// Extract to generic CircuitBreaker
private hookBreakers = new Map<string, CircuitBreaker>();

getBreaker(hookName: string): CircuitBreaker {
  let breaker = this.hookBreakers.get(hookName);
  if (!breaker) {
    breaker = new CircuitBreaker(`hook:${hookName}`, {
      failureThreshold: this.maxConsecutiveErrors,
      successThreshold: 1,
      resetTimeoutMs: 60000
    });
    this.hookBreakers.set(hookName, breaker);
  }
  return breaker;
}
```

**Benefit:** Consistent pattern across hooks, tools, providers

### 2. Leverage Existing Error Types

**Use ProviderErrorMapper for classification:**
```typescript
// src/infrastructure/providers/base/ProviderErrorMapper.ts

export function isRetryableError(error: Error): boolean {
  if (error instanceof ProviderAuthError) return false;
  if (error instanceof ProviderContextLengthError) return false;
  if (error instanceof ProviderRateLimitError) return true;
  if (error instanceof ProviderError) {
    // Check status code
    const status = (error as any).status;
    return status >= 500 || status === 429;
  }
  return true;  // Default: retry unknown errors
}
```

### 3. Leverage Existing Metrics

**ExecutionMetrics already tracks:**
- Tool success/failure counts
- Token usage
- Duration
- Error list

**Just add:**
- Circuit breaker state
- Backoff durations
- Recovery attempts

### 4. Leverage Event System

**Events already emit:**
- `llm:error`
- `tool:error`
- `tool:timeout`

**Just add:**
- `circuit:opened`
- `circuit:half-open`
- `circuit:closed`
- `backoff:started`

---

## Testing Strategy

### Unit Tests

**CircuitBreaker.test.ts:**
- State transitions (closed → open → half-open → closed)
- Failure counting in rolling window
- Success counting for recovery
- Timeout enforcement
- Manual reset
- Event emission
- Metrics collection

**BackoffStrategy.test.ts:**
- Exponential calculations
- Jitter randomness
- Max delay caps
- Linear strategy
- Constant strategy

**Logger.test.ts:**
- Log levels
- Context propagation
- Child loggers
- Pretty printing

**Metrics.test.ts:**
- Counter increments
- Gauge updates
- Timing recordings
- Histogram distributions
- Tag handling

### Integration Tests

**ProviderCircuitBreaker.test.ts:**
- Mock provider that fails N times
- Verify CB opens
- Verify half-open trial
- Verify recovery
- Verify events emitted
- Verify metrics collected

**ToolCircuitBreaker.test.ts:**
- Tool that fails repeatedly
- Per-tool isolation
- State independence
- Recovery per tool

**AgentCircuitBreaker.test.ts:**
- End-to-end with real Agent
- LLM CB + Tool CB coordination
- Event propagation
- Metrics aggregation

### Load Tests

**Stress Test:**
- 1000 agents simultaneously
- 50% tools fail
- Verify CB prevents retry storms
- Verify memory stable
- Verify performance acceptable

---

## Success Criteria

### Functional

✅ **Circuit Breaker**
- [ ] LLM providers protected
- [ ] Tools protected
- [ ] State transitions correct
- [ ] Backoff working
- [ ] Recovery automatic

✅ **Observability**
- [ ] Structured logging working
- [ ] All metrics collected
- [ ] Events emitted
- [ ] Child loggers propagate context

✅ **Configuration**
- [ ] Global config works
- [ ] Per-component override works
- [ ] Environment variables respected
- [ ] Defaults sensible

### Non-Functional

✅ **Performance**
- [ ] < 1ms overhead per call
- [ ] No memory leaks
- [ ] Event emission non-blocking

✅ **Backward Compatibility**
- [ ] Existing code works unchanged
- [ ] No breaking API changes
- [ ] Opt-out possible
- [ ] All existing tests pass

✅ **Production Ready**
- [ ] Prometheus integration tested
- [ ] Logging in production format
- [ ] Health checks accurate
- [ ] Documentation complete

---

## Deliverables

### Code
1. ✅ CircuitBreaker class (generic, reusable)
2. ✅ BackoffStrategy utilities
3. ✅ Logger infrastructure
4. ✅ Metrics infrastructure
5. ✅ Provider integration
6. ✅ Tool integration
7. ✅ AgenticLoop integration
8. ✅ Agent integration
9. ✅ Connector observability
10. ✅ Framework configuration

### Documentation
1. ✅ FRAMEWORK_RESILIENCE_GUIDE.md - Circuit breaker usage
2. ✅ FRAMEWORK_OBSERVABILITY_GUIDE.md - Logging and metrics
3. ✅ PRODUCTION_DEPLOYMENT_GUIDE.md - Complete production guide
4. ✅ API reference updates

### Tests
1. ✅ Unit tests for all new components
2. ✅ Integration tests for CB + observability
3. ✅ Load tests for production scenarios

---

## Timeline

### Week 1: Core Infrastructure
- **Day 1:** CircuitBreaker class + tests
- **Day 2:** BackoffStrategy + tests
- **Day 3:** Logger infrastructure + tests
- **Day 4:** Metrics infrastructure + tests
- **Day 5:** FrameworkConfig + integration tests

### Week 2: Provider & Tool Integration
- **Day 1-2:** BaseTextProvider CB integration + tests
- **Day 3:** All provider implementations updated
- **Day 4:** ToolRegistry CB integration + tests
- **Day 5:** AgenticLoop integration

### Week 3: Polish & Documentation
- **Day 1-2:** Agent + Connector observability
- **Day 3:** TaskAgent integration
- **Day 4:** Documentation
- **Day 5:** Final testing and validation

**Total: 3 weeks**

---

## Questions & Decisions

### Q1: Should CircuitBreaker be per-instance or global?

**Recommendation:** Per-instance (more flexible)

```typescript
// Each provider gets its own breaker
const provider1 = createProvider(connector1);  // Has CB instance 1
const provider2 = createProvider(connector2);  // Has CB instance 2

// Each tool gets its own breaker
ToolRegistry has Map<toolName, CircuitBreaker>
```

**Benefit:** Failures in one provider/tool don't affect others

### Q2: Should backoff be configurable?

**Recommendation:** Yes, with sensible defaults

```typescript
circuitBreaker: {
  backoff: {
    strategy: 'exponential',  // or 'linear', 'constant'
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    multiplier: 2,
    jitter: true
  }
}
```

### Q3: What about streaming?

**Recommendation:** Stream errors trigger CB same as non-stream

```typescript
async streamGenerate(): AsyncIterator<StreamEvent> {
  // CB wraps the entire stream
  return this.circuitBreaker.executeStreaming(
    async function* () {
      // ... streaming logic ...
    }
  );
}
```

### Q4: How to handle rate limits?

**Recommendation:** Use retry-after from error, not separate rate limiter

```typescript
// ProviderRateLimitError already has retryAfter
if (error instanceof ProviderRateLimitError) {
  // CB backoff uses error.retryAfter
  await backoff.wait(error.retryAfter);
}
```

**Benefit:** Respect server-provided retry-after, don't implement separate rate limiting

---

## Risk Assessment

### Low Risk
- Logger infrastructure (isolated)
- Metrics collection (fire-and-forget)
- FrameworkConfig (simple)
- Documentation

### Medium Risk
- CircuitBreaker state machine (complexity)
- Provider integration (touches critical path)
- Backoff strategies (timing-sensitive)

### High Risk
- None (good isolation, comprehensive tests)

### Mitigation
- Feature flags (can disable CB)
- Extensive unit tests
- Integration tests with mocked failures
- Gradual rollout (opt-in initially)

---

## Post-Implementation

### Phase 4: Advanced Features (Optional)

1. **Adaptive Circuit Breaker**
   - Learn failure patterns
   - Adjust thresholds dynamically
   - Predict failures

2. **Distributed Circuit Breaker**
   - Shared state across instances (Redis)
   - Cluster-wide protection
   - Coordinated backoff

3. **Observability Backends**
   - Datadog integration
   - New Relic integration
   - CloudWatch integration

4. **Advanced Metrics**
   - Cost tracking per agent
   - Token usage trends
   - Performance profiling

---

## Conclusion

This plan transforms the framework from **development-grade to production-grade** by adding:

1. **Resilience** - Circuit breaker prevents cascading failures
2. **Observability** - Logging and metrics enable debugging
3. **Consistency** - Same patterns across all components
4. **Flexibility** - Configurable globally or per-component

**Implementation Effort:** ~3,060 lines across 3 weeks
**Production Value:** HIGH
**Risk:** LOW-MEDIUM (good isolation, comprehensive testing)

**Ready to implement?**
