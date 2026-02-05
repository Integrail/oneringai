/**
 * AgentRunner - Wrapper around UniversalAgent for AMOS
 *
 * Provides a simplified interface for the app to interact with the agent.
 *
 * Phase 1 Improvements:
 * - Extracted permission config building to permissionUtils.ts (DRY)
 * - Added proper types from library (UniversalResponse, UniversalEvent)
 * - Type-safe response and event mapping
 */

import {
  UniversalAgent,
  FileSessionStorage,
  type ToolFunction,
  type ApprovalDecision,
  type UniversalResponse,
  type UniversalEvent,
  type AgentMode,
  type UniversalAgentContextAccess,
} from '@everworker/oneringai';
import type {
  IAgentRunner,
  AgentResponse,
  StreamEvent,
  AmosConfig,
  TokenUsage,
  ToolApprovalContext,
  TaskInfo,
  ContextMetrics,
  HistoryEntry,
  ContextBudgetInfo,
  ContextBreakdownInfo,
  CacheStatsInfo,
  MemoryEntryInfo,
} from '../config/types.js';
import { buildPermissionsConfig } from './permissionUtils.js';

export class AgentRunner implements IAgentRunner {
  private agent: UniversalAgent | null = null;
  private config: AmosConfig;
  private tools: ToolFunction[];
  private sessionDir: string;
  private _isRunning: boolean = false;
  private _currentModel: string;
  private _currentTemperature: number;
  private _connectorName: string = '';
  private _instructions: string | null = null;

  // For interactive tool approval
  private _onApprovalRequired: ((context: ToolApprovalContext) => Promise<ApprovalDecision>) | null = null;

  constructor(
    config: AmosConfig,
    tools: ToolFunction[],
    sessionDir: string = './data/sessions'
  ) {
    this.config = config;
    this.tools = tools;
    this.sessionDir = sessionDir;
    this._currentModel = config.activeModel || config.defaults.model;
    this._currentTemperature = config.defaults.temperature;
  }

  /**
   * Set the system instructions (from prompt template)
   */
  setInstructions(instructions: string | null): void {
    this._instructions = instructions;
    // Note: Instruction changes require agent recreation
  }

  /**
   * Get the current instructions
   */
  getInstructions(): string | null {
    return this._instructions;
  }

  /**
   * Initialize the agent
   */
  async initialize(connectorName: string, model: string): Promise<void> {
    // Destroy existing agent if any
    if (this.agent) {
      this.agent.destroy();
    }

    this._connectorName = connectorName;
    this._currentModel = model;

    const sessionConfig = this.config.session.autoSave
      ? {
          storage: new FileSessionStorage({ directory: this.sessionDir }),
          autoSave: true,
          autoSaveIntervalMs: this.config.session.autoSaveIntervalMs,
        }
      : undefined;

    // Build permissions config using shared utility (DRY - Phase 1.1)
    const permissionsConfig = buildPermissionsConfig(this.config, this._onApprovalRequired ?? undefined);

    // If we have a session to resume, use resume method
    if (this.config.session.activeSessionId && sessionConfig) {
      try {
        this.agent = await UniversalAgent.resume(
          this.config.session.activeSessionId,
          {
            connector: connectorName,
            model: model,
            tools: this.tools,
            temperature: this._currentTemperature,
            instructions: this._instructions || undefined,
            planning: {
              enabled: this.config.planning.enabled,
              autoDetect: this.config.planning.autoDetect,
              requireApproval: this.config.planning.requireApproval,
            },
            session: sessionConfig,
            permissions: permissionsConfig,
          }
        );
        return;
      } catch {
        // Session might not exist, create new agent
      }
    }

    // Create new agent with shared permissions config
    this.agent = UniversalAgent.create({
      connector: connectorName,
      model: model,
      tools: this.tools,
      temperature: this._currentTemperature,
      instructions: this._instructions || undefined,
      planning: {
        enabled: this.config.planning.enabled,
        autoDetect: this.config.planning.autoDetect,
        requireApproval: this.config.planning.requireApproval,
      },
      session: sessionConfig,
      permissions: permissionsConfig,
    });
  }

  /**
   * Check if agent is ready
   */
  isReady(): boolean {
    return this.agent !== null;
  }

  /**
   * Check if agent is running
   */
  isRunning(): boolean {
    return this._isRunning || (this.agent?.isRunning() ?? false);
  }

  /**
   * Check if agent is paused
   */
  isPaused(): boolean {
    return this.agent?.isPaused() ?? false;
  }

  /**
   * Run a single interaction
   */
  async run(input: string): Promise<AgentResponse> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    this._isRunning = true;

    try {
      const startTime = Date.now();
      const response = await this.agent.chat(input);
      const duration = Date.now() - startTime;

      return this.formatResponse(response, duration);
    } finally {
      this._isRunning = false;
    }
  }

  /**
   * Stream a response
   */
  async *stream(input: string): AsyncGenerator<StreamEvent> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    this._isRunning = true;

    try {
      for await (const event of this.agent.stream(input)) {
        yield this.mapStreamEvent(event);
      }
    } finally {
      this._isRunning = false;
    }
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.agent?.pause();
  }

  /**
   * Resume execution
   */
  resume(): void {
    this.agent?.resume();
  }

  /**
   * Cancel execution
   */
  cancel(): void {
    this.agent?.cancel();
    this._isRunning = false;
  }

  /**
   * Set the model - requires agent recreation
   */
  setModel(model: string): void {
    this._currentModel = model;
    // Note: Model change requires agent recreation
    // The app should call createAgent() after changing model
  }

  /**
   * Get the current model
   */
  getModel(): string {
    return this._currentModel;
  }

  /**
   * Set temperature - requires agent recreation
   */
  setTemperature(temp: number): void {
    this._currentTemperature = temp;
    // Note: Temperature change requires agent recreation
  }

  /**
   * Get temperature
   */
  getTemperature(): number {
    return this._currentTemperature;
  }

  /**
   * Set planning enabled
   */
  setPlanningEnabled(enabled: boolean): void {
    if (this.agent) {
      this.agent.setPlanningEnabled(enabled);
    }
  }

  /**
   * Set auto approval
   */
  setAutoApproval(enabled: boolean): void {
    if (this.agent) {
      this.agent.setAutoApproval(enabled);
    }
  }

  /**
   * Save session
   */
  async saveSession(): Promise<string> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    await this.agent.saveSession();

    // Return session ID
    return this.agent.getSessionId() ?? 'unknown';
  }

  /**
   * Load session - requires agent recreation
   */
  async loadSession(sessionId: string): Promise<void> {
    // We need to recreate the agent with the session ID
    // Store the session ID in config and reinitialize
    this.config.session.activeSessionId = sessionId;
    await this.initialize(this._connectorName, this._currentModel);
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.agent?.getSessionId() ?? null;
  }

  /**
   * Update tools - requires agent recreation
   */
  updateTools(tools: ToolFunction[]): void {
    this.tools = tools;
    // Note: Tool changes require agent recreation
  }

  /**
   * Get current mode
   */
  getMode(): AgentMode {
    return this.agent?.getMode() ?? 'interactive';
  }

  /**
   * Get current plan
   */
  getPlan(): unknown {
    return this.agent?.getPlan() ?? null;
  }

  /**
   * Get context access (Phase 2 - provides access to UniversalAgent's context)
   */
  getContext(): UniversalAgentContextAccess | null {
    return this.agent?.context ?? null;
  }

  /**
   * Get context metrics (Phase 2 - unified metrics from context)
   *
   * Returns metrics including:
   * - History message count
   * - Memory statistics
   * - Current mode
   * - Plan status
   */
  async getContextMetrics(): Promise<ContextMetrics | null> {
    const context = this.agent?.context;
    if (!context) {
      return null;
    }

    try {
      const metrics = await context.getMetrics();
      return {
        historyMessageCount: metrics.historyMessageCount,
        memoryStats: metrics.memoryStats,
        mode: metrics.mode,
        hasPlan: metrics.hasPlan,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get conversation history (Phase 2 - access to history via context)
   *
   * @param count - Number of recent messages to return (default: all)
   * @returns Array of history entries
   */
  async getConversationHistory(count?: number): Promise<HistoryEntry[]> {
    const context = this.agent?.context;
    if (!context) {
      return [];
    }

    try {
      const history = context.history;
      // Note: IHistoryManager methods are async
      const messages = count
        ? await history.getRecentMessages(count)
        : await history.getMessages();

      return messages.map((msg) => ({
        id: msg.id || `msg-${Date.now()}`,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      }));
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Context Inspection (Phase 3 - detailed context inspection)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get detailed context budget information
   *
   * Uses the context builder to calculate current token usage and budget.
   *
   * @returns Context budget info or null if not available
   */
  async getContextBudget(): Promise<ContextBudgetInfo | null> {
    const context = this.agent?.context;
    if (!context) {
      return null;
    }

    try {
      const contextBuilder = context.contextBuilder;
      const config = contextBuilder.getConfig();

      // Build context to get current usage
      const built = await contextBuilder.build('', {});

      const total = config.maxTokens ?? 128000;
      const responseReserve = config.responseReserve ?? 0.15;
      const reserved = Math.floor(total * responseReserve);
      const used = built.estimatedTokens;
      const available = total - reserved - used;

      // Calculate utilization percentage (relative to available budget after reserve)
      const availableBudget = total - reserved;
      const utilizationPercent = availableBudget > 0
        ? (used / availableBudget) * 100
        : 0;

      // Determine status
      const utilizationRatio = (used + reserved) / total;
      let status: 'ok' | 'warning' | 'critical';
      if (utilizationRatio >= 0.9) {
        status = 'critical';
      } else if (utilizationRatio >= 0.75) {
        status = 'warning';
      } else {
        status = 'ok';
      }

      return {
        total,
        reserved,
        used,
        available: Math.max(0, available),
        utilizationPercent,
        status,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get detailed token breakdown by component
   *
   * @returns Component breakdown or null if not available
   */
  async getContextBreakdown(): Promise<ContextBreakdownInfo | null> {
    const context = this.agent?.context;
    if (!context) {
      return null;
    }

    try {
      const contextBuilder = context.contextBuilder;

      // Build context to get token breakdown
      const built = await contextBuilder.build('', {});

      const totalUsed = built.estimatedTokens;
      const components: ContextBreakdownInfo['components'] = [];

      for (const [name, tokens] of Object.entries(built.tokenBreakdown)) {
        const percent = totalUsed > 0 ? (tokens / totalUsed) * 100 : 0;
        components.push({
          name,
          tokens,
          percent,
        });
      }

      // Sort by tokens descending
      components.sort((a, b) => b.tokens - a.tokens);

      return {
        totalUsed,
        components,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get cache statistics
   *
   * Note: UniversalAgent does not expose IdempotencyCache through context.
   * This returns null as cache stats are not available for this agent type.
   *
   * @returns Cache stats or null if not available
   */
  async getCacheStats(): Promise<CacheStatsInfo | null> {
    // UniversalAgent doesn't expose cache through context
    // Cache is used internally by TaskAgent but not exposed here
    return null;
  }

  /**
   * Get all memory entries
   *
   * @returns Array of memory entry information
   */
  async getMemoryEntries(): Promise<MemoryEntryInfo[]> {
    const context = this.agent?.context;
    if (!context) {
      return [];
    }

    try {
      const memory = context.memory;
      const index = await memory.getIndex();

      return index.entries.map((entry) => {
        // Format scope as string
        let scopeStr: string;
        if (typeof entry.scope === 'string') {
          scopeStr = entry.scope;
        } else if (entry.scope && typeof entry.scope === 'object' && 'type' in entry.scope) {
          const s = entry.scope as { type: string; taskIds?: string[] };
          if (s.type === 'task' && s.taskIds) {
            scopeStr = `task (${s.taskIds.length} tasks)`;
          } else {
            scopeStr = s.type;
          }
        } else {
          scopeStr = 'session';
        }

        // Parse size string to bytes (e.g., "1.5 KB" -> 1536)
        let sizeBytes = 0;
        const sizeMatch = entry.size.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
        if (sizeMatch) {
          const value = parseFloat(sizeMatch[1]);
          const unit = sizeMatch[2].toUpperCase();
          const multipliers: Record<string, number> = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
          sizeBytes = Math.round(value * (multipliers[unit] || 1));
        }

        return {
          key: entry.key,
          description: entry.description,
          sizeBytes,
          scope: scopeStr,
          priority: entry.effectivePriority,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Destroy the agent
   */
  destroy(): void {
    if (this.agent) {
      this.agent.destroy();
      this.agent = null;
    }
    this._isRunning = false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Permission Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set the callback for interactive tool approval
   */
  setApprovalHandler(
    handler: ((context: ToolApprovalContext) => Promise<ApprovalDecision>) | null
  ): void {
    this._onApprovalRequired = handler;
  }

  /**
   * Approve a tool for the current session
   */
  approveToolForSession(toolName: string): void {
    if (this.agent) {
      this.agent.permissions.approveForSession(toolName);
    }
  }

  /**
   * Revoke a tool's approval
   */
  revokeToolApproval(toolName: string): void {
    if (this.agent) {
      this.agent.permissions.revoke(toolName);
    }
  }

  /**
   * Add a tool to the allowlist (always allowed)
   */
  allowlistTool(toolName: string): void {
    if (this.agent) {
      this.agent.permissions.allowlistAdd(toolName);
    }
  }

  /**
   * Add a tool to the blocklist (always blocked)
   */
  blocklistTool(toolName: string): void {
    if (this.agent) {
      this.agent.permissions.blocklistAdd(toolName);
    }
  }

  /**
   * Remove a tool from the allowlist
   */
  removeFromAllowlist(toolName: string): void {
    if (this.agent) {
      this.agent.permissions.allowlistRemove(toolName);
    }
  }

  /**
   * Remove a tool from the blocklist
   */
  removeFromBlocklist(toolName: string): void {
    if (this.agent) {
      this.agent.permissions.blocklistRemove(toolName);
    }
  }

  /**
   * Get all tools that have been approved for this session
   */
  getApprovedTools(): string[] {
    return this.agent?.permissions.getApprovedTools() ?? [];
  }

  /**
   * Get the current allowlist
   */
  getAllowlist(): string[] {
    return this.agent?.permissions.getAllowlist() ?? [];
  }

  /**
   * Get the current blocklist
   */
  getBlocklist(): string[] {
    return this.agent?.permissions.getBlocklist() ?? [];
  }

  /**
   * Check if a tool needs approval
   */
  toolNeedsApproval(toolName: string): boolean {
    return this.agent?.permissions.checkPermission(toolName).needsApproval ?? false;
  }

  /**
   * Check if a tool is blocked
   */
  toolIsBlocked(toolName: string): boolean {
    return this.agent?.permissions.isBlocked(toolName) ?? false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Response & Event Mapping (Phase 1.2 - Type-safe)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Format response from UniversalAgent
   * Now properly typed with UniversalResponse
   */
  private formatResponse(response: UniversalResponse, duration: number): AgentResponse {
    const usage: TokenUsage | undefined = response.usage
      ? {
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          totalTokens: response.usage.totalTokens,
        }
      : undefined;

    return {
      text: response.text,
      mode: response.mode,
      plan: response.plan
        ? {
            goal: response.plan.goal,
            tasks: response.plan.tasks?.map((t) => this.mapTask(t)) || [],
            approved: response.planStatus === 'approved' || response.planStatus === 'executing' || response.planStatus === 'completed',
          }
        : undefined,
      taskProgress: response.taskProgress
        ? {
            current: response.taskProgress.completed,
            total: response.taskProgress.total,
            currentTask: response.taskProgress.current ? this.mapTask(response.taskProgress.current) : undefined,
          }
        : undefined,
      usage,
      duration,
      needsUserAction: response.needsUserAction,
    };
  }

  /**
   * Map a Task from the library to TaskInfo for AMOS
   */
  private mapTask(task: { id: string; name: string; description?: string; status: string; result?: unknown }): TaskInfo {
    return {
      id: task.id,
      name: task.name,
      description: task.description || '',
      status: task.status as TaskInfo['status'],
      result: task.result ? String(task.result) : undefined,
    };
  }

  /**
   * Map stream event from UniversalAgent
   * Now properly typed with UniversalEvent discriminated union
   */
  private mapStreamEvent(event: UniversalEvent): StreamEvent {
    switch (event.type) {
      case 'text:delta':
        return { type: 'text:delta', delta: event.delta };

      case 'text:done':
        return { type: 'text:done', text: event.text };

      case 'mode:changed':
        return {
          type: 'mode:changed',
          fromMode: event.from,
          toMode: event.to,
          mode: event.to,
        };

      case 'plan:created':
        return {
          type: 'plan:created',
          plan: {
            goal: event.plan.goal,
            tasks: event.plan.tasks?.map((t) => this.mapTask(t)) || [],
            approved: false,
          },
        };

      case 'plan:approved':
        return { type: 'plan:approved' };

      case 'task:started':
        return {
          type: 'task:started',
          task: this.mapTask(event.task),
        };

      case 'task:completed':
        return {
          type: 'task:completed',
          task: {
            ...this.mapTask(event.task),
            status: 'completed',
            result: event.result ? String(event.result) : undefined,
          },
        };

      case 'task:failed':
        return {
          type: 'task:failed',
          task: {
            ...this.mapTask(event.task),
            status: 'failed',
          },
          error: new Error(event.error),
        };

      case 'tool:start':
        return {
          type: 'tool:start',
          tool: { name: event.name, args: event.args },
        };

      case 'tool:complete':
        return {
          type: 'tool:complete',
          tool: { name: event.name, result: event.result },
        };

      case 'tool:error':
        return {
          type: 'error',
          error: new Error(event.error),
        };

      case 'error':
        return {
          type: 'error',
          error: new Error(event.error),
        };

      case 'execution:done':
        return {
          type: 'done',
          usage: undefined, // ExecutionResult doesn't include usage
        };

      // Handle other events that AMOS doesn't need to process specially
      case 'plan:analyzing':
      case 'plan:modified':
      case 'plan:awaiting_approval':
      case 'plan:rejected':
      case 'task:progress':
      case 'task:skipped':
      case 'execution:paused':
      case 'execution:resumed':
      case 'needs:approval':
      case 'needs:input':
      case 'needs:clarification':
        // Pass through with type for extensibility
        return { type: event.type as StreamEvent['type'] };

      default:
        // Exhaustive check - should never reach here with proper typing
        return { type: 'done' };
    }
  }
}
