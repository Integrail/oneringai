/**
 * AgentContextNextGen - Clean, Simple Context Manager
 *
 * Design Principles:
 * 1. Single system message with ALL context (prompt, instructions, plugin contents)
 * 2. Clear separation: system message | conversation | current input
 * 3. Compaction happens ONCE, right before LLM call
 * 4. Each plugin manages its own token tracking
 * 5. Tool pairs (tool_use + tool_result) always removed together
 *
 * Context Structure:
 * ```
 * [Developer Message - All glued together]
 *   # System Prompt
 *   # Persistent Instructions (if plugin enabled)
 *   # Plugin Instructions (for enabled plugins)
 *   # In-Context Memory (if plugin enabled)
 *   # Working Memory Index (if plugin enabled)
 *
 * [Conversation History]
 *   ... messages including tool_use/tool_result pairs ...
 *
 * [Current Input]
 *   User message OR tool results (newest, never compacted)
 * ```
 */

import { EventEmitter } from 'eventemitter3';
import { ToolManager } from '../ToolManager.js';
import { getModelInfo } from '../../domain/entities/Model.js';
import type { InputItem, Message } from '../../domain/entities/Message.js';
import { MessageRole } from '../../domain/entities/Message.js';
import type { Content } from '../../domain/entities/Content.js';
import { ContentType } from '../../domain/entities/Content.js';
import type { ToolResult } from '../../domain/entities/Tool.js';
import type { OutputItem } from '../../domain/entities/Message.js';
import { simpleTokenEstimator } from './BasePluginNextGen.js';

import type {
  IContextPluginNextGen,
  ITokenEstimator,
  AgentContextNextGenConfig,
  ContextFeatures,
  ContextBudget,
  PreparedContext,
  OversizedInputResult,
  SerializedContextState,
  ContextEvents,
  PluginConfigs,
} from './types.js';
import type { IContextStorage, StoredContextSession } from '../../domain/interfaces/IContextStorage.js';

// Plugin imports for auto-initialization
import {
  WorkingMemoryPluginNextGen,
  InContextMemoryPluginNextGen,
  PersistentInstructionsPluginNextGen,
} from './plugins/index.js';
import type {
  WorkingMemoryPluginConfig,
  InContextMemoryConfig,
  PersistentInstructionsConfig,
} from './plugins/index.js';

import {
  STRATEGY_THRESHOLDS,
  DEFAULT_FEATURES,
  DEFAULT_CONFIG,
} from './types.js';

// ============================================================================
// AgentContextNextGen
// ============================================================================

/**
 * Next-generation context manager for AI agents.
 *
 * Usage:
 * ```typescript
 * const ctx = AgentContextNextGen.create({
 *   model: 'gpt-4',
 *   systemPrompt: 'You are a helpful assistant.',
 *   features: { workingMemory: true },
 * });
 *
 * // Add user message
 * ctx.addUserMessage('Hello!');
 *
 * // Prepare for LLM call (handles compaction if needed)
 * const { input, budget } = await ctx.prepare();
 *
 * // Call LLM with input...
 *
 * // Add assistant response
 * ctx.addAssistantResponse(response.output);
 * ```
 */
export class AgentContextNextGen extends EventEmitter<ContextEvents> {
  // ============================================================================
  // Private State
  // ============================================================================

  /** Configuration */
  private readonly _config: Required<Omit<AgentContextNextGenConfig, 'tools' | 'storage' | 'features' | 'systemPrompt' | 'plugins'>> & {
    features: Required<ContextFeatures>;
    storage?: IContextStorage;
    systemPrompt?: string;
  };

  /** Maximum context tokens for the model */
  private readonly _maxContextTokens: number;

  /** Compaction strategy threshold */
  private readonly _strategyThreshold: number;

  /** System prompt (user-provided) */
  private _systemPrompt: string | undefined;

  /** Conversation history (excludes current input) */
  private _conversation: InputItem[] = [];

  /** Current input (pending, will be added to conversation after LLM response) */
  private _currentInput: InputItem[] = [];

  /** Registered plugins */
  private readonly _plugins: Map<string, IContextPluginNextGen> = new Map();

  /** Tool manager */
  private readonly _tools: ToolManager;

  /** Token estimator for conversation/input */
  private readonly _estimator: ITokenEstimator = simpleTokenEstimator;

  /** Session ID (if loaded/saved) */
  private _sessionId: string | null = null;

  /** Agent ID */
  private readonly _agentId: string;

  /** Storage backend */
  private readonly _storage?: IContextStorage;

  /** Destroyed flag */
  private _destroyed = false;

  // ============================================================================
  // Static Factory
  // ============================================================================

  /**
   * Create a new AgentContextNextGen instance.
   */
  static create(config: AgentContextNextGenConfig): AgentContextNextGen {
    return new AgentContextNextGen(config);
  }

  // ============================================================================
  // Constructor
  // ============================================================================

  private constructor(config: AgentContextNextGenConfig) {
    super();

    // Resolve max context tokens from model
    const modelInfo = getModelInfo(config.model);
    this._maxContextTokens = config.maxContextTokens ?? modelInfo?.features?.input?.tokens ?? 128000;

    // Build full config
    this._config = {
      model: config.model,
      maxContextTokens: this._maxContextTokens,
      responseReserve: config.responseReserve ?? DEFAULT_CONFIG.responseReserve,
      systemPrompt: config.systemPrompt,
      strategy: config.strategy ?? DEFAULT_CONFIG.strategy,
      features: { ...DEFAULT_FEATURES, ...config.features },
      agentId: config.agentId ?? this.generateId(),
      storage: config.storage,
    };

    this._systemPrompt = config.systemPrompt;
    this._agentId = this._config.agentId;
    this._storage = config.storage;
    this._strategyThreshold = STRATEGY_THRESHOLDS[this._config.strategy];

    // Create tool manager
    this._tools = new ToolManager();

    // Register initial tools
    if (config.tools) {
      for (const tool of config.tools) {
        this._tools.register(tool);
      }
    }

    // Auto-initialize plugins based on features config
    this.initializePlugins(config.plugins);
  }

  /**
   * Initialize plugins based on feature flags.
   * Called automatically in constructor.
   */
  private initializePlugins(pluginConfigs?: PluginConfigs): void {
    const features = this._config.features;
    const configs = pluginConfigs ?? {};

    // 1. Working Memory (default: enabled)
    if (features.workingMemory) {
      this.registerPlugin(new WorkingMemoryPluginNextGen(
        configs.workingMemory as WorkingMemoryPluginConfig | undefined
      ));
    }

    // 2. In-Context Memory (default: disabled)
    if (features.inContextMemory) {
      this.registerPlugin(new InContextMemoryPluginNextGen(
        configs.inContextMemory as InContextMemoryConfig | undefined
      ));
    }

    // 3. Persistent Instructions (default: disabled, requires agentId)
    if (features.persistentInstructions) {
      if (!this._agentId) {
        throw new Error('persistentInstructions feature requires agentId to be set');
      }
      const piConfig = configs.persistentInstructions as Partial<PersistentInstructionsConfig> | undefined;
      this.registerPlugin(new PersistentInstructionsPluginNextGen({
        agentId: this._agentId,
        ...piConfig,
      }));
    }
  }

  // ============================================================================
  // Public Properties
  // ============================================================================

  /** Get the tool manager */
  get tools(): ToolManager {
    return this._tools;
  }

  /** Get the model name */
  get model(): string {
    return this._config.model;
  }

  /** Get the agent ID */
  get agentId(): string {
    return this._agentId;
  }

  /** Get/set system prompt */
  get systemPrompt(): string | undefined {
    return this._systemPrompt;
  }

  set systemPrompt(value: string | undefined) {
    this._systemPrompt = value;
  }

  /** Get feature configuration */
  get features(): Required<ContextFeatures> {
    return this._config.features;
  }

  /** Check if destroyed */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /** Get current session ID */
  get sessionId(): string | null {
    return this._sessionId;
  }

  /** Get storage (null if not configured) */
  get storage(): IContextStorage | null {
    return this._storage ?? null;
  }

  /** Get max context tokens */
  get maxContextTokens(): number {
    return this._maxContextTokens;
  }

  /** Get response reserve tokens */
  get responseReserve(): number {
    return this._config.responseReserve;
  }

  /** Get current tools token usage (useful for debugging) */
  get toolsTokens(): number {
    return this.calculateToolsTokens();
  }

  // ============================================================================
  // Compatibility / Migration Helpers
  // ============================================================================

  /**
   * Get working memory plugin (if registered).
   * This is a compatibility accessor for code expecting ctx.memory
   */
  get memory(): import('./plugins/WorkingMemoryPluginNextGen.js').WorkingMemoryPluginNextGen | null {
    const plugin = this._plugins.get('working_memory');
    return plugin as import('./plugins/WorkingMemoryPluginNextGen.js').WorkingMemoryPluginNextGen | null;
  }

  /**
   * Get the last message (most recent user message or tool results).
   * Used for compatibility with old code that expected a single item.
   */
  getLastUserMessage(): InputItem | null {
    if (this._conversation.length === 0) return null;
    const last = this._conversation[this._conversation.length - 1];
    if (!last) return null;
    // Return if it's user message (check for role property and USER role)
    if ('role' in last && last.role === MessageRole.USER) return last;
    return null;
  }

  /**
   * Set current input (user message).
   * Adds a user message to the conversation and sets it as the current input for prepare().
   */
  setCurrentInput(content: string | Content[]): void {
    this.assertNotDestroyed();
    // Clear existing current input array
    this._currentInput = [];
    // Add user message to both conversation and current input
    this.addUserMessage(content);
    // The last message added is the current input
    const lastMsg = this._conversation[this._conversation.length - 1];
    if (lastMsg) {
      this._currentInput.push(lastMsg);
    }
  }

  /**
   * Add multiple input items to conversation (legacy compatibility).
   */
  addInputItems(items: InputItem[]): void {
    this.assertNotDestroyed();
    for (const item of items) {
      this._conversation.push(item);
    }
  }

  /**
   * Legacy alias for prepare() - returns prepared context.
   */
  async prepareConversation(): Promise<PreparedContext> {
    return this.prepare();
  }

  /**
   * Add a message (legacy compatibility).
   * For user messages, use addUserMessage instead.
   * For assistant messages, use addAssistantResponse instead.
   */
  addMessage(role: 'user' | 'assistant', content: string | Content[]): string {
    this.assertNotDestroyed();
    if (role === 'user') {
      return this.addUserMessage(content);
    }
    // For assistant, we need to convert to OutputItem format
    const outputItem: OutputItem = {
      type: 'message' as const,
      role: MessageRole.ASSISTANT,
      content: [{
        type: ContentType.OUTPUT_TEXT,
        text: typeof content === 'string' ? content : JSON.stringify(content),
      }],
    };
    return this.addAssistantResponse([outputItem]);
  }

  // ============================================================================
  // Plugin Management
  // ============================================================================

  /**
   * Register a plugin.
   * Plugin's tools are automatically registered with ToolManager.
   */
  registerPlugin(plugin: IContextPluginNextGen): void {
    this.assertNotDestroyed();

    if (this._plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }

    this._plugins.set(plugin.name, plugin);

    // Register plugin's tools
    const tools = plugin.getTools();
    for (const tool of tools) {
      this._tools.register(tool);
    }
  }

  /**
   * Get a plugin by name.
   */
  getPlugin<T extends IContextPluginNextGen>(name: string): T | null {
    return (this._plugins.get(name) as T) ?? null;
  }

  /**
   * Check if a plugin is registered.
   */
  hasPlugin(name: string): boolean {
    return this._plugins.has(name);
  }

  /**
   * Get all registered plugins.
   */
  getPlugins(): IContextPluginNextGen[] {
    return Array.from(this._plugins.values());
  }

  // ============================================================================
  // Conversation Management
  // ============================================================================

  /**
   * Add a user message.
   * Returns the message ID.
   */
  addUserMessage(content: string | Content[]): string {
    this.assertNotDestroyed();

    const id = this.generateId();
    const contentArray: Content[] = typeof content === 'string'
      ? [{ type: ContentType.INPUT_TEXT, text: content }]
      : content;

    const message: Message = {
      type: 'message',
      id,
      role: MessageRole.USER,
      content: contentArray,
    };

    // User message becomes current input
    this._currentInput = [message];

    this.emit('message:added', { role: 'user', index: this._conversation.length });

    return id;
  }

  /**
   * Add assistant response (from LLM output).
   * Also moves current input to conversation history.
   * Returns the message ID.
   */
  addAssistantResponse(output: OutputItem[]): string {
    this.assertNotDestroyed();

    // First, move current input to conversation
    if (this._currentInput.length > 0) {
      this._conversation.push(...this._currentInput);
      this._currentInput = [];
    }

    // Build assistant message
    const id = this.generateId();
    const contentArray: Content[] = [];

    for (const item of output) {
      if (item.type === 'message' && 'content' in item) {
        // Text content
        const msg = item as Message;
        for (const c of msg.content) {
          if (c.type === ContentType.OUTPUT_TEXT || c.type === ContentType.INPUT_TEXT) {
            contentArray.push({
              type: ContentType.OUTPUT_TEXT,
              text: (c as any).text || '',
            });
          } else if (c.type === ContentType.TOOL_USE) {
            contentArray.push(c);
          }
        }
      } else if (item.type === 'compaction' || item.type === 'reasoning') {
        // Skip compaction and reasoning items for now
        // They can be added if needed later
        continue;
      }
    }

    // Only add if there's content
    if (contentArray.length > 0) {
      const message: Message = {
        type: 'message',
        id,
        role: MessageRole.ASSISTANT,
        content: contentArray,
      };

      this._conversation.push(message);
      this.emit('message:added', { role: 'assistant', index: this._conversation.length - 1 });
    }

    return id;
  }

  /**
   * Add tool results.
   * Returns the message ID.
   */
  addToolResults(results: ToolResult[]): string {
    this.assertNotDestroyed();

    if (results.length === 0) {
      return '';
    }

    const id = this.generateId();
    const contentArray: Content[] = results.map(r => ({
      type: ContentType.TOOL_RESULT,
      tool_use_id: r.tool_use_id,
      content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content),
      error: r.error,
    }));

    const message: Message = {
      type: 'message',
      id,
      role: MessageRole.USER, // Tool results are user role in most APIs
      content: contentArray,
    };

    // Tool results become current input
    this._currentInput = [message];

    this.emit('message:added', { role: 'tool', index: this._conversation.length });

    return id;
  }

  /**
   * Get conversation history (read-only).
   */
  getConversation(): ReadonlyArray<InputItem> {
    return this._conversation;
  }

  /**
   * Get current input (read-only).
   */
  getCurrentInput(): ReadonlyArray<InputItem> {
    return this._currentInput;
  }

  /**
   * Get conversation length.
   */
  getConversationLength(): number {
    return this._conversation.length;
  }

  /**
   * Clear conversation history.
   */
  clearConversation(reason?: string): void {
    this.assertNotDestroyed();
    this._conversation = [];
    this._currentInput = [];
    this.emit('conversation:cleared', { reason });
  }

  // ============================================================================
  // Context Preparation (THE main method)
  // ============================================================================

  /**
   * Prepare context for LLM call.
   *
   * This method:
   * 1. Calculates tool definition tokens (never compacted)
   * 2. Builds the system message from all components
   * 3. Calculates token budget
   * 4. Handles oversized current input if needed
   * 5. Runs compaction if needed
   * 6. Returns final InputItem[] ready for LLM
   *
   * IMPORTANT: Call this ONCE right before each LLM call!
   */
  async prepare(): Promise<PreparedContext> {
    this.assertNotDestroyed();

    const compactionLog: string[] = [];

    // Step 1: Calculate tool tokens (NEVER compacted - must fit!)
    const toolsTokens = this.calculateToolsTokens();

    // Available = maxTokens - responseReserve - toolsTokens
    const availableForContent = this._maxContextTokens - this._config.responseReserve - toolsTokens;

    if (availableForContent <= 0) {
      throw new Error(
        `Too many tools registered: tools use ${toolsTokens} tokens, ` +
        `only ${this._maxContextTokens - this._config.responseReserve} available. ` +
        `Consider reducing the number of tools or their descriptions.`
      );
    }

    // Step 2: Build system message and calculate its tokens
    const { systemMessage, systemTokens, breakdown } = await this.buildSystemMessage();

    // Step 3: Calculate current input tokens
    let currentInputTokens = this.calculateInputTokens(this._currentInput);

    // Step 4: Check if current input is too large
    const systemPlusInput = systemTokens + currentInputTokens;
    if (systemPlusInput > availableForContent) {
      // Current input too large - handle it
      const result = await this.handleOversizedInput(
        availableForContent - systemTokens
      );
      this.emit('input:oversized', { result });

      if (!result.accepted) {
        throw new Error(result.error || 'Current input is too large for context');
      }

      // Recalculate current input tokens after truncation
      currentInputTokens = this.calculateInputTokens(this._currentInput);
    }

    // Step 5: Calculate conversation tokens
    let conversationTokens = this.calculateConversationTokens();
    let totalUsed = systemTokens + conversationTokens + currentInputTokens;

    // Step 6: Check if compaction needed
    let compacted = false;
    if (totalUsed / availableForContent > this._strategyThreshold) {
      const targetToFree = totalUsed - Math.floor(availableForContent * (this._strategyThreshold - 0.1));

      const freed = await this.runCompaction(targetToFree, compactionLog);
      compacted = freed > 0;

      // Recalculate after compaction
      conversationTokens = this.calculateConversationTokens();
      totalUsed = systemTokens + conversationTokens + currentInputTokens;
    }

    // Step 7: Build final budget (include tools in totalUsed for accurate reporting)
    const totalUsedWithTools = totalUsed + toolsTokens;
    const budget: ContextBudget = {
      maxTokens: this._maxContextTokens,
      responseReserve: this._config.responseReserve,
      systemMessageTokens: systemTokens,
      toolsTokens,
      conversationTokens,
      currentInputTokens,
      totalUsed: totalUsedWithTools,
      available: this._maxContextTokens - this._config.responseReserve - totalUsedWithTools,
      utilizationPercent: (totalUsedWithTools / (this._maxContextTokens - this._config.responseReserve)) * 100,
      breakdown: {
        ...breakdown,
        tools: toolsTokens,
        conversation: conversationTokens,
        currentInput: currentInputTokens,
      },
    };

    // Step 8: Emit budget warnings
    if (budget.utilizationPercent >= 90) {
      this.emit('budget:critical', { budget });
    } else if (budget.utilizationPercent >= 70) {
      this.emit('budget:warning', { budget });
    }

    // Step 9: Build final input array
    const input: InputItem[] = [
      systemMessage,
      ...this._conversation,
      ...this._currentInput,
    ];

    this.emit('context:prepared', { budget, compacted });

    return {
      input,
      budget,
      compacted,
      compactionLog,
    };
  }

  // ============================================================================
  // System Message Building
  // ============================================================================

  /**
   * Build the system message containing all context components.
   */
  private async buildSystemMessage(): Promise<{
    systemMessage: Message;
    systemTokens: number;
    breakdown: {
      systemPrompt: number;
      persistentInstructions: number;
      pluginInstructions: number;
      pluginContents: Record<string, number>;
    };
  }> {
    const parts: string[] = [];
    const breakdown = {
      systemPrompt: 0,
      persistentInstructions: 0,
      pluginInstructions: 0,
      pluginContents: {} as Record<string, number>,
    };

    // 1. System Prompt (user-provided)
    if (this._systemPrompt) {
      parts.push(`# System Prompt\n\n${this._systemPrompt}`);
      breakdown.systemPrompt = this._estimator.estimateTokens(this._systemPrompt);
    }

    // 2. Persistent Instructions (from plugin, if enabled)
    const persistentPlugin = this._plugins.get('persistent_instructions');
    if (persistentPlugin) {
      const content = await persistentPlugin.getContent();
      if (content) {
        parts.push(`# Persistent Instructions\n\n${content}`);
        breakdown.persistentInstructions = persistentPlugin.getTokenSize();
      }
    }

    // 3. Plugin Instructions (how to use each plugin)
    const instructionParts: string[] = [];
    let totalInstructionTokens = 0;

    for (const plugin of this._plugins.values()) {
      const instructions = plugin.getInstructions();
      if (instructions) {
        instructionParts.push(`## ${this.formatPluginName(plugin.name)}\n\n${instructions}`);
        totalInstructionTokens += plugin.getInstructionsTokenSize();
      }
    }

    if (instructionParts.length > 0) {
      parts.push(`# Instructions for Context Plugins\n\n${instructionParts.join('\n\n')}`);
      breakdown.pluginInstructions = totalInstructionTokens;
    }

    // 4. Plugin Contents (actual data from each plugin, except persistent instructions)
    for (const plugin of this._plugins.values()) {
      if (plugin.name === 'persistent_instructions') continue; // Already handled above

      const content = await plugin.getContent();
      if (content) {
        const sectionTitle = this.formatPluginName(plugin.name);
        parts.push(`# ${sectionTitle}\n\n${content}`);
        breakdown.pluginContents[plugin.name] = plugin.getTokenSize();
      }
    }

    // Build final system message
    const systemText = parts.join('\n\n---\n\n');
    const systemTokens = this._estimator.estimateTokens(systemText);

    const systemMessage: Message = {
      type: 'message',
      role: MessageRole.DEVELOPER,
      content: [{ type: ContentType.INPUT_TEXT, text: systemText }],
    };

    return { systemMessage, systemTokens, breakdown };
  }

  /**
   * Format plugin name for display (e.g., 'working_memory' -> 'Working Memory')
   */
  private formatPluginName(name: string): string {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // ============================================================================
  // Token Calculations
  // ============================================================================

  /**
   * Calculate tokens used by tool definitions.
   * Tools are sent separately to the LLM and take up context space.
   */
  private calculateToolsTokens(): number {
    const enabledTools = this._tools.getEnabled();
    if (enabledTools.length === 0) return 0;

    let total = 0;

    for (const tool of enabledTools) {
      // Each tool has: name, description, parameters schema
      const fn = tool.definition.function;

      // Name: ~2-5 tokens
      total += this._estimator.estimateTokens(fn.name);

      // Description: varies widely, typically 20-100 tokens
      if (fn.description) {
        total += this._estimator.estimateTokens(fn.description);
      }

      // Parameters schema: JSON schema can be large
      if (fn.parameters) {
        total += this._estimator.estimateDataTokens(fn.parameters);
      }

      // Per-tool overhead (JSON structure, type field, etc.)
      total += 10;
    }

    // Overall tools array overhead
    total += 20;

    return total;
  }

  /**
   * Calculate tokens for conversation history.
   */
  private calculateConversationTokens(): number {
    let total = 0;
    for (const item of this._conversation) {
      total += this.estimateItemTokens(item);
    }
    return total;
  }

  /**
   * Calculate tokens for current input.
   */
  private calculateInputTokens(items: InputItem[]): number {
    let total = 0;
    for (const item of items) {
      total += this.estimateItemTokens(item);
    }
    return total;
  }

  /**
   * Estimate tokens for a single InputItem.
   */
  private estimateItemTokens(item: InputItem): number {
    if (item.type !== 'message') return 50; // Default for unknown types

    const msg = item as Message;
    let total = 4; // Message overhead

    for (const c of msg.content) {
      if (c.type === ContentType.INPUT_TEXT || c.type === ContentType.OUTPUT_TEXT) {
        total += this._estimator.estimateTokens((c as any).text || '');
      } else if (c.type === ContentType.TOOL_USE) {
        total += this._estimator.estimateTokens((c as any).name || '');
        total += this._estimator.estimateDataTokens((c as any).input || {});
      } else if (c.type === ContentType.TOOL_RESULT) {
        total += this._estimator.estimateTokens((c as any).content || '');
      } else if (c.type === ContentType.INPUT_IMAGE_URL) {
        total += 200; // Approximate for images
      }
    }

    return total;
  }

  // ============================================================================
  // Compaction
  // ============================================================================

  /**
   * Run compaction to free up tokens.
   * Returns total tokens freed.
   */
  private async runCompaction(targetToFree: number, log: string[]): Promise<number> {
    let totalFreed = 0;
    let remaining = targetToFree;

    log.push(`Compaction started: need to free ~${targetToFree} tokens`);

    // Step 1: Compact plugins (in order of priority - most expendable first)
    const compactablePlugins = Array.from(this._plugins.values())
      .filter(p => p.isCompactable())
      .sort((a, b) => {
        // InContextMemory first, then WorkingMemory
        const order: Record<string, number> = {
          'in_context_memory': 1,
          'working_memory': 2,
        };
        return (order[a.name] ?? 10) - (order[b.name] ?? 10);
      });

    for (const plugin of compactablePlugins) {
      if (remaining <= 0) break;

      const freed = await plugin.compact(remaining);
      if (freed > 0) {
        totalFreed += freed;
        remaining -= freed;
        log.push(`Compacted ${plugin.name}: freed ~${freed} tokens`);
      }
    }

    // Step 2: Compact conversation history if still needed
    if (remaining > 0) {
      const conversationFreed = await this.compactConversation(remaining, log);
      totalFreed += conversationFreed;
      remaining -= conversationFreed;
    }

    log.push(`Compaction complete: freed ~${totalFreed} tokens total`);

    if (totalFreed > 0) {
      this.emit('context:compacted', { tokensFreed: totalFreed, log });
    }

    return totalFreed;
  }

  /**
   * Compact conversation history.
   * Removes oldest messages while preserving tool pairs.
   */
  private async compactConversation(targetToFree: number, log: string[]): Promise<number> {
    if (this._conversation.length === 0) return 0;

    // Find tool pairs (tool_use_id -> indices)
    const toolPairs = this.findToolPairs();

    // Find safe indices to remove (from oldest, not part of incomplete pairs)
    const safeToRemove: number[] = [];
    const inPair = new Set<number>();

    for (const indices of toolPairs.values()) {
      for (const idx of indices) {
        inPair.add(idx);
      }
    }

    // First pass: find messages that can be safely removed
    for (let i = 0; i < this._conversation.length; i++) {
      if (!inPair.has(i)) {
        safeToRemove.push(i);
      }
    }

    // Second pass: add complete pairs (both tool_use and tool_result present)
    for (const [_toolUseId, indices] of toolPairs) {
      // A complete pair has at least 2 messages
      if (indices.length >= 2) {
        for (const idx of indices) {
          if (!safeToRemove.includes(idx)) {
            safeToRemove.push(idx);
          }
        }
      }
    }

    // Sort by index (oldest first)
    safeToRemove.sort((a, b) => a - b);

    // Remove messages until we've freed enough tokens
    let tokensFreed = 0;
    const indicesToRemove = new Set<number>();

    for (const idx of safeToRemove) {
      if (tokensFreed >= targetToFree) break;

      // If this is part of a pair, remove the whole pair
      const item = this._conversation[idx];
      if (!item) continue;

      // Check if this message has tool_use or tool_result
      const msg = item as Message;
      for (const c of msg.content) {
        if (c.type === ContentType.TOOL_USE) {
          const toolUseId = (c as any).id;
          const pairIndices = toolPairs.get(toolUseId);
          if (pairIndices) {
            for (const pairIdx of pairIndices) {
              indicesToRemove.add(pairIdx);
              tokensFreed += this.estimateItemTokens(this._conversation[pairIdx]!);
            }
          }
        } else if (c.type === ContentType.TOOL_RESULT) {
          const toolUseId = (c as any).tool_use_id;
          const pairIndices = toolPairs.get(toolUseId);
          if (pairIndices) {
            for (const pairIdx of pairIndices) {
              indicesToRemove.add(pairIdx);
              tokensFreed += this.estimateItemTokens(this._conversation[pairIdx]!);
            }
          }
        }
      }

      // If not part of a pair, just remove this message
      if (!indicesToRemove.has(idx)) {
        indicesToRemove.add(idx);
        tokensFreed += this.estimateItemTokens(item);
      }
    }

    // Build new conversation without removed messages
    if (indicesToRemove.size > 0) {
      this._conversation = this._conversation.filter((_, i) => !indicesToRemove.has(i));
      log.push(`Removed ${indicesToRemove.size} messages from conversation: freed ~${tokensFreed} tokens`);
    }

    return tokensFreed;
  }

  /**
   * Find tool_use/tool_result pairs in conversation.
   * Returns Map<tool_use_id, array of message indices>.
   */
  private findToolPairs(): Map<string, number[]> {
    const pairs = new Map<string, number[]>();

    for (let i = 0; i < this._conversation.length; i++) {
      const item = this._conversation[i];
      if (item?.type !== 'message') continue;

      const msg = item as Message;
      for (const c of msg.content) {
        if (c.type === ContentType.TOOL_USE) {
          const toolUseId = (c as any).id;
          if (toolUseId) {
            const existing = pairs.get(toolUseId) ?? [];
            existing.push(i);
            pairs.set(toolUseId, existing);
          }
        } else if (c.type === ContentType.TOOL_RESULT) {
          const toolUseId = (c as any).tool_use_id;
          if (toolUseId) {
            const existing = pairs.get(toolUseId) ?? [];
            existing.push(i);
            pairs.set(toolUseId, existing);
          }
        }
      }
    }

    return pairs;
  }

  // ============================================================================
  // Oversized Input Handling
  // ============================================================================

  /**
   * Handle oversized current input.
   */
  private async handleOversizedInput(maxTokens: number): Promise<OversizedInputResult> {
    if (this._currentInput.length === 0) {
      return { accepted: true, content: '', originalSize: 0, finalSize: 0 };
    }

    const input = this._currentInput[0];
    if (input?.type !== 'message') {
      return { accepted: false, content: '', error: 'Invalid input type', originalSize: 0, finalSize: 0 };
    }

    const msg = input as Message;

    // Check if this is user input or tool results
    const hasToolResult = msg.content.some(c => c.type === ContentType.TOOL_RESULT);

    if (!hasToolResult) {
      // User input - reject with clear error
      const originalSize = this.estimateItemTokens(input);
      return {
        accepted: false,
        content: '',
        error: `User input is too large (${originalSize} tokens) for available context (${maxTokens} tokens). Please provide shorter input.`,
        originalSize,
        finalSize: 0,
      };
    }

    // Tool results - attempt truncation
    return this.emergencyToolResultsTruncation(msg, maxTokens);
  }

  /**
   * Emergency truncation of tool results to fit in context.
   */
  private emergencyToolResultsTruncation(msg: Message, maxTokens: number): OversizedInputResult {
    const originalSize = this.estimateItemTokens(msg);
    const truncatedContent: Content[] = [];

    // Calculate max chars we can keep (rough: tokens * 3.5)
    const maxChars = Math.floor(maxTokens * 3.5);
    let totalCharsUsed = 0;

    for (const c of msg.content) {
      if (c.type === ContentType.TOOL_RESULT) {
        const toolResult = c as any;
        const content = toolResult.content || '';

        // Check if content is binary (base64, etc.)
        if (this.isBinaryContent(content)) {
          // Reject binary content
          truncatedContent.push({
            type: ContentType.TOOL_RESULT,
            tool_use_id: toolResult.tool_use_id,
            content: '[Binary content too large - rejected. Please try a different approach or request smaller output.]',
            error: 'Binary content too large',
          });
          totalCharsUsed += 100;
        } else {
          // Truncate text/JSON content
          const availableChars = maxChars - totalCharsUsed - 200; // Reserve for warning
          if (content.length > availableChars && availableChars > 0) {
            const truncated = content.slice(0, availableChars);
            truncatedContent.push({
              type: ContentType.TOOL_RESULT,
              tool_use_id: toolResult.tool_use_id,
              content: `${truncated}\n\n[TRUNCATED: Original output was ${Math.round(content.length / 1024)}KB. Only first ${Math.round(availableChars / 1024)}KB shown. Consider using more targeted queries.]`,
            });
            totalCharsUsed += truncated.length + 150;
          } else if (availableChars > 0) {
            truncatedContent.push(c);
            totalCharsUsed += content.length;
          } else {
            // No space left
            truncatedContent.push({
              type: ContentType.TOOL_RESULT,
              tool_use_id: toolResult.tool_use_id,
              content: '[Output too large - skipped due to context limits. Try a more targeted query.]',
              error: 'Output too large',
            });
            totalCharsUsed += 100;
          }
        }
      } else {
        truncatedContent.push(c);
      }
    }

    // Update message with truncated content
    msg.content = truncatedContent;
    const finalSize = this.estimateItemTokens(msg);

    return {
      accepted: true,
      content: JSON.stringify(truncatedContent),
      warning: `Tool results truncated from ${originalSize} to ${finalSize} tokens to fit in context.`,
      originalSize,
      finalSize,
    };
  }

  /**
   * Check if content appears to be binary (base64, etc.)
   */
  private isBinaryContent(content: string): boolean {
    if (!content || content.length < 100) return false;

    // Check for base64 patterns
    const base64Ratio = (content.match(/[A-Za-z0-9+/=]/g)?.length ?? 0) / content.length;
    if (base64Ratio > 0.95 && content.length > 1000) {
      return true;
    }

    // Check for binary-looking patterns
    if (/^[A-Za-z0-9+/]{50,}={0,2}$/.test(content.slice(0, 100))) {
      return true;
    }

    return false;
  }

  // ============================================================================
  // Session Persistence
  // ============================================================================

  /**
   * Save context state to storage.
   *
   * @param sessionId - Optional session ID (uses current or generates new)
   * @param metadata - Optional additional metadata to merge
   * @param stateOverride - Optional state override (for agent-level state injection)
   */
  async save(
    sessionId?: string,
    metadata?: Record<string, unknown>,
    stateOverride?: SerializedContextState
  ): Promise<void> {
    this.assertNotDestroyed();

    if (!this._storage) {
      throw new Error('No storage configured');
    }

    const targetSessionId = sessionId ?? this._sessionId ?? this.generateId();

    // Use provided state override or build from current state
    const state: SerializedContextState = stateOverride ?? this.getState();

    // Merge additional metadata if provided
    if (metadata) {
      state.metadata = { ...state.metadata, ...metadata };
    }

    await this._storage.save(targetSessionId, state);
    this._sessionId = targetSessionId;
  }

  /**
   * Load context state from storage.
   */
  async load(sessionId: string): Promise<boolean> {
    this.assertNotDestroyed();

    if (!this._storage) {
      throw new Error('No storage configured');
    }

    const stored = await this._storage.load(sessionId);
    if (!stored) {
      return false;
    }

    // Extract state from StoredContextSession wrapper
    const state = stored.state;

    // Restore conversation
    this._conversation = state.conversation;
    this._systemPrompt = state.systemPrompt;

    // Restore plugin states
    for (const [name, pluginState] of Object.entries(state.pluginStates)) {
      const plugin = this._plugins.get(name);
      if (plugin) {
        plugin.restoreState(pluginState);
      }
    }

    this._sessionId = sessionId;
    return true;
  }

  /**
   * Load raw state from storage without restoring.
   * Used by BaseAgent for custom state restoration.
   */
  async loadRaw(sessionId: string): Promise<{ state: SerializedContextState; stored: StoredContextSession } | null> {
    this.assertNotDestroyed();

    if (!this._storage) {
      throw new Error('No storage configured');
    }

    const stored = await this._storage.load(sessionId);
    if (!stored) {
      return null;
    }

    this._sessionId = sessionId;
    return { state: stored.state, stored };
  }

  /**
   * Check if session exists in storage.
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    if (!this._storage) {
      return false;
    }
    return this._storage.exists(sessionId);
  }

  /**
   * Delete a session from storage.
   */
  async deleteSession(sessionId?: string): Promise<void> {
    if (!this._storage) {
      throw new Error('No storage configured');
    }

    const targetSessionId = sessionId ?? this._sessionId;
    if (!targetSessionId) {
      throw new Error('No session ID provided or loaded');
    }

    await this._storage.delete(targetSessionId);

    // Clear session ID if deleting current session
    if (targetSessionId === this._sessionId) {
      this._sessionId = null;
    }
  }

  /**
   * Get serialized state for persistence.
   * Used by BaseAgent to inject agent-level state.
   */
  getState(): SerializedContextState {
    this.assertNotDestroyed();

    const pluginStates: Record<string, unknown> = {};
    for (const [name, plugin] of this._plugins) {
      pluginStates[name] = plugin.getState();
    }

    return {
      conversation: this._conversation,
      pluginStates,
      systemPrompt: this._systemPrompt,
      metadata: {
        savedAt: Date.now(),
        agentId: this._agentId,
        model: this._config.model,
      },
    };
  }

  /**
   * Restore state from serialized form.
   * Used by BaseAgent for custom state restoration.
   */
  restoreState(state: SerializedContextState): void {
    this.assertNotDestroyed();

    this._conversation = state.conversation ?? [];
    this._systemPrompt = state.systemPrompt;

    // Restore plugin states (guard against null/undefined)
    if (state.pluginStates) {
      for (const [name, pluginState] of Object.entries(state.pluginStates)) {
        const plugin = this._plugins.get(name);
        if (plugin) {
          plugin.restoreState(pluginState);
        }
      }
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Generate unique ID.
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Assert context is not destroyed.
   */
  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('AgentContextNextGen is destroyed');
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Destroy context and release resources.
   */
  destroy(): void {
    if (this._destroyed) return;

    // Destroy plugins
    for (const plugin of this._plugins.values()) {
      plugin.destroy();
    }
    this._plugins.clear();

    // Destroy tool manager
    this._tools.destroy();

    // Clear state
    this._conversation = [];
    this._currentInput = [];

    this.removeAllListeners();
    this._destroyed = true;
  }
}
