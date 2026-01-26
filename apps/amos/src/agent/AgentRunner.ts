/**
 * AgentRunner - Wrapper around UniversalAgent for AMOS
 *
 * Provides a simplified interface for the app to interact with the agent.
 */

import {
  UniversalAgent,
  FileSessionStorage,
  type ToolFunction,
  type UniversalAgentConfig,
  type AgentPermissionsConfig,
  type PermissionCheckContext,
  type ApprovalDecision,
} from '@oneringai/agents';
import type {
  IAgentRunner,
  AgentResponse,
  StreamEvent,
  AmosConfig,
  TokenUsage,
  ToolApprovalContext,
} from '../config/types.js';

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
  private _pendingApprovalResolve: ((decision: ApprovalDecision) => void) | null = null;
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

    // If we have a session to resume, use resume method
    if (this.config.session.activeSessionId && sessionConfig) {
      try {
        // Build permissions config for resume
        const resumePermissionsConfig: AgentPermissionsConfig = {
          defaultScope: this.config.permissions.defaultScope,
          defaultRiskLevel: this.config.permissions.defaultRiskLevel,
          allowlist: this.config.permissions.allowlist,
          blocklist: this.config.permissions.blocklist,
          tools: this.config.permissions.toolOverrides,
          onApprovalRequired: this.config.permissions.promptForApproval
            ? async (context: PermissionCheckContext): Promise<ApprovalDecision> => {
                if (this._onApprovalRequired) {
                  return this._onApprovalRequired({
                    toolName: context.toolCall.function.name,
                    args: context.toolCall.function.arguments,
                    riskLevel: context.config?.riskLevel,
                    reason: context.config?.approvalMessage || 'Tool requires approval',
                  });
                }
                return { approved: true, scope: 'session' };
              }
            : undefined,
        };

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
            permissions: resumePermissionsConfig,
          }
        );
        return;
      } catch {
        // Session might not exist, create new agent
      }
    }

    // Build permissions config from app config
    const permissionsConfig: AgentPermissionsConfig = {
      defaultScope: this.config.permissions.defaultScope,
      defaultRiskLevel: this.config.permissions.defaultRiskLevel,
      allowlist: this.config.permissions.allowlist,
      blocklist: this.config.permissions.blocklist,
      tools: this.config.permissions.toolOverrides,
      onApprovalRequired: this.config.permissions.promptForApproval
        ? async (context: PermissionCheckContext): Promise<ApprovalDecision> => {
            // If we have an approval handler set, use it
            if (this._onApprovalRequired) {
              return this._onApprovalRequired({
                toolName: context.toolCall.function.name,
                args: context.toolCall.function.arguments,
                riskLevel: context.config?.riskLevel,
                reason: context.config?.approvalMessage || 'Tool requires approval',
              });
            }
            // Default: approve with session scope
            return { approved: true, scope: 'session' };
          }
        : undefined,
    };

    // Create new agent
    const agentConfig: UniversalAgentConfig = {
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
    };

    this.agent = UniversalAgent.create(agentConfig);
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
  getMode(): 'interactive' | 'planning' | 'executing' {
    return this.agent?.getMode() ?? 'interactive';
  }

  /**
   * Get current plan
   */
  getPlan(): unknown {
    return this.agent?.getPlan() ?? null;
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

  /**
   * Format response from UniversalAgent
   */
  private formatResponse(response: any, duration: number): AgentResponse {
    const usage: TokenUsage | undefined = response.usage
      ? {
          inputTokens: response.usage.inputTokens || response.usage.input_tokens || 0,
          outputTokens: response.usage.outputTokens || response.usage.output_tokens || 0,
          totalTokens: (response.usage.inputTokens || response.usage.input_tokens || 0) +
                       (response.usage.outputTokens || response.usage.output_tokens || 0),
        }
      : undefined;

    return {
      text: response.text || response.output_text || '',
      mode: response.mode || 'interactive',
      plan: response.plan
        ? {
            goal: response.plan.goal,
            tasks: response.plan.tasks?.map((t: any) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              status: t.status,
              result: t.result,
            })) || [],
            approved: response.plan.approved ?? false,
          }
        : undefined,
      taskProgress: response.taskProgress,
      usage,
      duration,
      needsUserAction: response.needsUserAction,
    };
  }

  /**
   * Map stream event from UniversalAgent
   */
  private mapStreamEvent(event: any): StreamEvent {
    // Map UniversalAgent events to our StreamEvent type
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
          plan: event.plan
            ? {
                goal: event.plan.goal,
                tasks: event.plan.tasks?.map((t: any) => ({
                  id: t.id,
                  name: t.name,
                  description: t.description,
                  status: t.status,
                })) || [],
                approved: false,
              }
            : undefined,
        };

      case 'plan:approved':
        return { type: 'plan:approved' };

      case 'task:started':
        return {
          type: 'task:started',
          task: event.task
            ? {
                id: event.task.id,
                name: event.task.name,
                description: event.task.description,
                status: 'in_progress',
              }
            : undefined,
        };

      case 'task:completed':
        return {
          type: 'task:completed',
          task: event.task
            ? {
                id: event.task.id,
                name: event.task.name,
                description: event.task.description,
                status: 'completed',
                result: event.result,
              }
            : undefined,
        };

      case 'task:failed':
        return {
          type: 'task:failed',
          task: event.task
            ? {
                id: event.task.id,
                name: event.task.name,
                description: event.task.description,
                status: 'failed',
              }
            : undefined,
          error: event.error,
        };

      case 'tool:start':
        return {
          type: 'tool:start',
          tool: { name: event.name || event.tool?.name, args: event.args },
        };

      case 'tool:complete':
        return {
          type: 'tool:complete',
          tool: {
            name: event.name || event.tool?.name,
            result: event.result,
          },
        };

      case 'error':
        return { type: 'error', error: event.error };

      case 'done':
        return { type: 'done', usage: event.usage };

      default:
        return { type: event.type, ...event };
    }
  }
}
