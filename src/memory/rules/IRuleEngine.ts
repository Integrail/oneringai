/**
 * Rule engine contract — interface only.
 *
 * MemorySystem calls `deriveFor(entityId, view, scope)` via its `deriveFactsFor`
 * method when a caller asks for inferred facts. The engine receives a read-only
 * `IScopedMemoryView` (already scoped to the caller) and returns partial IFact
 * specs. MemorySystem validates, finalizes ids / timestamps, and persists them
 * via the same `addFact` path — so rules cannot bypass scope invariants.
 *
 * No concrete implementation ships in v1. A forward-chaining engine will live
 * in a sibling folder when we build it.
 */

export type { IRuleEngine, IScopedMemoryView } from '../types.js';
