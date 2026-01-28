/**
 * ModeManager - Manages agent mode transitions
 *
 * Handles the state machine for UniversalAgent modes:
 * - interactive: Direct conversation, immediate tool execution
 * - planning: Creating and refining plans
 * - executing: Running through a plan
 */

import { EventEmitter } from 'eventemitter3';
import type { Plan } from '../../domain/entities/Task.js';
import type { AgentMode, ModeState, IntentAnalysis } from './types.js';

export interface ModeManagerEvents {
  'mode:changed': { from: AgentMode; to: AgentMode; reason: string };
  'mode:transition_blocked': { from: AgentMode; to: AgentMode; reason: string };
}

export class ModeManager extends EventEmitter {
  private state: ModeState;
  private transitionHistory: Array<{ from: AgentMode; to: AgentMode; at: Date; reason: string }> = [];

  constructor(initialMode: AgentMode = 'interactive') {
    super();
    this.state = {
      mode: initialMode,
      enteredAt: new Date(),
      reason: 'initial',
    };
  }

  /**
   * Get current mode
   */
  getMode(): AgentMode {
    return this.state.mode;
  }

  /**
   * Get full mode state
   */
  getState(): ModeState {
    return { ...this.state };
  }

  /**
   * Check if a transition is allowed
   */
  canTransition(to: AgentMode): boolean {
    const from = this.state.mode;

    // Define valid transitions
    const validTransitions: Record<AgentMode, AgentMode[]> = {
      'interactive': ['planning', 'executing'],
      'planning': ['interactive', 'executing'],
      'executing': ['interactive', 'planning'],
    };

    return validTransitions[from].includes(to);
  }

  /**
   * Transition to a new mode
   */
  transition(to: AgentMode, reason: string): boolean {
    const from = this.state.mode;

    if (!this.canTransition(to)) {
      this.emit('mode:transition_blocked', { from, to, reason });
      return false;
    }

    // Record transition
    this.transitionHistory.push({ from, to, at: new Date(), reason });

    // Update state
    this.state = {
      mode: to,
      enteredAt: new Date(),
      reason,
      // Clear mode-specific state on transition
      pendingPlan: to === 'planning' ? this.state.pendingPlan : undefined,
      planApproved: to === 'executing' ? true : undefined,
      currentTaskIndex: to === 'executing' ? 0 : undefined,
    };

    this.emit('mode:changed', { from, to, reason });
    return true;
  }

  /**
   * Enter planning mode with a goal
   */
  enterPlanning(reason: string = 'user_request'): boolean {
    return this.transition('planning', reason);
  }

  /**
   * Enter executing mode (plan must be approved)
   */
  enterExecuting(_plan: Plan, reason: string = 'plan_approved'): boolean {
    if (this.state.mode === 'planning' && !this.state.planApproved) {
      // Auto-approve when transitioning from planning to executing
      this.state.planApproved = true;
    }

    const success = this.transition('executing', reason);
    if (success) {
      this.state.currentTaskIndex = 0;
    }
    return success;
  }

  /**
   * Return to interactive mode
   */
  returnToInteractive(reason: string = 'completed'): boolean {
    return this.transition('interactive', reason);
  }

  /**
   * Set pending plan (in planning mode)
   */
  setPendingPlan(plan: Plan): void {
    this.state.pendingPlan = plan;
    this.state.planApproved = false;
  }

  /**
   * Get pending plan
   */
  getPendingPlan(): Plan | undefined {
    return this.state.pendingPlan;
  }

  /**
   * Approve the pending plan
   */
  approvePlan(): boolean {
    if (this.state.mode !== 'planning' || !this.state.pendingPlan) {
      return false;
    }
    this.state.planApproved = true;
    return true;
  }

  /**
   * Check if plan is approved
   */
  isPlanApproved(): boolean {
    return this.state.planApproved ?? false;
  }

  /**
   * Update current task index (in executing mode)
   */
  setCurrentTaskIndex(index: number): void {
    if (this.state.mode === 'executing') {
      this.state.currentTaskIndex = index;
    }
  }

  /**
   * Get current task index
   */
  getCurrentTaskIndex(): number {
    return this.state.currentTaskIndex ?? 0;
  }

  /**
   * Pause execution
   */
  pauseExecution(reason: string): void {
    if (this.state.mode === 'executing') {
      this.state.pausedAt = new Date();
      this.state.pauseReason = reason;
    }
  }

  /**
   * Resume execution
   */
  resumeExecution(): void {
    if (this.state.mode === 'executing') {
      this.state.pausedAt = undefined;
      this.state.pauseReason = undefined;
    }
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.state.pausedAt !== undefined;
  }

  /**
   * Get pause reason
   */
  getPauseReason(): string | undefined {
    return this.state.pauseReason;
  }

  /**
   * Determine recommended mode based on intent analysis
   */
  recommendMode(intent: IntentAnalysis, _currentPlan?: Plan): AgentMode | null {
    const currentMode = this.state.mode;

    switch (intent.type) {
      case 'complex':
        // Complex task → suggest planning
        if (currentMode === 'interactive') {
          return 'planning';
        }
        break;

      case 'approval':
        // User approved plan → suggest executing
        if (currentMode === 'planning' && this.state.pendingPlan) {
          return 'executing';
        }
        break;

      case 'rejection':
        // User rejected plan → stay in planning to refine
        if (currentMode === 'planning') {
          return 'planning';
        }
        break;

      case 'plan_modify':
        // Plan modification → enter planning if not already
        if (currentMode === 'executing' || currentMode === 'interactive') {
          return 'planning';
        }
        break;

      case 'interrupt':
        // Interrupt → return to interactive
        return 'interactive';

      case 'simple':
      case 'question':
        // Simple query during execution → handle inline, stay in current mode
        if (currentMode === 'executing') {
          return null; // Handle without mode change
        }
        return 'interactive';

      case 'status_query':
        // Status query → no mode change, just respond
        return null;

      case 'feedback':
        // Feedback during execution → note and continue
        return null;
    }

    return null; // No mode change recommended
  }

  /**
   * Get transition history
   */
  getHistory(): Array<{ from: AgentMode; to: AgentMode; at: Date; reason: string }> {
    return [...this.transitionHistory];
  }

  /**
   * Clear transition history
   */
  clearHistory(): void {
    this.transitionHistory = [];
  }

  /**
   * Get time spent in current mode
   */
  getTimeInCurrentMode(): number {
    return Date.now() - this.state.enteredAt.getTime();
  }

  /**
   * Serialize state for session persistence
   */
  serialize(): {
    mode: AgentMode;
    enteredAt: string;
    reason: string;
    pendingPlan?: Plan;
    planApproved?: boolean;
    currentTaskIndex?: number;
  } {
    return {
      mode: this.state.mode,
      enteredAt: this.state.enteredAt.toISOString(),
      reason: this.state.reason,
      pendingPlan: this.state.pendingPlan,
      planApproved: this.state.planApproved,
      currentTaskIndex: this.state.currentTaskIndex,
    };
  }

  /**
   * Restore state from serialized data
   */
  restore(data: ReturnType<ModeManager['serialize']>): void {
    this.state = {
      mode: data.mode,
      enteredAt: new Date(data.enteredAt),
      reason: data.reason,
      pendingPlan: data.pendingPlan,
      planApproved: data.planApproved,
      currentTaskIndex: data.currentTaskIndex,
    };
  }
}
