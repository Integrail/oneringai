/**
 * Agent class - represents an agent with tool calling capabilities
 * Now with events, hooks, pause/resume, and enterprise features
 *
 * Implements IDisposable for proper resource cleanup
 */

import { EventEmitter } from 'eventemitter3';
import { ITextProvider } from '../../domain/interfaces/ITextProvider.js';
import { IDisposable, assertNotDestroyed } from '../../domain/interfaces/IDisposable.js';
import { ToolRegistry } from './ToolRegistry.js';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { InputItem } from '../../domain/entities/Message.js';
import { AgentResponse } from '../../domain/entities/Response.js';
import { AgenticLoop, AgenticLoopConfig } from './AgenticLoop.js';
import { ExecutionContext, HistoryMode } from './ExecutionContext.js';
import { HookConfig } from './types/HookTypes.js';
import { AgenticLoopEvents } from './types/EventTypes.js';
import { StreamEvent } from '../../domain/entities/StreamEvent.js';

export interface AgentConfig {
  provider: string;
  model: string;
  instructions?: string;
  tools?: ToolFunction[];
  temperature?: number;
  maxIterations?: number;

  // NEW: Enterprise configuration
  hooks?: HookConfig;
  historyMode?: HistoryMode;
  limits?: {
    maxExecutionTime?: number;
    maxToolCalls?: number;
    maxContextSize?: number;
    /** Maximum number of input messages to keep (prevents unbounded context growth) */
    maxInputMessages?: number;
  };
  errorHandling?: {
    hookFailureMode?: 'fail' | 'warn' | 'ignore';
    toolFailureMode?: 'fail' | 'warn' | 'continue';
    maxConsecutiveErrors?: number;
  };
}

export class Agent extends EventEmitter<AgenticLoopEvents> implements IDisposable {
  private agenticLoop: AgenticLoop;
  private cleanupCallbacks: Array<() => void> = [];
  private boundListeners: Map<keyof AgenticLoopEvents, (...args: any[]) => void> = new Map();
  private _isDestroyed = false;

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  constructor(
    private config: AgentConfig,
    textProvider: ITextProvider,
    private toolRegistry: ToolRegistry
  ) {
    super();

    // Register tools if provided
    if (config.tools) {
      for (const tool of config.tools) {
        this.toolRegistry.registerTool(tool);
      }
    }

    // Create agentic loop with hooks
    this.agenticLoop = new AgenticLoop(
      textProvider,
      toolRegistry,
      config.hooks,
      config.errorHandling
    );

    // Forward all events from AgenticLoop with tracked listeners for cleanup
    const eventNames: Array<keyof AgenticLoopEvents> = [
      'execution:start',
      'execution:complete',
      'execution:error',
      'execution:paused',
      'execution:resumed',
      'execution:cancelled',
      'iteration:start',
      'iteration:complete',
      'llm:request',
      'llm:response',
      'llm:error',
      'tool:detected',
      'tool:start',
      'tool:complete',
      'tool:error',
      'tool:timeout',
      'hook:error',
    ];

    for (const eventName of eventNames) {
      // Create a bound handler that can be removed later
      const handler = (data: any) => {
        if (!this._isDestroyed) {
          this.emit(eventName, data);
        }
      };
      this.boundListeners.set(eventName, handler);
      this.agenticLoop.on(eventName, handler);
    }
  }

  /**
   * Run the agent with input
   * @throws Error if agent has been destroyed
   */
  async run(input: string | InputItem[]): Promise<AgentResponse> {
    assertNotDestroyed(this, 'run agent');

    // Get tool definitions for the LLM
    const tools = this.config.tools?.map((t) => t.definition) || [];

    const loopConfig: AgenticLoopConfig = {
      model: this.config.model,
      input,
      instructions: this.config.instructions,
      tools,
      temperature: this.config.temperature,
      maxIterations: this.config.maxIterations || 10,
      hooks: this.config.hooks,
      historyMode: this.config.historyMode,
      limits: this.config.limits,
      errorHandling: this.config.errorHandling,
    };

    return this.agenticLoop.execute(loopConfig);
  }

  /**
   * Stream response from the agent with real-time events
   * Returns an async iterator of streaming events
   * Supports full agentic loop with tool calling
   * @throws Error if agent has been destroyed
   */
  async *stream(input: string | InputItem[]): AsyncIterableIterator<StreamEvent> {
    assertNotDestroyed(this, 'stream from agent');

    // Get tool definitions for the LLM
    const tools = this.config.tools?.map((t) => t.definition) || [];

    const loopConfig: AgenticLoopConfig = {
      model: this.config.model,
      input,
      instructions: this.config.instructions,
      tools,
      temperature: this.config.temperature,
      maxIterations: this.config.maxIterations || 10,
      hooks: this.config.hooks,
      historyMode: this.config.historyMode,
      limits: this.config.limits,
      errorHandling: this.config.errorHandling,
    };

    // Stream from agentic loop with full tool support
    yield* this.agenticLoop.executeStreaming(loopConfig);
  }

  /**
   * Add a tool to the agent
   */
  addTool(tool: ToolFunction): void {
    this.toolRegistry.registerTool(tool);
    if (!this.config.tools) {
      this.config.tools = [];
    }
    this.config.tools.push(tool);
  }

  /**
   * Remove a tool from the agent
   */
  removeTool(toolName: string): void {
    this.toolRegistry.unregisterTool(toolName);
    if (this.config.tools) {
      this.config.tools = this.config.tools.filter(
        (t) => t.definition.function.name !== toolName
      );
    }
  }

  /**
   * List registered tools
   */
  listTools(): string[] {
    return this.toolRegistry.listTools();
  }

  // ==================== NEW: Control Methods ====================

  /**
   * Pause execution
   */
  pause(reason?: string): void {
    this.agenticLoop.pause(reason);
  }

  /**
   * Resume execution
   */
  resume(): void {
    this.agenticLoop.resume();
  }

  /**
   * Cancel execution
   */
  cancel(reason?: string): void {
    this.agenticLoop.cancel(reason);
  }

  // ==================== NEW: Introspection Methods ====================

  /**
   * Get current execution context
   */
  getContext(): ExecutionContext | null {
    return this.agenticLoop.getContext();
  }

  /**
   * Get execution metrics
   */
  getMetrics() {
    const context = this.agenticLoop.getContext();
    return context?.metrics || null;
  }

  /**
   * Get execution summary
   */
  getSummary() {
    const context = this.agenticLoop.getContext();
    return context?.getSummary() || null;
  }

  /**
   * Get audit trail
   */
  getAuditTrail() {
    const context = this.agenticLoop.getContext();
    return context?.getAuditTrail() || [];
  }

  /**
   * Check if currently running
   */
  isRunning(): boolean {
    return this.agenticLoop.isRunning();
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.agenticLoop.isPaused();
  }

  /**
   * Check if cancelled
   */
  isCancelled(): boolean {
    return this.agenticLoop.isCancelled();
  }

  // ==================== NEW: Cleanup ====================

  /**
   * Register cleanup callback
   */
  onCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Destroy agent and cleanup resources
   * Safe to call multiple times (idempotent)
   */
  destroy(): void {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;

    // Cancel any ongoing execution
    try {
      this.agenticLoop.cancel('Agent destroyed');
    } catch {
      // Ignore errors during cancel
    }

    // Remove specifically tracked event forwarding listeners from AgenticLoop
    for (const [eventName, handler] of this.boundListeners) {
      this.agenticLoop.off(eventName, handler);
    }
    this.boundListeners.clear();

    // Remove all event listeners from this Agent
    this.removeAllListeners();

    // Run custom cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('Cleanup callback error:', error);
      }
    }
    this.cleanupCallbacks = [];
  }
}
