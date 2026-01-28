/**
 * ExternalDependencyHandler - handles external dependencies
 */

import { EventEmitter } from 'eventemitter3';
import { Task } from '../../domain/entities/Task.js';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { calculateBackoff, BackoffConfig } from '../../infrastructure/resilience/BackoffStrategy.js';

export interface ExternalDependencyEvents {
  'webhook:received': { webhookId: string; data: unknown };
  'poll:success': { taskId: string; data: unknown };
  'poll:timeout': { taskId: string };
  'scheduled:triggered': { taskId: string };
  'manual:completed': { taskId: string; data: unknown };
}

/**
 * Handles external task dependencies
 */
export class ExternalDependencyHandler extends EventEmitter<ExternalDependencyEvents> {
  private activePolls = new Map<string, NodeJS.Timeout>();
  private activeScheduled = new Map<string, NodeJS.Timeout>();
  private cancelledPolls = new Set<string>(); // Track cancelled polls
  private tools: Map<string, ToolFunction>;

  constructor(tools: ToolFunction[] = []) {
    super();
    this.tools = new Map(tools.map((t) => [t.definition.function.name, t]));
  }

  /**
   * Start handling a task's external dependency
   */
  async startWaiting(task: Task): Promise<void> {
    if (!task.externalDependency) {
      return;
    }

    const dep = task.externalDependency;

    switch (dep.type) {
      case 'webhook':
        // Webhooks are passive - just wait for triggerWebhook() to be called
        break;

      case 'poll':
        this.startPolling(task);
        break;

      case 'scheduled':
        this.scheduleTask(task);
        break;

      case 'manual':
        // Manual tasks wait for completeManually() to be called
        break;
    }
  }

  /**
   * Stop waiting on a task's external dependency
   */
  stopWaiting(task: Task): void {
    if (!task.externalDependency) {
      return;
    }

    // Mark poll as cancelled (for async loop to check)
    this.cancelledPolls.add(task.id);

    // Clear any active polling timer (now using setTimeout with backoff)
    const pollTimer = this.activePolls.get(task.id);
    if (pollTimer) {
      clearTimeout(pollTimer);
      this.activePolls.delete(task.id);
    }

    const scheduleTimer = this.activeScheduled.get(task.id);
    if (scheduleTimer) {
      clearTimeout(scheduleTimer);
      this.activeScheduled.delete(task.id);
    }
  }

  /**
   * Trigger a webhook
   */
  async triggerWebhook(webhookId: string, data: unknown): Promise<void> {
    this.emit('webhook:received', { webhookId, data });
  }

  /**
   * Complete a manual task
   */
  async completeManual(taskId: string, data: unknown): Promise<void> {
    this.emit('manual:completed', { taskId, data });
  }

  /**
   * Start polling for a task with exponential backoff
   */
  private startPolling(task: Task): void {
    const dep = task.externalDependency!;
    const pollConfig = dep.pollConfig!;

    // Configure backoff: start at configured interval, cap at 4x initial
    const backoffConfig: BackoffConfig = {
      strategy: 'exponential',
      initialDelayMs: pollConfig.intervalMs,
      maxDelayMs: pollConfig.intervalMs * 4, // Cap at 4x initial interval
      jitter: true,
      jitterFactor: 0.1, // ±10% jitter to prevent thundering herd
    };

    // Clear any previous cancellation flag
    this.cancelledPolls.delete(task.id);

    // Use async IIFE for the polling loop with backoff
    (async () => {
      let attempts = 0;

      while (attempts < pollConfig.maxAttempts) {
        // Check if cancelled before each attempt
        if (this.cancelledPolls.has(task.id)) {
          this.cancelledPolls.delete(task.id);
          return;
        }

        attempts++;

        try {
          // Get the tool
          const tool = this.tools.get(pollConfig.toolName);
          if (!tool) {
            console.error(`Poll tool ${pollConfig.toolName} not found`);
            return;
          }

          // Execute the tool
          const result = await tool.execute(pollConfig.toolArgs);

          // Check if result indicates completion
          // For simplicity, any truthy result means complete
          if (result) {
            this.emit('poll:success', { taskId: task.id, data: result });
            return; // Success - exit loop
          }
        } catch (error) {
          console.error(`Poll error for task ${task.id}:`, error);
        }

        // Check if more attempts remain
        if (attempts >= pollConfig.maxAttempts) {
          this.emit('poll:timeout', { taskId: task.id });
          return;
        }

        // Wait with backoff before next attempt
        const delay = calculateBackoff(attempts, backoffConfig);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay);
          // Store timer for cancellation
          this.activePolls.set(task.id, timer);
        });

        // Check if cancelled after wait
        if (this.cancelledPolls.has(task.id)) {
          this.cancelledPolls.delete(task.id);
          return;
        }
      }
    })();
  }

  /**
   * Schedule a task to trigger at a specific time
   */
  private scheduleTask(task: Task): void {
    const dep = task.externalDependency!;
    const scheduledAt = dep.scheduledAt!;

    const delay = scheduledAt - Date.now();

    if (delay <= 0) {
      // Already past scheduled time, trigger immediately
      this.emit('scheduled:triggered', { taskId: task.id });
      return;
    }

    const timer = setTimeout(() => {
      this.emit('scheduled:triggered', { taskId: task.id });
      this.activeScheduled.delete(task.id);
    }, delay);

    this.activeScheduled.set(task.id, timer);
  }

  /**
   * Cleanup all active dependencies
   */
  cleanup(): void {
    // Mark all active polls as cancelled
    for (const taskId of this.activePolls.keys()) {
      this.cancelledPolls.add(taskId);
    }

    // Clear all polling timers (now using setTimeout with backoff)
    for (const timer of this.activePolls.values()) {
      clearTimeout(timer);
    }
    this.activePolls.clear();

    // Clear scheduled timers
    for (const timer of this.activeScheduled.values()) {
      clearTimeout(timer);
    }
    this.activeScheduled.clear();
  }

  /**
   * Update available tools
   */
  updateTools(tools: ToolFunction[]): void {
    this.tools = new Map(tools.map((t) => [t.definition.function.name, t]));
  }
}
