import { describe, expect, it } from 'vitest';
import { parseAndValidateStructuredOutput } from '@/agent-runtime/StructuredOutputValidator.js';
import { AgentStructuredOutputError } from '@/agent-runtime/index.js';

describe('parseAndValidateStructuredOutput', () => {
  it('returns undefined for text and parses schema-conforming JSON', () => {
    expect(parseAndValidateStructuredOutput('plain', { type: 'text' })).toBeUndefined();
    expect(parseAndValidateStructuredOutput('{"value":1}', {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: { value: { type: 'number' } },
        required: ['value'],
      },
    })).toEqual({ value: 1 });
  });

  it('reports malformed JSON, malformed schemas, and multiple validation errors', () => {
    expect(() => parseAndValidateStructuredOutput('not json', {
      type: 'json_schema',
      schema: { type: 'object' },
    })).toThrow(AgentStructuredOutputError);
    expect(() => parseAndValidateStructuredOutput('{}', {
      type: 'json_schema',
      schema: { type: 'not-a-json-schema-type' },
    })).toThrow(/Invalid runtime JSON Schema/);
    expect(() => parseAndValidateStructuredOutput('{"a":"wrong"}', {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'string' } },
        required: ['a', 'b'],
      },
    })).toThrow(/does not conform/);
  });
});
