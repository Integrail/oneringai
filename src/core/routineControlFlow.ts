/**
 * Routine Control Flow — map, fold, until handlers + template resolution
 *
 * Control flow tasks delegate to executeRoutine() recursively with the shared agent,
 * using ICM keys (__map_item, __map_index, etc.) to pass iteration state.
 */

import type { Agent } from './Agent.js';
import type { Task, TaskInput, SubRoutineSpec, ConditionMemoryAccess, TaskMapFlow, TaskFoldFlow, TaskUntilFlow } from '../domain/entities/Task.js';
import { evaluateCondition } from '../domain/entities/Task.js';
import type { RoutineDefinition, RoutineExecution, RoutineParameter } from '../domain/entities/Routine.js';
import { createRoutineDefinition } from '../domain/entities/Routine.js';
import type { InContextMemoryPluginNextGen } from './context-nextgen/plugins/InContextMemoryPluginNextGen.js';
import type { WorkingMemoryPluginNextGen } from './context-nextgen/plugins/WorkingMemoryPluginNextGen.js';
import { executeRoutine } from './routineRunner.js';
import { logger } from '../infrastructure/observability/Logger.js';

// ============================================================================
// Constants
// ============================================================================

const HARD_MAX_ITERATIONS = 1000;
const ICM_LARGE_THRESHOLD = 5000; // tokens — results above this go to WM

/** Well-known ICM/WM keys used by the routine execution framework. */
export const ROUTINE_KEYS = {
  /** Plan overview with task statuses (ICM) */
  PLAN: '__routine_plan',
  /** Dependency results location guide (ICM) */
  DEPS: '__routine_deps',
  /** Prefix for per-dependency result keys (ICM/WM) */
  DEP_RESULT_PREFIX: '__dep_result_',
  /** Current map/fold item (ICM) */
  MAP_ITEM: '__map_item',
  /** Current map/fold index, 0-based (ICM) */
  MAP_INDEX: '__map_index',
  /** Total items in map/fold (ICM) */
  MAP_TOTAL: '__map_total',
  /** Running fold accumulator (ICM) */
  FOLD_ACCUMULATOR: '__fold_accumulator',
  /** Prefix for large dep results stored in WM findings tier */
  WM_DEP_FINDINGS_PREFIX: 'findings/__dep_result_',
} as const;

// ============================================================================
// Types
// ============================================================================

export interface ControlFlowResult {
  completed: boolean;
  result?: unknown;
  error?: string;
}

// ============================================================================
// Template Resolution
// ============================================================================

/**
 * Resolve template placeholders in text.
 *
 * Supported namespaces:
 * - {{param.name}} → inputs[name]
 * - {{map.item}} / {{map.index}} / {{map.total}} → ICM keys
 * - {{fold.accumulator}} → ICM key
 *
 * Non-string values are JSON.stringify'd. Unresolved templates are left as-is.
 */
export function resolveTemplates(
  text: string,
  inputs: Record<string, unknown>,
  icmPlugin: InContextMemoryPluginNextGen | null
): string {
  return text.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_match, namespace: string, key: string) => {
    let value: unknown;

    if (namespace === 'param') {
      value = inputs[key];
    } else if (namespace === 'map') {
      const icmKey = `__map_${key}`;
      value = icmPlugin?.get(icmKey);
    } else if (namespace === 'fold') {
      const icmKey = `__fold_${key}`;
      value = icmPlugin?.get(icmKey);
    } else {
      // Unknown namespace — leave as-is
      return _match;
    }

    if (value === undefined) {
      return _match; // Unresolved — leave as-is
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

/**
 * Resolve templates in task description and expectedOutput.
 * Returns a shallow copy — original task is NOT mutated.
 */
export function resolveTaskTemplates(
  task: Task,
  inputs: Record<string, unknown>,
  icmPlugin: InContextMemoryPluginNextGen | null
): Task {
  const resolvedDescription = resolveTemplates(task.description, inputs, icmPlugin);
  const resolvedExpectedOutput = task.expectedOutput
    ? resolveTemplates(task.expectedOutput, inputs, icmPlugin)
    : task.expectedOutput;

  if (resolvedDescription === task.description && resolvedExpectedOutput === task.expectedOutput) {
    return task; // No changes — avoid unnecessary copy
  }

  return {
    ...task,
    description: resolvedDescription,
    expectedOutput: resolvedExpectedOutput,
  };
}

// ============================================================================
// Parameter Validation
// ============================================================================

/**
 * Validate inputs against parameter definitions and apply defaults.
 * @throws Error if a required parameter is missing
 */
export function validateAndResolveInputs(
  parameters: RoutineParameter[] | undefined,
  inputs: Record<string, unknown> | undefined
): Record<string, unknown> {
  const resolved: Record<string, unknown> = { ...(inputs ?? {}) };

  if (!parameters || parameters.length === 0) {
    return resolved;
  }

  for (const param of parameters) {
    if (resolved[param.name] === undefined) {
      if (param.required) {
        throw new Error(`Missing required parameter: "${param.name}"`);
      }
      if (param.default !== undefined) {
        resolved[param.name] = param.default;
      }
    }
  }

  return resolved;
}

// ============================================================================
// Memory Helpers
// ============================================================================

/**
 * Read a value from ICM first, falling back to WM.
 */
export async function readMemoryValue(
  key: string,
  icmPlugin: InContextMemoryPluginNextGen | null,
  wmPlugin: WorkingMemoryPluginNextGen | null
): Promise<unknown> {
  // Try ICM first
  if (icmPlugin) {
    const icmValue = icmPlugin.get(key);
    if (icmValue !== undefined) return icmValue;
  }

  // Fall back to WM
  if (wmPlugin) {
    const wmValue = await wmPlugin.retrieve(key);
    if (wmValue !== undefined) return wmValue;
  }

  return undefined;
}

/**
 * Store a value in ICM (if small enough) or WM (if large).
 */
async function storeResult(
  key: string,
  description: string,
  value: unknown,
  icmPlugin: InContextMemoryPluginNextGen | null,
  wmPlugin: WorkingMemoryPluginNextGen | null
): Promise<void> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const estimatedTokens = Math.ceil(serialized.length / 4);

  if (estimatedTokens < ICM_LARGE_THRESHOLD && icmPlugin) {
    icmPlugin.set(key, description, value, 'high');
  } else if (wmPlugin) {
    await wmPlugin.store(key, description, serialized, { tier: 'findings' });
  } else if (icmPlugin) {
    // No WM — put in ICM anyway
    icmPlugin.set(key, description, value, 'high');
  }
}

// ============================================================================
// Sub-routine Resolution
// ============================================================================

/**
 * Resolve a SubRoutineSpec into a RoutineDefinition.
 * If it's already a RoutineDefinition, return as-is.
 * If it's TaskInput[], wrap into a minimal RoutineDefinition.
 */
export function resolveSubRoutine(spec: SubRoutineSpec, parentTaskName: string): RoutineDefinition {
  if (!Array.isArray(spec)) {
    // Already a RoutineDefinition
    return spec;
  }

  // It's TaskInput[] — wrap into a RoutineDefinition
  return createRoutineDefinition({
    name: `${parentTaskName} (sub-routine)`,
    description: `Sub-routine of ${parentTaskName}`,
    tasks: spec as TaskInput[],
  });
}

// ============================================================================
// Helpers
// ============================================================================

export function getPlugins(agent: Agent) {
  const icmPlugin = agent.context.getPlugin('in_context_memory') as InContextMemoryPluginNextGen | null;
  const wmPlugin = agent.context.memory as WorkingMemoryPluginNextGen | null;
  return { icmPlugin, wmPlugin };
}

function cleanMapKeys(icmPlugin: InContextMemoryPluginNextGen | null): void {
  if (!icmPlugin) return;
  icmPlugin.delete(ROUTINE_KEYS.MAP_ITEM);
  icmPlugin.delete(ROUTINE_KEYS.MAP_INDEX);
  icmPlugin.delete(ROUTINE_KEYS.MAP_TOTAL);
}

function cleanFoldKeys(icmPlugin: InContextMemoryPluginNextGen | null): void {
  if (!icmPlugin) return;
  cleanMapKeys(icmPlugin);
  icmPlugin.delete(ROUTINE_KEYS.FOLD_ACCUMULATOR);
}

/**
 * Read and validate the source array from memory, capping iterations.
 * Returns the array + maxIter, or a ControlFlowResult error.
 */
async function readSourceArray(
  flow: { sourceKey: string; maxIterations?: number },
  flowType: string,
  icmPlugin: InContextMemoryPluginNextGen | null,
  wmPlugin: WorkingMemoryPluginNextGen | null
): Promise<{ array: unknown[]; maxIter: number } | ControlFlowResult> {
  const sourceValue = await readMemoryValue(flow.sourceKey, icmPlugin, wmPlugin);
  if (!Array.isArray(sourceValue)) {
    return {
      completed: false,
      error: `${flowType} sourceKey "${flow.sourceKey}" is not an array (got ${typeof sourceValue})`,
    };
  }
  const maxIter = Math.min(sourceValue.length, flow.maxIterations ?? sourceValue.length, HARD_MAX_ITERATIONS);
  return { array: sourceValue, maxIter };
}

/**
 * Resolve a sub-routine spec and prepare an augmented copy for instruction injection.
 */
function prepareSubRoutine(
  tasks: SubRoutineSpec,
  parentTaskName: string
): { augmented: RoutineDefinition; baseInstructions: string } {
  const subRoutine = resolveSubRoutine(tasks, parentTaskName);
  return {
    augmented: { ...subRoutine },
    baseInstructions: subRoutine.instructions ?? '',
  };
}

/**
 * Get the output from the last completed task in a sub-execution,
 * iterating backwards without copying the array.
 */
function getSubRoutineOutput(execution: RoutineExecution): unknown {
  const tasks = execution.plan.tasks;
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i]!.status === 'completed') {
      return tasks[i]!.result?.output ?? null;
    }
  }
  return null;
}

/**
 * Set ICM iteration keys (__map_item, __map_index, __map_total) for map/fold loops.
 */
function setIterationKeys(
  icmPlugin: InContextMemoryPluginNextGen | null,
  item: unknown,
  index: number,
  total: number,
  label: string
): void {
  if (!icmPlugin) return;
  icmPlugin.set(ROUTINE_KEYS.MAP_ITEM, `Current ${label} item (${index + 1}/${total})`, item, 'high');
  icmPlugin.set(ROUTINE_KEYS.MAP_INDEX, `Current ${label} index (0-based)`, index, 'high');
  icmPlugin.set(ROUTINE_KEYS.MAP_TOTAL, `Total items in ${label}`, total, 'high');
}

/**
 * Wrap a promise with an optional timeout. Returns the promise result if it resolves
 * before the timeout, otherwise rejects with a descriptive error.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  label: string
): Promise<T> {
  if (!timeoutMs) return promise;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// ============================================================================
// Control Flow Handlers
// ============================================================================

/**
 * Handle map control flow: iterate array, run sub-routine per element.
 */
async function handleMap(
  agent: Agent,
  flow: TaskMapFlow,
  task: Task,
  inputs: Record<string, unknown>
): Promise<ControlFlowResult> {
  const { icmPlugin, wmPlugin } = getPlugins(agent);
  const log = logger.child({ controlFlow: 'map', task: task.name });

  // 1. Read source array
  const sourceResult = await readSourceArray(flow, 'Map', icmPlugin, wmPlugin);
  if ('completed' in sourceResult) return sourceResult;
  const { array, maxIter } = sourceResult;
  const results: unknown[] = [];

  // 2. Resolve sub-routine
  const { augmented, baseInstructions } = prepareSubRoutine(flow.tasks, task.name);

  log.info({ arrayLength: array.length, maxIterations: maxIter }, 'Starting map iteration');

  try {
    for (let i = 0; i < maxIter; i++) {
      setIterationKeys(icmPlugin, array[i], i, array.length, 'map');

      // Inject iteration-specific instructions
      augmented.instructions = [
        `You are processing item ${i + 1} of ${array.length} in a map operation.`,
        'The current item is available in your live context as __map_item.',
        'Current index (0-based) is in __map_index, total count in __map_total.',
        '',
        baseInstructions,
      ].join('\n');

      // Execute sub-routine recursively (with optional per-iteration timeout)
      const subExecution = await withTimeout(
        executeRoutine({ definition: augmented, agent, inputs }),
        flow.iterationTimeoutMs,
        `Map iteration ${i}`
      );

      if (subExecution.status !== 'completed') {
        return {
          completed: false,
          error: `Map iteration ${i} failed: ${subExecution.error ?? 'sub-routine failed'}`,
        };
      }

      results.push(getSubRoutineOutput(subExecution));
    }
  } finally {
    cleanMapKeys(icmPlugin);
  }

  // Store results if resultKey specified
  if (flow.resultKey) {
    await storeResult(flow.resultKey, `Map results from "${task.name}"`, results, icmPlugin, wmPlugin);
  }

  log.info({ resultCount: results.length }, 'Map completed');
  return { completed: true, result: results };
}

/**
 * Handle fold control flow: accumulate across array elements.
 */
async function handleFold(
  agent: Agent,
  flow: TaskFoldFlow,
  task: Task,
  inputs: Record<string, unknown>
): Promise<ControlFlowResult> {
  const { icmPlugin, wmPlugin } = getPlugins(agent);
  const log = logger.child({ controlFlow: 'fold', task: task.name });

  // 1. Read source array
  const sourceResult = await readSourceArray(flow, 'Fold', icmPlugin, wmPlugin);
  if ('completed' in sourceResult) return sourceResult;
  const { array, maxIter } = sourceResult;
  let accumulator: unknown = flow.initialValue;

  // 2. Resolve sub-routine
  const { augmented, baseInstructions } = prepareSubRoutine(flow.tasks, task.name);

  log.info({ arrayLength: array.length, maxIterations: maxIter }, 'Starting fold iteration');

  try {
    for (let i = 0; i < maxIter; i++) {
      setIterationKeys(icmPlugin, array[i], i, array.length, 'fold');
      if (icmPlugin) {
        icmPlugin.set(ROUTINE_KEYS.FOLD_ACCUMULATOR, 'Running accumulator — update via context_set', accumulator, 'high');
      }

      // Inject iteration-specific instructions
      augmented.instructions = [
        `You are processing item ${i + 1} of ${array.length} in a fold/accumulate operation.`,
        'The current item is in __map_item. The running accumulator is in __fold_accumulator.',
        'After processing, use context_set to update __fold_accumulator with the new accumulated value.',
        'Your final text response will also be captured as the result.',
        '',
        baseInstructions,
      ].join('\n');

      // Execute sub-routine (with optional per-iteration timeout)
      const subExecution = await withTimeout(
        executeRoutine({ definition: augmented, agent, inputs }),
        flow.iterationTimeoutMs,
        `Fold iteration ${i}`
      );

      if (subExecution.status !== 'completed') {
        return {
          completed: false,
          error: `Fold iteration ${i} failed: ${subExecution.error ?? 'sub-routine failed'}`,
        };
      }

      // Read new accumulator: try sub-execution's last task output first.
      // getSubRoutineOutput() returns null when no completed task exists —
      // any other value (including '', undefined, 0, false) is a valid accumulator.
      const taskOutput = getSubRoutineOutput(subExecution);

      if (taskOutput !== null) {
        accumulator = taskOutput;
      } else if (icmPlugin) {
        // Fallback: LLM may have updated via context_set
        const icmAccumulator = icmPlugin.get(ROUTINE_KEYS.FOLD_ACCUMULATOR);
        if (icmAccumulator !== undefined) {
          accumulator = icmAccumulator;
        }
      }
    }
  } finally {
    cleanFoldKeys(icmPlugin);
  }

  // Store final accumulator
  await storeResult(flow.resultKey, `Fold result from "${task.name}"`, accumulator, icmPlugin, wmPlugin);

  log.info('Fold completed');
  return { completed: true, result: accumulator };
}

/**
 * Handle until control flow: repeat until condition is met.
 */
async function handleUntil(
  agent: Agent,
  flow: TaskUntilFlow,
  task: Task,
  inputs: Record<string, unknown>
): Promise<ControlFlowResult> {
  const { icmPlugin, wmPlugin } = getPlugins(agent);
  const log = logger.child({ controlFlow: 'until', task: task.name });

  // Resolve sub-routine
  const { augmented, baseInstructions } = prepareSubRoutine(flow.tasks, task.name);

  log.info({ maxIterations: flow.maxIterations }, 'Starting until loop');

  // Build ConditionMemoryAccess adapter from readMemoryValue
  const memoryAccess: ConditionMemoryAccess = {
    get: (key: string) => readMemoryValue(key, icmPlugin, wmPlugin),
  };

  try {
    for (let i = 0; i < flow.maxIterations; i++) {
      // Set iteration key if configured
      if (flow.iterationKey && icmPlugin) {
        icmPlugin.set(flow.iterationKey, 'Current iteration index', i, 'high');
      }

      // Inject iteration-specific instructions
      augmented.instructions = [
        `You are in iteration ${i + 1} of a repeating operation (max ${flow.maxIterations}).`,
        'Complete the task. The loop will continue until its exit condition is met.',
        '',
        baseInstructions,
      ].join('\n');

      // Execute sub-routine (with optional per-iteration timeout)
      const subExecution = await withTimeout(
        executeRoutine({ definition: augmented, agent, inputs }),
        flow.iterationTimeoutMs,
        `Until iteration ${i}`
      );

      if (subExecution.status !== 'completed') {
        return {
          completed: false,
          error: `Until iteration ${i} failed: ${subExecution.error ?? 'sub-routine failed'}`,
        };
      }

      // Evaluate condition AFTER iteration
      const conditionMet = await evaluateCondition(flow.condition, memoryAccess);
      if (conditionMet) {
        log.info({ iteration: i + 1 }, 'Until condition met');
        return { completed: true };
      }
    }
  } finally {
    // Clean up iteration key if set
    if (flow.iterationKey && icmPlugin) {
      icmPlugin.delete(flow.iterationKey);
    }
  }

  return { completed: false, error: `Until loop: maxIterations (${flow.maxIterations}) exceeded` };
}

// ============================================================================
// Dispatcher
// ============================================================================

/**
 * Execute a control flow task. Dispatches to the appropriate handler.
 */
export async function executeControlFlow(
  agent: Agent,
  task: Task,
  inputs: Record<string, unknown>
): Promise<ControlFlowResult> {
  const flow = task.controlFlow!;

  switch (flow.type) {
    case 'map':
      return handleMap(agent, flow, task, inputs);
    case 'fold':
      return handleFold(agent, flow, task, inputs);
    case 'until':
      return handleUntil(agent, flow, task, inputs);
    default:
      return { completed: false, error: `Unknown control flow type: ${(flow as any).type}` };
  }
}
