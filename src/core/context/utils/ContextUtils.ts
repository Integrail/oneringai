/**
 * Context Utilities - Shared functions for context management
 *
 * Extracted to avoid duplication across ContextManager and all strategies.
 */

import type { IContextComponent, ITokenEstimator } from '../types.js';

/**
 * Estimate tokens for a context component.
 * Handles both string content and structured data.
 *
 * @param component - The context component to estimate
 * @param estimator - Token estimator to use
 * @returns Estimated token count
 */
export function estimateComponentTokens(
  component: IContextComponent,
  estimator: ITokenEstimator
): number {
  if (typeof component.content === 'string') {
    return estimator.estimateTokens(component.content);
  }
  return estimator.estimateDataTokens(component.content);
}

/**
 * Sort components by priority for compaction.
 * Higher priority components are compacted first.
 * Only returns compactable components.
 *
 * @param components - Array of context components
 * @returns Sorted array of compactable components (highest priority first)
 */
export function sortCompactableByPriority(
  components: IContextComponent[]
): IContextComponent[] {
  return components
    .filter((c) => c.compactable)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Find a compactor that can handle the given component.
 *
 * @param component - The component to compact
 * @param compactors - Available compactors (should be sorted by priority)
 * @returns The first matching compactor, or undefined if none found
 */
export function findCompactorForComponent(
  component: IContextComponent,
  compactors: import('../types.js').IContextCompactor[]
): import('../types.js').IContextCompactor | undefined {
  return compactors.find((c) => c.canCompact(component));
}

/**
 * Calculate utilization ratio for a budget.
 *
 * @param used - Tokens used
 * @param reserved - Tokens reserved
 * @param total - Total tokens available
 * @returns Utilization ratio (0-1)
 */
export function calculateUtilizationRatio(
  used: number,
  reserved: number,
  total: number
): number {
  return (used + reserved) / total;
}

/**
 * Result of a compaction operation
 */
export interface CompactionResult {
  /** Updated components after compaction */
  components: IContextComponent[];
  /** Log of compaction actions taken */
  log: string[];
  /** Total tokens freed */
  tokensFreed: number;
}

/**
 * Options for the core compaction loop
 */
export interface CompactionLoopOptions {
  /** Components to compact */
  components: IContextComponent[];
  /** Target number of tokens to free */
  tokensToFree: number;
  /** Available compactors */
  compactors: import('../types.js').IContextCompactor[];
  /** Token estimator */
  estimator: ITokenEstimator;
  /** Calculate target size for a component given its current size and round number */
  calculateTargetSize: (beforeSize: number, round: number) => number;
  /** Maximum rounds of compaction (default: 1) */
  maxRounds?: number;
  /** Log prefix for messages (e.g., 'Proactive', 'Aggressive') */
  logPrefix?: string;
}

/**
 * Execute the core compaction loop.
 * This is the shared logic used by all compaction strategies.
 *
 * @param options - Compaction options
 * @returns Compaction result with updated components, log, and tokens freed
 */
export async function executeCompactionLoop(
  options: CompactionLoopOptions
): Promise<CompactionResult> {
  const {
    components,
    tokensToFree,
    compactors,
    estimator,
    calculateTargetSize,
    maxRounds = 1,
    logPrefix = '',
  } = options;

  const log: string[] = [];
  let current = [...components];
  let freedTokens = 0;
  let round = 0;

  // Get compactable components sorted by priority
  const sortedComponents = sortCompactableByPriority(current);

  while (freedTokens < tokensToFree && round < maxRounds) {
    round++;
    let roundFreed = 0;

    for (const component of sortedComponents) {
      if (freedTokens >= tokensToFree) break;

      // Find compactor for this component
      const compactor = findCompactorForComponent(component, compactors);
      if (!compactor) continue;

      // Estimate current size
      const beforeSize = estimateComponentTokens(component, estimator);

      // Calculate target size using strategy-specific logic
      const targetSize = calculateTargetSize(beforeSize, round);

      // Skip if target would be larger than current (nothing to compact)
      if (targetSize >= beforeSize) continue;

      // Compact the component
      const compacted = await compactor.compact(component, targetSize);

      // Update component in the array
      const index = current.findIndex((c) => c.name === component.name);
      if (index !== -1) {
        current[index] = compacted;
      }

      // Track savings
      const afterSize = estimateComponentTokens(compacted, estimator);
      const saved = beforeSize - afterSize;
      freedTokens += saved;
      roundFreed += saved;

      // Build log message
      const prefix = logPrefix ? `${logPrefix}: ` : '';
      const roundInfo = maxRounds > 1 ? `Round ${round}: ` : '';
      log.push(
        `${prefix}${roundInfo}${compactor.name} compacted "${component.name}" by ${saved} tokens`
      );
    }

    // If we didn't free anything this round, stop
    if (roundFreed === 0) break;
  }

  return { components: current, log, tokensFreed: freedTokens };
}
