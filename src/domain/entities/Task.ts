/**
 * Task and Plan entities for TaskAgent
 *
 * Defines the data structures for task-based autonomous agents.
 */

/**
 * Task status lifecycle
 */
export type TaskStatus =
  | 'pending'           // Not started
  | 'blocked'           // Dependencies not met
  | 'in_progress'       // Currently executing
  | 'waiting_external'  // Waiting on external event
  | 'completed'         // Successfully finished
  | 'failed'            // Failed after max retries
  | 'skipped'           // Skipped (condition not met)
  | 'cancelled';        // Manually cancelled

/**
 * Plan status
 */
export type PlanStatus =
  | 'pending'
  | 'running'
  | 'suspended'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Condition operators for conditional task execution
 */
export type ConditionOperator =
  | 'exists'
  | 'not_exists'
  | 'equals'
  | 'contains'
  | 'truthy'
  | 'greater_than'
  | 'less_than';

/**
 * Task condition - evaluated before execution
 */
export interface TaskCondition {
  memoryKey: string;
  operator: ConditionOperator;
  value?: unknown;
  onFalse: 'skip' | 'fail' | 'wait';
}

/**
 * External dependency configuration
 */
export interface ExternalDependency {
  type: 'webhook' | 'poll' | 'manual' | 'scheduled';

  /** For webhook: unique ID to match incoming webhook */
  webhookId?: string;

  /** For poll: how to check if complete */
  pollConfig?: {
    toolName: string;
    toolArgs: Record<string, unknown>;
    intervalMs: number;
    maxAttempts: number;
  };

  /** For scheduled: when to resume */
  scheduledAt?: number;

  /** For manual: description of what's needed */
  manualDescription?: string;

  /** Timeout for all types */
  timeoutMs?: number;

  /** Current state */
  state: 'waiting' | 'received' | 'timeout';

  /** Data received from external source */
  receivedData?: unknown;
  receivedAt?: number;
}

/**
 * Task execution settings
 */
export interface TaskExecution {
  /** Can run in parallel with other parallel tasks */
  parallel?: boolean;

  /** Max concurrent if this spawns sub-work */
  maxConcurrency?: number;

  /** Priority (higher = executed first) */
  priority?: number;
}

/**
 * A single unit of work
 */
export interface Task {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;

  /** Tasks that must complete before this one (task IDs) */
  dependsOn: string[];

  /** External dependency (if waiting on external event) */
  externalDependency?: ExternalDependency;

  /** Condition for execution */
  condition?: TaskCondition;

  /** Execution settings */
  execution?: TaskExecution;

  /** Optional expected output description */
  expectedOutput?: string;

  /** Result after completion */
  result?: {
    success: boolean;
    output?: unknown;
    error?: string;
  };

  /** Timestamps */
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  lastUpdatedAt: number;

  /** Retry tracking */
  attempts: number;
  maxAttempts: number;

  /** Metadata for extensions */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a task
 */
export interface TaskInput {
  id?: string;
  name: string;
  description: string;
  dependsOn?: string[];           // Task names or IDs
  externalDependency?: ExternalDependency;
  condition?: TaskCondition;
  execution?: TaskExecution;
  expectedOutput?: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Plan concurrency settings
 */
export interface PlanConcurrency {
  maxParallelTasks: number;
  strategy: 'fifo' | 'priority' | 'shortest-first';
}

/**
 * Execution plan - a goal with steps to achieve it
 */
export interface Plan {
  id: string;
  goal: string;
  context?: string;

  tasks: Task[];

  /** Concurrency settings */
  concurrency?: PlanConcurrency;

  /** Can agent modify the plan? */
  allowDynamicTasks: boolean;

  /** Plan status */
  status: PlanStatus;

  /** Why is the plan suspended? */
  suspendedReason?: {
    type: 'waiting_external' | 'manual_pause' | 'error';
    taskId?: string;
    message?: string;
  };

  /** Timestamps */
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  lastUpdatedAt: number;

  /** For resume: which task to continue from */
  currentTaskId?: string;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a plan
 */
export interface PlanInput {
  goal: string;
  context?: string;
  tasks: TaskInput[];
  concurrency?: PlanConcurrency;
  allowDynamicTasks?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Memory access interface for condition evaluation
 */
export interface ConditionMemoryAccess {
  get(key: string): Promise<unknown>;
}

// ============ Factory Functions ============

/**
 * Create a task with defaults
 */
export function createTask(input: TaskInput): Task {
  const now = Date.now();
  const id = input.id ?? `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    name: input.name,
    description: input.description,
    status: 'pending',
    dependsOn: input.dependsOn ?? [],
    externalDependency: input.externalDependency,
    condition: input.condition,
    execution: input.execution,
    expectedOutput: input.expectedOutput,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    createdAt: now,
    lastUpdatedAt: now,
    metadata: input.metadata,
  };
}

/**
 * Create a plan with tasks
 */
export function createPlan(input: PlanInput): Plan {
  const now = Date.now();
  const id = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create tasks first
  const tasks = input.tasks.map((taskInput) => createTask(taskInput));

  // Build name to ID map
  const nameToId = new Map<string, string>();
  for (const task of tasks) {
    nameToId.set(task.name, task.id);
  }

  // Resolve dependencies from names to IDs
  for (let i = 0; i < tasks.length; i++) {
    const taskInput = input.tasks[i]!;
    const task = tasks[i]!;

    if (taskInput.dependsOn && taskInput.dependsOn.length > 0) {
      task.dependsOn = taskInput.dependsOn.map((dep) => {
        // Check if it's already an ID (starts with 'task-')
        if (dep.startsWith('task-')) {
          return dep;
        }

        // Otherwise, it's a name - resolve it
        const resolvedId = nameToId.get(dep);
        if (!resolvedId) {
          throw new Error(`Task dependency "${dep}" not found in plan`);
        }
        return resolvedId;
      });
    }
  }

  return {
    id,
    goal: input.goal,
    context: input.context,
    tasks,
    concurrency: input.concurrency,
    allowDynamicTasks: input.allowDynamicTasks ?? true,
    status: 'pending',
    createdAt: now,
    lastUpdatedAt: now,
    metadata: input.metadata,
  };
}

// ============ Task Utilities ============

/**
 * Check if a task can be executed (dependencies met, status is pending)
 */
export function canTaskExecute(task: Task, allTasks: Task[]): boolean {
  // Must be pending
  if (task.status !== 'pending') {
    return false;
  }

  // Check if all dependencies are completed
  if (task.dependsOn.length > 0) {
    for (const depId of task.dependsOn) {
      const depTask = allTasks.find((t) => t.id === depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get the next tasks that can be executed
 */
export function getNextExecutableTasks(plan: Plan): Task[] {
  const executable = plan.tasks.filter((task) => canTaskExecute(task, plan.tasks));

  if (executable.length === 0) {
    return [];
  }

  // If no concurrency config, return sequential (first one only)
  if (!plan.concurrency) {
    return [executable[0]!];
  }

  // Count currently running tasks
  const runningCount = plan.tasks.filter((t) => t.status === 'in_progress').length;
  const availableSlots = plan.concurrency.maxParallelTasks - runningCount;

  if (availableSlots <= 0) {
    return [];
  }

  // Filter for parallel-capable tasks
  const parallelTasks = executable.filter((task) => task.execution?.parallel === true);

  if (parallelTasks.length === 0) {
    // No parallel tasks available, return first sequential task
    return [executable[0]!];
  }

  // Sort by strategy
  let sortedTasks = [...parallelTasks];
  if (plan.concurrency.strategy === 'priority') {
    sortedTasks.sort((a, b) => (b.execution?.priority ?? 0) - (a.execution?.priority ?? 0));
  }
  // 'fifo' and 'shortest-first' use default order (creation order)

  // Return up to availableSlots tasks
  return sortedTasks.slice(0, availableSlots);
}

/**
 * Evaluate a task condition against memory
 */
export async function evaluateCondition(
  condition: TaskCondition,
  memory: ConditionMemoryAccess
): Promise<boolean> {
  const value = await memory.get(condition.memoryKey);

  switch (condition.operator) {
    case 'exists':
      return value !== undefined;

    case 'not_exists':
      return value === undefined;

    case 'equals':
      return value === condition.value;

    case 'contains':
      if (Array.isArray(value)) {
        return value.includes(condition.value);
      }
      if (typeof value === 'string' && typeof condition.value === 'string') {
        return value.includes(condition.value);
      }
      return false;

    case 'truthy':
      return !!value;

    case 'greater_than':
      if (typeof value === 'number' && typeof condition.value === 'number') {
        return value > condition.value;
      }
      return false;

    case 'less_than':
      if (typeof value === 'number' && typeof condition.value === 'number') {
        return value < condition.value;
      }
      return false;

    default:
      return false;
  }
}

/**
 * Update task status and timestamps
 */
export function updateTaskStatus(task: Task, status: TaskStatus): Task {
  const now = Date.now();
  const updated: Task = {
    ...task,
    status,
    lastUpdatedAt: now,
  };

  // Set startedAt when moving to in_progress (first time only)
  // But always increment attempts when moving to in_progress
  if (status === 'in_progress') {
    if (!updated.startedAt) {
      updated.startedAt = now;
    }
    updated.attempts += 1;
  }

  // Set completedAt when moving to completed or failed
  if ((status === 'completed' || status === 'failed') && !updated.completedAt) {
    updated.completedAt = now;
  }

  return updated;
}

/**
 * Check if a task is blocked by dependencies
 */
export function isTaskBlocked(task: Task, allTasks: Task[]): boolean {
  if (task.dependsOn.length === 0) {
    return false;
  }

  for (const depId of task.dependsOn) {
    const depTask = allTasks.find((t) => t.id === depId);
    if (!depTask) {
      return true; // Dependency not found
    }
    if (depTask.status !== 'completed') {
      return true; // Dependency not completed
    }
  }

  return false;
}

/**
 * Get the dependency tasks for a task
 */
export function getTaskDependencies(task: Task, allTasks: Task[]): Task[] {
  if (task.dependsOn.length === 0) {
    return [];
  }

  return task.dependsOn
    .map((depId) => allTasks.find((t) => t.id === depId))
    .filter((t): t is Task => t !== undefined);
}

/**
 * Resolve task name dependencies to task IDs
 * Modifies taskInputs in place
 */
export function resolveDependencies(taskInputs: TaskInput[], tasks: Task[]): void {
  // Build name to ID map
  const nameToId = new Map<string, string>();
  for (const task of tasks) {
    nameToId.set(task.name, task.id);
  }

  // Resolve dependencies
  for (const input of taskInputs) {
    if (input.dependsOn && input.dependsOn.length > 0) {
      input.dependsOn = input.dependsOn.map((dep) => {
        // If it's already an ID, keep it
        if (dep.startsWith('task-')) {
          return dep;
        }

        // Otherwise, resolve name to ID
        const resolvedId = nameToId.get(dep);
        if (!resolvedId) {
          throw new Error(`Task dependency "${dep}" not found`);
        }
        return resolvedId;
      });
    }
  }
}
