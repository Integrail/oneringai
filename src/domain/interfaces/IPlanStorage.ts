/**
 * Plan storage interface for plan persistence.
 * Implement for long-running agent support.
 */

import { Plan, Task, PlanStatus } from '../entities/Task.js';

export interface IPlanStorage {
  /**
   * Save or update a plan
   */
  savePlan(plan: Plan): Promise<void>;

  /**
   * Get plan by ID
   */
  getPlan(planId: string): Promise<Plan | undefined>;

  /**
   * Update a specific task within a plan
   */
  updateTask(planId: string, task: Task): Promise<void>;

  /**
   * Add a new task to a plan (for dynamic task creation)
   */
  addTask(planId: string, task: Task): Promise<void>;

  /**
   * Delete a plan
   */
  deletePlan(planId: string): Promise<void>;

  /**
   * List plans by status
   */
  listPlans(filter?: { status?: PlanStatus[] }): Promise<Plan[]>;

  /**
   * Find plans with tasks waiting on a specific webhook
   */
  findByWebhookId(webhookId: string): Promise<{ plan: Plan; task: Task } | undefined>;
}
