# Unified Context Manager Design

## Overview

This document proposes a unified context management architecture where:
1. **History is built into ContextManager** (not a separate IHistoryManager)
2. **All agent types use the same ContextManager** (optional for basic Agent)
3. **Plugins extend capabilities** for Plan, Memory, and custom needs
4. **PlanningAgent joins the BaseAgent hierarchy**
5. **Single compaction pipeline** for all context components

---

## Core Interface

```typescript
/**
 * UnifiedContextManager - Single source of truth for all context
 *
 * Built-in capabilities:
 * - System prompt & instructions
 * - Conversation history (replaces IHistoryManager)
 * - Current input
 *
 * Extensible via plugins:
 * - Plan (for TaskAgent)
 * - Memory index (for TaskAgent/UniversalAgent)
 * - Tool outputs
 * - Custom plugins
 */
export interface IUnifiedContextManager extends EventEmitter<ContextManagerEvents> {
  // ===== Core Context (built-in) =====

  /** Set system prompt (priority 0, never compacted) */
  setSystemPrompt(prompt: string): void;
  getSystemPrompt(): string;

  /** Set instructions (priority 0, never compacted) */
  setInstructions(instructions: string): void;
  getInstructions(): string;

  /** Set current input for this turn (priority 0, never compacted) */
  setCurrentInput(input: string): void;
  getCurrentInput(): string;

  // ===== Built-in History Management =====

  /** Add a message to history */
  addMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): HistoryMessage;

  /** Get all history messages */
  getHistory(): HistoryMessage[];

  /** Get recent N messages */
  getRecentHistory(count: number): HistoryMessage[];

  /** Clear history */
  clearHistory(): void;

  /** Get formatted history for display */
  formatHistory(options?: HistoryFormatOptions): string;

  // ===== Plugin System =====

  /** Register a plugin */
  registerPlugin(plugin: IContextPlugin): void;

  /** Unregister a plugin by name */
  unregisterPlugin(name: string): void;

  /** Get a registered plugin */
  getPlugin<T extends IContextPlugin>(name: string): T | undefined;

  /** List all registered plugins */
  listPlugins(): string[];

  // ===== Context Preparation =====

  /** Prepare context for LLM call (assembles components, compacts if needed) */
  prepare(): Promise<PreparedContext>;

  /** Get current budget without preparing */
  getBudget(): ContextBudget;

  /** Force compaction */
  compact(): Promise<CompactionResult>;

  // ===== Configuration =====

  /** Set compaction strategy */
  setStrategy(strategy: ContextStrategyType | IContextStrategy): void;

  /** Get current strategy */
  getStrategy(): IContextStrategy;

  /** Update configuration */
  updateConfig(config: Partial<ContextManagerConfig>): void;

  /** Get current configuration */
  getConfig(): ContextManagerConfig;

  // ===== Introspection =====

  /** Estimate tokens for content */
  estimateTokens(content: string, type?: TokenContentType): number;

  /** Get utilization percentage */
  getUtilization(): number;

  /** Get detailed metrics */
  getMetrics(): ContextMetrics;

  // ===== Serialization =====

  /** Get state for session persistence */
  getState(): SerializedContextState;

  /** Restore from saved state */
  restoreState(state: SerializedContextState): void;
}
```

---

## Plugin Interface

```typescript
/**
 * Context plugin for extensibility
 *
 * Plugins add custom components to the context (e.g., Plan, Memory, Tool Outputs)
 */
export interface IContextPlugin {
  /** Unique name for this plugin */
  readonly name: string;

  /** Compaction priority (higher = compact first, 0 = never compact) */
  readonly priority: number;

  /** Whether this plugin's content can be compacted */
  readonly compactable: boolean;

  /**
   * Get this plugin's context component
   * Return null if plugin has no content for this turn
   */
  getComponent(): Promise<IContextComponent | null>;

  /**
   * Called when this plugin's content needs compaction
   * Plugin is responsible for reducing its size
   *
   * @param targetTokens - Target token count to reduce to
   * @param estimator - Token estimator to use
   * @returns Tokens actually freed
   */
  compact?(targetTokens: number, estimator: ITokenEstimator): Promise<number>;

  /**
   * Called after context is prepared (opportunity for cleanup/logging)
   */
  onPrepared?(budget: ContextBudget): Promise<void>;

  /**
   * Get state for serialization
   */
  getState?(): unknown;

  /**
   * Restore from serialized state
   */
  restoreState?(state: unknown): void;
}
```

---

## Built-in Plugins

### 1. PlanPlugin (for TaskAgent)

```typescript
export class PlanPlugin implements IContextPlugin {
  readonly name = 'plan';
  readonly priority = 1;  // Very low (important, keep)
  readonly compactable = false;  // Never compact the plan

  private plan: Plan | null = null;

  setPlan(plan: Plan): void {
    this.plan = plan;
  }

  getPlan(): Plan | null {
    return this.plan;
  }

  updateTaskStatus(taskId: string, status: TaskStatus): void {
    // Update task within the plan
  }

  async getComponent(): Promise<IContextComponent | null> {
    if (!this.plan) return null;

    return {
      name: 'plan',
      content: this.formatPlan(this.plan),
      priority: this.priority,
      compactable: this.compactable,
    };
  }

  private formatPlan(plan: Plan): string {
    // Format plan for LLM context
  }
}
```

### 2. MemoryPlugin (for TaskAgent/UniversalAgent)

```typescript
export class MemoryPlugin implements IContextPlugin {
  readonly name = 'memory_index';
  readonly priority = 8;  // Higher = more likely to compact
  readonly compactable = true;

  private memory: WorkingMemory;

  constructor(memory: WorkingMemory) {
    this.memory = memory;
  }

  async getComponent(): Promise<IContextComponent | null> {
    const index = await this.memory.formatIndex();
    if (!index || index.length === 0) return null;

    return {
      name: 'memory_index',
      content: index,
      priority: this.priority,
      compactable: this.compactable,
    };
  }

  async compact(targetTokens: number, estimator: ITokenEstimator): Promise<number> {
    // Evict least-important entries from memory
    const before = estimator.estimateTokens(await this.memory.formatIndex());
    await this.memory.evict(5, 'lru');  // Evict 5 LRU entries
    const after = estimator.estimateTokens(await this.memory.formatIndex());
    return before - after;
  }
}
```

### 3. ToolOutputPlugin

```typescript
export class ToolOutputPlugin implements IContextPlugin {
  readonly name = 'tool_outputs';
  readonly priority = 10;  // Highest priority to compact (most expendable)
  readonly compactable = true;

  private outputs: ToolOutput[] = [];
  private maxOutputs = 10;

  addOutput(toolName: string, result: unknown): void {
    this.outputs.push({ tool: toolName, output: result, timestamp: Date.now() });
    // Keep only recent outputs
    if (this.outputs.length > this.maxOutputs * 2) {
      this.outputs = this.outputs.slice(-this.maxOutputs);
    }
  }

  async getComponent(): Promise<IContextComponent | null> {
    if (this.outputs.length === 0) return null;

    return {
      name: 'tool_outputs',
      content: this.outputs.slice(-this.maxOutputs),
      priority: this.priority,
      compactable: this.compactable,
    };
  }

  async compact(targetTokens: number, estimator: ITokenEstimator): Promise<number> {
    // Remove oldest outputs
    const before = this.outputs.length;
    this.outputs = this.outputs.slice(-Math.floor(this.maxOutputs / 2));
    return (before - this.outputs.length) * 100;  // Approximate
  }
}
```

---

## UnifiedContextManager Implementation

```typescript
export class UnifiedContextManager
  extends EventEmitter<ContextManagerEvents>
  implements IUnifiedContextManager
{
  // ===== Built-in Core State =====
  private systemPrompt: string = '';
  private instructions: string = '';
  private history: HistoryMessage[] = [];
  private currentInput: string = '';

  // ===== Plugin System =====
  private plugins: Map<string, IContextPlugin> = new Map();

  // ===== Infrastructure =====
  private config: ContextManagerConfig;
  private strategy: IContextStrategy;
  private estimator: ITokenEstimator;
  private maxContextTokens: number;

  // ===== History Config =====
  private historyConfig: HistoryConfig = {
    maxMessages: 50,
    preserveRecent: 10,
    compactionPriority: 6,  // Middle priority
  };

  constructor(config: Partial<UnifiedContextManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
    this.maxContextTokens = config.maxContextTokens ?? 128000;
    this.strategy = this.createStrategy(config.strategy ?? 'proactive');
    this.estimator = this.createEstimator(config.estimator ?? 'approximate');
  }

  // ===== Built-in History Management =====

  addMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): HistoryMessage {
    const message: HistoryMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };

    this.history.push(message);
    this.emit('message:added', { message });

    return message;
  }

  getHistory(): HistoryMessage[] {
    return [...this.history];
  }

  getRecentHistory(count: number): HistoryMessage[] {
    return this.history.slice(-count);
  }

  clearHistory(): void {
    this.history = [];
    this.emit('history:cleared', {});
  }

  // ===== Context Preparation =====

  async prepare(): Promise<PreparedContext> {
    // 1. Build components from core + plugins
    const components = await this.buildComponents();

    // 2. Calculate budget
    let budget = this.calculateBudget(components);

    // 3. Emit warnings
    if (budget.status === 'warning') {
      this.emit('budget_warning', { budget });
    } else if (budget.status === 'critical') {
      this.emit('budget_critical', { budget });
    }

    // 4. Compact if needed
    if (this.config.autoCompact && this.strategy.shouldCompact(budget, this.config)) {
      return await this.doCompaction(components, budget);
    }

    return { components, budget, compacted: false };
  }

  private async buildComponents(): Promise<IContextComponent[]> {
    const components: IContextComponent[] = [];

    // Core components (built-in)
    if (this.systemPrompt) {
      components.push({
        name: 'system_prompt',
        content: this.systemPrompt,
        priority: 0,
        compactable: false,
      });
    }

    if (this.instructions) {
      components.push({
        name: 'instructions',
        content: this.instructions,
        priority: 0,
        compactable: false,
      });
    }

    // History component (built-in, compactable)
    if (this.history.length > 0) {
      components.push({
        name: 'conversation_history',
        content: this.history,
        priority: this.historyConfig.compactionPriority,
        compactable: true,
        metadata: {
          messageCount: this.history.length,
          preserveRecent: this.historyConfig.preserveRecent,
        },
      });
    }

    // Current input (never compact)
    if (this.currentInput) {
      components.push({
        name: 'current_input',
        content: this.currentInput,
        priority: 0,
        compactable: false,
      });
    }

    // Plugin components
    for (const plugin of this.plugins.values()) {
      const component = await plugin.getComponent();
      if (component) {
        components.push(component);
      }
    }

    return components;
  }

  private async doCompaction(
    components: IContextComponent[],
    budget: ContextBudget
  ): Promise<PreparedContext> {
    const log: string[] = [];
    let tokensFreed = 0;

    // Sort by priority (highest first = compact first)
    const compactable = components
      .filter(c => c.compactable)
      .sort((a, b) => b.priority - a.priority);

    for (const component of compactable) {
      if (budget.status === 'ok') break;

      // Special handling for history (built-in)
      if (component.name === 'conversation_history') {
        const freed = this.compactHistory();
        tokensFreed += freed;
        log.push(`Compacted history, freed ~${freed} tokens`);
      }
      // Plugin compaction
      else {
        const plugin = this.plugins.get(component.name);
        if (plugin?.compact) {
          const freed = await plugin.compact(budget.available, this.estimator);
          tokensFreed += freed;
          log.push(`Compacted ${component.name}, freed ~${freed} tokens`);
        }
      }

      // Recalculate budget
      const newComponents = await this.buildComponents();
      budget = this.calculateBudget(newComponents);
    }

    this.emit('compacted', { log, tokensFreed, newBudget: budget });

    return {
      components: await this.buildComponents(),
      budget,
      compacted: true,
      compactionLog: log,
    };
  }

  private compactHistory(): number {
    const before = this.history.length;
    const preserve = this.historyConfig.preserveRecent;

    if (this.history.length > preserve) {
      // Keep only recent messages
      this.history = this.history.slice(-preserve);
    }

    const removed = before - this.history.length;
    return removed * 100;  // Approximate tokens per message
  }

  // ===== Plugin Management =====

  registerPlugin(plugin: IContextPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  unregisterPlugin(name: string): void {
    this.plugins.delete(name);
  }

  getPlugin<T extends IContextPlugin>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }

  // ===== Serialization =====

  getState(): SerializedContextState {
    const pluginStates: Record<string, unknown> = {};
    for (const [name, plugin] of this.plugins) {
      if (plugin.getState) {
        pluginStates[name] = plugin.getState();
      }
    }

    return {
      version: 1,
      core: {
        systemPrompt: this.systemPrompt,
        instructions: this.instructions,
        history: this.history,
      },
      plugins: pluginStates,
      config: this.config,
    };
  }

  restoreState(state: SerializedContextState): void {
    this.systemPrompt = state.core.systemPrompt;
    this.instructions = state.core.instructions;
    this.history = state.core.history;

    for (const [name, pluginState] of Object.entries(state.plugins)) {
      const plugin = this.plugins.get(name);
      if (plugin?.restoreState) {
        plugin.restoreState(pluginState);
      }
    }
  }
}
```

---

## Agent Integration

### Basic Agent (Optional Context)

```typescript
export interface AgentConfig extends BaseAgentConfig {
  // ... existing config

  /** Optional context manager (enables history tracking, context budget) */
  context?: IUnifiedContextManager | UnifiedContextManagerConfig;
}

export class Agent extends BaseAgent {
  private contextManager?: IUnifiedContextManager;

  constructor(config: AgentConfig) {
    super(config);

    // Create context manager if configured
    if (config.context) {
      this.contextManager = config.context instanceof UnifiedContextManager
        ? config.context
        : new UnifiedContextManager(config.context);
    }
  }

  async run(input: string): Promise<LLMResponse> {
    // Track history if context manager exists
    if (this.contextManager) {
      this.contextManager.setCurrentInput(input);
      this.contextManager.addMessage('user', input);
    }

    // Execute via AgenticLoop
    const response = await this.agenticLoop.run(input);

    // Track assistant response
    if (this.contextManager) {
      this.contextManager.addMessage('assistant', response.output_text);
    }

    return response;
  }

  // Expose context manager for advanced use
  get context(): IUnifiedContextManager | undefined {
    return this.contextManager;
  }
}
```

### TaskAgent (Required Context + Plugins)

```typescript
export class TaskAgent extends BaseAgent {
  private contextManager: IUnifiedContextManager;
  private planPlugin: PlanPlugin;
  private memoryPlugin: MemoryPlugin;
  private memory: WorkingMemory;

  constructor(config: TaskAgentConfig) {
    super(config);

    // Create context manager (required)
    this.contextManager = new UnifiedContextManager({
      maxContextTokens: this.getModelContextSize(),
      strategy: config.contextStrategy ?? 'proactive',
    });

    // Set system prompt
    this.contextManager.setSystemPrompt(TASK_AGENT_SYSTEM_PROMPT);
    if (config.instructions) {
      this.contextManager.setInstructions(config.instructions);
    }

    // Register plugins
    this.planPlugin = new PlanPlugin();
    this.contextManager.registerPlugin(this.planPlugin);

    this.memory = new WorkingMemory(new InMemoryStorage(), config.memoryConfig);
    this.memoryPlugin = new MemoryPlugin(this.memory);
    this.contextManager.registerPlugin(this.memoryPlugin);

    this.contextManager.registerPlugin(new ToolOutputPlugin());
  }

  async start(planInput: PlanInput): Promise<PlanExecutionResult> {
    // Create plan
    const plan = createPlan(planInput);
    this.planPlugin.setPlan(plan);

    // Execute tasks
    for (const task of getExecutableTasks(plan)) {
      // Prepare context (handles compaction automatically)
      this.contextManager.setCurrentInput(this.buildTaskPrompt(task));
      const prepared = await this.contextManager.prepare();

      // Execute task with prepared context
      const result = await this.executeTask(task, prepared);

      // Track in history
      this.contextManager.addMessage('assistant', result.output);
    }
  }
}
```

### PlanningAgent (Now Extends BaseAgent)

```typescript
/**
 * PlanningAgent - Now part of the agent hierarchy
 */
export class PlanningAgent extends BaseAgent<PlanningAgentConfig, PlanningAgentEvents> {
  private contextManager: IUnifiedContextManager;

  constructor(config: PlanningAgentConfig) {
    super({
      ...config,
      tools: [...(config.tools ?? []), ...this.createPlanningTools()],
    });

    // Create minimal context manager
    this.contextManager = new UnifiedContextManager({
      maxContextTokens: 32000,  // Planning needs less context
      strategy: 'lazy',  // Minimal compaction for planning
    });

    this.contextManager.setSystemPrompt(PLANNING_SYSTEM_PROMPT);
  }

  async generatePlan(goal: string, context?: string): Promise<GeneratedPlan> {
    this.contextManager.setCurrentInput(this.buildPlanningPrompt(goal, context));

    // Run planning loop
    const response = await this.run(goal);

    // Track in history
    this.contextManager.addMessage('user', goal);
    this.contextManager.addMessage('assistant', response.output_text);

    return this.extractPlan(response);
  }

  // Inherits from BaseAgent:
  // - ToolManager
  // - ToolPermissionManager
  // - SessionManager
  // - Lifecycle hooks
}
```

### UniversalAgent (Uses Same Context Manager)

```typescript
export class UniversalAgent extends BaseAgent {
  private contextManager: IUnifiedContextManager;
  private memoryPlugin: MemoryPlugin;
  private modeManager: ModeManager;

  constructor(config: UniversalAgentConfig) {
    super(config);

    // Same context manager as everyone else
    this.contextManager = new UnifiedContextManager({
      maxContextTokens: this.getModelContextSize(),
      strategy: config.contextStrategy ?? 'adaptive',
    });

    // Memory plugin (mode-aware)
    this.memory = new WorkingMemory(new InMemoryStorage(), config.memoryConfig);
    this.memoryPlugin = new MemoryPlugin(this.memory);
    this.contextManager.registerPlugin(this.memoryPlugin);

    // Plan plugin (used when executing)
    this.planPlugin = new PlanPlugin();
    this.contextManager.registerPlugin(this.planPlugin);
  }

  async chat(input: string): Promise<UniversalResponse> {
    // Track in history
    this.contextManager.addMessage('user', input);
    this.contextManager.setCurrentInput(input);

    // Prepare context (same as TaskAgent!)
    const prepared = await this.contextManager.prepare();

    // Route based on mode
    const response = await this.routeByMode(input, prepared);

    // Track response
    this.contextManager.addMessage('assistant', response.text);

    return response;
  }
}
```

---

## Migration Path

### Phase 1: Create UnifiedContextManager

1. Create `src/core/context/UnifiedContextManager.ts`
2. Create plugin interfaces and built-in plugins
3. Add to exports (alongside existing ContextManager)

### Phase 2: Add Optional Context to Agent

1. Update `AgentConfig` to accept context manager
2. Update Agent to track history if context exists
3. Backward compatible (context is optional)

### Phase 3: Migrate TaskAgent

1. Replace TaskAgentContextProvider with plugins
2. Replace IHistoryManager usage with built-in history
3. Update PlanExecutor to use new context manager

### Phase 4: Migrate UniversalAgent

1. Replace IContextBuilder with UnifiedContextManager
2. Use same plugins as TaskAgent
3. Remove duplicate IHistoryManager

### Phase 5: Migrate PlanningAgent

1. Make PlanningAgent extend BaseAgent
2. Add context manager
3. Inherit ToolManager, permissions, sessions

### Phase 6: Deprecate Old Interfaces

1. Mark IHistoryManager as deprecated
2. Mark IContextProvider as deprecated
3. Mark IContextBuilder as deprecated
4. Provide migration guide

---

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| History management | Separate IHistoryManager | Built into context |
| Managers to configure | 2+ (Context, History, Memory) | 1 (Context + plugins) |
| Compaction logic | Duplicated in 2 places | Single pipeline |
| Agent consistency | Different approaches | Same interface |
| PlanningAgent | Standalone | Part of hierarchy |
| Basic Agent history | Manual | Optional built-in |
| Code duplication | High | Low |
| Mental model | Complex | Simple |

---

## Types Summary

```typescript
// Core types
export interface IUnifiedContextManager extends EventEmitter<ContextManagerEvents> { ... }
export interface IContextPlugin { ... }
export interface PreparedContext { ... }
export interface ContextBudget { ... }
export interface HistoryMessage { ... }
export interface SerializedContextState { ... }

// Built-in plugins
export class PlanPlugin implements IContextPlugin { ... }
export class MemoryPlugin implements IContextPlugin { ... }
export class ToolOutputPlugin implements IContextPlugin { ... }

// Main implementation
export class UnifiedContextManager implements IUnifiedContextManager { ... }

// Deprecated (will be removed)
export interface IHistoryManager { ... }  // Use built-in history
export interface IContextProvider { ... }  // Use plugins
export interface IContextBuilder { ... }   // Use UnifiedContextManager
```
