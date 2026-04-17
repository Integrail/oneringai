/**
 * Unit tests for memory/Ranking.ts — scoreFact + rankFacts.
 */

import { describe, it, expect } from 'vitest';
import { scoreFact, rankFacts } from '@/memory/Ranking.js';
import type { IFact, RankingConfig } from '@/memory/types.js';

function makeFact(partial: Partial<IFact>): IFact {
  const now = new Date('2026-04-17T00:00:00Z');
  return {
    id: partial.id ?? 'fact_1',
    subjectId: partial.subjectId ?? 'ent_1',
    predicate: partial.predicate ?? 'observation',
    kind: partial.kind ?? 'atomic',
    createdAt: partial.createdAt ?? now,
    ...partial,
  };
}

describe('Ranking', () => {
  const now = new Date('2026-04-17T00:00:00Z');

  describe('scoreFact', () => {
    it('returns confidence × 1 × 1 for a just-observed fact with default config', () => {
      const fact = makeFact({ confidence: 0.9, observedAt: now });
      expect(scoreFact(fact, {}, now)).toBeCloseTo(0.9, 5);
    });

    it('defaults confidence to 1.0 when missing', () => {
      const fact = makeFact({ observedAt: now });
      expect(scoreFact(fact, {}, now)).toBe(1);
    });

    it('returns 0 when confidence is below minConfidence', () => {
      const fact = makeFact({ confidence: 0.1, observedAt: now });
      const config: RankingConfig = { minConfidence: 0.5 };
      expect(scoreFact(fact, config, now)).toBe(0);
    });

    it('applies half-life recency decay', () => {
      // halfLife = 30 days, fact observed 30 days ago → recency factor = 0.5
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
      const fact = makeFact({ confidence: 1, observedAt: thirtyDaysAgo });
      const score = scoreFact(fact, { recencyHalfLifeDays: 30 }, now);
      expect(score).toBeCloseTo(0.5, 5);
    });

    it('applies predicate weights', () => {
      const fact = makeFact({ confidence: 1, predicate: 'works_at', observedAt: now });
      const config: RankingConfig = { predicateWeights: { works_at: 2.5 } };
      expect(scoreFact(fact, config, now)).toBeCloseTo(2.5, 5);
    });

    it('defaults predicate weight to 1.0 when not in map', () => {
      const fact = makeFact({ confidence: 1, predicate: 'obscure', observedAt: now });
      const config: RankingConfig = { predicateWeights: { works_at: 2 } };
      expect(scoreFact(fact, config, now)).toBe(1);
    });

    it('falls back to createdAt when observedAt is missing', () => {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
      const fact = makeFact({ confidence: 1, createdAt: thirtyDaysAgo });
      const score = scoreFact(fact, { recencyHalfLifeDays: 30 }, now);
      expect(score).toBeCloseTo(0.5, 5);
    });

    it('combines confidence × recency × predicate weight', () => {
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000);
      const fact = makeFact({
        confidence: 0.8,
        predicate: 'mentioned',
        observedAt: sixtyDaysAgo,
      });
      // halfLife=60 → recency=0.5; weight=0.3; confidence=0.8 → 0.8 × 0.5 × 0.3 = 0.12
      const score = scoreFact(
        fact,
        { recencyHalfLifeDays: 60, predicateWeights: { mentioned: 0.3 } },
        now,
      );
      expect(score).toBeCloseTo(0.12, 5);
    });
  });

  describe('rankFacts', () => {
    it('sorts facts descending by score', () => {
      const facts = [
        makeFact({ id: 'low', confidence: 0.3, observedAt: now }),
        makeFact({ id: 'high', confidence: 0.9, observedAt: now }),
        makeFact({ id: 'mid', confidence: 0.6, observedAt: now }),
      ];
      const ranked = rankFacts(facts, {}, now);
      expect(ranked.map((f) => f.id)).toEqual(['high', 'mid', 'low']);
    });

    it('filters out facts scoring 0 (below minConfidence)', () => {
      const facts = [
        makeFact({ id: 'keep', confidence: 0.9, observedAt: now }),
        makeFact({ id: 'drop', confidence: 0.1, observedAt: now }),
      ];
      const ranked = rankFacts(facts, { minConfidence: 0.5 }, now);
      expect(ranked.map((f) => f.id)).toEqual(['keep']);
    });

    it('returns empty array for empty input', () => {
      expect(rankFacts([], {}, now)).toEqual([]);
    });

    it('stable enough ordering — older high-confidence still beats newer low-confidence', () => {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
      const facts = [
        makeFact({ id: 'new_low', confidence: 0.3, observedAt: now }),
        makeFact({ id: 'old_high', confidence: 0.9, observedAt: thirtyDaysAgo }),
      ];
      const ranked = rankFacts(facts, { recencyHalfLifeDays: 90 }, now);
      expect(ranked[0]!.id).toBe('old_high');
    });
  });
});
