/**
 * Generic BFS traversal built on top of IMemoryStore's required methods.
 * Used automatically when a store does not implement the optional `traverse` capability.
 */

import type {
  EntityId,
  IFact,
  IMemoryStore,
  Neighborhood,
  ScopeFilter,
  TraversalOptions,
} from './types.js';

export async function genericTraverse(
  store: IMemoryStore,
  startId: EntityId,
  opts: TraversalOptions,
  scope: ScopeFilter,
): Promise<Neighborhood> {
  const direction = opts.direction;
  const predicates = opts.predicates && opts.predicates.length > 0 ? new Set(opts.predicates) : null;
  const maxDepth = Math.max(0, opts.maxDepth);
  // `limit` is edges, not nodes — matches the `memory_graph` tool contract.
  // Nodes get resolved for every endpoint of the surviving edges, so node
  // count is naturally bounded at 2*edgeLimit + 1 and stays consistent with
  // the returned edges (every edge's from/to is guaranteed in `nodes`).
  const edgeLimit = opts.limit ?? Infinity;

  const visited = new Set<EntityId>();
  const nodes: Neighborhood['nodes'] = [];
  const edges: Neighborhood['edges'] = [];

  const startEntity = await store.getEntity(startId, scope);
  if (!startEntity) return { nodes: [], edges: [] };
  visited.add(startId);
  nodes.push({ entity: startEntity, depth: 0 });

  let frontier: EntityId[] = [startId];

  outer: for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const nextFrontier: EntityId[] = [];

    for (const currentId of frontier) {
      const neighborFacts: IFact[] = [];

      if (direction === 'out' || direction === 'both') {
        const out = await collectFacts(store, { subjectId: currentId, asOf: opts.asOf }, scope);
        for (const fact of out) {
          if (!fact.objectId) continue;
          if (predicates && !predicates.has(fact.predicate)) continue;
          neighborFacts.push(fact);
        }
      }

      if (direction === 'in' || direction === 'both') {
        const inEdges = await collectFacts(store, { objectId: currentId, asOf: opts.asOf }, scope);
        for (const fact of inEdges) {
          if (!fact.objectId) continue;
          if (predicates && !predicates.has(fact.predicate)) continue;
          neighborFacts.push(fact);
        }
      }

      for (const fact of neighborFacts) {
        const otherId = fact.subjectId === currentId ? fact.objectId! : fact.subjectId;
        edges.push({
          fact,
          from: fact.subjectId,
          to: fact.objectId!,
          depth,
        });

        if (!visited.has(otherId)) {
          visited.add(otherId);
          const otherEntity = await store.getEntity(otherId, scope);
          if (otherEntity) {
            nodes.push({ entity: otherEntity, depth });
            nextFrontier.push(otherId);
          }
        }

        if (edges.length >= edgeLimit) break outer;
      }
    }

    frontier = nextFrontier;
  }

  return { nodes, edges };
}

async function collectFacts(
  store: IMemoryStore,
  filter: { subjectId?: EntityId; objectId?: EntityId; asOf?: Date },
  scope: ScopeFilter,
): Promise<IFact[]> {
  const collected: IFact[] = [];
  let cursor: string | undefined;
  const PAGE = 200;
  // Bounded paging — real adapters should rarely exceed one page per neighbor.
  // We cap at a safety limit to avoid runaway loops from buggy adapters.
  const SAFETY_CAP = 5000;
  while (collected.length < SAFETY_CAP) {
    const page = await store.findFacts(
      { ...filter, kind: 'atomic' },
      { limit: PAGE, cursor, orderBy: { field: 'observedAt', direction: 'desc' } },
      scope,
    );
    collected.push(...page.items);
    if (!page.nextCursor || page.items.length === 0) break;
    cursor = page.nextCursor;
  }
  return collected;
}
