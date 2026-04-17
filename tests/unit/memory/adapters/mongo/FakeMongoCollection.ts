/**
 * FakeMongoCollection — a minimal in-memory implementation of
 * IMongoCollectionLike used for unit testing MongoMemoryAdapter without a real
 * Mongo instance. Supports the subset of Mongo operators the adapter uses:
 *   $and, $or, $in, $exists, $elemMatch, $regex (with $options 'i'),
 *   $gte, $lte, $gt, $lt, $ne
 * plus $set / $inc update operators and a small aggregation ($match +
 * $graphLookup + $addFields + $vectorSearch for testing fast paths).
 */

import type {
  IMongoCollectionLike,
  MongoBulkOp,
  MongoFilter,
  MongoFindOptions,
  MongoUpdate,
  MongoUpdateOptions,
  MongoUpdateResult,
} from '@/memory/adapters/mongo/IMongoCollectionLike.js';

export class FakeMongoCollection<T extends { id: string }> implements IMongoCollectionLike<T> {
  private docs: T[] = [];
  private indexes: Array<{ spec: Record<string, 1 | -1>; unique: boolean; name?: string }> = [];
  private txActive = false;

  /** For verifying bulkWrite path — call count incremented on each invocation. */
  public bulkWriteCalls = 0;
  /** For verifying aggregate path. */
  public aggregateCalls = 0;

  constructor(private readonly name: string = 'fake') {}

  // ---------- helpers ----------
  get all(): T[] {
    return this.docs;
  }

  reset(): void {
    this.docs = [];
    this.indexes = [];
    this.bulkWriteCalls = 0;
    this.aggregateCalls = 0;
  }

  // ---------- writes ----------
  async insertOne(doc: T): Promise<void> {
    if (this.docs.some((d) => d.id === doc.id)) {
      const err = new Error(`E11000 duplicate key error on id ${doc.id}`);
      (err as { code?: number }).code = 11000;
      throw err;
    }
    this.docs.push(clone(doc));
  }

  async insertMany(docs: T[]): Promise<void> {
    for (const d of docs) await this.insertOne(d);
  }

  async updateOne(
    filter: MongoFilter,
    update: MongoUpdate,
    opts?: MongoUpdateOptions,
  ): Promise<MongoUpdateResult> {
    const idx = this.docs.findIndex((d) => matches(d, filter));
    if (idx === -1) {
      if (opts?.upsert) {
        // Build document from $set fields + id from filter.
        const setPart = (update as { $set?: Record<string, unknown> }).$set ?? {};
        const idFromFilter = (filter as { id?: string }).id;
        if (!idFromFilter) {
          throw new Error('FakeMongoCollection upsert requires id in filter');
        }
        const doc = { ...setPart, id: idFromFilter } as T;
        this.docs.push(clone(doc));
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    }
    const current = this.docs[idx]!;
    const next = applyUpdate(current, update);
    this.docs[idx] = clone(next);
    return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
  }

  async deleteOne(filter: MongoFilter): Promise<void> {
    const idx = this.docs.findIndex((d) => matches(d, filter));
    if (idx >= 0) this.docs.splice(idx, 1);
  }

  async deleteMany(filter: MongoFilter): Promise<void> {
    this.docs = this.docs.filter((d) => !matches(d, filter));
  }

  async bulkWrite(ops: Array<MongoBulkOp<T>>): Promise<void> {
    this.bulkWriteCalls++;
    for (const op of ops) {
      if ('insertOne' in op) await this.insertOne(op.insertOne.document);
      else if ('updateOne' in op) {
        await this.updateOne(op.updateOne.filter, op.updateOne.update, {
          upsert: op.updateOne.upsert,
        });
      } else if ('deleteOne' in op) {
        await this.deleteOne(op.deleteOne.filter);
      }
    }
  }

  // ---------- reads ----------
  async findOne(filter: MongoFilter, opts?: MongoFindOptions): Promise<T | null> {
    const hits = this.applyFind(filter, opts);
    return hits[0] ? clone(hits[0]) : null;
  }

  async find(filter: MongoFilter, opts?: MongoFindOptions): Promise<T[]> {
    return this.applyFind(filter, opts).map(clone);
  }

  async countDocuments(filter: MongoFilter): Promise<number> {
    return this.applyFind(filter).length;
  }

  private applyFind(filter: MongoFilter, opts?: MongoFindOptions): T[] {
    let out = this.docs.filter((d) => matches(d, filter));
    if (opts?.sort) {
      const entries = Object.entries(opts.sort);
      out = [...out].sort((a, b) => {
        for (const [field, dir] of entries) {
          const av = (a as Record<string, unknown>)[field];
          const bv = (b as Record<string, unknown>)[field];
          const cmp = compareAny(av, bv);
          if (cmp !== 0) return cmp * dir;
        }
        return 0;
      });
    }
    const skip = opts?.skip ?? 0;
    const limit = opts?.limit;
    out = out.slice(skip, limit ? skip + limit : undefined);
    return out;
  }

  async aggregate(pipeline: unknown[]): Promise<unknown[]> {
    this.aggregateCalls++;
    return evaluatePipeline(this.docs, pipeline);
  }

  async createIndex(
    spec: Record<string, 1 | -1>,
    opts?: { unique?: boolean; name?: string },
  ): Promise<void> {
    this.indexes.push({ spec, unique: !!opts?.unique, name: opts?.name });
  }

  get createdIndexes(): Array<{ spec: Record<string, 1 | -1>; name?: string }> {
    return [...this.indexes];
  }

  async withTransaction<R>(fn: () => Promise<R>): Promise<R> {
    if (this.txActive) return fn();
    this.txActive = true;
    try {
      return await fn();
    } finally {
      this.txActive = false;
    }
  }
}

/** Collection variant that has NO aggregate, NO bulkWrite — for fallback coverage. */
export class MinimalFakeMongoCollection<T extends { id: string }>
  implements IMongoCollectionLike<T>
{
  private readonly backing = new FakeMongoCollection<T>();

  insertOne(doc: T): Promise<void> {
    return this.backing.insertOne(doc);
  }
  insertMany(docs: T[]): Promise<void> {
    return this.backing.insertMany(docs);
  }
  updateOne(
    filter: MongoFilter,
    update: MongoUpdate,
    opts?: MongoUpdateOptions,
  ): Promise<MongoUpdateResult> {
    return this.backing.updateOne(filter, update, opts);
  }
  deleteOne(filter: MongoFilter): Promise<void> {
    return this.backing.deleteOne(filter);
  }
  deleteMany(filter: MongoFilter): Promise<void> {
    return this.backing.deleteMany(filter);
  }
  findOne(filter: MongoFilter, opts?: MongoFindOptions): Promise<T | null> {
    return this.backing.findOne(filter, opts);
  }
  find(filter: MongoFilter, opts?: MongoFindOptions): Promise<T[]> {
    return this.backing.find(filter, opts);
  }
  countDocuments(filter: MongoFilter): Promise<number> {
    return this.backing.countDocuments(filter);
  }
  // No aggregate, no bulkWrite, no createIndex, no withTransaction.
}

// =============================================================================
// Filter matcher — subset of Mongo query operators
// =============================================================================

function matches(doc: unknown, filter: MongoFilter): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const [key, value] of Object.entries(filter)) {
    if (key === '$and') {
      const list = value as MongoFilter[];
      if (!list.every((f) => matches(doc, f))) return false;
      continue;
    }
    if (key === '$or') {
      const list = value as MongoFilter[];
      if (!list.some((f) => matches(doc, f))) return false;
      continue;
    }

    const fieldVal = getField(doc, key);
    if (!fieldMatches(fieldVal, value)) return false;
  }
  return true;
}

function fieldMatches(actual: unknown, expected: unknown): boolean {
  if (expected === null) {
    return actual === null || actual === undefined;
  }
  if (expected instanceof Date) {
    return actual instanceof Date && actual.getTime() === expected.getTime();
  }
  if (typeof expected === 'object' && !Array.isArray(expected) && expected !== null) {
    const ops = expected as Record<string, unknown>;
    const keys = Object.keys(ops);
    if (keys.some((k) => k.startsWith('$'))) {
      return evaluateOperators(actual, ops);
    }
    // Nested object equality — fallback
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
  if (Array.isArray(actual)) {
    // Match if any element equals expected.
    return actual.some((v) => v === expected);
  }
  return actual === expected;
}

function evaluateOperators(actual: unknown, ops: Record<string, unknown>): boolean {
  for (const [op, expected] of Object.entries(ops)) {
    switch (op) {
      case '$exists': {
        const present = actual !== undefined;
        if (present !== !!expected) return false;
        break;
      }
      case '$eq':
        if (actual !== expected) return false;
        break;
      case '$ne':
        if (actual === expected) return false;
        break;
      case '$gt':
        if (!(compareAny(actual, expected) > 0)) return false;
        break;
      case '$gte':
        if (!(compareAny(actual, expected) >= 0)) return false;
        break;
      case '$lt':
        if (!(compareAny(actual, expected) < 0)) return false;
        break;
      case '$lte':
        if (!(compareAny(actual, expected) <= 0)) return false;
        break;
      case '$in': {
        const arr = expected as unknown[];
        if (Array.isArray(actual)) {
          if (!actual.some((v) => arr.includes(v))) return false;
        } else {
          if (!arr.includes(actual)) return false;
        }
        break;
      }
      case '$nin': {
        const arr = expected as unknown[];
        if (Array.isArray(actual)) {
          if (actual.some((v) => arr.includes(v))) return false;
        } else {
          if (arr.includes(actual)) return false;
        }
        break;
      }
      case '$regex': {
        const pattern = expected as string;
        const flags =
          (ops.$options as string | undefined) !== undefined ? (ops.$options as string) : '';
        const re = new RegExp(pattern, flags);
        if (Array.isArray(actual)) {
          if (!actual.some((v) => typeof v === 'string' && re.test(v))) return false;
        } else if (typeof actual !== 'string' || !re.test(actual)) {
          return false;
        }
        break;
      }
      case '$options':
        break; // handled alongside $regex
      case '$elemMatch': {
        if (!Array.isArray(actual)) return false;
        if (!actual.some((el) => matches(el, expected as MongoFilter))) return false;
        break;
      }
      default:
        // Unknown operator — treat as literal mismatch
        return false;
    }
  }
  return true;
}

function compareAny(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : 1;
  return 0;
}

function getField(doc: unknown, path: string): unknown {
  if (!doc || typeof doc !== 'object') return undefined;
  if (!path.includes('.')) return (doc as Record<string, unknown>)[path];
  const parts = path.split('.');
  let cur: unknown = doc;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (typeof cur !== 'object') return undefined;
    if (Array.isArray(cur)) {
      // Flatten one level: collect the path from every element.
      const collected: unknown[] = [];
      for (const el of cur) {
        const v = getField(el, p);
        if (Array.isArray(v)) collected.push(...v);
        else if (v !== undefined) collected.push(v);
      }
      cur = collected;
    } else {
      cur = (cur as Record<string, unknown>)[p];
    }
  }
  return cur;
}

function applyUpdate<T>(doc: T, update: MongoUpdate): T {
  const next = { ...(doc as Record<string, unknown>) };
  const $set = (update as { $set?: Record<string, unknown> }).$set;
  const $inc = (update as { $inc?: Record<string, number> }).$inc;
  if ($set) Object.assign(next, $set);
  if ($inc) {
    for (const [k, v] of Object.entries($inc)) {
      const cur = typeof next[k] === 'number' ? (next[k] as number) : 0;
      next[k] = cur + v;
    }
  }
  return next as T;
}

// =============================================================================
// Minimal aggregation pipeline — supports the operators our adapter uses
// =============================================================================

function evaluatePipeline(docs: unknown[], pipeline: unknown[]): unknown[] {
  let current = docs.map((d) => clone(d));
  for (const stage of pipeline as Array<Record<string, unknown>>) {
    if ('$match' in stage) {
      const filter = stage.$match as MongoFilter;
      current = current.filter((d) => matches(d, filter));
    } else if ('$addFields' in stage) {
      const fields = stage.$addFields as Record<string, unknown>;
      current = current.map((d) => {
        const out = { ...(d as Record<string, unknown>) };
        for (const [k, v] of Object.entries(fields)) {
          // Very minimal — support literal values + {$meta: '...'}
          if (typeof v === 'object' && v && '$meta' in v) {
            out[k] = (d as Record<string, unknown>)[k] ?? 0;
          } else {
            out[k] = v;
          }
        }
        return out;
      });
    } else if ('$graphLookup' in stage) {
      // Not exercised in unit tests — Mongo adapter turns off native graph
      // lookup when collection has no aggregate, and with `aggregate` we still
      // recommend iterative traversal via genericTraverse for deterministic tests.
      // Pass through empty descendants field.
      const params = stage.$graphLookup as { as: string };
      current = current.map((d) => ({ ...(d as Record<string, unknown>), [params.as]: [] }));
    } else if ('$vectorSearch' in stage) {
      // Stub: ignore vector search — integration tests cover real Atlas flow.
      current = [];
    }
  }
  return current;
}

function clone<T>(x: T): T {
  return structuredClone(x);
}
