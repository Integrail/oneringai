/**
 * Unit tests for ConnectorProfileGenerator + parseProfileResponse + defaultProfilePrompt.
 *
 * Uses ConnectorProfileGenerator.withAgent to inject a mock agent for
 * deterministic testing of the prompt + parsing flow. Also tests fallback
 * parsing for providers that don't honor json_object.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ConnectorProfileGenerator,
  parseProfileResponse,
} from '@/memory/integration/ConnectorProfileGenerator.js';
import { defaultProfilePrompt } from '@/memory/integration/defaultPrompt.js';
import type { IEntity, IFact, ProfileGeneratorInput } from '@/memory/types.js';

function entity(overrides: Partial<IEntity> = {}): IEntity {
  const now = new Date();
  return {
    id: overrides.id ?? 'ent_1',
    type: overrides.type ?? 'person',
    displayName: overrides.displayName ?? 'Jane Doe',
    aliases: overrides.aliases,
    identifiers: overrides.identifiers ?? [{ kind: 'email', value: 'jane@acme.com' }],
    version: 1,
    groupId: overrides.groupId,
    ownerId: overrides.ownerId,
    createdAt: now,
    updatedAt: now,
  };
}

function fact(overrides: Partial<IFact> = {}): IFact {
  const now = new Date();
  return {
    id: overrides.id ?? 'f',
    subjectId: overrides.subjectId ?? 'ent_1',
    predicate: overrides.predicate ?? 'works_at',
    kind: overrides.kind ?? 'atomic',
    details: overrides.details,
    objectId: overrides.objectId,
    value: overrides.value,
    confidence: overrides.confidence,
    observedAt: overrides.observedAt ?? now,
    createdAt: now,
  };
}

function makeMockAgent(outputText: string): {
  runDirect: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
} {
  return {
    runDirect: vi.fn(async () => ({
      output_text: outputText,
      output: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    })),
    destroy: vi.fn(),
  };
}

function makeInputShape(overrides: Partial<ProfileGeneratorInput> = {}): ProfileGeneratorInput {
  return {
    entity: overrides.entity ?? entity(),
    newFacts: overrides.newFacts ?? [fact()],
    priorProfile: overrides.priorProfile,
    invalidatedFactIds: overrides.invalidatedFactIds ?? [],
    targetScope: overrides.targetScope ?? {},
  };
}

describe('ConnectorProfileGenerator', () => {
  describe('generate()', () => {
    const makeInput = (overrides: Partial<Parameters<typeof makeInputShape>[0]> = {}) =>
      makeInputShape(overrides);

    it('returns parsed details + summary from JSON response', async () => {
      const mock = makeMockAgent(
        JSON.stringify({
          details: '# Jane Doe\n\nEngineer at Acme.',
          summaryForEmbedding: 'Jane Doe: engineer at Acme, contributes to backend.',
        }),
      );
      const gen = ConnectorProfileGenerator.withAgent({ agent: mock as never });
      const result = await gen.generate(makeInput());
      expect(result.details).toContain('Jane Doe');
      expect(result.summaryForEmbedding).toContain('Jane Doe');
    });

    it('calls runDirect with json_object response format', async () => {
      const mock = makeMockAgent(
        JSON.stringify({ details: 'd', summaryForEmbedding: 's' }),
      );
      const gen = ConnectorProfileGenerator.withAgent({ agent: mock as never });
      await gen.generate(makeInput());
      const call = mock.runDirect.mock.calls[0];
      expect(call![1]).toMatchObject({
        responseFormat: { type: 'json_object' },
      });
    });

    it('passes entity + newFacts + priorProfile + invalidatedFactIds + targetScope to the prompt fn', async () => {
      const promptFn = vi.fn(() => 'CUSTOM PROMPT');
      const mock = makeMockAgent(
        JSON.stringify({ details: 'd', summaryForEmbedding: 's' }),
      );
      const gen = ConnectorProfileGenerator.withAgent({
        agent: mock as never,
        promptTemplate: promptFn,
      });
      const ent = entity({ id: 'e1' });
      const facts = [fact({ id: 'f1' })];
      const prior = fact({ id: 'prior', kind: 'document' });
      const scope = { groupId: 'g1' };
      await gen.generate({
        entity: ent,
        newFacts: facts,
        priorProfile: prior,
        invalidatedFactIds: ['old1', 'old2'],
        targetScope: scope,
      });
      expect(promptFn).toHaveBeenCalledWith({
        entity: ent,
        newFacts: facts,
        priorProfile: prior,
        invalidatedFactIds: ['old1', 'old2'],
        targetScope: scope,
      });
    });

    it('uses default temperature 0.3 and maxOutputTokens 1200', async () => {
      const mock = makeMockAgent(JSON.stringify({ details: 'd', summaryForEmbedding: 's' }));
      const gen = ConnectorProfileGenerator.withAgent({ agent: mock as never });
      await gen.generate(makeInput());
      expect(mock.runDirect).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ temperature: 0.3, maxOutputTokens: 1200 }),
      );
    });

    it('destroys the internal agent on destroy()', () => {
      const mock = makeMockAgent('{}');
      const gen = ConnectorProfileGenerator.withAgent({ agent: mock as never });
      gen.destroy();
      expect(mock.destroy).toHaveBeenCalled();
    });
  });
});

describe('parseProfileResponse', () => {
  const ent = entity();

  it('parses clean JSON', () => {
    const raw = JSON.stringify({
      details: '# Profile\nHello',
      summaryForEmbedding: 'Summary here',
    });
    const parsed = parseProfileResponse(raw, ent, undefined);
    expect(parsed.details).toContain('Profile');
    expect(parsed.summaryForEmbedding).toBe('Summary here');
  });

  it('strips code fences', () => {
    const raw = '```json\n{"details":"d","summaryForEmbedding":"s"}\n```';
    const parsed = parseProfileResponse(raw, ent, undefined);
    expect(parsed.details).toBe('d');
    expect(parsed.summaryForEmbedding).toBe('s');
  });

  it('extracts first JSON object from text with surrounding prose', () => {
    const raw =
      'Here is the profile:\n{"details":"d","summaryForEmbedding":"s"}\nThat was it.';
    const parsed = parseProfileResponse(raw, ent, undefined);
    expect(parsed.details).toBe('d');
  });

  it('falls back to treating raw text as details when JSON parse fails', () => {
    const raw = 'Jane Doe is an engineer at Acme Corp working on backend systems.';
    const parsed = parseProfileResponse(raw, ent, undefined);
    expect(parsed.details).toContain('Jane Doe');
    expect(parsed.summaryForEmbedding.length).toBeGreaterThan(0);
  });

  it('uses prior profile details when raw output is empty', () => {
    const prior = fact({ kind: 'document', details: '# Prior profile\nOld content' });
    const parsed = parseProfileResponse('', ent, prior);
    expect(parsed.details).toContain('Prior profile');
  });

  it('synthesizes summary from details via first ~80 words', () => {
    const raw = 'Alice is an engineer. '.repeat(100); // ~300 words
    const parsed = parseProfileResponse(raw, ent, undefined);
    expect(parsed.summaryForEmbedding.split(' ').length).toBeLessThanOrEqual(80);
  });

  // ── parseJsonPermissive integration (robust against LLM drift) ──

  it('recovers JSON wrapped in ```json fences + trailing explanatory prose', () => {
    const raw =
      '```json\n{"details":"# d","summaryForEmbedding":"s"}\n```\n\nLet me know if you want me to tweak it.';
    const parsed = parseProfileResponse(raw, ent, undefined);
    expect(parsed.details).toBe('# d');
    expect(parsed.summaryForEmbedding).toBe('s');
  });

  it('recovers JSON with trailing commas', () => {
    const raw = '{"details":"d","summaryForEmbedding":"s",}';
    const parsed = parseProfileResponse(raw, ent, undefined);
    expect(parsed.details).toBe('d');
    expect(parsed.summaryForEmbedding).toBe('s');
  });

  it('recovers JSON with single-quoted strings', () => {
    const raw = "{'details':'d','summaryForEmbedding':'s'}";
    const parsed = parseProfileResponse(raw, ent, undefined);
    expect(parsed.details).toBe('d');
    expect(parsed.summaryForEmbedding).toBe('s');
  });
});

describe('defaultProfilePrompt', () => {
  const base = (overrides: Partial<ProfileGeneratorInput> = {}): ProfileGeneratorInput => ({
    entity: overrides.entity ?? entity(),
    newFacts: overrides.newFacts ?? [],
    priorProfile: overrides.priorProfile,
    invalidatedFactIds: overrides.invalidatedFactIds ?? [],
    targetScope: overrides.targetScope ?? {},
  });

  it('includes entity identity, identifiers, and new facts', () => {
    const prompt = defaultProfilePrompt(
      base({
        entity: entity({ displayName: 'Alice', aliases: ['Ali'] }),
        newFacts: [fact({ predicate: 'works_at', objectId: 'acme' })],
      }),
    );
    expect(prompt).toContain('Alice');
    expect(prompt).toContain('Ali');
    expect(prompt).toContain('jane@acme.com');
    expect(prompt).toContain('works_at');
  });

  it('includes prior profile when present and instructs to evolve', () => {
    const prompt = defaultProfilePrompt(
      base({
        priorProfile: fact({ kind: 'document', details: 'EARLIER PROFILE CONTENT' }),
      }),
    );
    expect(prompt).toContain('EARLIER PROFILE CONTENT');
    expect(prompt).toContain('Evolve');
  });

  it('renders the invalidation list when non-empty', () => {
    const prompt = defaultProfilePrompt(
      base({ invalidatedFactIds: ['fact_old_1', 'fact_old_2'] }),
    );
    // Header + IDs must appear together so the generator can act on them.
    expect(prompt).toContain('## Invalidated Claims');
    expect(prompt).toContain('fact_old_1');
    expect(prompt).toContain('fact_old_2');
  });

  it('omits the invalidation section header when list is empty', () => {
    const prompt = defaultProfilePrompt(base({ invalidatedFactIds: [] }));
    // The `## Invalidated Claims` *section header* must not appear, even though
    // the Task instructions reference the concept by name.
    expect(prompt).not.toContain('## Invalidated Claims');
  });

  it('describes scope correctly', () => {
    expect(defaultProfilePrompt(base({ targetScope: {} }))).toContain('global');
    expect(defaultProfilePrompt(base({ targetScope: { groupId: 'g1' } }))).toContain(
      'group-wide',
    );
    expect(defaultProfilePrompt(base({ targetScope: { ownerId: 'u1' } }))).toContain(
      'user-private',
    );
  });

  it('instructs JSON-only output', () => {
    const prompt = defaultProfilePrompt(base());
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('details');
    expect(prompt).toContain('summaryForEmbedding');
  });
});
