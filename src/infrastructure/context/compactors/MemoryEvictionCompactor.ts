/**
 * Memory Eviction Compactor
 *
 * Evicts LRU entries from memory index
 * Works with memory components that have eviction metadata
 */

import type { IContextCompactor, IContextComponent, ITokenEstimator } from '../../../core/context/types.js';

export class MemoryEvictionCompactor implements IContextCompactor {
  readonly name = 'memory-eviction';
  readonly priority = 8;

  constructor(private estimator: ITokenEstimator) {}

  canCompact(component: IContextComponent): boolean {
    return (
      component.compactable &&
      (component.metadata?.strategy === 'evict' || component.name === 'memory_index')
    );
  }

  async compact(component: IContextComponent, targetTokens: number): Promise<IContextComponent> {
    // If memory component has eviction callback, use it
    if (component.metadata?.evict && typeof component.metadata.evict === 'function') {
      const currentTokens = this.estimator.estimateDataTokens(component.content);
      const tokensToFree = Math.max(0, currentTokens - targetTokens);

      // Estimate how many entries to evict
      const avgEntrySize = component.metadata.avgEntrySize as number || 100;
      const entriesToEvict = Math.ceil(tokensToFree / avgEntrySize);

      if (entriesToEvict > 0) {
        // Call eviction callback
        await (component.metadata.evict as (count: number) => Promise<void>)(entriesToEvict);

        // Get updated content
        if (component.metadata.getUpdatedContent && typeof component.metadata.getUpdatedContent === 'function') {
          const updatedContent = await (component.metadata.getUpdatedContent as () => Promise<unknown>)();

          return {
            ...component,
            content: updatedContent,
            metadata: {
              ...component.metadata,
              evicted: true,
              evictedCount: entriesToEvict,
            },
          };
        }
      }
    }

    // If no eviction mechanism, just return unchanged
    return component;
  }

  estimateSavings(component: IContextComponent): number {
    // Estimate based on average entry size
    const avgEntrySize = component.metadata?.avgEntrySize as number || 100;
    return avgEntrySize * 2; // Conservative estimate: evict 2 entries
  }
}
