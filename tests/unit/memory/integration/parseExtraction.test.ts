/**
 * parseExtractionWithStatus — rich parser for LLM extraction output.
 *
 * C3: no silent returns on parse failure. Every non-ok status is actionable
 * (has reason + rawExcerpt) so callers can log/retry.
 */

import { describe, it, expect } from 'vitest';
import {
  parseExtractionWithStatus,
  parseExtractionResponse,
} from '@/memory/integration/parseExtraction.js';

describe('parseExtractionWithStatus', () => {
  it('returns ok + populated fields on valid JSON', () => {
    const raw = JSON.stringify({
      mentions: { m1: { surface: 'Alice', type: 'person' } },
      facts: [{ subject: 'm1', predicate: 'works_at', object: 'm2' }],
    });
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('ok');
    expect(r.mentions).toEqual({ m1: { surface: 'Alice', type: 'person' } });
    expect(r.facts).toHaveLength(1);
    expect(r.reason).toBeUndefined();
  });

  it('returns ok with empty fields when LLM correctly emits empty shape', () => {
    const r = parseExtractionWithStatus('{"mentions":{},"facts":[]}');
    expect(r.status).toBe('ok');
    expect(r.mentions).toEqual({});
    expect(r.facts).toEqual([]);
  });

  it('strips code fences', () => {
    const raw = '```json\n{"mentions":{},"facts":[]}\n```';
    expect(parseExtractionWithStatus(raw).status).toBe('ok');
  });

  it('recovers JSON from prose wrapping', () => {
    const raw = 'Here is the result: {"mentions":{"m1":{"surface":"X","type":"topic"}},"facts":[]} done.';
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('ok');
    expect(r.mentions.m1!.surface).toBe('X');
  });

  it('returns parse_error on empty input', () => {
    const r = parseExtractionWithStatus('');
    expect(r.status).toBe('parse_error');
    expect(r.reason).toMatch(/empty/);
    expect(r.rawExcerpt).toBe('');
  });

  it('returns parse_error on truncated JSON that cannot be recovered', () => {
    const r = parseExtractionWithStatus('not even close to json');
    expect(r.status).toBe('parse_error');
    expect(r.reason).toMatch(/could not parse/);
    expect(r.rawExcerpt).toBe('not even close to json');
  });

  it('returns shape_error when mentions is an array (LLM mistake)', () => {
    const raw = JSON.stringify({
      mentions: [{ surface: 'Alice' }], // array, not object
      facts: [],
    });
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('shape_error');
    expect(r.reason).toMatch(/mentions is not an object/);
    expect(r.mentions).toEqual({}); // fallback default
    expect(r.facts).toEqual([]);
  });

  it('returns shape_error when facts is a string (LLM mistake)', () => {
    const raw = JSON.stringify({ mentions: {}, facts: 'whoops' });
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('shape_error');
    expect(r.reason).toMatch(/facts is not an array/);
    expect(r.mentions).toEqual({});
    expect(r.facts).toEqual([]);
  });

  it('returns shape_error with partial mentions when facts is wrong but mentions is OK', () => {
    const raw = JSON.stringify({
      mentions: { m1: { surface: 'Alice', type: 'person' } },
      facts: null,
    });
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('shape_error');
    expect(r.mentions.m1!.surface).toBe('Alice');
    expect(r.facts).toEqual([]);
  });

  it('truncates rawExcerpt in log output for large payloads', () => {
    const huge = 'x'.repeat(2000);
    const r = parseExtractionWithStatus(huge);
    expect(r.rawExcerpt!.length).toBeLessThanOrEqual(501);
    expect(r.rawExcerpt!.endsWith('…')).toBe(true);
  });

  // ── Regression coverage for the onboarding parse failures ──

  it('recovers when ```json fences have trailing explanatory prose', () => {
    const raw =
      '```json\n{"mentions":{"m_peter":{"surface":"Peter","type":"person"}},"facts":[]}\n```\n\nLet me know if anything needs adjusting.';
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('ok');
    expect(r.mentions.m_peter!.surface).toBe('Peter');
  });

  it('recovers when LLM output is truncated before the closing fence (maxOutputTokens)', () => {
    const raw = '```json\n{"mentions":{"m1":{"surface":"A","type":"topic"}},"facts":[]}';
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('ok');
    expect(r.mentions.m1!.surface).toBe('A');
  });

  it('recovers from trailing commas', () => {
    const raw = '{"mentions":{"m1":{"surface":"A","type":"topic",},},"facts":[],}';
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('ok');
    expect(r.mentions.m1!.surface).toBe('A');
  });

  it('recovers from single-quoted strings', () => {
    const raw = "{'mentions':{'m1':{'surface':'A','type':'topic'}},'facts':[]}";
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('ok');
    expect(r.mentions.m1!.surface).toBe('A');
  });

  it('recovers from unquoted keys', () => {
    const raw = '{mentions:{"m1":{"surface":"A","type":"topic"}},facts:[]}';
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('ok');
    expect(r.mentions.m1!.surface).toBe('A');
  });

  it('nulls out `details` field when verbatim text breaks parsing, keeps rest', () => {
    // Real failure mode: LLM emits a fact with unescaped quotes inside
    // verbatim email/transcript text. Strategy 5 nulls `details` and keeps
    // the structured facts so we don't lose the signal entirely.
    const raw =
      '{"mentions":{},"facts":[{"subject":"m1","predicate":"said","details":"Peter said "yes" and left."}]}';
    const r = parseExtractionWithStatus(raw);
    expect(r.status).toBe('ok');
    expect(r.facts).toHaveLength(1);
    expect(r.facts[0].subject).toBe('m1');
    expect(r.facts[0].predicate).toBe('said');
    expect(r.facts[0].details).toBeNull();
  });
});

describe('parseExtractionResponse (back-compat)', () => {
  it('returns {mentions,facts} without status for back-compat callers', () => {
    const r = parseExtractionResponse('{"mentions":{},"facts":[]}');
    expect(r).toEqual({ mentions: {}, facts: [] });
    expect((r as { status?: string }).status).toBeUndefined();
  });

  it('returns empty shape on parse failure (tolerant behaviour preserved)', () => {
    const r = parseExtractionResponse('garbage');
    expect(r).toEqual({ mentions: {}, facts: [] });
  });
});
