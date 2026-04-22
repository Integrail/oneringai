/**
 * parseJsonPermissive — robust JSON parser for LLM responses.
 *
 * Regression coverage for every repair strategy. The driving use case is
 * `parseExtractionWithStatus`, which wraps this parser and used to fail on
 * markdown fences with trailing prose, single-quoted keys, trailing commas,
 * and verbatim-text fields with embedded escape bugs.
 */

import { describe, it, expect } from 'vitest';
import { parseJsonPermissive, JsonParseError } from '@/utils/jsonRepair.js';

describe('parseJsonPermissive', () => {
  describe('strategy 1 — direct parse', () => {
    it('parses clean JSON objects', () => {
      expect(parseJsonPermissive('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' });
    });

    it('parses clean JSON arrays', () => {
      expect(parseJsonPermissive('[1,2,3]')).toEqual([1, 2, 3]);
    });

    it('parses nested structures verbatim', () => {
      const obj = { a: [1, { b: 'two' }, null], c: { d: { e: 5 } } };
      expect(parseJsonPermissive(JSON.stringify(obj))).toEqual(obj);
    });
  });

  describe('strategy 2 — extract from fences / prose', () => {
    it('strips ```json fences', () => {
      expect(parseJsonPermissive('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it('strips bare ``` fences', () => {
      expect(parseJsonPermissive('```\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it('recovers JSON wrapped in explanatory prose', () => {
      const raw = 'Here is the result: {"mentions":{"m1":{"surface":"X"}},"facts":[]} done.';
      expect(parseJsonPermissive(raw)).toEqual({
        mentions: { m1: { surface: 'X' } },
        facts: [],
      });
    });

    it('recovers JSON with ```json prefix + trailing prose (the onboarding bug)', () => {
      // Real-world failure mode: LLM opens a fence then adds an explanation
      // after. The built-in regex only matches strict ^fence...fence$ so this
      // used to throw parse_error.
      const raw = '```json\n{"mentions":{},"facts":[]}\n```\n\nLet me know if anything is off.';
      expect(parseJsonPermissive(raw)).toEqual({ mentions: {}, facts: [] });
    });

    it('recovers JSON truncated before the closing fence (token cap)', () => {
      // maxOutputTokens clipped the closing ``` — the bracket-match fallback
      // finds the balanced `}` and succeeds.
      const raw = '```json\n{"a":1,"b":"complete"}';
      expect(parseJsonPermissive(raw)).toEqual({ a: 1, b: 'complete' });
    });

    it('recovers first JSON object when multiple are present', () => {
      const raw = 'First: {"a":1} then: {"b":2}';
      expect(parseJsonPermissive(raw)).toEqual({ a: 1 });
    });

    it('recovers JSON array from prose', () => {
      expect(parseJsonPermissive('Result: [1,2,3] done')).toEqual([1, 2, 3]);
    });
  });

  describe('strategy 3 — conservative repair', () => {
    it('removes trailing commas before }', () => {
      expect(parseJsonPermissive('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
    });

    it('removes trailing commas before ]', () => {
      expect(parseJsonPermissive('[1,2,3,]')).toEqual([1, 2, 3]);
    });

    it('strips // line comments', () => {
      const raw = '{"a":1, // inline explanation\n "b":2}';
      expect(parseJsonPermissive(raw)).toEqual({ a: 1, b: 2 });
    });

    it('strips /* block */ comments', () => {
      const raw = '{"a":1, /* block */ "b":2}';
      expect(parseJsonPermissive(raw)).toEqual({ a: 1, b: 2 });
    });

    it('does NOT treat // inside a string as a comment', () => {
      expect(parseJsonPermissive('{"url":"http://example.com"}')).toEqual({
        url: 'http://example.com',
      });
    });

    it('escapes literal newlines inside string values', () => {
      const raw = '{"note":"line one\nline two"}';
      const parsed = parseJsonPermissive(raw) as { note: string };
      expect(parsed.note).toBe('line one\nline two');
    });

    it("fixes \\' escape (never valid in JSON)", () => {
      const raw = "{\"label\":\"Sam\\'s deal\"}";
      const parsed = parseJsonPermissive(raw) as { label: string };
      expect(parsed.label).toBe("Sam's deal");
    });
  });

  describe('strategy 4 — aggressive repair', () => {
    it('converts single-quoted strings to double-quoted', () => {
      expect(parseJsonPermissive("{'a':'b'}")).toEqual({ a: 'b' });
    });

    it('quotes unquoted object keys', () => {
      expect(parseJsonPermissive('{a: "b", c: 2}')).toEqual({ a: 'b', c: 2 });
    });

    it('handles combined single-quote + unquoted-key mess', () => {
      expect(parseJsonPermissive("{a: 'b', c: 'd'}")).toEqual({ a: 'b', c: 'd' });
    });
  });

  describe('strategy 5 — field-strip last resort', () => {
    it('nulls out verbatim-text fields when their value breaks JSON', () => {
      // Simulate what an LLM does with a meeting transcript — verbatim text
      // with embedded quotes it fails to escape. `details` breaks the parse
      // but the surrounding structure is fine, so we null it and keep the
      // rest of the payload.
      const raw =
        '{"mentions":{},"facts":[{"predicate":"said","details":"Peter said "I will send it" and left."}]}';
      const parsed = parseJsonPermissive(raw) as {
        mentions: Record<string, unknown>;
        facts: Array<{ predicate: string; details: null }>;
      };
      expect(parsed.mentions).toEqual({});
      expect(parsed.facts).toHaveLength(1);
      expect(parsed.facts[0].predicate).toBe('said');
      expect(parsed.facts[0].details).toBeNull();
    });

    it('uses caller-supplied field list', () => {
      // `details` is in the default list, but here we override to strip only
      // `body`. The parser should still try to strip `body`, fail to find it,
      // and then throw since nothing else worked.
      const raw = '{"x":"unclosed string without closer';
      expect(() =>
        parseJsonPermissive(raw, { stripFieldsAsLastResort: ['body'] }),
      ).toThrow(JsonParseError);
    });

    it('disables field strip when passed empty list', () => {
      const raw = '{"details":"bad "quotes" here"}';
      expect(() =>
        parseJsonPermissive(raw, { stripFieldsAsLastResort: [] }),
      ).toThrow(JsonParseError);
    });

    it('does not strip structured values of matching keys', () => {
      // `details: { ... }` is a nested object, not a verbatim string — the
      // strip logic should leave it alone. This test passes only if the
      // repaired JSON is valid without any strip.
      const raw = '{"details":{"a":1,"b":2},}'; // trailing comma repairs in strategy 3
      expect(parseJsonPermissive(raw)).toEqual({ details: { a: 1, b: 2 } });
    });
  });

  describe('failure paths', () => {
    it('throws JsonParseError on empty input', () => {
      expect(() => parseJsonPermissive('')).toThrow(JsonParseError);
      expect(() => parseJsonPermissive('   ')).toThrow(JsonParseError);
    });

    it('throws JsonParseError when no strategy recovers JSON', () => {
      expect(() => parseJsonPermissive('not even close to json')).toThrow(JsonParseError);
    });

    it('JsonParseError carries a truncated raw snippet for logging', () => {
      const huge = `${'x'.repeat(2000)}`;
      try {
        parseJsonPermissive(huge);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(JsonParseError);
        const e = err as JsonParseError;
        expect(e.rawSnippet.length).toBeLessThanOrEqual(550); // 500 chars + total-count suffix
        expect(e.rawSnippet).toContain('chars total');
      }
    });

    it('JsonParseError without truncation for small inputs', () => {
      try {
        parseJsonPermissive('garbage');
        expect.fail('should have thrown');
      } catch (err) {
        const e = err as JsonParseError;
        expect(e.rawSnippet).toBe('garbage');
      }
    });
  });
});
