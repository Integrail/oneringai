/**
 * MongoMemoryAdapter — real-Mongo integration test.
 *
 * Gated: skips entirely if `mongodb` + `mongodb-memory-server` are not
 * installed. To run it, install both as devDependencies:
 *
 *   npm install --save-dev mongodb mongodb-memory-server
 *
 * Then:
 *
 *   npm run test:integration
 *
 * The test spins up an in-process MongoDB, exercises the adapter end-to-end
 * via the real driver (RawMongoCollection), and verifies scope filter
 * pushdown, indexes, bulk writes, and semantic fallback.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryAdapter } from '@/memory/adapters/mongo/MongoMemoryAdapter.js';
import { RawMongoCollection } from '@/memory/adapters/mongo/RawMongoCollection.js';
import { ensureIndexes } from '@/memory/adapters/mongo/indexes.js';
import type { IEntity, IFact } from '@/memory/types.js';

// Dynamic imports so Vitest can resolve this file even when the peer deps are absent.
let MongoClient: unknown;
let MongoMemoryServer: unknown;
let available = false;

try {
  ({ MongoClient } = await import('mongodb'));
  ({ MongoMemoryServer } = await import('mongodb-memory-server'));
  available = !!MongoClient && !!MongoMemoryServer;
} catch {
  available = false;
}

const describeIfAvailable = available ? describe : describe.skip;

describeIfAvailable('MongoMemoryAdapter (real Mongo)', () => {
  let server: { stop: () => Promise<void>; getUri: () => string };
  let client: { close: () => Promise<void>; db: (n: string) => { collection: (n: string) => unknown } };
  let adapter: MongoMemoryAdapter;

  beforeAll(async () => {
    const MMS = MongoMemoryServer as { create: () => Promise<typeof server> };
    server = await MMS.create();
    const uri = server.getUri();
    const Client = MongoClient as new (uri: string) => { connect: () => Promise<typeof client> };
    client = await new Client(uri).connect();

    const db = client.db('memory_test');
    const entities = new RawMongoCollection<IEntity>(
      db.collection('memory_entities') as never,
    );
    const facts = new RawMongoCollection<IFact>(db.collection('memory_facts') as never);
    await ensureIndexes({ entities, facts });

    adapter = new MongoMemoryAdapter({
      entities,
      facts,
      factsCollectionName: 'memory_facts',
      useNativeGraphLookup: true,
    });
  }, 60000);

  afterAll(async () => {
    adapter?.destroy();
    if (client) await client.close();
    if (server) await server.stop();
  });

  it('upserts + reads an entity', async () => {
    const now = new Date();
    await adapter.putEntity({
      id: 'ent_a',
      type: 'person',
      displayName: 'Integration Test',
      identifiers: [{ kind: 'email', value: 'it@example.com' }],
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    const got = await adapter.getEntity('ent_a', {});
    expect(got?.displayName).toBe('Integration Test');
  });

  it('writes + reads a fact with scope filter pushdown', async () => {
    const now = new Date();
    await adapter.putEntity({
      id: 'ent_s',
      type: 'person',
      displayName: 'Scoped',
      identifiers: [],
      groupId: 'g1',
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await adapter.putFact({
      id: 'f_s',
      subjectId: 'ent_s',
      predicate: 'note',
      kind: 'atomic',
      groupId: 'g1',
      value: 'hello',
      observedAt: now,
      createdAt: now,
    });

    const visible = await adapter.findFacts({ subjectId: 'ent_s' }, {}, { groupId: 'g1' });
    expect(visible.items).toHaveLength(1);

    const hidden = await adapter.findFacts({ subjectId: 'ent_s' }, {}, { groupId: 'g2' });
    expect(hidden.items).toHaveLength(0);
  });

  it('bulk writes go through bulkWrite path', async () => {
    const now = new Date();
    await adapter.putEntity({
      id: 'ent_bulk',
      type: 'person',
      displayName: 'Bulk Host',
      identifiers: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    const facts: IFact[] = [];
    for (let i = 0; i < 20; i++) {
      facts.push({
        id: `fb_${i}`,
        subjectId: 'ent_bulk',
        predicate: 'p',
        kind: 'atomic',
        value: i,
        observedAt: now,
        createdAt: now,
      });
    }
    await adapter.putFacts(facts);
    const n = await adapter.countFacts({ subjectId: 'ent_bulk' }, {});
    expect(n).toBe(20);
  });

  it('cosine semantic search fallback returns ranked hits', async () => {
    const now = new Date();
    await adapter.putEntity({
      id: 'ent_v',
      type: 'person',
      displayName: 'Vec',
      identifiers: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await adapter.putFact({
      id: 'fv1',
      subjectId: 'ent_v',
      predicate: 'note',
      kind: 'atomic',
      embedding: [1, 0, 0],
      observedAt: now,
      createdAt: now,
    });
    await adapter.putFact({
      id: 'fv2',
      subjectId: 'ent_v',
      predicate: 'note',
      kind: 'atomic',
      embedding: [0, 1, 0],
      observedAt: now,
      createdAt: now,
    });
    const results = await adapter.semanticSearch([1, 0, 0], {}, { topK: 2 }, {});
    expect(results[0]?.fact.id).toBe('fv1');
    expect(results[0]?.score).toBeCloseTo(1, 5);
  });
});

if (!available) {
  describe.skip('MongoMemoryAdapter (real Mongo) — skipped', () => {
    it('install `mongodb` + `mongodb-memory-server` to enable', () => undefined);
  });
}
