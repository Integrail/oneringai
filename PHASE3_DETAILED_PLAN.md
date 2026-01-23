# Phase 3: Production Hardening - Detailed Plan

**Date:** 2026-01-23
**Duration:** 1 week
**Priority:** MEDIUM
**Status:** Ready to start

---

## Overview

Phase 3 focuses on **production hardening** - adding the protective mechanisms and observability features needed for reliable, scalable deployment. These features prevent common production issues like runaway costs, cascading failures, and difficult debugging.

---

## Goals

1. **Prevent Runaway Execution** - Rate limiting to control costs
2. **Handle Failures Gracefully** - Circuit breaker to prevent cascading failures
3. **Production Observability** - Structured logging and metrics
4. **Deployment Readiness** - Complete production deployment guide

---

## Component 1: Rate Limiting

### Purpose

Prevent agents from executing too many tool calls too quickly, which can:
- **Rack up API costs** - Unlimited tool calls = unlimited costs
- **Hit rate limits** - External APIs have rate limits
- **Cause resource exhaustion** - Too many concurrent operations

### Design

**RateLimiter Class:**
```typescript
// src/capabilities/taskAgent/RateLimiter.ts

export interface RateLimitConfig {
  /** Max calls per minute per tool */
  maxCallsPerMinute: number;

  /** Max calls per task (prevents infinite loops) */
  maxCallsPerTask?: number;

  /** Cooldown period after hitting limit (ms) */
  cooldownMs?: number;

  /** Burst allowance (allow brief spikes) */
  burstSize?: number;
}

export class RateLimiter {
  private callTimestamps = new Map<string, number[]>();
  private taskCallCounts = new Map<string, Map<string, number>>();

  /**
   * Check if tool call is allowed
   * @throws RateLimitError if limit exceeded
   */
  async checkLimit(
    toolName: string,
    taskId?: string,
    config: RateLimitConfig
  ): Promise<boolean> {
    const now = Date.now();

    // Check per-minute limit
    const recentCalls = this.getRecentCalls(toolName, now, 60000);
    if (recentCalls.length >= config.maxCallsPerMinute) {
      if (config.cooldownMs) {
        await this.cooldown(config.cooldownMs);
      } else {
        throw new RateLimitError(
          toolName,
          config.maxCallsPerMinute,
          'minute'
        );
      }
    }

    // Check per-task limit
    if (taskId && config.maxCallsPerTask) {
      const taskCalls = this.getTaskCalls(toolName, taskId);
      if (taskCalls >= config.maxCallsPerTask) {
        throw new RateLimitError(
          toolName,
          config.maxCallsPerTask,
          'task'
        );
      }
    }

    // Record this call
    this.recordCall(toolName, taskId, now);
    return true;
  }

  /**
   * Get recent calls within window
   */
  private getRecentCalls(
    toolName: string,
    now: number,
    windowMs: number
  ): number[] {
    const calls = this.callTimestamps.get(toolName) || [];
    const cutoff = now - windowMs;
    const recent = calls.filter(ts => ts > cutoff);

    // Clean up old timestamps
    this.callTimestamps.set(toolName, recent);

    return recent;
  }

  /**
   * Cooldown period
   */
  private async cooldown(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class RateLimitError extends Error {
  constructor(
    public toolName: string,
    public limit: number,
    public period: string
  ) {
    super(
      `Rate limit exceeded for ${toolName}: ${limit} calls per ${period}`
    );
    this.name = 'RateLimitError';
  }
}
```

### Integration

**In TaskAgent:**
```typescript
export class TaskAgent {
  private rateLimiter?: RateLimiter;

  private initializeComponents(config: TaskAgentConfig): void {
    // ... existing code ...

    // Create rate limiter if configured
    if (config.rateLimitConfig) {
      this.rateLimiter = new RateLimiter(config.rateLimitConfig);
    }

    // Wrap tools with rate limiting
    const rateLimitedTools = this.tools.map(tool =>
      this.wrapToolWithRateLimit(tool)
    );
  }

  private wrapToolWithRateLimit(tool: ToolFunction): ToolFunction {
    return {
      ...tool,
      execute: async (args: any, context?: any) => {
        // Check rate limit before execution
        if (this.rateLimiter && tool.rateLimit !== false) {
          const config = tool.rateLimitConfig || DEFAULT_RATE_LIMIT;
          await this.rateLimiter.checkLimit(
            tool.definition.function.name,
            context?.taskId,
            config
          );
        }

        // Execute tool
        return tool.execute(args, context);
      }
    };
  }
}
```

### Configuration

**Per-Agent:**
```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [expensiveTool],
  rateLimitConfig: {
    maxCallsPerMinute: 60,
    maxCallsPerTask: 10,
    cooldownMs: 5000,
    burstSize: 5
  }
});
```

**Per-Tool:**
```typescript
const expensiveTool: ToolFunction = {
  definition: { /* ... */ },
  execute: async (args) => { /* ... */ },
  rateLimitConfig: {
    maxCallsPerMinute: 10,  // Stricter limit for this tool
    cooldownMs: 10000
  }
};
```

### Benefits

- ✅ **Cost Control** - Prevents runaway API costs
- ✅ **Rate Limit Protection** - Stays under external API limits
- ✅ **Graceful Degradation** - Cooldown instead of hard failure
- ✅ **Per-Tool Configuration** - Flexible limits

### Testing

```typescript
// tests/unit/taskAgent/RateLimiter.test.ts
describe('RateLimiter', () => {
  it('should allow calls under limit', async () => {
    const limiter = new RateLimiter();
    // Make 5 calls (under 10/min limit)
    for (let i = 0; i < 5; i++) {
      await limiter.checkLimit('tool', 'task1', {
        maxCallsPerMinute: 10
      });
    }
  });

  it('should throw when limit exceeded', async () => {
    const limiter = new RateLimiter();
    // Make 11 calls (over 10/min limit)
    for (let i = 0; i < 10; i++) {
      await limiter.checkLimit('tool', 'task1', {
        maxCallsPerMinute: 10
      });
    }

    await expect(
      limiter.checkLimit('tool', 'task1', {
        maxCallsPerMinute: 10
      })
    ).rejects.toThrow(RateLimitError);
  });

  it('should reset after time window', async () => {
    // Test that old calls are cleaned up
  });
});
```

---

## Component 2: Circuit Breaker

### Purpose

Prevent cascading failures when a tool consistently fails:
- **Stop retrying failed operations** - Don't waste time/money
- **Fast failure** - Fail immediately when circuit is open
- **Auto-recovery** - Automatically try again after cooldown

### Design

**CircuitBreaker Class:**
```typescript
// src/capabilities/taskAgent/CircuitBreaker.ts

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;

  /** Number of successes to close circuit */
  successThreshold: number;

  /** Time to wait before trying again (ms) */
  resetTimeoutMs: number;

  /** Time window for counting failures (ms) */
  windowMs: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = new Map<string, FailureRecord[]>();
  private openUntil = new Map<string, number>();
  private consecutiveSuccesses = new Map<string, number>();

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T> {
    const now = Date.now();

    // Check if circuit is open
    const openTime = this.openUntil.get(key);
    if (openTime) {
      if (now < openTime) {
        // Circuit still open
        throw new CircuitOpenError(key, openTime - now);
      } else {
        // Try half-open
        this.state = 'half-open';
        this.openUntil.delete(key);
      }
    }

    try {
      // Execute function
      const result = await fn();

      // Success - record it
      this.recordSuccess(key, config);

      return result;
    } catch (error) {
      // Failure - record it
      this.recordFailure(key, now, config);

      throw error;
    }
  }

  /**
   * Record successful execution
   */
  private recordSuccess(
    key: string,
    config: CircuitBreakerConfig
  ): void {
    // Increment consecutive successes
    const successes = (this.consecutiveSuccesses.get(key) || 0) + 1;
    this.consecutiveSuccesses.set(key, successes);

    // Close circuit if threshold met
    if (successes >= config.successThreshold) {
      this.state = 'closed';
      this.failures.delete(key);
      this.consecutiveSuccesses.delete(key);
    }
  }

  /**
   * Record failed execution
   */
  private recordFailure(
    key: string,
    now: number,
    config: CircuitBreakerConfig
  ): void {
    // Reset consecutive successes
    this.consecutiveSuccesses.set(key, 0);

    // Record failure
    const records = this.failures.get(key) || [];
    records.push({ timestamp: now, error: 'failure' });

    // Keep only recent failures
    const cutoff = now - config.windowMs;
    const recentFailures = records.filter(r => r.timestamp > cutoff);
    this.failures.set(key, recentFailures);

    // Check if threshold exceeded
    if (recentFailures.length >= config.failureThreshold) {
      // Open circuit
      this.state = 'open';
      this.openUntil.set(key, now + config.resetTimeoutMs);

      console.warn(
        `Circuit breaker opened for ${key} after ${recentFailures.length} failures`
      );
    }
  }

  /**
   * Get circuit state for a key
   */
  getState(key: string): CircuitState {
    const openTime = this.openUntil.get(key);
    if (openTime && Date.now() < openTime) {
      return 'open';
    }
    return this.state;
  }

  /**
   * Manually reset circuit
   */
  reset(key: string): void {
    this.state = 'closed';
    this.failures.delete(key);
    this.openUntil.delete(key);
    this.consecutiveSuccesses.delete(key);
  }
}

interface FailureRecord {
  timestamp: number;
  error: string;
}

export class CircuitOpenError extends Error {
  constructor(
    public key: string,
    public retryAfterMs: number
  ) {
    super(
      `Circuit breaker open for ${key}. Retry after ${Math.ceil(retryAfterMs / 1000)}s`
    );
    this.name = 'CircuitOpenError';
  }
}
```

### Integration

**In TaskAgent:**
```typescript
export class TaskAgent {
  private circuitBreaker?: CircuitBreaker;

  private initializeComponents(config: TaskAgentConfig): void {
    // ... existing code ...

    // Create circuit breaker if configured
    if (config.circuitBreakerConfig) {
      this.circuitBreaker = new CircuitBreaker();
    }

    // Wrap tools with circuit breaker
    const protectedTools = this.tools.map(tool =>
      this.wrapToolWithCircuitBreaker(tool)
    );
  }

  private wrapToolWithCircuitBreaker(tool: ToolFunction): ToolFunction {
    return {
      ...tool,
      execute: async (args: any, context?: any) => {
        if (!this.circuitBreaker || tool.circuitBreaker === false) {
          return tool.execute(args, context);
        }

        const key = tool.definition.function.name;
        const config = tool.circuitBreakerConfig || DEFAULT_CIRCUIT_BREAKER;

        // Execute with circuit breaker protection
        return this.circuitBreaker.execute(
          key,
          () => tool.execute(args, context),
          config
        );
      }
    };
  }
}
```

### Configuration

```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [unreliableTool],
  circuitBreakerConfig: {
    failureThreshold: 5,      // Open after 5 failures
    successThreshold: 2,      // Close after 2 successes
    resetTimeoutMs: 60000,    // Wait 1 minute
    windowMs: 300000          // 5 minute window
  }
});
```

### Benefits

- ✅ **Fast Failure** - Don't waste time retrying
- ✅ **Resource Protection** - Prevent overload
- ✅ **Auto-Recovery** - Automatically tries again
- ✅ **Cascading Prevention** - Stops failure spread

---

## Component 3: Production Observability

### Purpose

Enable monitoring, debugging, and optimization in production:
- **Structured Logging** - Machine-readable logs
- **Metrics Collection** - Track performance
- **Health Checks** - Monitor agent status
- **Distributed Tracing** - Track requests across systems

### 3.1: Structured Logging

**Use pino for structured logging:**

```typescript
// src/capabilities/taskAgent/Logger.ts
import pino from 'pino';

export interface LoggerConfig {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  pretty?: boolean;
  destination?: string;
}

export function createLogger(config: LoggerConfig = {}): pino.Logger {
  return pino({
    level: config.level || process.env.LOG_LEVEL || 'info',
    transport: config.pretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
}
```

**Integration:**

```typescript
export class TaskAgent {
  private logger: pino.Logger;

  private constructor(...) {
    this.logger = createLogger({
      level: config.logLevel || 'info'
    });
  }

  protected async executePlan(): Promise<PlanResult> {
    this.logger.info({
      agentId: this.id,
      planId: this.state.plan.id,
      taskCount: this.state.plan.tasks.length
    }, 'Plan execution started');

    try {
      const result = await this.planExecutor.execute(plan, this.state);

      this.logger.info({
        agentId: this.id,
        status: result.status,
        metrics: result.metrics
      }, 'Plan execution completed');

      return result;
    } catch (error) {
      this.logger.error({
        agentId: this.id,
        error: error.message,
        stack: error.stack
      }, 'Plan execution failed');

      throw error;
    }
  }
}
```

### 3.2: Metrics Collection

**Track key metrics:**

```typescript
// src/capabilities/taskAgent/Metrics.ts

export interface MetricsCollector {
  increment(name: string, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  timing(name: string, duration: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
}

export class PrometheusMetrics implements MetricsCollector {
  // Implementation using prom-client
}

export class DatadogMetrics implements MetricsCollector {
  // Implementation using hot-shots
}
```

**Key Metrics:**

```typescript
// In TaskAgent
metrics.increment('taskagent.tasks.started', { task: task.name });
metrics.increment('taskagent.tasks.completed', { task: task.name, status: 'success' });
metrics.timing('taskagent.task.duration', duration, { task: task.name });
metrics.gauge('taskagent.memory.utilization', utilization);
metrics.gauge('taskagent.context.utilization', contextPercent);
metrics.histogram('taskagent.llm.tokens', tokens, { model: 'gpt-4' });
```

### 3.3: Health Checks

```typescript
// src/capabilities/taskAgent/HealthCheck.ts

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    agent: HealthCheckResult;
    memory: HealthCheckResult;
    context: HealthCheckResult;
    storage: HealthCheckResult;
  };
  timestamp: number;
}

export class HealthCheck {
  async check(agent: TaskAgent): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkAgent(agent),
      this.checkMemory(agent),
      this.checkContext(agent),
      this.checkStorage(agent),
    ]);

    const overallStatus = this.aggregateStatus(checks);

    return {
      status: overallStatus,
      checks: {
        agent: checks[0],
        memory: checks[1],
        context: checks[2],
        storage: checks[3],
      },
      timestamp: Date.now(),
    };
  }
}
```

**Express endpoint:**

```typescript
app.get('/health/taskagent/:agentId', async (req, res) => {
  const agent = getAgent(req.params.agentId);
  const health = await healthCheck.check(agent);

  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

---

## Component 4: Production Deployment Guide

### Purpose

Comprehensive guide for production deployment covering:
- Storage backend selection
- Scaling strategies
- Monitoring setup
- Security best practices

### Content Outline

**TASKAGENT_PRODUCTION_GUIDE.md:**

1. **Storage Backends**
   - In-Memory (development)
   - Redis (recommended)
   - PostgreSQL (complex queries)
   - Custom implementation

2. **Scaling Strategies**
   - Horizontal scaling with shared storage
   - Load balancing
   - Queue-based task distribution

3. **Monitoring Setup**
   - Structured logging configuration
   - Metrics collection
   - Alerting thresholds
   - Dashboard examples

4. **Security**
   - API key management
   - Tool sandboxing
   - Input validation
   - Output sanitization

5. **Performance Tuning**
   - Model selection
   - Context optimization
   - Memory limits
   - Rate limiting

6. **Troubleshooting**
   - Common issues
   - Debug workflows
   - Performance profiling

---

## Implementation Timeline

### Week 1: Core Components
- **Day 1-2:** RateLimiter implementation and tests
- **Day 3-4:** CircuitBreaker implementation and tests
- **Day 5:** Integration with TaskAgent

### Week 2: Observability
- **Day 1-2:** Structured logging integration
- **Day 3:** Metrics collection
- **Day 4:** Health checks
- **Day 5:** Production deployment guide

---

## Testing Strategy

### Unit Tests
- RateLimiter (scenarios: under limit, over limit, cooldown, burst)
- CircuitBreaker (states: closed, open, half-open, recovery)
- Logger (levels, formatting, destinations)
- Metrics (collectors, aggregation)

### Integration Tests
- Rate limiting with real tools
- Circuit breaker with flaky tools
- End-to-end logging
- Health check accuracy

### Load Tests
- 1000 tasks with rate limiting
- Circuit breaker under stress
- Memory usage over time

---

## Success Criteria

✅ **Rate Limiting**
- Prevents unlimited tool calls
- Configurable per-tool and per-agent
- Graceful cooldown behavior

✅ **Circuit Breaker**
- Opens after threshold failures
- Auto-recovers successfully
- Prevents cascading failures

✅ **Observability**
- Structured logs readable by humans and machines
- Key metrics collected
- Health checks accurate

✅ **Documentation**
- Complete production guide
- Example configurations
- Troubleshooting workflows

---

## Post-Phase 3

After Phase 3, TaskAgent will be **fully production-ready** with:
- ✅ All critical bugs fixed (Phase 1)
- ✅ AI planning and observability (Phase 2)
- ✅ Production hardening (Phase 3)
- ⏭️ Optional: Advanced testing (Phase 4)

**Deployment-ready checklist:**
- [ ] Rate limiting configured
- [ ] Circuit breaker thresholds set
- [ ] Logging configured (pino)
- [ ] Metrics collection enabled
- [ ] Health checks deployed
- [ ] Storage backend selected (Redis/Postgres)
- [ ] Monitoring dashboards created
- [ ] Alerting configured
- [ ] Security review complete

---

## Questions?

**Q: Is Phase 3 required for production?**
A: Recommended but not strictly required. You can deploy without it if:
   - You have low traffic
   - You trust your tools won't fail
   - You have other rate limiting in place
   - You have external monitoring

**Q: Can I implement Phase 3 incrementally?**
A: Yes! Each component is independent:
   - Start with just rate limiting
   - Add circuit breaker for critical tools
   - Add observability when debugging needed

**Q: What's the performance impact?**
A: Minimal:
   - Rate limiting: < 1ms per check
   - Circuit breaker: < 0.5ms per check
   - Logging: Async, non-blocking
   - Metrics: Fire-and-forget

**Q: Can I use my own logging/metrics system?**
A: Yes! All interfaces are pluggable:
   - Implement MetricsCollector interface
   - Use any pino-compatible logger
   - Customize health checks

---

**Ready to implement Phase 3?**
