/**
 * UniversalAgent - Unified agent combining interactive, planning, and task execution
 *
 * Extends BaseAgent to inherit:
 * - Connector resolution
 * - Tool manager initialization
 * - Permission manager initialization
 * - Session management
 * - Lifecycle/cleanup
 *
 * Features:
 * - Mode-fluid: Automatically switches between interactive, planning, and executing
 * - User intervention: Users can interrupt, modify plans, provide feedback
 * - Smart detection: Auto-detects complex tasks that need planning
 * - Session persistence: Save and resume conversations
 * - Dynamic tools: Enable/disable tools at runtime
 */

import { BaseAgent, BaseAgentConfig, BaseSessionConfig } from '../../core/BaseAgent.js';
import { Agent } from '../../core/Agent.js';
import { Plan, Task, createPlan, createTask, TaskInput } from '../../domain/entities/Task.js';
import { StreamEventType } from '../../domain/entities/StreamEvent.js';
import type { WorkingMemoryConfig } from '../../domain/entities/Memory.js';
// InMemoryStorage no longer needed - memory is managed by inherited AgentContext
import { PlanningAgent } from '../taskAgent/PlanningAgent.js';
import { ModeManager } from './ModeManager.js';
import { getMetaTools, isMetaTool, META_TOOL_NAMES } from './metaTools.js';
// AgentContext is inherited from BaseAgent, import only for type reference if needed
import type { AgentContextConfig } from '../../core/AgentContext.js';
import { PlanPlugin } from '../../core/context/plugins/PlanPlugin.js';
import { MemoryPlugin } from '../../core/context/plugins/MemoryPlugin.js';
import type { AgentPermissionsConfig } from '../../core/permissions/types.js';
import type {
  UniversalResponse,
  UniversalEvent,
  AgentMode,
  TaskProgress,
  IntentAnalysis,
  PlanChange,
  ExecutionResult,
} from './types.js';

// NOTE: UniversalAgent now exposes AgentContext directly via the `context` getter.
// No separate interface needed - AgentContext is the unified API.

// ============================================================================
// Configuration
// ============================================================================

/**
 * Session configuration for UniversalAgent - extends BaseSessionConfig
 */
export interface UniversalAgentSessionConfig extends BaseSessionConfig {
  // UniversalAgent-specific session options can be added here
}

/**
 * Planning configuration
 */
export interface UniversalAgentPlanningConfig {
  /** Whether planning is enabled (default: true) */
  enabled?: boolean;
  /** Whether to auto-detect complex tasks (default: true) */
  autoDetect?: boolean;
  /** Model to use for planning (defaults to agent model) */
  model?: string;
  /** Whether approval is required (default: true) */
  requireApproval?: boolean;
}

/**
 * UniversalAgent configuration - extends BaseAgentConfig
 */
export interface UniversalAgentConfig extends BaseAgentConfig {
  /** System instructions for the agent */
  instructions?: string;

  /** Temperature for generation */
  temperature?: number;

  /** Maximum iterations for tool calling loop */
  maxIterations?: number;

  /** Planning configuration */
  planning?: UniversalAgentPlanningConfig;

  /** Memory configuration */
  memoryConfig?: WorkingMemoryConfig;

  /** Session configuration - extends base type */
  session?: UniversalAgentSessionConfig;

  /** Permission configuration for tool execution approval */
  permissions?: AgentPermissionsConfig;

  /** AgentContext configuration (optional) */
  context?: Partial<AgentContextConfig>;
}

// ============================================================================
// Events
// ============================================================================

export interface UniversalAgentEvents {
  'mode:changed': { from: AgentMode; to: AgentMode; reason: string };
  'plan:created': { plan: Plan };
  'plan:modified': { plan: Plan; changes: PlanChange[] };
  'plan:approved': { plan: Plan };
  'task:started': { task: Task };
  'task:completed': { task: Task; result: unknown };
  'task:failed': { task: Task; error: string };
  'execution:completed': { result: ExecutionResult };
  'error': { error: Error; recoverable: boolean };
  // Inherited from BaseAgentEvents
  'session:saved': { sessionId: string };
  'session:loaded': { sessionId: string };
  destroyed: void;
}

// ============================================================================
// UniversalAgent Class
// ============================================================================

export class UniversalAgent extends BaseAgent<UniversalAgentConfig, UniversalAgentEvents> {
  // Core components
  private agent: Agent;                    // Interactive agent (with meta-tools)
  private executionAgent?: Agent;           // Execution agent (without meta-tools) - created on demand
  private modeManager: ModeManager;
  private planningAgent?: PlanningAgent;

  // Plugins for inherited AgentContext (from BaseAgent)
  // Note: _agentContext is inherited from BaseAgent (single source of truth)
  private _planPlugin: PlanPlugin;
  private _memoryPlugin?: MemoryPlugin;

  // Execution state
  private currentPlan: Plan | null = null;
  private executionHistory: Array<{ input: string; response: UniversalResponse; timestamp: Date }> = [];

  // ============================================================================
  // Static Factory
  // ============================================================================

  /**
   * Create a new UniversalAgent
   */
  static create(config: UniversalAgentConfig): UniversalAgent {
    return new UniversalAgent(config);
  }

  /**
   * Resume an agent from a saved session
   */
  static async resume(
    sessionId: string,
    config: Omit<UniversalAgentConfig, 'session'> & { session: { storage: import('../../domain/interfaces/IContextStorage.js').IContextStorage } }
  ): Promise<UniversalAgent> {
    const agent = new UniversalAgent({
      ...config,
      session: {
        ...config.session,
        id: sessionId,
      },
    });

    // Wait for session to load
    await agent.ensureSessionLoaded();

    // Restore currentPlan from modeManager after session loads
    // (modeManager state is restored via plugin during session load)
    const pendingPlan = agent.modeManager.getPendingPlan();
    if (pendingPlan) {
      agent.currentPlan = pendingPlan;
    }

    return agent;
  }

  // ============================================================================
  // Constructor
  // ============================================================================

  private constructor(config: UniversalAgentConfig) {
    // Call BaseAgent constructor - handles connector, tool manager (via AgentContext), permission manager init
    super(config, 'UniversalAgent');

    // Register meta-tools for mode transitions (user tools already registered by BaseAgent)
    const metaTools = getMetaTools();
    for (const tool of metaTools) {
      this._agentContext.tools.register(tool, { namespace: '_meta' });
    }

    // Set system prompt on inherited AgentContext
    this._agentContext.systemPrompt = this.buildInstructions(config.instructions);

    // Create base agent for LLM calls (shares inherited AgentContext)
    const allTools = this._agentContext.tools.getEnabled();
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: allTools,
      instructions: this.buildInstructions(config.instructions),
      temperature: config.temperature,
      maxIterations: config.maxIterations ?? 20,
      permissions: config.permissions,
      context: this._agentContext,  // Share inherited AgentContext
    });

    // Initialize mode manager
    this.modeManager = new ModeManager('interactive');
    this.modeManager.on('mode:changed', (data) => {
      this.emit('mode:changed', data);
    });

    // Note: ModeManager state is persisted via getContextState()/restoreContextState() overrides,
    // not as a plugin. ModeManager is agent-level state, not context (it doesn't contribute to LLM prompt).

    // Initialize planning agent if planning is enabled
    const planningEnabled = config.planning?.enabled !== false;
    if (planningEnabled) {
      this.planningAgent = PlanningAgent.create({
        connector: config.connector,
        model: config.planning?.model ?? config.model,
        availableTools: this._agentContext.tools.getEnabled().filter(t => !isMetaTool(t.definition.function.name)),
      });
    }

    // Create execution agent (without meta-tools) for task execution
    this.executionAgent = this.createExecutionAgent();

    // Register PlanPlugin with inherited AgentContext
    this._planPlugin = new PlanPlugin();
    this._agentContext.registerPlugin(this._planPlugin);

    // Only create MemoryPlugin if memory feature is enabled
    if (this._agentContext.memory) {
      this._memoryPlugin = new MemoryPlugin(this._agentContext.memory);
      this._agentContext.registerPlugin(this._memoryPlugin);
    }

    // Initialize session (from BaseAgent)
    this.initializeSession(config.session);
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent' {
    return 'universal-agent';
  }

  // ============================================================================
  // Session State Overrides (Agent-Level State)
  // ============================================================================

  /**
   * Override to include ModeManager state in agentState field.
   * ModeManager is agent-level state, not a context plugin.
   */
  async getContextState(): Promise<import('../../core/AgentContext.js').SerializedAgentContextState> {
    const state = await super.getContextState();
    state.agentState = state.agentState || {};
    state.agentState.modeManager = this.modeManager.serialize();
    return state;
  }

  /**
   * Override to restore ModeManager state from agentState field.
   */
  async restoreContextState(state: import('../../core/AgentContext.js').SerializedAgentContextState): Promise<void> {
    await super.restoreContextState(state);
    if (state.agentState?.modeManager) {
      this.modeManager.restore(state.agentState.modeManager as ReturnType<ModeManager['serialize']>);
    }
  }

  // ============================================================================
  // Main API
  // ============================================================================

  /**
   * Chat with the agent - the main entry point
   */
  async chat(input: string): Promise<UniversalResponse> {
    if (this._isDestroyed) {
      throw new Error('Agent has been destroyed');
    }

    // Analyze user intent
    const intent = await this.analyzeIntent(input);

    // Handle based on current mode and intent
    let response: UniversalResponse;

    switch (this.modeManager.getMode()) {
      case 'interactive':
        response = await this.handleInteractive(input, intent);
        break;
      case 'planning':
        response = await this.handlePlanning(input, intent);
        break;
      case 'executing':
        response = await this.handleExecuting(input, intent);
        break;
      default:
        throw new Error(`Unknown mode: ${this.modeManager.getMode()}`);
    }

    // Record in history
    this.executionHistory.push({
      input,
      response,
      timestamp: new Date(),
    });

    // Auto-save session if enabled
    if (this._config.session?.autoSave && this.hasSession()) {
      await this.saveSession().catch(() => {
        // Ignore auto-save errors
      });
    }

    return response;
  }

  /**
   * Stream chat response
   */
  async *stream(input: string): AsyncIterableIterator<UniversalEvent> {
    if (this._isDestroyed) {
      throw new Error('Agent has been destroyed');
    }

    // Analyze intent
    const intent = await this.analyzeIntent(input);

    // Check for mode transition
    const recommendedMode = this.modeManager.recommendMode(intent, this.currentPlan ?? undefined);
    if (recommendedMode && recommendedMode !== this.modeManager.getMode()) {
      const from = this.modeManager.getMode();
      this.modeManager.transition(recommendedMode, intent.type);
      yield { type: 'mode:changed', from, to: recommendedMode, reason: intent.type };
    }

    // Stream based on mode
    const mode = this.modeManager.getMode();

    if (mode === 'interactive') {
      yield* this.streamInteractive(input, intent);
    } else if (mode === 'planning') {
      yield* this.streamPlanning(input, intent);
    } else if (mode === 'executing') {
      yield* this.streamExecuting(intent);
    }
  }

  // ============================================================================
  // Mode Handlers
  // ============================================================================

  private async handleInteractive(input: string, intent: IntentAnalysis): Promise<UniversalResponse> {
    // Check if we should switch to planning
    const shouldPlan = this.shouldSwitchToPlanning(intent);

    if (shouldPlan) {
      // Add user input before entering planning (planning doesn't use agent.run)
      await this.addToConversationHistory('user', input);
      this.modeManager.enterPlanning('complex_task_detected');
      return this.handlePlanning(input, intent);
    }

    // Execute directly with agent - it handles adding messages to shared AgentContext
    // NOTE: Don't add user/assistant messages manually - agent.run() manages the
    // conversation via the shared AgentContext (adds user message, prepares context,
    // calls LLM, adds assistant response)
    const response = await this.agent.run(input);

    // Check if agent used _start_planning meta-tool
    const planningToolCall = response.output.find(
      (item: any) => item.type === 'tool_use' && item.name === META_TOOL_NAMES.START_PLANNING
    );

    if (planningToolCall) {
      this.modeManager.enterPlanning('agent_requested');
      const rawInput = (planningToolCall as any).input;
      const args = typeof rawInput === 'string' ? JSON.parse(rawInput || '{}') : (rawInput || {});
      return this.createPlan(args.goal, args.reasoning);
    }

    const responseText = response.output_text ?? '';

    return {
      text: responseText,
      mode: 'interactive',
      usage: response.usage ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  private async handlePlanning(input: string, intent: IntentAnalysis): Promise<UniversalResponse> {
    // Check if user is approving the plan
    if (intent.type === 'approval' && this.modeManager.getPendingPlan()) {
      return this.approvePlan(intent.feedback);
    }

    // Check if user is rejecting/modifying
    if (intent.type === 'rejection') {
      return this.handlePlanRejection(input, intent);
    }

    if (intent.type === 'plan_modify' && intent.modification) {
      return this.modifyPlan(intent.modification);
    }

    // Create new plan or refine existing
    if (!this.modeManager.getPendingPlan()) {
      return this.createPlan(input);
    } else {
      // Refine existing plan based on input
      return this.refinePlan(input);
    }
  }

  private async handleExecuting(input: string, intent: IntentAnalysis): Promise<UniversalResponse> {
    // Handle interrupts
    if (intent.type === 'interrupt') {
      this.modeManager.pauseExecution('user_interrupt');
      return {
        text: 'Execution paused. What would you like to do?',
        mode: 'executing',
        taskProgress: this.getTaskProgress(),
        needsUserAction: true,
        userActionType: 'provide_input',
      };
    }

    // Handle status queries inline
    if (intent.type === 'status_query') {
      return this.reportProgress();
    }

    // Handle plan modifications
    if (intent.type === 'plan_modify' && intent.modification) {
      // Pause, modify, resume
      this.modeManager.pauseExecution('plan_modification');
      const modifyResult = await this.modifyPlan(intent.modification);
      this.modeManager.resumeExecution();
      return modifyResult;
    }

    // Handle feedback - note it and continue
    if (intent.type === 'feedback') {
      // Only store feedback if memory feature is enabled
      if (this._agentContext.memory) {
        await this._agentContext.memory.store(
          `user_feedback_${Date.now()}`,
          'User feedback during execution',
          input,
          { scope: 'persistent' }
        );
      }
      return {
        text: "Noted. I'll keep that in mind as I continue.",
        mode: 'executing',
        taskProgress: this.getTaskProgress(),
      };
    }

    // If paused, resume with this input
    if (this.modeManager.isPaused()) {
      this.modeManager.resumeExecution();
      // Continue execution
      return this.continueExecution();
    }

    // Otherwise, handle as inline question
    const response = await this.agent.run(input);
    return {
      text: response.output_text ?? '',
      mode: 'executing',
      taskProgress: this.getTaskProgress(),
    };
  }

  // ============================================================================
  // Streaming Handlers
  // ============================================================================

  private async *streamInteractive(input: string, intent: IntentAnalysis): AsyncIterableIterator<UniversalEvent> {
    // Check if we should switch to planning
    if (this.shouldSwitchToPlanning(intent)) {
      // Add user input before entering planning (planning doesn't use agent.stream)
      await this.addToConversationHistory('user', input);
      const from = this.modeManager.getMode();
      this.modeManager.enterPlanning('complex_task_detected');
      yield { type: 'mode:changed', from, to: 'planning', reason: 'complex_task_detected' };
      yield* this.streamPlanning(input, intent);
      return;
    }

    // Stream from agent - it handles adding messages to shared AgentContext
    // NOTE: Don't add user/assistant messages manually - agent.stream() manages the
    // conversation via the shared AgentContext (adds user message, prepares context,
    // calls LLM, adds assistant response)
    let fullText = '';
    let planningToolArgs: { goal: string; reasoning?: string } | null = null;
    let currentToolName = '';

    for await (const event of this.agent.stream(input)) {
      if (event.type === StreamEventType.OUTPUT_TEXT_DELTA) {
        const delta = (event as any).delta || '';
        fullText += delta;
        yield { type: 'text:delta', delta };
      } else if (event.type === StreamEventType.TOOL_EXECUTION_START) {
        currentToolName = (event as any).tool_name || 'unknown';
        const args = (event as any).arguments || null;
        yield { type: 'tool:start', name: currentToolName, args };

        // Capture _start_planning args
        if (currentToolName === META_TOOL_NAMES.START_PLANNING && args) {
          planningToolArgs = typeof args === 'string' ? JSON.parse(args) : args;
        }
      } else if (event.type === StreamEventType.TOOL_EXECUTION_DONE) {
        yield { type: 'tool:complete', name: (event as any).tool_name || 'unknown', result: (event as any).result, durationMs: (event as any).execution_time_ms || 0 };
      }
    }

    // Check if agent called _start_planning - if so, transition to planning mode
    if (planningToolArgs) {
      this.modeManager.enterPlanning('agent_requested');
      yield { type: 'mode:changed', from: 'interactive', to: 'planning', reason: 'agent_requested' };

      // Create the actual plan
      const plan = await this.createPlanInternal(planningToolArgs.goal);
      this.modeManager.setPendingPlan(plan);
      this.currentPlan = plan;
      this._planPlugin.setPlan(plan);

      yield { type: 'plan:created', plan };

      if (this._config.planning?.requireApproval !== false) {
        yield { type: 'plan:awaiting_approval', plan };
        yield { type: 'needs:approval', plan };

        const summary = this.formatPlanSummary(plan);
        // Add plan summary to history (this is UniversalAgent-specific, not from LLM)
        await this.addToConversationHistory('assistant', summary);

        // Yield the plan summary as text so user sees it
        yield { type: 'text:delta', delta: '\n\n' + summary };
        yield { type: 'text:done', text: fullText + '\n\n' + summary };
      }
      return;
    }

    yield { type: 'text:done', text: fullText };
  }

  private async *streamPlanning(input: string, intent: IntentAnalysis): AsyncIterableIterator<UniversalEvent> {
    // Add user input to conversation history (if not already added by streamInteractive)
    if (intent.type !== 'approval') {
      await this.addToConversationHistory('user', input);
    }

    if (intent.type === 'approval' && this.modeManager.getPendingPlan()) {
      const plan = this.modeManager.getPendingPlan()!;
      this.modeManager.approvePlan();
      yield { type: 'plan:approved', plan };

      // Add plan approval to history
      await this.addToConversationHistory('assistant', `Plan approved. Starting execution of ${plan.tasks.length} tasks.`);

      // Transition to executing
      this.modeManager.enterExecuting(plan, 'plan_approved');
      yield { type: 'mode:changed', from: 'planning', to: 'executing', reason: 'plan_approved' };

      yield* this.streamExecution();
      return;
    }

    // Create plan
    yield { type: 'plan:analyzing', goal: input };

    const plan = await this.createPlanInternal(input);
    this.modeManager.setPendingPlan(plan);
    this.currentPlan = plan;
    this._planPlugin.setPlan(plan);

    yield { type: 'plan:created', plan };

    if (this._config.planning?.requireApproval !== false) {
      yield { type: 'plan:awaiting_approval', plan };
      yield { type: 'needs:approval', plan };

      const summary = this.formatPlanSummary(plan);

      // Add plan to conversation history
      await this.addToConversationHistory('assistant', summary);

      yield { type: 'text:delta', delta: summary };
      yield { type: 'text:done', text: summary };
    }
  }

  private async *streamExecuting(intent: IntentAnalysis): AsyncIterableIterator<UniversalEvent> {
    if (intent.type === 'status_query') {
      const progress = this.getTaskProgress();
      const text = this.formatProgress(progress);
      yield { type: 'text:delta', delta: text };
      yield { type: 'text:done', text };
      return;
    }

    yield* this.streamExecution();
  }

  private async *streamExecution(): AsyncIterableIterator<UniversalEvent> {
    if (!this.currentPlan) {
      yield { type: 'error', error: 'No plan to execute', recoverable: false };
      return;
    }

    // Ensure execution agent exists (without meta-tools)
    if (!this.executionAgent) {
      this.executionAgent = this.createExecutionAgent();
    }

    const tasks = this.currentPlan.tasks;
    let completedTasks = 0;
    let failedTasks = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task) continue;

      // Check if paused
      if (this.modeManager.isPaused()) {
        yield { type: 'execution:paused', reason: this.modeManager.getPauseReason() || 'unknown' };
        return;
      }

      // Skip completed/failed tasks
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'skipped') {
        if (task.status === 'completed') completedTasks++;
        if (task.status === 'failed') failedTasks++;
        continue;
      }

      // Start task
      task.status = 'in_progress';
      task.startedAt = Date.now();
      task.attempts = (task.attempts || 0) + 1;
      this.modeManager.setCurrentTaskIndex(i);

      yield { type: 'task:started', task };

      try {
        // Build task prompt with context about the plan and completed tasks
        const prompt = this.buildTaskPromptWithContext(task, i);
        let taskResultText = '';

        // Use execution agent (without meta-tools) instead of main agent
        for await (const event of this.executionAgent.stream(prompt)) {
          if (event.type === StreamEventType.OUTPUT_TEXT_DELTA) {
            const delta = (event as any).delta || '';
            taskResultText += delta;
            yield { type: 'task:progress', task, status: delta };
          } else if (event.type === StreamEventType.TOOL_EXECUTION_START) {
            yield { type: 'tool:start', name: (event as any).tool_name || 'unknown', args: (event as any).arguments || null };
          } else if (event.type === StreamEventType.TOOL_EXECUTION_DONE) {
            yield { type: 'tool:complete', name: (event as any).tool_name || 'unknown', result: (event as any).result, durationMs: (event as any).execution_time_ms || 0 };
          }
        }

        // Mark completed
        task.status = 'completed';
        task.completedAt = Date.now();
        task.result = { success: true, output: taskResultText };
        completedTasks++;

        // Add task completion to conversation history
        await this.addToConversationHistory('assistant', `Completed task "${task.name}": ${taskResultText.substring(0, 200)}${taskResultText.length > 200 ? '...' : ''}`);

        yield { type: 'task:completed', task, result: taskResultText };

      } catch (error) {
        task.status = 'failed';
        const errorMsg = error instanceof Error ? error.message : String(error);
        task.result = { success: false, error: errorMsg };
        failedTasks++;

        // Add task failure to conversation history
        await this.addToConversationHistory('assistant', `Task "${task.name}" failed: ${errorMsg}`);

        yield { type: 'task:failed', task, error: errorMsg };
      }
    }

    // All done
    const result: ExecutionResult = {
      status: failedTasks === 0 ? 'completed' : 'failed',
      completedTasks,
      totalTasks: tasks.length,
      failedTasks,
      skippedTasks: tasks.filter(t => t.status === 'skipped').length,
    };

    // Generate final response by gathering task results
    const finalResponse = this.generateExecutionSummary(tasks);

    // Yield text events so the user sees the final response
    yield { type: 'text:delta', delta: '\n' + finalResponse };
    yield { type: 'text:done', text: finalResponse };

    // Add final response to conversation history
    await this.addToConversationHistory('assistant', finalResponse);

    yield { type: 'execution:done', result };

    // Return to interactive
    this.modeManager.returnToInteractive('execution_completed');
    yield { type: 'mode:changed', from: 'executing', to: 'interactive', reason: 'execution_completed' };

    this.emit('execution:completed', { result });
  }

  /**
   * Generate a user-facing summary from task execution results.
   * Returns the output of the last successful task, or a status summary if all failed.
   */
  private generateExecutionSummary(tasks: Task[]): string {
    // Find the last completed task with output (typically the final synthesis/summary task)
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.result?.output);

    if (completedTasks.length > 0) {
      // Return the last task's output - this is typically the final answer/summary
      const lastTask = completedTasks[completedTasks.length - 1];
      if (lastTask && lastTask.result?.output) {
        // Convert output to string (it's typed as unknown)
        const output = lastTask.result.output;
        return typeof output === 'string' ? output : JSON.stringify(output, null, 2);
      }
    }

    // If no completed tasks with output, check for failed tasks
    const failedTasks = tasks.filter(t => t.status === 'failed');
    if (failedTasks.length > 0) {
      const errors = failedTasks.map(t => `- ${t.name}: ${t.result?.error || 'Unknown error'}`).join('\n');
      return `Plan execution encountered errors:\n${errors}`;
    }

    // Fallback
    return 'Plan execution completed but no output was generated.';
  }

  // ============================================================================
  // Planning Helpers
  // ============================================================================

  private async createPlan(goal: string, _reasoning?: string): Promise<UniversalResponse> {
    const plan = await this.createPlanInternal(goal);

    this.modeManager.setPendingPlan(plan);
    this.currentPlan = plan;
    this._planPlugin.setPlan(plan);

    this.emit('plan:created', { plan });

    const summary = this.formatPlanSummary(plan);
    const requireApproval = this._config.planning?.requireApproval !== false;

    return {
      text: summary,
      mode: 'planning',
      plan,
      planStatus: requireApproval ? 'pending_approval' : 'approved',
      needsUserAction: requireApproval,
      userActionType: requireApproval ? 'approve_plan' : undefined,
    };
  }

  private async createPlanInternal(goal: string): Promise<Plan> {
    if (this.planningAgent) {
      const result = await this.planningAgent.generatePlan({ goal });
      return createPlan({ goal, tasks: result.plan.tasks as TaskInput[] });
    }

    // Fallback: simple single-task plan
    return createPlan({
      goal,
      tasks: [{ name: 'execute', description: goal }],
    });
  }

  private async approvePlan(_feedback?: string): Promise<UniversalResponse> {
    const plan = this.modeManager.getPendingPlan();
    if (!plan) {
      return {
        text: 'No plan to approve.',
        mode: this.modeManager.getMode(),
      };
    }

    this.modeManager.approvePlan();
    this.modeManager.enterExecuting(plan, 'user_approved');
    this.currentPlan = plan;
    this._planPlugin.setPlan(plan);

    this.emit('plan:approved', { plan });

    // Start execution
    return this.continueExecution();
  }

  private async handlePlanRejection(_input: string, intent: IntentAnalysis): Promise<UniversalResponse> {
    if (intent.feedback) {
      return this.refinePlan(intent.feedback);
    }

    return {
      text: "I understand you'd like to change the plan. What would you like me to modify?",
      mode: 'planning',
      plan: this.modeManager.getPendingPlan(),
      needsUserAction: true,
      userActionType: 'provide_input',
    };
  }

  private async refinePlan(feedback: string): Promise<UniversalResponse> {
    const currentPlan = this.modeManager.getPendingPlan();
    if (!currentPlan || !this.planningAgent) {
      return this.createPlan(feedback);
    }

    const refined = await this.planningAgent.refinePlan(currentPlan, feedback);
    this.modeManager.setPendingPlan(refined.plan);
    this.currentPlan = refined.plan;
    this._planPlugin.setPlan(refined.plan);

    this.emit('plan:modified', { plan: refined.plan, changes: [] });

    return {
      text: this.formatPlanSummary(refined.plan),
      mode: 'planning',
      plan: refined.plan,
      planStatus: 'pending_approval',
      needsUserAction: true,
      userActionType: 'approve_plan',
    };
  }

  private async modifyPlan(modification: IntentAnalysis['modification']): Promise<UniversalResponse> {
    if (!modification || !this.currentPlan) {
      return {
        text: 'No active plan to modify.',
        mode: this.modeManager.getMode(),
      };
    }

    const changes: PlanChange[] = [];

    switch (modification.action) {
      case 'add_task': {
        const newTask = createTask({
          name: `task_${this.currentPlan.tasks.length + 1}`,
          description: modification.details ?? 'New task',
        });
        this.currentPlan.tasks.push(newTask);
        changes.push({ type: 'task_added', taskId: newTask.id, taskName: newTask.name, details: modification.details });
        break;
      }

      case 'remove_task': {
        const idx = this.currentPlan.tasks.findIndex(t => t.name === modification.taskName);
        if (idx >= 0) {
          this.currentPlan.tasks.splice(idx, 1);
          changes.push({ type: 'task_removed', taskName: modification.taskName });
        }
        break;
      }

      case 'skip_task': {
        const task = this.currentPlan.tasks.find(t => t.name === modification.taskName);
        if (task) {
          task.status = 'skipped';
          changes.push({ type: 'task_updated', taskId: task.id, taskName: task.name, details: 'Marked as skipped' });
        }
        break;
      }

      case 'update_task': {
        const task = this.currentPlan.tasks.find(t => t.name === modification.taskName);
        if (task && modification.details) {
          task.description = modification.details;
          changes.push({ type: 'task_updated', taskId: task.id, taskName: task.name, details: modification.details });
        }
        break;
      }
    }

    this.currentPlan.lastUpdatedAt = Date.now();

    this.emit('plan:modified', { plan: this.currentPlan, changes });

    return {
      text: `Plan updated: ${changes.map(c => c.details || c.type).join(', ')}`,
      mode: this.modeManager.getMode(),
      plan: this.currentPlan,
    };
  }

  // ============================================================================
  // Execution Helpers
  // ============================================================================

  private async continueExecution(): Promise<UniversalResponse> {
    if (!this.currentPlan) {
      return {
        text: 'No plan to execute.',
        mode: 'interactive',
      };
    }

    const tasks = this.currentPlan.tasks;
    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

    if (pendingTasks.length === 0) {
      this.modeManager.returnToInteractive('all_tasks_completed');
      return {
        text: 'All tasks completed!',
        mode: 'interactive',
        taskProgress: this.getTaskProgress(),
      };
    }

    // Execute next pending task
    const nextTask = pendingTasks[0];
    if (!nextTask) {
      throw new Error('No pending task found');
    }

    nextTask.status = 'in_progress';
    nextTask.startedAt = Date.now();
    nextTask.attempts = (nextTask.attempts || 0) + 1;

    this.emit('task:started', { task: nextTask });

    try {
      const prompt = this.buildTaskPrompt(nextTask);
      const response = await this.agent.run(prompt);

      nextTask.status = 'completed';
      nextTask.completedAt = Date.now();
      nextTask.result = { success: true, output: response.output_text };

      this.emit('task:completed', { task: nextTask, result: response.output_text });

      // Check if more tasks
      const remaining = tasks.filter(t => t.status === 'pending');
      if (remaining.length > 0) {
        return {
          text: `Completed: ${nextTask.name}\n\nContinuing to next task...`,
          mode: 'executing',
          taskProgress: this.getTaskProgress(),
        };
      } else {
        this.modeManager.returnToInteractive('all_tasks_completed');
        return {
          text: `All tasks completed!\n\nFinal task result:\n${response.output_text}`,
          mode: 'interactive',
          taskProgress: this.getTaskProgress(),
        };
      }
    } catch (error) {
      nextTask.status = 'failed';
      const errorMsg = error instanceof Error ? error.message : String(error);
      nextTask.result = { success: false, error: errorMsg };

      this.emit('task:failed', { task: nextTask, error: errorMsg });

      return {
        text: `Task failed: ${errorMsg}`,
        mode: 'executing',
        taskProgress: this.getTaskProgress(),
      };
    }
  }

  private reportProgress(): UniversalResponse {
    const progress = this.getTaskProgress();
    return {
      text: this.formatProgress(progress),
      mode: this.modeManager.getMode(),
      taskProgress: progress,
    };
  }

  // ============================================================================
  // Intent Analysis
  // ============================================================================

  private async analyzeIntent(input: string): Promise<IntentAnalysis> {
    const lowerInput = input.toLowerCase().trim();

    // Simple pattern matching for common intents
    if (this.isApproval(lowerInput)) {
      return { type: 'approval', confidence: 0.9 };
    }

    if (this.isRejection(lowerInput)) {
      return { type: 'rejection', confidence: 0.9, feedback: input };
    }

    if (this.isStatusQuery(lowerInput)) {
      return { type: 'status_query', confidence: 0.9 };
    }

    if (this.isInterrupt(lowerInput)) {
      return { type: 'interrupt', confidence: 0.9 };
    }

    if (this.isPlanModification(lowerInput)) {
      return {
        type: 'plan_modify',
        confidence: 0.8,
        modification: this.parsePlanModification(input),
      };
    }

    // Check complexity heuristics
    const complexity = this.estimateComplexity(input);
    if (complexity === 'high' || complexity === 'medium') {
      return {
        type: 'complex',
        confidence: 0.7,
        complexity,
        estimatedSteps: this.estimateSteps(input),
      };
    }

    return { type: 'simple', confidence: 0.8 };
  }

  private isApproval(input: string): boolean {
    const approvalPatterns = [
      /^(yes|yeah|yep|sure|ok|okay|go ahead|proceed|approve|looks good|lgtm|do it|start|execute|run it)$/i,
      /^(that('s| is) (good|fine|great|perfect))$/i,
      /^(please proceed|please continue|continue)$/i,
    ];
    return approvalPatterns.some(p => p.test(input));
  }

  private isRejection(input: string): boolean {
    const rejectionPatterns = [
      /^(no|nope|nah|stop|cancel|reject|don't|wait)$/i,
      /^(that('s| is) (wrong|not right|incorrect))$/i,
      /change|modify|different|instead/i,
    ];
    return rejectionPatterns.some(p => p.test(input));
  }

  private isStatusQuery(input: string): boolean {
    const statusPatterns = [
      /status|progress|where are (you|we)|what('s| is) (the )?(status|progress)/i,
      /how('s| is) it going|what have you done|current state/i,
      /which task|what task/i,
    ];
    return statusPatterns.some(p => p.test(input));
  }

  private isInterrupt(input: string): boolean {
    const interruptPatterns = [
      /^(stop|pause|wait|hold on|hold up)$/i,
      /stop (what you're doing|execution|everything)/i,
    ];
    return interruptPatterns.some(p => p.test(input));
  }

  private isPlanModification(input: string): boolean {
    const modPatterns = [
      /add (a )?task|new task|also (do|add)|additionally/i,
      /remove (the )?task|skip (the )?task|don't do/i,
      /change (the )?order|reorder|do .* first|prioritize/i,
      /update (the )?task|modify (the )?task/i,
    ];
    return modPatterns.some(p => p.test(input));
  }

  private parsePlanModification(input: string): IntentAnalysis['modification'] {
    const lowerInput = input.toLowerCase();

    if (/add|new|also|additionally/.test(lowerInput)) {
      return { action: 'add_task', details: input };
    }
    if (/remove|skip|don't/.test(lowerInput)) {
      return { action: 'skip_task', details: input };
    }
    if (/reorder|first|prioritize/.test(lowerInput)) {
      return { action: 'reorder', details: input };
    }
    return { action: 'update_task', details: input };
  }

  /**
   * Check if the input is a simple single-tool request that shouldn't trigger planning.
   * These are common patterns like web searches, lookups, etc.
   */
  private isSingleToolRequest(input: string): boolean {
    const lowerInput = input.toLowerCase();

    // Patterns that indicate a simple tool call (not a multi-step task)
    const singleToolPatterns = [
      // Web search patterns
      /^(search|google|look\s*up|find)\s+(the\s+)?(web|internet|online)?\s*(for|about)?\s+/i,
      /^(search|find|look\s*up)\s+/i,
      /^what\s+(is|are|was|were)\s+/i,
      /^who\s+(is|are|was|were)\s+/i,
      /^where\s+(is|are|was|were)\s+/i,
      /^when\s+(did|was|were|is)\s+/i,
      /^how\s+(do|does|did|to|much|many)\s+/i,
      // Web fetch patterns
      /^(fetch|get|read|open|visit|go\s+to)\s+(the\s+)?(url|page|website|site|link)/i,
      /^(fetch|get|scrape)\s+https?:\/\//i,
      // Simple calculations/lookups
      /^(calculate|compute|what\s+is)\s+\d/i,
      /^(tell\s+me|show\s+me|give\s+me)\s+(about|the)/i,
      // Summary requests (still single action)
      /^(summarize|summary\s+of)\s+/i,
    ];

    // Check if it matches any single-tool pattern
    if (singleToolPatterns.some(p => p.test(lowerInput))) {
      return true;
    }

    // Also check: if "and" is followed by result-presentation words, it's still single-action
    // e.g., "search for X and show me results" = single action (search + display)
    // vs "search for X and then email the results" = multi-action
    const presentationSuffixes = /\s+and\s+(show|display|give|tell|present|list|summarize|provide)\s+(me\s+)?(the\s+)?(results?|summary|findings?|answer|info|information)/i;
    if (presentationSuffixes.test(lowerInput)) {
      return true;
    }

    return false;
  }

  private estimateComplexity(input: string): 'low' | 'medium' | 'high' {
    // First check: is this a simple single-tool request?
    if (this.isSingleToolRequest(input)) {
      return 'low';
    }

    const words = input.split(/\s+/).length;
    const lowerInput = input.toLowerCase();

    // Check for multiple DISTINCT action verbs (not just the word "and")
    const actionVerbs = ['search', 'find', 'create', 'build', 'write', 'send', 'email',
                         'delete', 'update', 'fetch', 'scrape', 'download', 'upload',
                         'install', 'deploy', 'configure', 'setup', 'migrate', 'refactor',
                         'analyze', 'compare', 'merge', 'split', 'convert', 'transform'];
    const foundVerbs = actionVerbs.filter(v => new RegExp(`\\b${v}\\b`, 'i').test(lowerInput));
    const hasMultipleDistinctActions = foundVerbs.length >= 2;

    // Complex keywords that suggest planning is needed
    const hasComplexKeywords = /\b(build|create|implement|design|develop|setup|configure|migrate|refactor|deploy|integrate)\b/i.test(lowerInput);

    // Sequential action keywords (stronger signal than just "and")
    const hasSequentialKeywords = /\b(then|after\s+that|next|finally|first\s+.+\s+then|step\s+\d)\b/i.test(lowerInput);

    // High complexity: long input with complex keywords, or multiple distinct actions with sequences
    if (words > 50 || (hasMultipleDistinctActions && hasSequentialKeywords)) {
      return 'high';
    }

    // Medium complexity: multiple distinct actions, or complex keywords with some length
    if (hasMultipleDistinctActions || (hasComplexKeywords && words > 15)) {
      return 'medium';
    }

    // Default to low
    return 'low';
  }

  private estimateSteps(input: string): number {
    const andCount = (input.match(/\band\b/gi) || []).length;
    const thenCount = (input.match(/\bthen\b/gi) || []).length;
    return Math.max(2, andCount + thenCount + 1);
  }

  private shouldSwitchToPlanning(intent: IntentAnalysis): boolean {
    if (this._config.planning?.enabled !== false && this._config.planning?.autoDetect !== false) {
      return intent.type === 'complex' && (intent.complexity === 'high' || intent.complexity === 'medium');
    }
    return false;
  }

  // ============================================================================
  // Execution Agent (without meta-tools)
  // ============================================================================

  /**
   * Create a separate agent for task execution that doesn't have meta-tools.
   * This prevents the agent from calling _start_planning during task execution.
   * Shares AgentContext with parent UniversalAgent for history/memory continuity.
   */
  private createExecutionAgent(): Agent {
    // Get user tools only (exclude meta-tools) from inherited _agentContext
    const userTools = this._agentContext.tools.getEnabled().filter(t => !isMetaTool(t.definition.function.name));

    return Agent.create({
      connector: this._config.connector,
      model: this._config.model,
      tools: userTools,
      instructions: this.buildExecutionInstructions(),
      temperature: this._config.temperature,
      maxIterations: this._config.maxIterations ?? 20,
      permissions: this._config.permissions,
      context: this._agentContext,  // Share context with execution agent for history/memory continuity
    });
  }

  /**
   * Build instructions for the execution agent (task-focused)
   * Uses user's custom instructions if provided, otherwise falls back to default
   */
  private buildExecutionInstructions(): string {
    // If user provided custom instructions, use those directly
    if (this._config.instructions && this._config.instructions.trim()) {
      return this._config.instructions;
    }

    // Default fallback only when no custom instructions provided
    return `You are an AI assistant executing specific tasks. Focus on completing the assigned task using the available tools.

Guidelines:
- Execute the task described in the prompt
- Use the appropriate tools to accomplish the task
- Report results clearly and concisely
- If you encounter errors, explain what went wrong`;
  }

  // ============================================================================
  // Conversation History & Context (via AgentContext)
  // ============================================================================

  /**
   * Add a message to conversation history (via AgentContext)
   */
  private async addToConversationHistory(role: 'user' | 'assistant', content: string): Promise<void> {
    // Use async addMessage with capacity checking for potentially large content
    await this._agentContext.addMessage(role, content);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private buildInstructions(userInstructions?: string): string {
    const baseInstructions = `You are a versatile AI assistant that can handle both simple requests and complex multi-step tasks.

For simple requests:
- Answer questions directly
- Use tools when needed for immediate results

For complex requests:
- Use the _start_planning tool to create a structured plan
- Wait for user approval before executing

You have access to meta-tools:
- _start_planning: Call when a task needs multiple steps
- _modify_plan: Call when user wants to change the plan
- _report_progress: Call when user asks about status
- _request_approval: Call when you need user confirmation

Always be helpful, clear, and ask for clarification when needed.`;

    return userInstructions
      ? `${baseInstructions}\n\nAdditional instructions:\n${userInstructions}`
      : baseInstructions;
  }

  private buildTaskPrompt(task: Task): string {
    let prompt = `Execute the following task:\n\nTask: ${task.name}\nDescription: ${task.description}`;

    if (task.expectedOutput) {
      prompt += `\nExpected Output: ${task.expectedOutput}`;
    }

    return prompt;
  }

  /**
   * Build task prompt with full context (plan goal, completed tasks, etc.)
   */
  private buildTaskPromptWithContext(task: Task, taskIndex: number): string {
    const parts: string[] = [];

    // Add plan context
    if (this.currentPlan) {
      parts.push(`## Overall Goal\n${this.currentPlan.goal}\n`);

      // Add results from completed tasks
      const completedTasks = this.currentPlan.tasks.slice(0, taskIndex).filter(t => t.status === 'completed');
      if (completedTasks.length > 0) {
        parts.push(`## Previously Completed Tasks`);
        for (const completed of completedTasks) {
          const output = completed.result?.output
            ? (typeof completed.result.output === 'string'
              ? completed.result.output.substring(0, 300)
              : JSON.stringify(completed.result.output).substring(0, 300))
            : 'No output recorded';
          parts.push(`- **${completed.name}**: ${completed.description}\n  Result: ${output}`);
        }
        parts.push('');
      }
    }

    // Add current task
    parts.push(`## Current Task (${taskIndex + 1}/${this.currentPlan?.tasks.length || 1})`);
    parts.push(`**Name**: ${task.name}`);
    parts.push(`**Description**: ${task.description}`);
    if (task.expectedOutput) {
      parts.push(`**Expected Output**: ${task.expectedOutput}`);
    }
    parts.push('');
    parts.push('Execute this task now using the available tools. Be thorough and report results clearly.');

    return parts.join('\n');
  }

  private formatPlanSummary(plan: Plan): string {
    let summary = `I've created a plan to: ${plan.goal}\n\n`;
    summary += `Tasks (${plan.tasks.length}):\n`;

    plan.tasks.forEach((task, i) => {
      const deps = task.dependsOn?.length ? ` (depends on: ${task.dependsOn.join(', ')})` : '';
      summary += `${i + 1}. ${task.name}: ${task.description}${deps}\n`;
    });

    summary += '\nWould you like me to proceed with this plan?';
    return summary;
  }

  private formatProgress(progress: TaskProgress): string {
    let text = `Progress: ${progress.completed}/${progress.total} tasks completed`;

    if (progress.failed > 0) {
      text += ` (${progress.failed} failed)`;
    }
    if (progress.skipped > 0) {
      text += ` (${progress.skipped} skipped)`;
    }

    if (progress.current) {
      text += `\n\nCurrently working on: ${progress.current.name}`;
    }

    return text;
  }

  private getTaskProgress(): TaskProgress {
    if (!this.currentPlan) {
      return { completed: 0, total: 0, failed: 0, skipped: 0 };
    }

    const tasks = this.currentPlan.tasks;
    const currentIdx = this.modeManager.getCurrentTaskIndex();

    return {
      completed: tasks.filter(t => t.status === 'completed').length,
      total: tasks.length,
      current: tasks[currentIdx],
      failed: tasks.filter(t => t.status === 'failed').length,
      skipped: tasks.filter(t => t.status === 'skipped').length,
    };
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  getMode(): AgentMode {
    return this.modeManager.getMode();
  }

  getPlan(): Plan | null {
    return this.currentPlan;
  }

  getProgress(): TaskProgress | null {
    if (this.modeManager.getMode() !== 'executing' || !this.currentPlan) {
      return null;
    }
    return this.getTaskProgress();
  }

  /**
   * Access to tool manager (alias for `tools` getter from BaseAgent)
   * @deprecated Use `tools` instead for consistency with other agents
   */
  get toolManager() {
    return this._agentContext.tools;  // Use inherited AgentContext.tools
  }

  // ============================================================================
  // Unified Context Access
  // ============================================================================

  // Note: `context` getter is inherited from BaseAgent (returns _agentContext)
  // The inherited getter returns the AgentContext which is always available after BaseAgent constructor

  /**
   * Check if context is available (always true since AgentContext is created by BaseAgent)
   */
  hasContext(): boolean {
    return true;
  }

  // ============================================================================
  // Runtime Configuration
  // ============================================================================

  setAutoApproval(value: boolean): void {
    if (this._config.planning) {
      this._config.planning.requireApproval = !value;
    }
  }

  setPlanningEnabled(value: boolean): void {
    if (this._config.planning) {
      this._config.planning.enabled = value;
    }
  }

  // ============================================================================
  // Control
  // ============================================================================

  private _isPaused = false;

  pause(): void {
    this._isPaused = true;
    if (this.modeManager.getMode() === 'executing') {
      this.modeManager.pauseExecution('user_request');
    }
  }

  resume(): void {
    this._isPaused = false;
    if (this.modeManager.isPaused()) {
      this.modeManager.resumeExecution();
    }
  }

  cancel(): void {
    if (this.currentPlan) {
      this.currentPlan.status = 'cancelled';
    }
    this.modeManager.returnToInteractive('cancelled');
  }

  isRunning(): boolean {
    return this.modeManager.getMode() === 'executing' && !this.isPaused();
  }

  isPaused(): boolean {
    return this._isPaused || this.modeManager.isPaused();
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    if (this._isDestroyed) return;

    this._logger.debug('UniversalAgent destroy started');

    // Run cleanup callbacks (synchronously, matching Agent behavior)
    for (const callback of this._cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        this._logger.error({ error: (error as Error).message }, 'Cleanup callback error');
      }
    }
    this._cleanupCallbacks = [];

    // Cleanup composed EventEmitters via removeAllListeners()
    this.modeManager.removeAllListeners();

    // Cleanup components
    this.agent.destroy();
    if (this.executionAgent) {
      this.executionAgent.destroy();
    }
    this.modeManager.destroy();

    // Note: AgentContext cleanup is handled by baseDestroy() in BaseAgent

    // Call base destroy (handles session, AgentContext, permission manager cleanup)
    this.baseDestroy();

    this._logger.debug('UniversalAgent destroyed');
  }
}
