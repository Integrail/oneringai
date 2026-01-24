/**
 * Context management strategies
 */

import type { IContextStrategy } from '../types.js';
import { ProactiveCompactionStrategy } from './ProactiveStrategy.js';
import { AggressiveCompactionStrategy } from './AggressiveStrategy.js';
import { LazyCompactionStrategy } from './LazyStrategy.js';
import { RollingWindowStrategy } from './RollingWindowStrategy.js';
import { AdaptiveStrategy } from './AdaptiveStrategy.js';

/**
 * Strategy factory
 */
export function createStrategy(
  name: string,
  options: Record<string, unknown> = {}
): IContextStrategy {
  switch (name) {
    case 'proactive':
      return new ProactiveCompactionStrategy();
    case 'aggressive':
      return new AggressiveCompactionStrategy(options);
    case 'lazy':
      return new LazyCompactionStrategy();
    case 'rolling-window':
      return new RollingWindowStrategy(options);
    case 'adaptive':
      return new AdaptiveStrategy(options);
    default:
      throw new Error(`Unknown context strategy: ${name}`);
  }
}

export {
  ProactiveCompactionStrategy,
  AggressiveCompactionStrategy,
  LazyCompactionStrategy,
  RollingWindowStrategy,
  AdaptiveStrategy,
};
