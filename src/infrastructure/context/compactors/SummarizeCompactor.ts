/**
 * Summarize Compactor (Placeholder)
 *
 * Uses LLM to create summaries of conversation history
 * TODO: Implement when needed
 */

import type { IContextCompactor, IContextComponent, ITokenEstimator } from '../../../core/context/types.js';

export class SummarizeCompactor implements IContextCompactor {
  readonly name = 'summarize';
  readonly priority = 5;

  constructor(private estimator: ITokenEstimator) {}

  canCompact(component: IContextComponent): boolean {
    return (
      component.compactable &&
      component.metadata?.strategy === 'summarize'
    );
  }

  async compact(component: IContextComponent, _targetTokens: number): Promise<IContextComponent> {
    // TODO: Implement LLM-based summarization
    // For now, just return the component unchanged
    console.warn('SummarizeCompactor not yet implemented - returning component unchanged');
    return component;
  }

  estimateSavings(component: IContextComponent): number {
    const current = this.estimator.estimateDataTokens(component.content);
    return Math.floor(current * 0.8); // Summaries typically save 80%
  }
}
