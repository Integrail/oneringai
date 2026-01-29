/**
 * PlanPlugin - Provides plan context for TaskAgent and UniversalAgent
 *
 * The plan is a critical component that should never be compacted.
 * It contains the goal and task list that guides agent execution.
 */

import { BaseContextPlugin } from './IContextPlugin.js';
import type { IContextComponent } from '../types.js';
import type { Plan, Task, TaskStatus } from '../../../domain/entities/Task.js';

/**
 * Serialized plan state for session persistence
 */
export interface SerializedPlanPluginState {
  plan: Plan | null;
}

/**
 * Plan plugin for context management
 *
 * Provides the execution plan as a context component.
 * Priority 1 (critical, never compacted).
 */
export class PlanPlugin extends BaseContextPlugin {
  readonly name = 'plan';
  readonly priority = 1; // Very low = keep (critical)
  readonly compactable = false; // Never compact the plan

  private plan: Plan | null = null;

  /**
   * Set the current plan
   */
  setPlan(plan: Plan): void {
    this.plan = plan;
  }

  /**
   * Get the current plan
   */
  getPlan(): Plan | null {
    return this.plan;
  }

  /**
   * Clear the plan
   */
  clearPlan(): void {
    this.plan = null;
  }

  /**
   * Update a task's status within the plan
   */
  updateTaskStatus(taskId: string, status: TaskStatus): void {
    if (!this.plan) return;

    const task = this.plan.tasks.find(t => t.id === taskId || t.name === taskId);
    if (task) {
      task.status = status;
    }
  }

  /**
   * Get a task by ID or name
   */
  getTask(taskId: string): Task | undefined {
    if (!this.plan) return undefined;
    return this.plan.tasks.find(t => t.id === taskId || t.name === taskId);
  }

  /**
   * Check if all tasks are completed
   */
  isComplete(): boolean {
    if (!this.plan) return true;
    return this.plan.tasks.every(t => t.status === 'completed' || t.status === 'skipped');
  }

  /**
   * Get component for context
   */
  async getComponent(): Promise<IContextComponent | null> {
    if (!this.plan) return null;

    return {
      name: this.name,
      content: this.formatPlan(this.plan),
      priority: this.priority,
      compactable: this.compactable,
      metadata: {
        taskCount: this.plan.tasks.length,
        completedCount: this.plan.tasks.filter(t => t.status === 'completed').length,
        goal: this.plan.goal,
      },
    };
  }

  /**
   * Format plan for LLM context
   */
  private formatPlan(plan: Plan): string {
    const lines: string[] = [
      '## Current Plan',
      '',
      `**Goal**: ${plan.goal}`,
      '',
      '**Tasks**:',
    ];

    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i];
      if (!task) continue;

      const status = task.status || 'pending';
      const statusEmoji = this.getStatusEmoji(status);
      const deps = task.dependsOn && task.dependsOn.length > 0
        ? ` (depends on: ${task.dependsOn.join(', ')})`
        : '';

      lines.push(`${i + 1}. ${statusEmoji} [${status}] **${task.name}**: ${task.description}${deps}`);

      // Include completion criteria if present
      if (task.validation?.completionCriteria) {
        lines.push(`   - Completion: ${task.validation.completionCriteria}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get emoji for task status
   */
  private getStatusEmoji(status: TaskStatus): string {
    switch (status) {
      case 'completed': return '[x]';
      case 'in_progress': return '[~]';
      case 'failed': return '[!]';
      case 'skipped': return '[-]';
      case 'blocked': return '[#]';
      case 'pending':
      default: return '[ ]';
    }
  }

  // Session persistence
  override getState(): SerializedPlanPluginState {
    return { plan: this.plan };
  }

  override restoreState(state: unknown): void {
    const s = state as SerializedPlanPluginState;
    if (s?.plan) {
      this.plan = s.plan;
    }
  }
}
