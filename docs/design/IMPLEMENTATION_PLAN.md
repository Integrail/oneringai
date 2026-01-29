# Unified Context Manager - Implementation Plan

## Summary

Unify all agents under a single context management system where:
- History is built into ContextManager (not separate)
- Plugins extend capabilities (Plan, Memory, ToolOutputs)
- All agents use the same interface
- PlanningAgent joins BaseAgent hierarchy

---

## Phase 1: Core Infrastructure (Foundation)

### Task 1.1: Create Plugin Interface

**File**: `src/core/context/plugins/IContextPlugin.ts`

```typescript
export interface IContextPlugin {
  readonly name: string;
  readonly priority: number;
  readonly compactable: boolean;

  getComponent(): Promise<IContextComponent | null>;
  compact?(targetTokens: number, estimator: ITokenEstimator): Promise<number>;
  onPrepared?(budget: ContextBudget): Promise<void>;
  getState?(): unknown;
  restoreState?(state: unknown): void;
}
```

### Task 1.2: Create UnifiedContextManager

**File**: `src/core/context/UnifiedContextManager.ts`

Key changes from current ContextManager:
- Remove dependency on IContextProvider
- Add built-in history array
- Add plugin registry
- Add history-specific methods
- Unified compaction pipeline

### Task 1.3: Create Built-in Plugins

**Files**:
- `src/core/context/plugins/PlanPlugin.ts`
- `src/core/context/plugins/MemoryPlugin.ts`
- `src/core/context/plugins/ToolOutputPlugin.ts`
- `src/core/context/plugins/index.ts`

### Task 1.4: Update Types

**File**: `src/core/context/types.ts`

Add:
```typescript
export interface HistoryConfig {
  maxMessages: number;
  preserveRecent: number;
  compactionPriority: number;
}

export interface SerializedContextState {
  version: number;
  core: {
    systemPrompt: string;
    instructions: string;
    history: HistoryMessage[];
  };
  plugins: Record<string, unknown>;
  config: ContextManagerConfig;
}
```

### Task 1.5: Export New APIs

**File**: `src/core/context/index.ts`

```typescript
// New exports
export { UnifiedContextManager } from './UnifiedContextManager.js';
export type { IContextPlugin } from './plugins/IContextPlugin.js';
export { PlanPlugin, MemoryPlugin, ToolOutputPlugin } from './plugins/index.js';

// Keep existing exports for backward compat (mark deprecated)
export { ContextManager } from './ContextManager.js';  // @deprecated
```

---

## Phase 2: Basic Agent Enhancement

### Task 2.1: Update AgentConfig

**File**: `src/core/Agent.ts`

```typescript
export interface AgentConfig extends BaseAgentConfig {
  // ... existing

  /** Optional context manager for history tracking and budget management */
  context?: IUnifiedContextManager | Partial<UnifiedContextManagerConfig>;
}
```

### Task 2.2: Integrate Context into Agent

**File**: `src/core/Agent.ts`

Changes:
1. Create context manager if config.context provided
2. Track user messages in `run()`
3. Track assistant responses
4. Expose `context` property
5. Serialize context in session

```typescript
async run(input: string): Promise<LLMResponse> {
  // Track input
  if (this.contextManager) {
    this.contextManager.setCurrentInput(input);
    this.contextManager.addMessage('user', input);
  }

  const response = await this.agenticLoop.run(input);

  // Track output
  if (this.contextManager) {
    this.contextManager.addMessage('assistant', response.output_text);
  }

  return response;
}
```

### Task 2.3: Update Agent Session Handling

**File**: `src/core/Agent.ts`

Add context state to session serialization/restoration.

---

## Phase 3: TaskAgent Migration

### Task 3.1: Remove IHistoryManager Dependency

**File**: `src/capabilities/taskAgent/TaskAgent.ts`

Before:
```typescript
private historyManager: IHistoryManager;
```

After:
```typescript
// History is now in this.contextManager
```

### Task 3.2: Replace TaskAgentContextProvider

**File**: `src/capabilities/taskAgent/TaskAgent.ts`

Before:
```typescript
const provider = new TaskAgentContextProvider({
  model, plan, memory, historyManager, currentInput
});
const contextManager = new ContextManager(provider, ...);
```

After:
```typescript
this.contextManager = new UnifiedContextManager({ maxContextTokens, strategy });
this.contextManager.registerPlugin(new PlanPlugin(plan));
this.contextManager.registerPlugin(new MemoryPlugin(memory));
this.contextManager.registerPlugin(new ToolOutputPlugin());
```

### Task 3.3: Update PlanExecutor

**File**: `src/capabilities/taskAgent/PlanExecutor.ts`

Changes:
1. Accept UnifiedContextManager instead of ContextManager + IHistoryManager
2. Use built-in history methods
3. Remove historyManager parameter

Before:
```typescript
constructor(
  agent: Agent,
  memory: WorkingMemory,
  contextManager: ContextManager,
  contextProvider: TaskAgentContextProvider,
  idempotencyCache: IdempotencyCache,
  historyManager: IHistoryManager,  // REMOVE
  // ...
)
```

After:
```typescript
constructor(
  agent: Agent,
  memory: WorkingMemory,
  contextManager: IUnifiedContextManager,
  idempotencyCache: IdempotencyCache,
  // historyManager removed - use contextManager.addMessage()
)
```

### Task 3.4: Delete TaskAgentContextProvider

**File**: DELETE `src/infrastructure/context/providers/TaskAgentContextProvider.ts`

This is replaced by plugins.

### Task 3.5: Update Memory Tools Context

**File**: `src/capabilities/taskAgent/memoryTools.ts`

Update to use new context manager if needed.

---

## Phase 4: UniversalAgent Migration

### Task 4.1: Replace IContextBuilder

**File**: `src/capabilities/universalAgent/UniversalAgent.ts`

Before:
```typescript
private historyManager: IHistoryManager;
private contextBuilder: IContextBuilder;
```

After:
```typescript
private contextManager: IUnifiedContextManager;
```

### Task 4.2: Use Same Plugins

**File**: `src/capabilities/universalAgent/UniversalAgent.ts`

```typescript
this.contextManager = new UnifiedContextManager({ ... });
this.contextManager.registerPlugin(new MemoryPlugin(this.workingMemory));
this.contextManager.registerPlugin(new PlanPlugin());  // Set plan when executing
```

### Task 4.3: Delete IContextBuilder Interface

**File**: DELETE `src/domain/interfaces/IContextBuilder.ts`

Or mark as deprecated if external code might use it.

### Task 4.4: Delete DefaultContextBuilder

**File**: DELETE `src/core/context/DefaultContextBuilder.ts`

---

## Phase 5: PlanningAgent Migration

### Task 5.1: Make PlanningAgent Extend BaseAgent

**File**: `src/capabilities/taskAgent/PlanningAgent.ts`

Before:
```typescript
export class PlanningAgent {
  private agent: Agent;
  private config: PlanningAgentConfig;
```

After:
```typescript
export class PlanningAgent extends BaseAgent<PlanningAgentConfig, PlanningAgentEvents> {
  private contextManager: IUnifiedContextManager;
```

### Task 5.2: Add Context Manager to PlanningAgent

```typescript
constructor(config: PlanningAgentConfig) {
  super({
    connector: config.connector,
    model: config.model,
    tools: this.createPlanningTools(),
  });

  this.contextManager = new UnifiedContextManager({
    maxContextTokens: 32000,
    strategy: 'lazy',
  });

  this.contextManager.setSystemPrompt(PLANNING_SYSTEM_PROMPT);
}
```

### Task 5.3: Update PlanningAgent Factory

Keep `PlanningAgent.create()` static method, now calls `new PlanningAgent()` with proper inheritance.

---

## Phase 6: Cleanup & Deprecation

### Task 6.1: Mark Deprecated Interfaces

**Files to update**:
- `src/domain/interfaces/IHistoryManager.ts` - add @deprecated JSDoc
- `src/core/context/ContextManager.ts` - add @deprecated JSDoc
- `src/infrastructure/context/providers/TaskAgentContextProvider.ts` - delete or deprecate

### Task 6.2: Update Exports

**File**: `src/index.ts`

```typescript
// New unified exports
export { UnifiedContextManager } from './core/context/UnifiedContextManager.js';
export type { IContextPlugin } from './core/context/plugins/IContextPlugin.js';
export { PlanPlugin, MemoryPlugin, ToolOutputPlugin } from './core/context/plugins/index.js';

// Deprecated exports (keep for backward compat)
/** @deprecated Use UnifiedContextManager instead */
export { ContextManager } from './core/context/ContextManager.js';
/** @deprecated Use UnifiedContextManager built-in history instead */
export type { IHistoryManager } from './domain/interfaces/IHistoryManager.js';
```

### Task 6.3: Update CLAUDE.md Documentation

Reflect new unified architecture.

### Task 6.4: Update USER_GUIDE.md

Add migration guide from old to new context system.

---

## Phase 7: Tests

### Task 7.1: Unit Tests for UnifiedContextManager

**File**: `tests/unit/context/UnifiedContextManager.test.ts`

Test:
- Built-in history management
- Plugin registration/unregistration
- Context preparation
- Compaction pipeline
- Serialization/restoration

### Task 7.2: Unit Tests for Plugins

**File**: `tests/unit/context/plugins/*.test.ts`

Test each plugin independently.

### Task 7.3: Integration Tests

**File**: `tests/integration/context/UnifiedContext.integration.test.ts`

Test:
- Agent with context manager
- TaskAgent migration
- UniversalAgent migration
- Session persistence with context

### Task 7.4: Update Existing Tests

Update all tests that use:
- IHistoryManager → use contextManager.addMessage()
- TaskAgentContextProvider → use plugins
- IContextBuilder → use UnifiedContextManager

---

## File Summary

### New Files (Create)
```
src/core/context/
├── UnifiedContextManager.ts        # Main implementation
├── plugins/
│   ├── IContextPlugin.ts           # Plugin interface
│   ├── PlanPlugin.ts               # Plan plugin
│   ├── MemoryPlugin.ts             # Memory plugin
│   ├── ToolOutputPlugin.ts         # Tool output plugin
│   └── index.ts                    # Plugin exports

tests/unit/context/
├── UnifiedContextManager.test.ts
└── plugins/
    ├── PlanPlugin.test.ts
    ├── MemoryPlugin.test.ts
    └── ToolOutputPlugin.test.ts
```

### Modified Files
```
src/core/Agent.ts                   # Add optional context
src/core/BaseAgent.ts               # May need context hooks
src/capabilities/taskAgent/
├── TaskAgent.ts                    # Use UnifiedContextManager
├── PlanExecutor.ts                 # Remove IHistoryManager dep
├── PlanningAgent.ts                # Extend BaseAgent
└── memoryTools.ts                  # Update context access
src/capabilities/universalAgent/
└── UniversalAgent.ts               # Use UnifiedContextManager
src/core/context/types.ts           # Add new types
src/core/context/index.ts           # Export new APIs
src/index.ts                        # Update public exports
```

### Deprecated/Deleted Files
```
# Mark as deprecated
src/domain/interfaces/IHistoryManager.ts
src/core/context/ContextManager.ts

# Delete (or deprecate)
src/infrastructure/context/providers/TaskAgentContextProvider.ts
src/core/context/DefaultContextBuilder.ts
src/domain/interfaces/IContextBuilder.ts
```

---

## Estimated Effort

| Phase | Tasks | Effort | Risk |
|-------|-------|--------|------|
| Phase 1: Core | 5 tasks | 3-4 days | Low |
| Phase 2: Agent | 3 tasks | 1-2 days | Low |
| Phase 3: TaskAgent | 5 tasks | 3-4 days | Medium |
| Phase 4: UniversalAgent | 4 tasks | 2-3 days | Medium |
| Phase 5: PlanningAgent | 3 tasks | 1-2 days | Low |
| Phase 6: Cleanup | 4 tasks | 1-2 days | Low |
| Phase 7: Tests | 4 tasks | 2-3 days | Low |
| **Total** | **28 tasks** | **~2-3 weeks** | **Medium** |

---

## Backward Compatibility

### Breaking Changes
- None if deprecated interfaces kept

### Migration Required
- Code using `IHistoryManager` directly → use `contextManager.addMessage()`
- Code using `TaskAgentContextProvider` → use plugins
- Code using `IContextBuilder` → use `UnifiedContextManager`

### Deprecation Timeline
1. **v0.3.0**: New API alongside deprecated old API
2. **v0.4.0**: Deprecation warnings in console
3. **v1.0.0**: Remove deprecated APIs

---

## Success Criteria

1. ✅ All agent types use UnifiedContextManager
2. ✅ History is built-in, not separate
3. ✅ PlanningAgent extends BaseAgent
4. ✅ Single compaction pipeline
5. ✅ All existing tests pass
6. ✅ New tests for unified system
7. ✅ Documentation updated
8. ✅ No breaking changes for existing users
