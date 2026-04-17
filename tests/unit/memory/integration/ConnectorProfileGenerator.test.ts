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
import type { IEntity, IFact } from '@/memory/types.js';

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

describe('ConnectorProfileGenerator', () => {
  describe('generate()', () => {
    it('returns parsed details + summary from JSON response', async () => {
      const mock = makeMockAgent(
        JSON.stringify({
          details: '# Jane Doe\n\nEngineer at Acme.',
          summaryForEmbedding: 'Jane Doe: engineer at Acme, contributes to backend.',
        }),
      );
      const gen = ConnectorProfileGenerator.withAgent({ agent: mock as never });
      const result = await gen.generate(entity(), [fact()], undefined, {});
      expect(result.details).toContain('Jane Doe');
      expect(result.summaryForEmbedding).toContain('Jane Doe');
    });

    it('calls runDirect with json_object response format', async () => {
      const mock = makeMockAgent(
        JSON.stringify({ details: 'd', summaryForEmbedding: 's' }),
      );
      const gen = ConnectorProfileGenerator.withAgent({ agent: mock as never });
      await gen.generate(entity(), [fact()], undefined, {});
      const call = mock.runDirect.mock.calls[0];
      expect(call![1]).toMatchObject({
        responseFormat: { type: 'json_object' },
      });
    });

    it('passes entity + facts + priorProfile + targetScope to the prompt fn', async () => {
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
      await gen.generate(ent, facts, prior, scope);
      expect(promptFn).toHaveBeenCalledWith({
        entity: ent,
        atomicFacts: facts,
        priorProfile: prior,
        targetScope: scope,
      });
    });

    it('uses default temperature 0.3 and maxOutputTokens 1200', async () => {
      const mock = makeMockAgent(JSON.stringify({ details: 'd', summaryForEmbedding: 's' }));
      const gen = ConnectorProfileGenerator.withAgent({ agent: mock as never });
      await gen.generate(entity(), [fact()], undefined, {});
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
});

describe('defaultProfilePrompt', () => {
  it('includes entity identity, identifiers, and facts', () => {
    const prompt = defaultProfilePrompt({
      entity: entity({ displayName: 'Alice', aliases: ['Ali'] }),
      atomicFacts: [fact({ predicate: 'works_at', objectId: 'acme' })],
      priorProfile: undefined,
      targetScope: {},
    });
    expect(prompt).toContain('Alice');
    expect(prompt).toContain('Ali');
    expect(prompt).toContain('jane@acme.com');
    expect(prompt).toContain('works_at');
  });

  it('includes prior profile when present', () => {
    const prompt = defaultProfilePrompt({
      entity: entity(),
      atomicFacts: [],
      priorProfile: fact({ kind: 'document', details: 'EARLIER PROFILE CONTENT' }),
      targetScope: {},
    });
    expect(prompt).toContain('EARLIER PROFILE CONTENT');
    expect(prompt).toContain('Evolve');
  });

  it('describes scope correctly', () => {
    const global = defaultProfilePrompt({
      entity: entity(),
      atomicFacts: [],
      priorProfile: undefined,
      targetScope: {},
    });
    expect(global).toContain('global');

    const group = defaultProfilePrompt({
      entity: entity(),
      atomicFacts: [],
      priorProfile: undefined,
      targetScope: { groupId: 'g1' },
    });
    expect(group).toContain('group-wide');
    expect(group).toContain('g1');

    const user = defaultProfilePrompt({
      entity: entity(),
      atomicFacts: [],
      priorProfile: undefined,
      targetScope: { ownerId: 'u1' },
    });
    expect(user).toContain('user-private');
  });

  it('instructs JSON-only output', () => {
    const prompt = defaultProfilePrompt({
      entity: entity(),
      atomicFacts: [],
      priorProfile: undefined,
      targetScope: {},
    });
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('details');
    expect(prompt).toContain('summaryForEmbedding');
  });
});
