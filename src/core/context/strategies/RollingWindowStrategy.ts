/**
 * Rolling Window Strategy
 *
 * - Maintains fixed-size window of recent context
 * - No compaction needed - just drops old items
 * - Very fast and predictable
 * - Good for: Real-time agents, streaming conversations
 */

import type {
  IContextStrategy,
  IContextComponent,
  ContextBudget,
  ContextManagerConfig,
} from '../types.js';

export interface RollingWindowOptions {
  /** Maximum number of messages to keep */
  maxMessages?: number;
  /** Maximum tokens per component */
  maxTokensPerComponent?: number;
}

export class RollingWindowStrategy implements IContextStrategy {
  readonly name = 'rolling-window';

  constructor(private options: RollingWindowOptions = {}) {}

  shouldCompact(_budget: ContextBudget, _config: ContextManagerConfig): boolean {
    // Never compact - we handle it in prepareComponents
    return false;
  }

  async prepareComponents(components: IContextComponent[]): Promise<IContextComponent[]> {
    return components.map((component) => {
      // Apply rolling window to array components (e.g., conversation history)
      if (Array.isArray(component.content)) {
        const maxMessages = this.options.maxMessages ?? 20;
        if (component.content.length > maxMessages) {
          return {
            ...component,
            content: component.content.slice(-maxMessages),
            metadata: {
              ...component.metadata,
              windowed: true,
              originalLength: component.content.length,
              keptLength: maxMessages,
            },
          };
        }
      }

      return component;
    });
  }

  async compact(): Promise<{ components: IContextComponent[]; log: string[]; tokensFreed: number }> {
    // Should never be called since shouldCompact returns false
    return { components: [], log: [], tokensFreed: 0 };
  }
}
