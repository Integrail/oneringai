/**
 * UniversalAgent - Unified agent combining interactive, planning, and task execution
 *
 * Features:
 * - Mode-fluid: Automatically switches between interactive, planning, and executing
 * - User intervention: Users can interrupt, modify plans, provide feedback
 * - Smart detection: Auto-detects complex tasks that need planning
 * - Session persistence: Save and resume conversations
 * - Dynamic tools: Enable/disable tools at runtime
 */

import { EventEmitter } from 'events';
import { Connector } from '../../core/Connector.js';
import { Agent } from '../../core/Agent.js';
import { ToolManager } from '../../core/ToolManager.js';
import { SessionManager, Session, ISessionStorage } from '../../core/SessionManager.js';
import { Plan, Task, createPlan, createTask, TaskInput } from '../../domain/entities/Task.js';
import { StreamEventType } from '../../domain/entities/StreamEvent.js';
import { WorkingMemory } from '../taskAgent/WorkingMemory.js';
import { DEFAULT_MEMORY_CONFIG } from '../../domain/entities/Memory.js';
import { InMemoryStorage } from '../../infrastructure/storage/InMemoryStorage.js';
import { PlanningAgent } from '../taskAgent/PlanningAgent.js';
import { ModeManager } from './ModeManager.js';
import { getMetaTools, isMetaTool, META_TOOL_NAMES } from './metaTools.js';
import type {
  UniversalAgentConfig,
  UniversalResponse,
  UniversalEvent,
  AgentMode,
  TaskProgress,
  IntentAnalysis,
  PlanChange,
  ExecutionResult,
} from './types.js';

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
}

// ============================================================================
// UniversalAgent Class
// ============================================================================

export class UniversalAgent extends EventEmitter {
  readonly name: string;
  readonly connector: Connector;
  readonly model: string;

  // Core components
  private config: UniversalAgentConfig;
  private agent: Agent;
  private _toolManager: ToolManager;
  private modeManager: ModeManager;
  private planningAgent?: PlanningAgent;
  private workingMemory: WorkingMemory;

  // Session management
  private _sessionManager: SessionManager | null = null;
  private _session: Session | null = null;

  // Execution state
  private currentPlan: Plan | null = null;
  private executionHistory: Array<{ input: string; response: UniversalResponse; timestamp: Date }> = [];
  private isDestroyed = false;

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
    config: Omit<UniversalAgentConfig, 'session'> & { session: { storage: ISessionStorage } }
  ): Promise<UniversalAgent> {
    const agent = new UniversalAgent({
      ...config,
      session: {
        ...config.session,
        id: sessionId,
      },
    });

    // Load session
    await agent.loadSession(sessionId);

    return agent;
  }

  // ============================================================================
  // Constructor
  // ============================================================================

  private constructor(config: UniversalAgentConfig) {
    super();

    // Resolve connector
    this.connector =
      typeof config.connector === 'string'
        ? Connector.get(config.connector)
        : config.connector;

    this.name = config.name ?? `universal-agent-${Date.now()}`;
    this.model = config.model;
    this.config = config;

    // Initialize ToolManager
    this._toolManager = config.toolManager ?? new ToolManager();

    // Register user tools
    if (config.tools) {
      for (const tool of config.tools) {
        this._toolManager.register(tool, { namespace: 'user' });
      }
    }

    // Register meta-tools for mode transitions
    const metaTools = getMetaTools();
    for (const tool of metaTools) {
      this._toolManager.register(tool, { namespace: '_meta' });
    }

    // Create base agent for LLM calls
    const allTools = this._toolManager.getEnabled();
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: allTools,
      instructions: this.buildInstructions(config.instructions),
      temperature: config.temperature,
      maxIterations: config.maxIterations ?? 20,
      permissions: config.permissions,
    });

    // Initialize mode manager
    this.modeManager = new ModeManager('interactive');
    this.modeManager.on('mode:changed', (data) => {
      this.emit('mode:changed', data);
    });

    // Initialize planning agent if planning is enabled
    const planningEnabled = config.planning?.enabled !== false;
    if (planningEnabled) {
      this.planningAgent = PlanningAgent.create({
        connector: config.connector,
        model: config.planning?.model ?? config.model,
        availableTools: this._toolManager.getEnabled().filter(t => !isMetaTool(t.definition.function.name)),
      });
    }

    // Initialize working memory with in-memory storage
    const memoryStorage = new InMemoryStorage();
    this.workingMemory = new WorkingMemory(memoryStorage, config.memoryConfig ?? DEFAULT_MEMORY_CONFIG);

    // Setup session if configured
    if (config.session) {
      this._sessionManager = new SessionManager({ storage: config.session.storage });

      if (!config.session.id) {
        // Create new session
        this._session = this._sessionManager.create('universal-agent', {
          title: this.name,
        });

        // Setup auto-save if configured
        if (config.session.autoSave) {
          const interval = config.session.autoSaveIntervalMs ?? 30000;
          this._sessionManager.enableAutoSave(this._session, interval);
        }
      }
    }
  }

  // ============================================================================
  // Main API
  // ============================================================================

  /**
   * Chat with the agent - the main entry point
   */
  async chat(input: string): Promise<UniversalResponse> {
    if (this.isDestroyed) {
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
    if (this.config.session?.autoSave && this._session) {
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
    if (this.isDestroyed) {
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
      this.modeManager.enterPlanning('complex_task_detected');
      return this.handlePlanning(input, intent);
    }

    // Execute directly with agent
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

    return {
      text: response.output_text ?? '',
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
      await this.workingMemory.store(
        `user_feedback_${Date.now()}`,
        'User feedback during execution',
        input,
        'persistent'
      );
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
      const from = this.modeManager.getMode();
      this.modeManager.enterPlanning('complex_task_detected');
      yield { type: 'mode:changed', from, to: 'planning', reason: 'complex_task_detected' };
      yield* this.streamPlanning(input, intent);
      return;
    }

    // Stream from agent
    let fullText = '';
    for await (const event of this.agent.stream(input)) {
      if (event.type === StreamEventType.OUTPUT_TEXT_DELTA) {
        const delta = (event as any).delta || '';
        fullText += delta;
        yield { type: 'text:delta', delta };
      } else if (event.type === StreamEventType.TOOL_CALL_START) {
        yield { type: 'tool:start', name: (event as any).tool_name || 'unknown', args: null };
      } else if (event.type === StreamEventType.TOOL_EXECUTION_DONE) {
        yield { type: 'tool:complete', name: (event as any).name || 'unknown', result: (event as any).result, durationMs: 0 };
      }
    }

    yield { type: 'text:done', text: fullText };
  }

  private async *streamPlanning(input: string, intent: IntentAnalysis): AsyncIterableIterator<UniversalEvent> {
    if (intent.type === 'approval' && this.modeManager.getPendingPlan()) {
      const plan = this.modeManager.getPendingPlan()!;
      this.modeManager.approvePlan();
      yield { type: 'plan:approved', plan };

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

    yield { type: 'plan:created', plan };

    if (this.config.planning?.requireApproval !== false) {
      yield { type: 'plan:awaiting_approval', plan };
      yield { type: 'needs:approval', plan };

      const summary = this.formatPlanSummary(plan);
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
        // Execute task with agent
        const prompt = this.buildTaskPrompt(task);
        let taskResultText = '';

        for await (const event of this.agent.stream(prompt)) {
          if (event.type === StreamEventType.OUTPUT_TEXT_DELTA) {
            const delta = (event as any).delta || '';
            taskResultText += delta;
            yield { type: 'task:progress', task, status: delta };
          } else if (event.type === StreamEventType.TOOL_CALL_START) {
            yield { type: 'tool:start', name: (event as any).tool_name || 'unknown', args: null };
          } else if (event.type === StreamEventType.TOOL_EXECUTION_DONE) {
            yield { type: 'tool:complete', name: (event as any).name || 'unknown', result: (event as any).result, durationMs: 0 };
          }
        }

        // Mark completed
        task.status = 'completed';
        task.completedAt = Date.now();
        task.result = { success: true, output: taskResultText };
        completedTasks++;

        yield { type: 'task:completed', task, result: taskResultText };

      } catch (error) {
        task.status = 'failed';
        const errorMsg = error instanceof Error ? error.message : String(error);
        task.result = { success: false, error: errorMsg };
        failedTasks++;

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

    yield { type: 'execution:done', result };

    // Return to interactive
    this.modeManager.returnToInteractive('execution_completed');
    yield { type: 'mode:changed', from: 'executing', to: 'interactive', reason: 'execution_completed' };

    this.emit('execution:completed', { result });
  }

  // ============================================================================
  // Planning Helpers
  // ============================================================================

  private async createPlan(goal: string, _reasoning?: string): Promise<UniversalResponse> {
    const plan = await this.createPlanInternal(goal);

    this.modeManager.setPendingPlan(plan);
    this.currentPlan = plan;

    this.emit('plan:created', { plan });

    const summary = this.formatPlanSummary(plan);
    const requireApproval = this.config.planning?.requireApproval !== false;

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
      // Should never happen since we checked pendingTasks.length above
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

  private estimateComplexity(input: string): 'low' | 'medium' | 'high' {
    const words = input.split(/\s+/).length;
    const hasMultipleActions = /and|then|after|before|also|additionally/.test(input.toLowerCase());
    const hasComplexKeywords = /build|create|implement|design|develop|setup|configure|migrate|refactor/.test(input.toLowerCase());

    if (words > 50 || (hasMultipleActions && hasComplexKeywords)) {
      return 'high';
    }
    if (words > 20 || hasMultipleActions || hasComplexKeywords) {
      return 'medium';
    }
    return 'low';
  }

  private estimateSteps(input: string): number {
    const andCount = (input.match(/\band\b/gi) || []).length;
    const thenCount = (input.match(/\bthen\b/gi) || []).length;
    return Math.max(2, andCount + thenCount + 1);
  }

  private shouldSwitchToPlanning(intent: IntentAnalysis): boolean {
    if (this.config.planning?.enabled !== false && this.config.planning?.autoDetect !== false) {
      return intent.type === 'complex' && (intent.complexity === 'high' || intent.complexity === 'medium');
    }
    return false;
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
  // Session Management
  // ============================================================================

  getSessionId(): string | null {
    return this._session?.id ?? null;
  }

  hasSession(): boolean {
    return this._session !== null;
  }

  async saveSession(): Promise<void> {
    if (!this._sessionManager || !this._session) {
      throw new Error('Session not enabled');
    }

    // Update session state
    this._session.toolState = this._toolManager.getState();
    this._session.mode = this.modeManager.getMode();

    if (this.currentPlan) {
      this._session.plan = { version: 1, data: this.currentPlan };
    }

    this._session.custom['modeState'] = this.modeManager.serialize();
    this._session.custom['executionHistory'] = this.executionHistory;

    await this._sessionManager.save(this._session);
  }

  private async loadSession(sessionId: string): Promise<void> {
    if (!this._sessionManager) return;

    const session = await this._sessionManager.load(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this._session = session;

    // Restore tool state
    if (session.toolState) {
      this._toolManager.loadState(session.toolState);
    }

    // Restore mode state
    if (session.custom['modeState']) {
      this.modeManager.restore(session.custom['modeState'] as ReturnType<ModeManager['serialize']>);
    }

    // Restore plan
    if (session.plan?.data) {
      this.currentPlan = session.plan.data as Plan;
    }

    // Restore execution history
    if (session.custom['executionHistory']) {
      this.executionHistory = session.custom['executionHistory'] as typeof this.executionHistory;
    }
  }

  getSession(): Session | null {
    return this._session;
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

  get toolManager(): ToolManager {
    return this._toolManager;
  }

  /**
   * Permission management. Returns ToolPermissionManager for approval control.
   * Delegates to internal Agent's permission manager.
   */
  get permissions() {
    return this.agent.permissions;
  }

  // ============================================================================
  // Runtime Configuration
  // ============================================================================

  setAutoApproval(value: boolean): void {
    if (this.config.planning) {
      this.config.planning.requireApproval = !value;
    }
  }

  setPlanningEnabled(value: boolean): void {
    if (this.config.planning) {
      this.config.planning.enabled = value;
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

  onCleanup(callback: () => void): void {
    this.agent.onCleanup(callback);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Cleanup session
    if (this._sessionManager && this._session) {
      this._sessionManager.stopAutoSave(this._session.id);
      this._sessionManager.destroy();
    }

    // Cleanup components
    this.agent.destroy();
    this._toolManager.removeAllListeners();
    this.modeManager.removeAllListeners();
    this.removeAllListeners();
  }
}
