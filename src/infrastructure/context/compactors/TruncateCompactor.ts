/**
 * Truncate Compactor
 *
 * Truncates content to target size by:
 * - For strings: Cut to character limit
 * - For arrays: Keep most recent items
 */

import type { IContextCompactor, IContextComponent, ITokenEstimator } from '../../../core/context/types.js';

export class TruncateCompactor implements IContextCompactor {
  readonly name = 'truncate';
  readonly priority = 10;

  constructor(private estimator: ITokenEstimator) {}

  canCompact(component: IContextComponent): boolean {
    return (
      component.compactable &&
      (component.metadata?.strategy === 'truncate' || component.metadata?.truncatable === true)
    );
  }

  async compact(component: IContextComponent, targetTokens: number): Promise<IContextComponent> {
    if (typeof component.content === 'string') {
      return this.truncateString(component, targetTokens);
    }

    if (Array.isArray(component.content)) {
      return this.truncateArray(component, targetTokens);
    }

    // Can't truncate other types
    return component;
  }

  estimateSavings(component: IContextComponent): number {
    const current = this.estimator.estimateDataTokens(component.content);
    return Math.floor(current * 0.5); // Estimate 50% reduction
  }

  private truncateString(component: IContextComponent, targetTokens: number): IContextComponent {
    const content = component.content as string;
    const currentTokens = this.estimator.estimateTokens(content);

    if (currentTokens <= targetTokens) {
      return component;
    }

    // Calculate character limit
    const targetChars = targetTokens * 4; // ~4 chars per token
    const truncated = content.substring(0, targetChars) + '\n[truncated...]';

    return {
      ...component,
      content: truncated,
      metadata: {
        ...component.metadata,
        truncated: true,
        originalLength: content.length,
        truncatedLength: truncated.length,
      },
    };
  }

  private truncateArray(component: IContextComponent, targetTokens: number): IContextComponent {
    const content = component.content as unknown[];
    let tokens = 0;
    const kept: unknown[] = [];

    // Keep most recent items that fit within target
    for (let i = content.length - 1; i >= 0; i--) {
      const item = content[i];
      const itemTokens = this.estimator.estimateDataTokens(item);

      if (tokens + itemTokens > targetTokens && kept.length > 0) {
        break;
      }

      kept.unshift(item);
      tokens += itemTokens;
    }

    const droppedLength = content.length - kept.length;

    // Only mark as truncated if we actually dropped items
    if (droppedLength === 0) {
      return component;
    }

    return {
      ...component,
      content: kept,
      metadata: {
        ...component.metadata,
        truncated: true,
        originalLength: content.length,
        keptLength: kept.length,
        droppedLength,
      },
    };
  }
}
