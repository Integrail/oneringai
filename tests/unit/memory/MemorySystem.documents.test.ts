/**
 * MemorySystem documents API — create/update/get/attach/detach/list/search.
 *
 * Documents are entities with `type='document'` carrying long-form content in
 * `metadata.body`. The wrapper enforces conventions (byteSize derived, slug
 * prefix added, has_document predicate for attachments) and queues
 * `contentEmbedding` refresh on body changes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { HAS_DOCUMENT_PREDICATE, DOCUMENT_TYPE } from '@/memory/documents/index.js';
import type { IEmbedder, ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'u1' };

/**
 * Deterministic embedder for tests. Maps each input string to a unique unit
 * vector indexed by call order so cosine similarity is stable. Lets us
 * exercise the contentEmbedding pipeline + semanticSearchEntities path.
 */
class DeterministicEmbedder implements IEmbedder {
  readonly dimensions = 4;
  private readonly cache = new Map<string, number[]>();

  async embed(text: string): Promise<number[]> {
    const cached = this.cache.get(text);
    if (cached) return cached;
    // Simple deterministic hash → 4-vector → unit norm.
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    const raw = [
      ((h >>> 0) & 0xff) / 255,
      ((h >>> 8) & 0xff) / 255,
      ((h >>> 16) & 0xff) / 255,
      ((h >>> 24) & 0xff) / 255,
    ];
    const mag = Math.sqrt(raw.reduce((s, v) => s + v * v, 0)) || 1;
    const v = raw.map((x) => x / mag);
    this.cache.set(text, v);
    return v;
  }
}

describe('MemorySystem documents', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  // -----------------------------------------------------------------------
  // create
  // -----------------------------------------------------------------------

  it('createDocument: sets type=document, displayName, body, derived byteSize', async () => {
    const doc = await mem.createDocument(
      {
        title: 'Q3 Planning Brief',
        slug: 'q3-brief',
        body: 'Hello world',
        role: 'brief',
      },
      scope,
    );
    expect(doc.type).toBe(DOCUMENT_TYPE);
    expect(doc.displayName).toBe('Q3 Planning Brief');
    expect(doc.metadata?.body).toBe('Hello world');
    expect(doc.metadata?.role).toBe('brief');
    expect(doc.metadata?.byteSize).toBe(Buffer.byteLength('Hello world', 'utf8'));
    expect(doc.identifiers).toContainEqual(
      expect.objectContaining({ kind: 'canonical', value: 'doc:q3-brief' }),
    );
  });

  it('createDocument: slug omitted → no canonical identifier', async () => {
    const doc = await mem.createDocument({ title: 'untitled', body: 'x' }, scope);
    expect(doc.identifiers.find((i) => i.kind === 'canonical')).toBeUndefined();
  });

  it('createDocument: rejects empty title', async () => {
    await expect(mem.createDocument({ title: '', body: 'x' }, scope)).rejects.toThrow(
      /title must be a non-empty string/,
    );
  });

  it('createDocument: rejects non-string body', async () => {
    // @ts-expect-error — runtime guard
    await expect(mem.createDocument({ title: 't', body: null }, scope)).rejects.toThrow(
      /body must be a string/,
    );
  });

  it('createDocument: same slug twice updates body (idempotent upsert, B1)', async () => {
    const first = await mem.createDocument(
      { title: 'Plan', slug: 'q3', body: 'v1', role: 'plan' },
      scope,
    );
    const second = await mem.createDocument(
      { title: 'Plan', slug: 'q3', body: 'v2', role: 'plan' },
      scope,
    );
    expect(second.id).toBe(first.id);
    expect(second.metadata?.body).toBe('v2');
    expect(second.metadata?.byteSize).toBe(Buffer.byteLength('v2', 'utf8'));
    expect(second.version).toBeGreaterThan(first.version);
  });

  it('createDocument: same slug twice with different title updates displayName too', async () => {
    const first = await mem.createDocument(
      { title: 'Old Title', slug: 'q3-title', body: 'v1' },
      scope,
    );
    const second = await mem.createDocument(
      { title: 'New Title', slug: 'q3-title', body: 'v1' },
      scope,
    );
    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe('New Title');
    expect(second.version).toBeGreaterThan(first.version);
  });

  it('createDocument: rejects slug already owned by a non-document entity (B3)', async () => {
    // Squat the canonical:doc:foo identifier on a `task` entity.
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Squatter',
        identifiers: [{ kind: 'canonical', value: 'doc:foo' }],
      },
      scope,
    );
    await expect(
      mem.createDocument({ title: 't', slug: 'foo', body: 'b' }, scope),
    ).rejects.toThrow(/non-document entity/i);
  });

  it('createDocument: rejection on squatter does NOT mutate the squatter (B3 no-side-effect)', async () => {
    // Regression guard: pre-fix, the rejection ran AFTER upsertEntity had
    // already overwritten the task's metadata with document-shape fields and
    // bumped its version. Verify the squatter is byte-for-byte unchanged.
    const seed = await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Squatter',
        identifiers: [{ kind: 'canonical', value: 'doc:no-touch' }],
        metadata: { state: 'pending', priority: 'high' },
      },
      scope,
    );
    const before = await mem.getEntity(seed.entity.id, scope);
    await expect(
      mem.createDocument(
        { title: 'attacker', slug: 'no-touch', body: 'pwned', role: 'brief' },
        scope,
      ),
    ).rejects.toThrow(/non-document entity/i);
    const after = await mem.getEntity(seed.entity.id, scope);
    expect(after).not.toBeNull();
    expect(after!.type).toBe('task');
    expect(after!.displayName).toBe('Squatter');
    expect(after!.version).toBe(before!.version);
    expect(after!.metadata).toEqual(before!.metadata);
    expect(after!.metadata?.body).toBeUndefined();
    expect(after!.metadata?.byteSize).toBeUndefined();
    expect(after!.metadata?.role).toBeUndefined();
  });

  it('createDocument: attachTo creates a has_document fact', async () => {
    const project = await mem.upsertEntity(
      { type: 'project', displayName: 'NA Launch', identifiers: [{ kind: 'system_user_id', value: 'p1' }] },
      scope,
    );
    const doc = await mem.createDocument(
      { title: 'launch plan', slug: 'na-plan', body: 'plan body', attachTo: project.entity.id },
      scope,
    );
    const facts = await mem.findFacts(
      { subjectId: project.entity.id, predicate: HAS_DOCUMENT_PREDICATE },
      {},
      scope,
    );
    expect(facts.items).toHaveLength(1);
    expect(facts.items[0]!.objectId).toBe(doc.id);
  });

  // -----------------------------------------------------------------------
  // update
  // -----------------------------------------------------------------------

  it('updateDocument: body change bumps version + preserves other metadata', async () => {
    const doc = await mem.createDocument(
      { title: 'plan', slug: 'p', body: 'v1', role: 'plan', format: 'markdown' },
      scope,
    );
    const initialVersion = doc.version;
    const updated = await mem.updateDocument('p', { body: 'v2' }, scope);
    expect(updated.metadata?.body).toBe('v2');
    expect(updated.metadata?.role).toBe('plan');
    expect(updated.metadata?.format).toBe('markdown');
    expect(updated.metadata?.byteSize).toBe(Buffer.byteLength('v2', 'utf8'));
    expect(updated.version).toBe(initialVersion + 1);
  });

  it('updateDocument: no-op when content + title + summary unchanged', async () => {
    const doc = await mem.createDocument(
      { title: 'plan', slug: 'p2', body: 'v1', role: 'plan' },
      scope,
    );
    const updated = await mem.updateDocument('p2', { body: 'v1' }, scope);
    expect(updated.version).toBe(doc.version);
  });

  it('updateDocument: extra metadata keys merged shallowly', async () => {
    await mem.createDocument(
      { title: 'plan', slug: 'p3', body: 'v1', metadata: { extra: 'A' } },
      scope,
    );
    const updated = await mem.updateDocument('p3', { metadata: { extra2: 'B' } }, scope);
    expect((updated.metadata as Record<string, unknown>).extra).toBe('A');
    expect((updated.metadata as Record<string, unknown>).extra2).toBe('B');
  });

  it('updateDocument: throws when target not found', async () => {
    await expect(mem.updateDocument('nope', { body: 'x' }, scope)).rejects.toThrow(/not found/);
  });

  // -----------------------------------------------------------------------
  // get / resolve
  // -----------------------------------------------------------------------

  it('getDocument: resolves by entity id', async () => {
    const doc = await mem.createDocument({ title: 't', body: 'b' }, scope);
    const found = await mem.getDocument(doc.id, scope);
    expect(found?.id).toBe(doc.id);
  });

  it('getDocument: resolves by bare slug', async () => {
    const doc = await mem.createDocument({ title: 't', slug: 'my-slug', body: 'b' }, scope);
    const found = await mem.getDocument('my-slug', scope);
    expect(found?.id).toBe(doc.id);
  });

  it('getDocument: resolves by full doc:slug form', async () => {
    const doc = await mem.createDocument({ title: 't', slug: 'my-slug', body: 'b' }, scope);
    const found = await mem.getDocument('doc:my-slug', scope);
    expect(found?.id).toBe(doc.id);
  });

  it('getDocument: returns null when missing', async () => {
    const found = await mem.getDocument('no-such-slug', scope);
    expect(found).toBeNull();
  });

  // -----------------------------------------------------------------------
  // attach / detach
  // -----------------------------------------------------------------------

  it('attachDocument: idempotent — second call does not create a duplicate', async () => {
    const project = await mem.upsertEntity(
      { type: 'project', displayName: 'P', identifiers: [{ kind: 'system_user_id', value: 'proj' }] },
      scope,
    );
    const doc = await mem.createDocument({ title: 'd', slug: 'd', body: 'b' }, scope);
    await mem.attachDocument(project.entity.id, 'd', scope);
    await mem.attachDocument(project.entity.id, 'd', scope);
    const facts = await mem.findFacts(
      { subjectId: project.entity.id, predicate: HAS_DOCUMENT_PREDICATE, objectId: doc.id },
      {},
      scope,
    );
    expect(facts.items).toHaveLength(1);
  });

  it('detachDocument: archives the has_document fact and returns {archived, skipped} counts (C3)', async () => {
    const project = await mem.upsertEntity(
      { type: 'project', displayName: 'P', identifiers: [{ kind: 'system_user_id', value: 'proj2' }] },
      scope,
    );
    const doc = await mem.createDocument(
      { title: 'd', slug: 'd2', body: 'b', attachTo: project.entity.id },
      scope,
    );
    const result = await mem.detachDocument(project.entity.id, doc.id, scope);
    expect(result).toEqual({ archived: 1, skippedDueToPermissions: 0 });
    const facts = await mem.findFacts(
      { subjectId: project.entity.id, predicate: HAS_DOCUMENT_PREDICATE, objectId: doc.id },
      {},
      scope,
    );
    expect(facts.items.every((f) => f.archived)).toBe(true);
  });

  it('detachDocument: returns {archived:0, skipped:0} when there are no matching attachments', async () => {
    const project = await mem.upsertEntity(
      { type: 'project', displayName: 'P', identifiers: [{ kind: 'system_user_id', value: 'proj-empty' }] },
      scope,
    );
    const doc = await mem.createDocument({ title: 'd', slug: 'd-empty', body: 'b' }, scope);
    // Doc exists but was never attached.
    const result = await mem.detachDocument(project.entity.id, doc.id, scope);
    expect(result).toEqual({ archived: 0, skippedDueToPermissions: 0 });
  });

  it('attachDocument: rejects self-referential parent === doc', async () => {
    const doc = await mem.createDocument({ title: 'self', slug: 'self', body: 'b' }, scope);
    await expect(mem.attachDocument(doc.id, doc.id, scope)).rejects.toThrow(/must differ/);
  });

  // -----------------------------------------------------------------------
  // list
  // -----------------------------------------------------------------------

  it('listDocuments: strips body by default, returns it on includeBody=true', async () => {
    await mem.createDocument({ title: 't1', slug: 's1', body: 'big body 1', role: 'brief' }, scope);
    await mem.createDocument({ title: 't2', slug: 's2', body: 'big body 2', role: 'brief' }, scope);
    const lean = await mem.listDocuments({}, scope);
    expect(lean.every((d) => d.metadata?.body === undefined)).toBe(true);
    const full = await mem.listDocuments({ includeBody: true }, scope);
    expect(full.every((d) => typeof d.metadata?.body === 'string')).toBe(true);
  });

  it('listDocuments: filters by role', async () => {
    await mem.createDocument({ title: 'b1', slug: 'b1', body: 'x', role: 'brief' }, scope);
    await mem.createDocument({ title: 'p1', slug: 'p1', body: 'x', role: 'plan' }, scope);
    const briefs = await mem.listDocuments({ role: 'brief' }, scope);
    expect(briefs).toHaveLength(1);
    expect(briefs[0]!.displayName).toBe('b1');
  });

  it('listDocuments: filters by attachedTo', async () => {
    const project = await mem.upsertEntity(
      { type: 'project', displayName: 'P', identifiers: [{ kind: 'system_user_id', value: 'proj-list' }] },
      scope,
    );
    await mem.createDocument({ title: 'attached', slug: 'a1', body: 'x', attachTo: project.entity.id }, scope);
    await mem.createDocument({ title: 'orphan', slug: 'o1', body: 'x' }, scope);
    const docs = await mem.listDocuments({ attachedTo: project.entity.id, includeBody: true }, scope);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.displayName).toBe('attached');
  });

  // -----------------------------------------------------------------------
  // search
  // -----------------------------------------------------------------------

  it('searchDocuments (keyword): matches body substring case-insensitively', async () => {
    await mem.createDocument({ title: 'a', slug: 'doc-a', body: 'the quick brown fox' }, scope);
    await mem.createDocument({ title: 'b', slug: 'doc-b', body: 'a slow blue heron' }, scope);
    const hits = await mem.searchDocuments({ query: 'BROWN', mode: 'keyword' }, scope);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.doc.displayName).toBe('a');
    expect(hits[0]!.matchedVia).toBe('keyword');
    expect(hits[0]!.snippet.toLowerCase()).toContain('brown');
  });

  it('searchDocuments (keyword): role filter narrows results', async () => {
    await mem.createDocument({ title: 'brief x', slug: 'bx', body: 'q3 launch', role: 'brief' }, scope);
    await mem.createDocument({ title: 'plan x', slug: 'px', body: 'q3 launch', role: 'plan' }, scope);
    const hits = await mem.searchDocuments({ query: 'q3', mode: 'keyword', role: 'brief' }, scope);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.doc.metadata?.role).toBe('brief');
  });

  it('searchDocuments (keyword): displayName match ranks above body-only match', async () => {
    await mem.createDocument({ title: 'unrelated', slug: 'd1', body: 'pizza in here' }, scope);
    await mem.createDocument({ title: 'pizza recipe', slug: 'd2', body: 'unrelated text' }, scope);
    const hits = await mem.searchDocuments({ query: 'pizza', mode: 'keyword' }, scope);
    expect(hits[0]!.doc.displayName).toBe('pizza recipe');
  });

  it('searchDocuments (keyword): name hit beats body hits even when seeded later (B2 sort-not-break)', async () => {
    // Three docs with body hits, then a fourth with a NAME hit. With the
    // pre-fix early-break, name-hit would be dropped when limit=2. The fix
    // collects everything, sorts by score, then slices.
    await mem.createDocument({ title: 'aaaa', slug: 'b2-a', body: 'foo bar' }, scope);
    await mem.createDocument({ title: 'bbbb', slug: 'b2-b', body: 'foo bar' }, scope);
    await mem.createDocument({ title: 'cccc', slug: 'b2-c', body: 'foo bar' }, scope);
    await mem.createDocument({ title: 'foo definitive', slug: 'b2-d', body: 'unrelated' }, scope);
    const hits = await mem.searchDocuments({ query: 'foo', mode: 'keyword', limit: 2 }, scope);
    expect(hits).toHaveLength(2);
    // The name match must appear in the returned top-2.
    expect(hits.map((h) => h.doc.displayName)).toContain('foo definitive');
    expect(hits[0]!.doc.displayName).toBe('foo definitive');
  });

  it('searchDocuments (semantic): empty when no embedder configured', async () => {
    await mem.createDocument({ title: 't', slug: 'tt', body: 'x' }, scope);
    const hits = await mem.searchDocuments({ query: 'anything' }, scope);
    expect(hits).toEqual([]);
  });

  it('searchDocuments (semantic): returns scored results with content embedding', async () => {
    const memWithEmbedder = new MemorySystem({
      store: new InMemoryAdapter(),
      embedder: new DeterministicEmbedder(),
    });
    try {
      await memWithEmbedder.createDocument(
        { title: 'kale salad', slug: 'k', body: 'a recipe for kale salad' },
        scope,
      );
      await memWithEmbedder.createDocument(
        { title: 'machine learning notes', slug: 'm', body: 'gradient descent overview' },
        scope,
      );
      await memWithEmbedder.flushEmbeddings();
      const hits = await memWithEmbedder.searchDocuments({ query: 'kale salad' }, scope);
      // DeterministicEmbedder doesn't simulate true semantic distance, so we
      // can't assert WHICH doc ranks first. We can assert: the path is wired
      // (contentEmbedding written, semanticSearchEntities consulted with
      // embeddingField:'content'), results are returned with semantic
      // metadata, and scores are populated.
      expect(hits.length).toBeGreaterThan(0);
      for (const hit of hits) {
        expect(hit.matchedVia).toBe('semantic');
        expect(typeof hit.score).toBe('number');
        expect(['kale salad', 'machine learning notes']).toContain(hit.doc.displayName);
      }
    } finally {
      await memWithEmbedder.shutdown();
    }
  });

  it('searchDocuments: rejects empty query', async () => {
    await expect(mem.searchDocuments({ query: '   ' }, scope)).rejects.toThrow(/non-empty/);
  });

  it('searchDocuments (semantic): attachedTo bounded-set path scores only attached docs (no leakage)', async () => {
    // Exercises the fixed code path where attachedTo is resolved up front
    // and scored directly against contentEmbedding (no topK candidate hop).
    // Pre-fix, semantic + attachedTo used `topK=limit*2` candidates from
    // the adapter's vector index, then post-filtered — on Mongo with many
    // unattached docs the attached doc could fall outside topK and be
    // silently dropped. This test mainly guards the no-leakage contract:
    // only attached docs ever appear in the result.
    const memWithEmbedder = new MemorySystem({
      store: new InMemoryAdapter(),
      embedder: new DeterministicEmbedder(),
    });
    try {
      const project = await memWithEmbedder.upsertEntity(
        {
          type: 'project',
          displayName: 'Q3 project',
          identifiers: [{ kind: 'system_user_id', value: 'sem-starv-proj' }],
        },
        scope,
      );
      // Many unattached docs — these will populate the vector index pool.
      for (let i = 0; i < 30; i++) {
        await memWithEmbedder.createDocument(
          { title: `dummy-${i}`, slug: `sem-dummy-${i}`, body: `unrelated content ${i}` },
          scope,
        );
      }
      // The attached doc — created last, may not be in top-K candidates.
      const attached = await memWithEmbedder.createDocument(
        {
          title: 'target',
          slug: 'sem-target',
          body: 'target body',
          attachTo: project.entity.id,
        },
        scope,
      );
      await memWithEmbedder.flushEmbeddings();
      const hits = await memWithEmbedder.searchDocuments(
        {
          query: 'anything semantic',
          mode: 'semantic',
          attachedTo: project.entity.id,
          limit: 5,
        },
        scope,
      );
      // The bounded-set path guarantees the attached doc is considered —
      // semantic similarity values are noisy with the deterministic
      // embedder, but we MUST see the attached doc in the results.
      expect(hits.map((h) => h.doc.id)).toContain(attached.id);
      // And only attached docs should ever appear.
      for (const h of hits) {
        expect(h.doc.id).toBe(attached.id);
      }
    } finally {
      await memWithEmbedder.shutdown();
    }
  });

  it('searchDocuments (keyword): paginates past the first 1000 docs (no silent truncation)', async () => {
    // Pre-fix the keyword scan only fetched a single 1000-row page and
    // ignored nextCursor. Seed enough docs so the matching one is forced
    // past the first page, then verify it still surfaces.
    //
    // The InMemoryAdapter returns entities in insertion order, so we
    // sandwich the needle deep in the list to make sure it's not in page 1.
    const TOTAL = 1200;
    const NEEDLE_AT = 1100;
    for (let i = 0; i < TOTAL; i++) {
      const body = i === NEEDLE_AT ? 'this contains the needle term' : 'unrelated body';
      await mem.createDocument(
        { title: `bulk-${i}`, slug: `bulk-pg-${i}`, body, role: 'notes' },
        scope,
      );
    }
    const hits = await mem.searchDocuments(
      { query: 'needle', mode: 'keyword', limit: 10 },
      scope,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]!.doc.displayName).toBe(`bulk-${NEEDLE_AT}`);
  });

  it('searchDocuments (keyword): attachedTo path returns matches even when scope has 1000+ unattached docs (C-starvation)', async () => {
    // Pre-fix, attachedTo was a post-filter applied AFTER the keyword scan,
    // and the keyword scan capped at the first 1000 entities. So when scope
    // has 1000+ docs whose insertion order puts the attached match past the
    // cap, the attached match was silently dropped. The fixed path resolves
    // the attached id set first and searches only that bounded set.
    const project = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'P',
        identifiers: [{ kind: 'system_user_id', value: 'starvation-proj' }],
      },
      scope,
    );
    // Enough unattached noise to push the attached match past the
    // pre-fix 1000-doc first-page cap. Keep noise body distinct from the
    // query needle so the only 'starvation-needle' hit lives on the
    // attached doc.
    for (let i = 0; i < 1050; i++) {
      await mem.createDocument(
        { title: `noise-${i}`, slug: `starv-noise-${i}`, body: 'apple', role: 'notes' },
        scope,
      );
    }
    // Attached doc created LAST — pre-fix it's past the 1000-doc keyword
    // scan window. Body has the needle; name does NOT (avoid the high-score
    // name-hit shortcut so we're testing the bounded-set path, not ranking).
    await mem.createDocument(
      {
        title: 'plain title',
        slug: 'starv-att-1',
        body: 'this body contains the starvation-needle term',
        attachTo: project.entity.id,
      },
      scope,
    );
    const hits = await mem.searchDocuments(
      {
        query: 'starvation-needle',
        mode: 'keyword',
        attachedTo: project.entity.id,
      },
      scope,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]!.doc.displayName).toBe('plain title');
  });
});
