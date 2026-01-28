# Agentic Framework Improvement Plan

## Overview

This document outlines a comprehensive improvement plan for the @oneringai/agents agentic framework based on a thorough code quality analysis. The plan addresses non-DRY code, inconsistencies, missing abstractions, potential bugs, and resource management issues.

**Analysis Date:** 2026-01-28
**Total Issues Identified:** 45+
**Estimated Total Effort:** 15-20 engineering days

---

## Implementation Status

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Session Loading Race Condition | ✅ COMPLETE | Fixed in Agent.ts - awaits pending load in run()/stream()/saveSession() |
| 1.2 Extract BaseAgent Class | ⚠️ PARTIAL | BaseAgent class created (`src/core/BaseAgent.ts`); migration of agents deferred to avoid breaking changes |
| 1.3 Standardize EventEmitter Imports | ✅ COMPLETE | All 14 files now use `eventemitter3` |
| 1.4 Unified Error Handling Strategy | ✅ COMPLETE | ErrorHandler class created (`src/core/ErrorHandler.ts`) |

### 1.2 BaseAgent Notes

The `BaseAgent` class has been created with:
- Connector resolution helper
- ToolManager initialization helper
- PermissionManager initialization helper
- Session management (init, load, save, getters)
- Lifecycle/cleanup helpers

**Why partial?** Migrating Agent, TaskAgent, and UniversalAgent to extend BaseAgent requires significant refactoring due to:
- Different event types (AgenticLoopEvents vs BaseAgentEvents)
- Complex constructor logic specific to each agent
- Risk of breaking existing tests and behavior

**Recommendation:** Use BaseAgent for new agents. Migrate existing agents in a future major version.

---

## Table of Contents

1. [Priority 1: Critical Issues](#priority-1-critical-issues)
2. [Priority 2: Architecture Improvements](#priority-2-architecture-improvements)
3. [Priority 3: API Consistency](#priority-3-api-consistency)
4. [Priority 4: Code Quality](#priority-4-code-quality)
5. [Implementation Schedule](#implementation-schedule)
6. [Verification Checklist](#verification-checklist)

---

## Priority 1: Critical Issues

### 1.1 Fix Session Loading Race Condition

**Severity:** CRITICAL
**Effort:** Low (1-2 hours)
**Files:** `src/core/Agent.ts`

#### Problem

In `Agent.ts` (lines 287-288), session loading is started but not awaited in the constructor:

```typescript
// Current (broken):
this._pendingSessionLoad = this.loadSessionInternal(config.session.id);
// Constructor returns while session is still loading
```

When `run()` is called immediately after construction, the session may not be loaded, causing:
- Tool permissions not restored
- Conversation history missing
- Approval state lost

#### Solution

**Option A (Recommended):** Await pending load in `run()` and `stream()`

```typescript
// In Agent.ts

async run(input: InputItem | InputItem[] | string): Promise<LLMResponse> {
  // Wait for any pending session load
  if (this._pendingSessionLoad) {
    await this._pendingSessionLoad;
    this._pendingSessionLoad = undefined;
  }

  // ... existing code
}

async *stream(input: InputItem | InputItem[] | string): AsyncIterableIterator<StreamEvent> {
  // Wait for any pending session load
  if (this._pendingSessionLoad) {
    await this._pendingSessionLoad;
    this._pendingSessionLoad = undefined;
  }

  // ... existing code
}
```

**Option B:** Factory method pattern

```typescript
// Make constructor private, use factory
private constructor(config: AgentConfig) { ... }

static async create(config: AgentConfig): Promise<Agent> {
  const agent = new Agent(config);
  if (agent._pendingSessionLoad) {
    await agent._pendingSessionLoad;
  }
  return agent;
}
```

#### Tests to Add

```typescript
// tests/unit/core/Agent.test.ts

describe('Session Loading Race Condition', () => {
  it('should wait for session load before executing run()', async () => {
    const storage = new InMemorySessionStorage();
    // Create session with history
    const session = { id: 'test', history: [...] };
    await storage.save(session);

    const agent = Agent.create({
      connector: 'openai',
      model: 'gpt-4',
      session: { storage, id: 'test' },
    });

    // Immediately call run() - should not fail
    const response = await agent.run('Hello');

    // Session history should be loaded
    expect(agent.getHistory().length).toBeGreaterThan(0);
  });

  it('should wait for session load before streaming', async () => {
    // Similar test for stream()
  });
});
```

---

### 1.2 Extract BaseAgent Class

**Severity:** HIGH
**Effort:** High (2-3 days)
**Files:** New `src/core/BaseAgent.ts`, modify `Agent.ts`, `TaskAgent.ts`, `UniversalAgent.ts`

#### Problem

Three agent classes duplicate 300+ lines of identical code:
- Connector resolution (3 locations)
- Session initialization (3 locations, ~90 lines each)
- Tool manager setup (3 locations)
- Event forwarding (3 locations)
- Cleanup/destroy logic (3 locations)

#### Solution

Create abstract `BaseAgent` class with shared functionality.

**New File:** `src/core/BaseAgent.ts`

```typescript
import { EventEmitter } from 'eventemitter3';
import { Connector } from './Connector.js';
import { ToolManager } from './ToolManager.js';
import { SessionManager, Session } from './SessionManager.js';
import { ToolPermissionManager } from './permissions/ToolPermissionManager.js';
import type { ToolFunction } from '../domain/entities/Tool.js';
import type { LLMResponse } from '../domain/entities/Response.js';
import type { InputItem } from '../domain/entities/Message.js';

/**
 * Base configuration shared by all agent types
 */
export interface BaseAgentConfig {
  /** Connector name or instance */
  connector: string | Connector;

  /** Model identifier */
  model: string;

  /** Tools available to the agent */
  tools?: ToolFunction[];

  /** Session configuration */
  session?: {
    storage: ISessionStorage;
    id?: string;
    autoSave?: boolean;
    autoSaveIntervalMs?: number;
  };

  /** Permission configuration */
  permissions?: PermissionConfig;
}

/**
 * Base events emitted by all agent types
 */
export interface BaseAgentEvents {
  'tool:start': { toolName: string; args: Record<string, unknown> };
  'tool:complete': { toolName: string; result: unknown; durationMs: number };
  'tool:error': { toolName: string; error: Error };
  'session:saved': { sessionId: string };
  'session:loaded': { sessionId: string };
  'destroyed': void;
}

/**
 * Abstract base class for all agent types.
 * Provides shared functionality for connector resolution, session management,
 * tool management, and lifecycle methods.
 */
export abstract class BaseAgent<
  TConfig extends BaseAgentConfig = BaseAgentConfig,
  TEvents extends BaseAgentEvents = BaseAgentEvents
> extends EventEmitter<TEvents> {

  // ===== Protected State =====
  protected readonly config: TConfig;
  protected connector: Connector;
  protected toolManager: ToolManager;
  protected permissionManager?: ToolPermissionManager;

  // Session state
  protected sessionManager?: SessionManager;
  protected session?: Session;
  protected pendingSessionLoad?: Promise<void>;
  protected autoSaveTimer?: NodeJS.Timeout;

  // Lifecycle state
  protected _isPaused = false;
  protected _isCancelled = false;
  protected _isDestroyed = false;
  protected cleanupCallbacks: Array<() => void | Promise<void>> = [];

  // ===== Constructor =====

  constructor(config: TConfig) {
    super();
    this.config = config;

    // Resolve connector
    this.connector = this.resolveConnector(config.connector);

    // Initialize tool manager
    this.toolManager = this.initializeToolManager(config.tools);

    // Initialize permissions
    if (config.permissions) {
      this.permissionManager = new ToolPermissionManager(config.permissions);
    }

    // Initialize session (may start async load)
    this.initializeSession(config.session);
  }

  // ===== Abstract Methods (must be implemented by subclasses) =====

  /**
   * Execute the agent with the given input
   */
  abstract run(input: InputItem | InputItem[] | string): Promise<LLMResponse>;

  /**
   * Stream execution results
   */
  abstract stream(input: InputItem | InputItem[] | string): AsyncIterableIterator<unknown>;

  /**
   * Get the agent type identifier for session serialization
   */
  protected abstract getAgentType(): string;

  // ===== Protected Initialization Methods =====

  /**
   * Resolve connector from string name or instance
   */
  protected resolveConnector(ref: string | Connector): Connector {
    if (typeof ref === 'string') {
      return Connector.get(ref);
    }
    return ref;
  }

  /**
   * Initialize tool manager with provided tools
   */
  protected initializeToolManager(tools?: ToolFunction[]): ToolManager {
    const manager = new ToolManager();

    if (tools) {
      for (const tool of tools) {
        manager.register(tool);
      }
    }

    return manager;
  }

  /**
   * Initialize session management
   */
  protected initializeSession(sessionConfig?: TConfig['session']): void {
    if (!sessionConfig) {
      return;
    }

    this.sessionManager = new SessionManager({ storage: sessionConfig.storage });

    if (sessionConfig.id) {
      // Resume existing session (async)
      this.pendingSessionLoad = this.loadSession(sessionConfig.id);
    } else {
      // Create new session
      this.session = this.sessionManager.create(this.getAgentType(), {
        model: this.config.model,
      });
    }

    // Setup auto-save if enabled
    if (sessionConfig.autoSave && !sessionConfig.id) {
      const interval = sessionConfig.autoSaveIntervalMs ?? 30000;
      this.enableAutoSave(interval);
    }
  }

  /**
   * Ensure any pending session load is complete
   */
  protected async ensureSessionLoaded(): Promise<void> {
    if (this.pendingSessionLoad) {
      await this.pendingSessionLoad;
      this.pendingSessionLoad = undefined;
    }
  }

  /**
   * Load session from storage
   */
  protected async loadSession(sessionId: string): Promise<void> {
    if (!this.sessionManager) {
      throw new Error('Session manager not initialized');
    }

    const session = await this.sessionManager.load(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.session = session;

    // Restore tool state
    if (session.toolState) {
      this.toolManager.loadState(session.toolState);
    }

    // Restore permission state
    if (session.permissionState && this.permissionManager) {
      this.permissionManager.loadState(session.permissionState);
    }

    // Enable auto-save if configured
    if (this.config.session?.autoSave) {
      const interval = this.config.session.autoSaveIntervalMs ?? 30000;
      this.enableAutoSave(interval);
    }

    this.emit('session:loaded' as keyof TEvents, { sessionId } as any);
  }

  /**
   * Enable auto-save for session
   */
  protected enableAutoSave(intervalMs: number): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.saveSession();
      } catch (error) {
        // Log but don't throw for auto-save errors
        console.warn('[BaseAgent] Auto-save failed:', error);
      }
    }, intervalMs);
  }

  // ===== Public Session Methods =====

  /**
   * Save current session to storage
   */
  async saveSession(): Promise<void> {
    if (!this.session || !this.sessionManager) {
      throw new Error('Session not enabled');
    }

    // Update session state before saving
    this.session.toolState = this.toolManager.getState();
    if (this.permissionManager) {
      this.session.permissionState = this.permissionManager.getState();
    }
    this.session.lastAccessedAt = Date.now();

    await this.sessionManager.save(this.session);
    this.emit('session:saved' as keyof TEvents, { sessionId: this.session.id } as any);
  }

  /**
   * Get session ID if session is enabled
   */
  getSessionId(): string | undefined {
    return this.session?.id;
  }

  /**
   * Check if session is enabled
   */
  hasSession(): boolean {
    return this.session !== undefined;
  }

  // ===== Public Tool Methods =====

  /**
   * Get the tool manager
   */
  get tools(): ToolManager {
    return this.toolManager;
  }

  /**
   * Add a tool to the agent
   */
  addTool(tool: ToolFunction): void {
    this.toolManager.register(tool);
  }

  /**
   * Remove a tool by name
   */
  removeTool(name: string): void {
    this.toolManager.unregister(name);
  }

  /**
   * List all tool names
   */
  listTools(): string[] {
    return this.toolManager.listEnabled();
  }

  /**
   * Set all tools (replaces existing)
   */
  setTools(tools: ToolFunction[]): void {
    this.toolManager.clear();
    for (const tool of tools) {
      this.toolManager.register(tool);
    }
  }

  // ===== Public Permission Methods =====

  /**
   * Get the permission manager
   */
  get permissions(): ToolPermissionManager | undefined {
    return this.permissionManager;
  }

  /**
   * Check if a tool needs approval
   */
  toolNeedsApproval(toolName: string): boolean {
    if (!this.permissionManager) {
      return false;
    }
    const result = this.permissionManager.checkPermission(toolName);
    return result.needsApproval;
  }

  /**
   * Approve a tool for the current session
   */
  approveToolForSession(toolName: string): void {
    if (!this.permissionManager) {
      return;
    }
    this.permissionManager.approveForSession(toolName);
  }

  // ===== Public Lifecycle Methods =====

  /**
   * Pause agent execution
   */
  pause(): void {
    this._isPaused = true;
  }

  /**
   * Resume agent execution
   */
  resume(): void {
    this._isPaused = false;
  }

  /**
   * Cancel current execution
   */
  cancel(): void {
    this._isCancelled = true;
  }

  /**
   * Check if agent is paused
   */
  isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Check if agent is cancelled
   */
  isCancelled(): boolean {
    return this._isCancelled;
  }

  /**
   * Check if agent is destroyed
   */
  isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Register a cleanup callback
   */
  onCleanup(callback: () => void | Promise<void>): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Destroy the agent and release resources
   */
  async destroy(): Promise<void> {
    if (this._isDestroyed) {
      return;
    }

    this._isDestroyed = true;
    this._isCancelled = true;

    // Stop auto-save
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }

    // Save session if enabled
    if (this.session && this.sessionManager && this.config.session?.autoSave) {
      try {
        await this.saveSession();
      } catch (error) {
        console.warn('[BaseAgent] Final save failed:', error);
      }
    }

    // Run cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        console.warn('[BaseAgent] Cleanup callback failed:', error);
      }
    }
    this.cleanupCallbacks = [];

    // Remove all listeners
    this.removeAllListeners();

    this.emit('destroyed' as keyof TEvents, undefined as any);
  }
}

export default BaseAgent;
```

#### Migration Steps

1. Create `BaseAgent.ts` as shown above
2. Update `Agent.ts`:
   ```typescript
   export class Agent extends BaseAgent<AgentConfig, AgentEvents> {
     // Remove duplicated methods, keep agent-specific logic
   }
   ```
3. Update `TaskAgent.ts`:
   ```typescript
   export class TaskAgent extends BaseAgent<TaskAgentConfig, TaskAgentEvents> {
     // Remove duplicated methods, keep task-specific logic
   }
   ```
4. Update `UniversalAgent.ts`:
   ```typescript
   export class UniversalAgent extends BaseAgent<UniversalAgentConfig, UniversalAgentEvents> {
     // Remove duplicated methods, keep universal-specific logic
   }
   ```
5. Update exports in `src/core/index.ts`
6. Run all tests to ensure backward compatibility

#### Tests to Add

```typescript
// tests/unit/core/BaseAgent.test.ts

describe('BaseAgent', () => {
  describe('Connector Resolution', () => {
    it('should resolve connector from string name');
    it('should accept connector instance directly');
    it('should throw if connector not found');
  });

  describe('Tool Management', () => {
    it('should initialize tool manager with provided tools');
    it('should allow adding tools after construction');
    it('should allow removing tools');
  });

  describe('Session Management', () => {
    it('should create new session if no id provided');
    it('should load existing session if id provided');
    it('should enable auto-save when configured');
    it('should save session on destroy');
  });

  describe('Lifecycle', () => {
    it('should support pause/resume');
    it('should support cancel');
    it('should run cleanup callbacks on destroy');
  });
});
```

---

### 1.3 Standardize EventEmitter Imports

**Severity:** MEDIUM
**Effort:** Low (1 hour)
**Files:** 6+ files

#### Problem

Inconsistent EventEmitter imports across the codebase:

| File | Current Import |
|------|----------------|
| `AgenticLoop.ts` | `import { EventEmitter } from 'eventemitter3';` |
| `Agent.ts` | `import { EventEmitter } from 'eventemitter3';` |
| `TaskAgent.ts` | `import EventEmitter from 'eventemitter3';` |
| `PlanExecutor.ts` | `import EventEmitter from 'eventemitter3';` |
| `UniversalAgent.ts` | `import { EventEmitter } from 'events';` |
| `SessionManager.ts` | `import { EventEmitter } from 'events';` |
| `ExternalDependencyHandler.ts` | `import EventEmitter from 'eventemitter3';` |

This causes:
- Confusion about which library to use
- Potential TypeScript type mismatches
- Different event typing capabilities

#### Solution

Standardize on `eventemitter3` with named import (smaller bundle, better TypeScript support):

```typescript
// Standard import for ALL files
import { EventEmitter } from 'eventemitter3';
```

#### Files to Update

```bash
# Find all EventEmitter imports
grep -r "import.*EventEmitter" src/

# Update each file:
src/capabilities/taskAgent/TaskAgent.ts
src/capabilities/taskAgent/PlanExecutor.ts
src/capabilities/taskAgent/ExternalDependencyHandler.ts
src/capabilities/universalAgent/UniversalAgent.ts
src/core/SessionManager.ts
```

#### Verification

```bash
# After changes, verify no Node.js events import remains
grep -r "from 'events'" src/
# Should return empty

# Verify all use named import
grep -r "import EventEmitter from" src/
# Should return empty
```

---

### 1.4 Unified Error Handling Strategy

**Severity:** HIGH
**Effort:** Medium (1 day)
**Files:** All agent files, new `src/core/ErrorHandler.ts`

#### Problem

Each agent handles errors differently:

| Agent | Error Handling |
|-------|----------------|
| `Agent.ts` | Comprehensive logging with metrics (lines 409-424) |
| `TaskAgent.ts` | Minimal logging, checkpoint on error (lines 920-947) |
| `UniversalAgent.ts` | Try-catch with no logging (lines 595-604) |
| `PlanExecutor.ts` | Error recovery with hooks (lines 250-320) |

This makes debugging difficult and behavior unpredictable.

#### Solution

Create centralized error handling utility:

**New File:** `src/core/ErrorHandler.ts`

```typescript
import { EventEmitter } from 'eventemitter3';

export interface ErrorContext {
  agentType: 'agent' | 'task-agent' | 'universal-agent';
  agentId?: string;
  operation: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ErrorHandlerConfig {
  /** Log errors to console */
  logToConsole?: boolean;

  /** Include stack traces in logs */
  includeStackTrace?: boolean;

  /** Custom error transformer */
  transformError?: (error: Error, context: ErrorContext) => Error;

  /** Error categories that should be retried */
  retryableErrors?: string[];

  /** Maximum retry attempts */
  maxRetries?: number;
}

export interface ErrorHandlerEvents {
  'error': { error: Error; context: ErrorContext; recoverable: boolean };
  'error:retrying': { error: Error; context: ErrorContext; attempt: number };
  'error:fatal': { error: Error; context: ErrorContext };
}

/**
 * Centralized error handling for all agent types
 */
export class ErrorHandler extends EventEmitter<ErrorHandlerEvents> {
  private config: Required<ErrorHandlerConfig>;

  constructor(config: ErrorHandlerConfig = {}) {
    super();
    this.config = {
      logToConsole: config.logToConsole ?? true,
      includeStackTrace: config.includeStackTrace ?? process.env.NODE_ENV !== 'production',
      transformError: config.transformError ?? ((e) => e),
      retryableErrors: config.retryableErrors ?? ['ECONNRESET', 'ETIMEDOUT', 'RATE_LIMIT'],
      maxRetries: config.maxRetries ?? 3,
    };
  }

  /**
   * Handle an error with context
   */
  handle(error: Error, context: ErrorContext): void {
    const transformed = this.config.transformError(error, context);
    const recoverable = this.isRecoverable(transformed);

    // Log if configured
    if (this.config.logToConsole) {
      this.logError(transformed, context, recoverable);
    }

    // Emit event
    this.emit('error', { error: transformed, context, recoverable });

    if (!recoverable) {
      this.emit('error:fatal', { error: transformed, context });
    }
  }

  /**
   * Execute with error handling and optional retry
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryable(lastError) || attempt === this.config.maxRetries) {
          this.handle(lastError, context);
          throw lastError;
        }

        this.emit('error:retrying', { error: lastError, context, attempt });

        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 100);
      }
    }

    throw lastError;
  }

  /**
   * Wrap a function with error handling
   */
  wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    contextFactory: (...args: Parameters<T>) => ErrorContext
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error as Error, contextFactory(...args));
        throw error;
      }
    }) as T;
  }

  private isRecoverable(error: Error): boolean {
    // Network errors are often recoverable
    if (error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT')) {
      return true;
    }

    // Rate limits are recoverable
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return true;
    }

    return false;
  }

  private isRetryable(error: Error): boolean {
    return this.config.retryableErrors.some(
      (code) => error.message.includes(code) || error.name.includes(code)
    );
  }

  private logError(error: Error, context: ErrorContext, recoverable: boolean): void {
    const prefix = `[${context.agentType}${context.agentId ? `:${context.agentId}` : ''}]`;
    const severity = recoverable ? 'WARN' : 'ERROR';

    console.error(`${prefix} ${severity} in ${context.operation}:`, error.message);

    if (this.config.includeStackTrace && error.stack) {
      console.error(error.stack);
    }

    if (context.metadata) {
      console.error(`${prefix} Context:`, JSON.stringify(context.metadata, null, 2));
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton for global error handling
export const globalErrorHandler = new ErrorHandler();
```

#### Integration Example

```typescript
// In Agent.ts
import { ErrorHandler, ErrorContext } from './ErrorHandler.js';

export class Agent extends BaseAgent {
  private errorHandler: ErrorHandler;

  constructor(config: AgentConfig) {
    super(config);
    this.errorHandler = new ErrorHandler({
      logToConsole: true,
      includeStackTrace: process.env.NODE_ENV !== 'production',
    });
  }

  async run(input: InputItem | InputItem[] | string): Promise<LLMResponse> {
    const context: ErrorContext = {
      agentType: 'agent',
      agentId: this.session?.id,
      operation: 'run',
      input,
    };

    return this.errorHandler.executeWithRetry(
      async () => {
        // ... existing run logic
      },
      context
    );
  }
}
```

---

## Priority 2: Architecture Improvements

### 2.1 Abstract Provider Converter Base

**Severity:** HIGH
**Effort:** High (2 days)
**Files:** New `src/infrastructure/providers/base/BaseConverter.ts`, modify 3 converter files

#### Problem

Three provider converters duplicate ~60% of code:
- `OpenAIResponsesConverter.ts` (~400 lines)
- `GoogleConverter.ts` (~500 lines)
- `AnthropicConverter.ts` (~300 lines)

Duplicated patterns:
- Input normalization
- Tool schema conversion
- Response extraction
- Error mapping

#### Solution

**New File:** `src/infrastructure/providers/base/BaseConverter.ts`

```typescript
import type { InputItem, OutputItem } from '../../../domain/entities/Message.js';
import type { ToolFunction, ToolCall } from '../../../domain/entities/Tool.js';
import type { LLMResponse } from '../../../domain/entities/Response.js';

/**
 * Base interface for provider-specific input format
 */
export interface ProviderInput {
  messages?: unknown[];
  tools?: unknown[];
  [key: string]: unknown;
}

/**
 * Base interface for provider-specific output format
 */
export interface ProviderOutput {
  content?: unknown;
  tool_calls?: unknown[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  [key: string]: unknown;
}

/**
 * Conversion result with metadata
 */
export interface ConversionResult<T> {
  data: T;
  warnings?: string[];
}

/**
 * Abstract base converter for all LLM providers.
 * Implements common conversion patterns while allowing provider-specific overrides.
 */
export abstract class BaseConverter<
  TInput extends ProviderInput = ProviderInput,
  TOutput extends ProviderOutput = ProviderOutput
> {

  // ===== Abstract Methods (must be implemented) =====

  /**
   * Convert tool definition to provider-specific format
   */
  protected abstract convertToolDefinition(tool: ToolFunction): unknown;

  /**
   * Extract tool calls from provider response
   */
  protected abstract extractToolCalls(output: TOutput): ToolCall[];

  /**
   * Get the provider name for error messages
   */
  protected abstract getProviderName(): string;

  // ===== Public Conversion Methods =====

  /**
   * Convert input items to provider format
   */
  convertInput(items: InputItem[]): ConversionResult<TInput> {
    const warnings: string[] = [];
    const messages: unknown[] = [];

    for (const item of items) {
      try {
        const converted = this.convertInputItem(item);
        messages.push(converted);
      } catch (error) {
        warnings.push(`Failed to convert input item: ${(error as Error).message}`);
      }
    }

    return {
      data: { messages } as TInput,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Convert tools to provider format
   */
  convertTools(tools: ToolFunction[]): ConversionResult<unknown[]> {
    const warnings: string[] = [];
    const converted: unknown[] = [];

    for (const tool of tools) {
      try {
        converted.push(this.convertToolDefinition(tool));
      } catch (error) {
        warnings.push(`Failed to convert tool ${tool.definition.function.name}: ${(error as Error).message}`);
      }
    }

    return {
      data: converted,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Convert provider response to LLMResponse
   */
  convertOutput(output: TOutput): LLMResponse {
    const text = this.extractText(output);
    const toolCalls = this.extractToolCalls(output);
    const usage = this.extractUsage(output);

    return {
      output_text: text,
      output: this.buildOutputItems(output, text, toolCalls),
      usage: {
        input_tokens: usage.input_tokens ?? 0,
        output_tokens: usage.output_tokens ?? 0,
        total_tokens: usage.total_tokens ?? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
      },
    };
  }

  /**
   * Map provider error to standard error
   */
  mapError(error: unknown): Error {
    if (error instanceof Error) {
      return this.transformError(error);
    }
    return new Error(`${this.getProviderName()} error: ${String(error)}`);
  }

  // ===== Protected Helper Methods =====

  /**
   * Convert a single input item (can be overridden)
   */
  protected convertInputItem(item: InputItem): unknown {
    if (typeof item === 'string') {
      return { role: 'user', content: item };
    }

    if ('role' in item && 'content' in item) {
      return {
        role: this.mapRole(item.role),
        content: this.normalizeContent(item.content),
      };
    }

    throw new Error(`Unknown input item format: ${JSON.stringify(item)}`);
  }

  /**
   * Map role to provider-specific role name
   */
  protected mapRole(role: string): string {
    const roleMap: Record<string, string> = {
      user: 'user',
      assistant: 'assistant',
      system: 'system',
      tool: 'tool',
    };
    return roleMap[role] ?? role;
  }

  /**
   * Normalize content to string
   */
  protected normalizeContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n');
    }

    return String(content);
  }

  /**
   * Extract text from provider response
   */
  protected extractText(output: TOutput): string {
    if (typeof output.content === 'string') {
      return output.content;
    }

    if (Array.isArray(output.content)) {
      return output.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    }

    return '';
  }

  /**
   * Extract usage information
   */
  protected extractUsage(output: TOutput): Partial<TOutput['usage']> {
    return output.usage ?? {};
  }

  /**
   * Build output items from response
   */
  protected buildOutputItems(
    output: TOutput,
    text: string,
    toolCalls: ToolCall[]
  ): OutputItem[] {
    const items: OutputItem[] = [];

    if (text) {
      items.push({
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text }],
      });
    }

    for (const toolCall of toolCalls) {
      items.push({
        type: 'function_call',
        id: toolCall.id,
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      });
    }

    return items;
  }

  /**
   * Transform provider-specific error
   */
  protected transformError(error: Error): Error {
    // Default: return as-is
    // Subclasses can override for provider-specific error handling
    return error;
  }
}
```

#### Provider Implementation Example

```typescript
// src/infrastructure/providers/openai/OpenAIConverter.ts

import { BaseConverter, ProviderInput, ProviderOutput } from '../base/BaseConverter.js';

interface OpenAIInput extends ProviderInput {
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
}

interface OpenAIOutput extends ProviderOutput {
  choices: Array<{
    message: {
      content?: string;
      tool_calls?: OpenAIToolCall[];
    };
  }>;
}

export class OpenAIConverter extends BaseConverter<OpenAIInput, OpenAIOutput> {

  protected getProviderName(): string {
    return 'OpenAI';
  }

  protected convertToolDefinition(tool: ToolFunction): OpenAITool {
    return {
      type: 'function',
      function: {
        name: tool.definition.function.name,
        description: tool.definition.function.description,
        parameters: tool.definition.function.parameters,
      },
    };
  }

  protected extractToolCalls(output: OpenAIOutput): ToolCall[] {
    const choice = output.choices?.[0];
    if (!choice?.message?.tool_calls) {
      return [];
    }

    return choice.message.tool_calls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));
  }

  protected extractText(output: OpenAIOutput): string {
    return output.choices?.[0]?.message?.content ?? '';
  }

  protected transformError(error: Error): Error {
    // Map OpenAI-specific errors
    if (error.message.includes('rate_limit')) {
      return new RateLimitError('OpenAI', error);
    }
    if (error.message.includes('invalid_api_key')) {
      return new ProviderAuthError('OpenAI', 'Invalid API key');
    }
    return error;
  }
}
```

---

### 2.2 Resource Cleanup

**Severity:** MEDIUM
**Effort:** Medium (1 day)
**Files:** Multiple

#### Problems and Solutions

##### 2.2.1 Event Listener Leak on Error

**File:** `src/core/Agent.ts` (lines 836-866)

**Problem:** If `setupEventForwarding()` throws, listeners are registered but not cleaned up.

**Solution:**

```typescript
private setupEventForwarding(): void {
  const events = ['tool:start', 'tool:complete', 'tool:error', ...];

  try {
    for (const eventName of events) {
      const handler = (data: any) => this.emit(eventName, data);
      this.boundListeners.set(eventName, handler);
      this.agenticLoop.on(eventName, handler);
    }
  } catch (error) {
    // Cleanup on error
    for (const [eventName, handler] of this.boundListeners) {
      this.agenticLoop.off(eventName, handler);
    }
    this.boundListeners.clear();
    throw error;
  }
}
```

##### 2.2.2 CircuitBreaker Listeners

**File:** `src/infrastructure/providers/base/BaseTextProvider.ts` (lines 56-70)

**Problem:** CircuitBreaker listeners never removed.

**Solution:**

```typescript
export abstract class BaseTextProvider {
  private circuitBreakerHandlers: Map<string, (...args: any[]) => void> = new Map();

  protected setupCircuitBreaker(): void {
    const openedHandler = (data: any) => {
      // ... existing logic
    };
    const closedHandler = (data: any) => {
      // ... existing logic
    };

    this.circuitBreaker.on('opened', openedHandler);
    this.circuitBreaker.on('closed', closedHandler);

    this.circuitBreakerHandlers.set('opened', openedHandler);
    this.circuitBreakerHandlers.set('closed', closedHandler);
  }

  destroy(): void {
    // Remove circuit breaker listeners
    for (const [event, handler] of this.circuitBreakerHandlers) {
      this.circuitBreaker.off(event, handler);
    }
    this.circuitBreakerHandlers.clear();
  }
}
```

##### 2.2.3 Timer Race Condition in SessionManager

**File:** `src/core/SessionManager.ts` (lines 305-330)

**Problem:** Timer can fire while save is in-flight, causing duplicate saves.

**Solution:**

```typescript
export class SessionManager {
  private autoSaveTimers = new Map<string, NodeJS.Timeout>();
  private savesInFlight = new Map<string, Promise<void>>();

  enableAutoSave(session: Session, intervalMs: number): void {
    this.stopAutoSave(session.id);

    const timer = setInterval(async () => {
      // Skip if save already in flight
      if (this.savesInFlight.has(session.id)) {
        return;
      }

      const savePromise = this.save(session).catch((error) => {
        console.warn('[SessionManager] Auto-save failed:', error);
      }).finally(() => {
        this.savesInFlight.delete(session.id);
      });

      this.savesInFlight.set(session.id, savePromise);
    }, intervalMs);

    this.autoSaveTimers.set(session.id, timer);
  }

  stopAutoSave(sessionId: string): void {
    const timer = this.autoSaveTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.autoSaveTimers.delete(sessionId);
    }
  }
}
```

##### 2.2.4 Logger File Stream

**File:** `src/utils/Logger.ts` (lines 80-120)

**Problem:** File stream never closed.

**Solution:**

```typescript
export class Logger {
  private stream?: fs.WriteStream;

  constructor(options: LoggerOptions) {
    if (options.logToFile) {
      this.stream = fs.createWriteStream(options.filePath, { flags: 'a' });

      this.stream.on('error', (error) => {
        console.error('[Logger] Stream error:', error);
      });
    }
  }

  async close(): Promise<void> {
    if (this.stream) {
      return new Promise((resolve, reject) => {
        this.stream!.end(() => {
          this.stream = undefined;
          resolve();
        });
        this.stream!.on('error', reject);
      });
    }
  }
}
```

##### 2.2.5 MCP Client Partial Connection

**File:** `src/infrastructure/mcp/MCPRegistry.ts` (lines 108-121)

**Problem:** Partial connection not cleaned up on error.

**Solution:**

```typescript
static async create(config: MCPServerConfig): Promise<MCPClient> {
  const client = new MCPClient(config);

  try {
    if (config.autoConnect) {
      await client.connect();
    }

    this.clients.set(config.name, client);
    return client;
  } catch (error) {
    // Cleanup partial connection
    try {
      await client.disconnect();
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```

---

### 2.3 Session Load Validation

**Severity:** MEDIUM
**Effort:** Low (2-3 hours)
**Files:** `src/core/SessionManager.ts`

#### Problem

No validation of loaded session structure. Corrupt data causes runtime errors.

#### Solution

```typescript
// src/core/SessionManager.ts

import { z } from 'zod'; // Or use custom validation

const SessionSchema = z.object({
  id: z.string(),
  agentType: z.string(),
  createdAt: z.number(),
  lastAccessedAt: z.number(),
  metadata: z.object({
    name: z.string().optional(),
    model: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  history: z.object({
    messages: z.array(z.unknown()),
    summaries: z.array(z.unknown()).optional(),
  }),
  memory: z.object({
    entries: z.array(z.unknown()),
  }).optional(),
  toolState: z.object({
    enabled: z.array(z.string()),
    disabled: z.array(z.string()),
  }).optional(),
  permissionState: z.object({
    approved: z.array(z.string()),
    denied: z.array(z.string()),
  }).optional(),
});

export class SessionManager {
  async load(sessionId: string): Promise<Session | null> {
    const raw = await this.storage.load(sessionId);
    if (!raw) {
      return null;
    }

    // Validate structure
    const result = SessionSchema.safeParse(raw);
    if (!result.success) {
      console.error('[SessionManager] Invalid session structure:', result.error);
      throw new Error(`Corrupt session data for ${sessionId}: ${result.error.message}`);
    }

    return result.data as Session;
  }
}
```

---

### 2.4 Injectable Configuration

**Severity:** MEDIUM
**Effort:** Medium (1 day)
**Files:** Multiple

#### Problem

Many values are hardcoded that should be configurable:

| File | Value | Current | Should Be |
|------|-------|---------|-----------|
| `AgenticLoop.ts:115` | Max history size | `10` | Configurable |
| `PlanExecutor.ts:23` | Task timeout | `300000` (5 min) | Configurable |
| `WorkingMemory.ts` | Default memory size | Hardcoded | Configurable |
| `HistoryManager.ts:35-41` | Default config | Hardcoded | Configurable |

#### Solution

Create centralized configuration with defaults:

**New File:** `src/core/Config.ts`

```typescript
/**
 * Global configuration for the agents library
 */
export interface AgentsConfig {
  // Execution
  execution: {
    /** Default max iterations for agentic loop */
    maxIterations: number;

    /** Default task timeout in ms */
    taskTimeoutMs: number;

    /** Default tool timeout in ms */
    toolTimeoutMs: number;
  };

  // Memory
  memory: {
    /** Default max memory size in bytes */
    maxSizeBytes: number;

    /** Soft limit percentage for warnings */
    softLimitPercent: number;

    /** Default eviction strategy */
    evictionStrategy: 'lru' | 'size';
  };

  // History
  history: {
    /** Max detailed messages to keep */
    maxDetailedMessages: number;

    /** Summarize batch size */
    summarizeBatchSize: number;

    /** Max history tokens */
    maxHistoryTokens: number;
  };

  // Context
  context: {
    /** Default compaction threshold percentage */
    compactionThreshold: number;

    /** Chars per token for estimation */
    charsPerToken: number;
  };

  // Logging
  logging: {
    /** Enable debug logging */
    debug: boolean;

    /** Include stack traces */
    includeStackTraces: boolean;
  };
}

const DEFAULT_CONFIG: AgentsConfig = {
  execution: {
    maxIterations: 10,
    taskTimeoutMs: 300000, // 5 minutes
    toolTimeoutMs: 30000,  // 30 seconds
  },
  memory: {
    maxSizeBytes: 1024 * 1024, // 1MB
    softLimitPercent: 80,
    evictionStrategy: 'lru',
  },
  history: {
    maxDetailedMessages: 50,
    summarizeBatchSize: 10,
    maxHistoryTokens: 8000,
  },
  context: {
    compactionThreshold: 75,
    charsPerToken: 3.5,
  },
  logging: {
    debug: process.env.DEBUG === 'true',
    includeStackTraces: process.env.NODE_ENV !== 'production',
  },
};

let currentConfig: AgentsConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the agents library
 */
export function configure(config: Partial<AgentsConfig>): void {
  currentConfig = deepMerge(DEFAULT_CONFIG, config);
}

/**
 * Get current configuration
 */
export function getConfig(): Readonly<AgentsConfig> {
  return currentConfig;
}

/**
 * Reset to default configuration
 */
export function resetConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG };
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] as any, source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
  }
  return result;
}
```

#### Usage

```typescript
import { configure, getConfig } from '@oneringai/agents';

// Configure at startup
configure({
  execution: {
    taskTimeoutMs: 600000, // 10 minutes
  },
  memory: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
  },
});

// In code, use config
const timeout = getConfig().execution.taskTimeoutMs;
```

---

## Priority 3: API Consistency

### 3.1 Standardize Agent APIs

**Severity:** MEDIUM
**Effort:** Medium (1 day)
**Files:** All 3 agents

#### Problem

Inconsistent APIs across agents:

| Method | Agent | TaskAgent | UniversalAgent |
|--------|-------|-----------|----------------|
| `pause()` | `pause(reason?: string): void` | `pause(): Promise<void>` | `pause(): void` |
| `getMetrics()` | Returns `ExecutionMetrics | null` | Not available | Not available |
| `tools.get()` | Returns `ToolFunction` | Returns `ToolFunction` | Returns `ToolFunction` |
| `listTools()` | Returns `string[]` | Different API | Different API |

#### Solution

Define common interface and implement consistently:

```typescript
// src/domain/interfaces/IAgent.ts

export interface IAgent {
  // Execution
  run(input: InputItem | InputItem[] | string): Promise<LLMResponse>;
  stream(input: InputItem | InputItem[] | string): AsyncIterableIterator<StreamEvent>;

  // Tools
  readonly tools: ToolManager;
  addTool(tool: ToolFunction): void;
  removeTool(name: string): void;
  listTools(): string[];
  setTools(tools: ToolFunction[]): void;

  // Session
  getSessionId(): string | undefined;
  hasSession(): boolean;
  saveSession(): Promise<void>;

  // Lifecycle
  pause(): void;
  resume(): void;
  cancel(): void;
  isPaused(): boolean;
  isCancelled(): boolean;
  isRunning(): boolean;
  destroy(): Promise<void>;

  // Metrics
  getMetrics(): ExecutionMetrics | null;

  // Permissions
  readonly permissions: ToolPermissionManager | undefined;
  toolNeedsApproval(toolName: string): boolean;
  approveToolForSession(toolName: string): void;

  // Cleanup
  onCleanup(callback: () => void | Promise<void>): void;
}
```

Then update all agents to implement this interface.

---

### 3.2 Add PlanExecutor.destroy()

**Severity:** LOW
**Effort:** Low (1-2 hours)
**Files:** `src/capabilities/taskAgent/PlanExecutor.ts`

#### Problem

PlanExecutor has no `destroy()` method, leaving resources (AbortController, event listeners) unreleased.

#### Solution

```typescript
// src/capabilities/taskAgent/PlanExecutor.ts

export class PlanExecutor extends EventEmitter<PlanExecutorEvents> {
  private abortController: AbortController;
  private destroyed = false;

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    // Abort any pending operations
    this.abortController.abort();

    // Remove all event listeners
    this.removeAllListeners();

    // Clear references
    this.agent = null as any;
    this.memory = null as any;
  }
}
```

---

### 3.3 Implement Tool Execution Timeout

**Severity:** MEDIUM
**Effort:** Medium (3-4 hours)
**Files:** `src/capabilities/agents/AgenticLoop.ts`

#### Problem

`toolTimeout` config is defined but never enforced.

#### Solution

```typescript
// src/capabilities/agents/AgenticLoop.ts

export class AgenticLoop {
  private async executeToolWithTimeout(
    tool: ToolFunction,
    args: Record<string, unknown>,
    timeoutMs: number
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await Promise.race([
        tool.execute(args),
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new ToolTimeoutError(tool.definition.function.name, timeoutMs));
          });
        }),
      ]);

      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// New error class
export class ToolTimeoutError extends Error {
  constructor(toolName: string, timeoutMs: number) {
    super(`Tool '${toolName}' timed out after ${timeoutMs}ms`);
    this.name = 'ToolTimeoutError';
  }
}
```

---

### 3.4 Mode Enum vs String

**Severity:** LOW
**Effort:** Low (1-2 hours)
**Files:** `src/capabilities/universalAgent/`

#### Problem

Mode is string literal, should be enum for type safety.

#### Solution

```typescript
// src/capabilities/universalAgent/types.ts

export const AgentMode = {
  Interactive: 'interactive',
  Planning: 'planning',
  Executing: 'executing',
} as const;

export type AgentMode = (typeof AgentMode)[keyof typeof AgentMode];

// Usage
switch (this.modeManager.getMode()) {
  case AgentMode.Interactive:
    // ...
  case AgentMode.Planning:
    // ...
  case AgentMode.Executing:
    // ...
}
```

---

## Priority 4: Code Quality

### 4.1 Constructor Parameter Bundling

**Severity:** LOW
**Effort:** Low (2-3 hours)
**Files:** `src/capabilities/taskAgent/PlanExecutor.ts`

#### Problem

PlanExecutor has 9 constructor parameters.

#### Solution

```typescript
// Bundle into config object
export interface PlanExecutorDependencies {
  agent: Agent;
  memory: WorkingMemory;
  contextManager: ContextManager;
  idempotencyCache: IdempotencyCache;
  historyManager: HistoryManager;
  externalHandler: ExternalDependencyHandler;
  checkpointManager: CheckpointManager;
}

export class PlanExecutor {
  constructor(
    deps: PlanExecutorDependencies,
    hooks: TaskAgentHooks | undefined,
    config: PlanExecutorConfig
  ) {
    this.agent = deps.agent;
    this.memory = deps.memory;
    // ...
  }
}
```

---

### 4.2 Assertion Helpers

**Severity:** LOW
**Effort:** Low (1-2 hours)
**Files:** Create `src/utils/assertions.ts`

#### Problem

Repeated null/undefined checks throughout codebase.

#### Solution

```typescript
// src/utils/assertions.ts

export function assertDefined<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

export function assertSession(
  session: Session | undefined,
  sessionManager: SessionManager | undefined
): asserts session is Session {
  if (!session || !sessionManager) {
    throw new Error('Session not enabled');
  }
}

// Usage
assertSession(this.session, this.sessionManager);
// TypeScript now knows this.session is defined
```

---

### 4.3 Explicit Update Interface

**Severity:** LOW
**Effort:** Low (1 hour)
**Files:** `src/capabilities/taskAgent/TaskAgent.ts`

#### Problem

```typescript
export interface PlanUpdates {
  updateTasks?: Array<{ id: string } & Partial<Task>>;
}
```

Using `& Partial<Task>` is fragile.

#### Solution

```typescript
export interface TaskUpdate {
  id: string;
  name?: string;
  description?: string;
  dependsOn?: string[];
  condition?: TaskCondition;
  externalDependency?: ExternalDependency;
  execution?: TaskExecution;
  // Explicitly list updatable fields
}

export interface PlanUpdates {
  addTasks?: TaskInput[];
  updateTasks?: TaskUpdate[];
  removeTasks?: string[];
}
```

---

## Implementation Schedule

### Week 1: Critical Issues

| Day | Task | Effort |
|-----|------|--------|
| 1 | 1.1 Fix Session Loading Race Condition | 2h |
| 1-2 | 1.3 Standardize EventEmitter Imports | 1h |
| 1-2 | 1.4 Unified Error Handling | 6h |
| 2-4 | 1.2 Extract BaseAgent Class | 16h |

### Week 2: Architecture

| Day | Task | Effort |
|-----|------|--------|
| 1-2 | 2.1 Abstract Provider Converter | 12h |
| 3 | 2.2 Resource Cleanup (all) | 6h |
| 4 | 2.3 Session Load Validation | 3h |
| 4-5 | 2.4 Injectable Configuration | 6h |

### Week 3: API & Quality

| Day | Task | Effort |
|-----|------|--------|
| 1 | 3.1 Standardize Agent APIs | 6h |
| 2 | 3.2 PlanExecutor.destroy() | 2h |
| 2-3 | 3.3 Tool Execution Timeout | 4h |
| 3 | 3.4 Mode Enum | 2h |
| 4 | 4.1-4.3 Code Quality | 5h |
| 5 | Testing & Documentation | 8h |

---

## Verification Checklist

After implementation, verify:

- [ ] All 2210+ existing tests pass
- [ ] New tests added for each change
- [ ] TypeScript compiles without errors
- [ ] No new ESLint warnings
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Breaking changes documented (if any)

### Test Coverage Requirements

| Area | Minimum Coverage |
|------|------------------|
| BaseAgent | 90% |
| ErrorHandler | 95% |
| BaseConverter | 85% |
| Config | 95% |
| Session Validation | 90% |

### Performance Benchmarks

Run before and after to ensure no regressions:

```bash
npm run benchmark:agents
# Should not degrade by more than 5%
```

---

## Appendix: File Inventory

Files that will be modified:

```
src/core/
  Agent.ts                    # Major refactor
  BaseAgent.ts                # NEW
  ErrorHandler.ts             # NEW
  Config.ts                   # NEW (or update existing)
  SessionManager.ts           # Validation, resource cleanup
  ToolManager.ts              # Minor API updates

src/capabilities/
  agents/AgenticLoop.ts       # Timeout enforcement
  taskAgent/TaskAgent.ts      # Extend BaseAgent
  taskAgent/PlanExecutor.ts   # destroy(), config bundling
  universalAgent/UniversalAgent.ts  # Extend BaseAgent
  universalAgent/types.ts     # Mode enum

src/infrastructure/
  providers/base/BaseConverter.ts  # NEW
  providers/base/BaseTextProvider.ts  # Resource cleanup
  providers/openai/OpenAIConverter.ts  # Extend BaseConverter
  providers/google/GoogleConverter.ts  # Extend BaseConverter
  providers/anthropic/AnthropicConverter.ts  # Extend BaseConverter
  mcp/MCPRegistry.ts          # Partial connection cleanup

src/domain/
  interfaces/IAgent.ts        # NEW
  errors/AIErrors.ts          # New error types

src/utils/
  assertions.ts               # NEW
  Logger.ts                   # Stream cleanup
```

Total: ~25 files modified, ~5 new files

---

**Document Version:** 1.0
**Created:** 2026-01-28
**Author:** AI Analysis
