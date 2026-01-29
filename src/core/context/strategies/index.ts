/**
 * Context management strategies
 */

import type { IContextStrategy } from '../types.js';
import { ProactiveCompactionStrategy, type ProactiveStrategyOptions } from './ProactiveStrategy.js';
import { AggressiveCompactionStrategy, type AggressiveStrategyOptions } from './AggressiveStrategy.js';
import { LazyCompactionStrategy, type LazyStrategyOptions } from './LazyStrategy.js';
import { RollingWindowStrategy, type RollingWindowOptions } from './RollingWindowStrategy.js';
import { AdaptiveStrategy, type AdaptiveStrategyOptions } from './AdaptiveStrategy.js';

/**
 * Union type of all strategy options
 */
export type StrategyOptions =
  | ProactiveStrategyOptions
  | AggressiveStrategyOptions
  | LazyStrategyOptions
  | RollingWindowOptions
  | AdaptiveStrategyOptions;

/**
 * Strategy factory - creates a strategy by name with options
 *
 * @param name - Strategy name
 * @param options - Strategy-specific options
 * @returns Configured strategy instance
 */
export function createStrategy(
  name: string,
  options: Record<string, unknown> = {}
): IContextStrategy {
  switch (name) {
    case 'proactive':
      return new ProactiveCompactionStrategy(options as ProactiveStrategyOptions);
    case 'aggressive':
      return new AggressiveCompactionStrategy(options as AggressiveStrategyOptions);
    case 'lazy':
      return new LazyCompactionStrategy(options as LazyStrategyOptions);
    case 'rolling-window':
      return new RollingWindowStrategy(options as RollingWindowOptions);
    case 'adaptive':
      return new AdaptiveStrategy(options as AdaptiveStrategyOptions);
    default:
      throw new Error(`Unknown context strategy: ${name}`);
  }
}

// Export base class
export { BaseCompactionStrategy, type BaseStrategyMetrics } from './BaseCompactionStrategy.js';

// Export strategy classes
export { ProactiveCompactionStrategy } from './ProactiveStrategy.js';
export { AggressiveCompactionStrategy } from './AggressiveStrategy.js';
export { LazyCompactionStrategy } from './LazyStrategy.js';
export { RollingWindowStrategy } from './RollingWindowStrategy.js';
export { AdaptiveStrategy } from './AdaptiveStrategy.js';

// Export strategy option types
export type { ProactiveStrategyOptions } from './ProactiveStrategy.js';
export type { AggressiveStrategyOptions } from './AggressiveStrategy.js';
export type { LazyStrategyOptions } from './LazyStrategy.js';
export type { RollingWindowOptions } from './RollingWindowStrategy.js';
export type { AdaptiveStrategyOptions } from './AdaptiveStrategy.js';
