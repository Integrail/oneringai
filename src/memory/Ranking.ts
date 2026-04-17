/**
 * Pure ranking helpers shared by MemorySystem and adapters that want consistent scoring.
 * No dependencies beyond types.
 */

import type { IFact, RankingConfig } from './types.js';

const DEFAULT_HALF_LIFE_DAYS = 90;
const DEFAULT_MIN_CONFIDENCE = 0.2;
const MS_PER_DAY = 86_400_000;

export function scoreFact(fact: IFact, config: RankingConfig, now: Date): number {
  const minConfidence = config.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const confidence = fact.confidence ?? 1.0;
  if (confidence < minConfidence) return 0;

  const halfLifeDays = config.recencyHalfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const observedAt = fact.observedAt ?? fact.createdAt;
  const ageMs = Math.max(0, now.getTime() - observedAt.getTime());
  const ageDays = ageMs / MS_PER_DAY;
  const recency = Math.pow(0.5, ageDays / halfLifeDays);

  const predicateWeight = config.predicateWeights?.[fact.predicate] ?? 1.0;

  return confidence * recency * predicateWeight;
}

export function rankFacts(facts: IFact[], config: RankingConfig, now: Date): IFact[] {
  const scored = facts.map((fact) => ({ fact, score: scoreFact(fact, config, now) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).map((s) => s.fact);
}
