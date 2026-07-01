import { describe, it, expect } from 'vitest';
import {
  resolveStructuredStrategy,
  toProviderResponseFormat,
  buildStructuredInstructionSuffix,
  buildStructuredRepairInstruction,
  parseStructuredOutput,
  type ResponseFormat,
} from '../../../src/core/StructuredOutput.js';
import { Vendor } from '../../../src/core/Vendor.js';
import type { ModelCapabilities } from '../../../src/domain/interfaces/ITextProvider.js';

const caps = (over: Partial<ModelCapabilities> = {}): ModelCapabilities => ({
  supportsTools: true,
  supportsVision: false,
  supportsJSON: true,
  supportsJSONSchema: true,
  maxTokens: 128000,
  ...over,
});

const schemaFormat: ResponseFormat = {
  type: 'json_schema',
  name: 'contact',
  schema: {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
    additionalProperties: false,
  },
};
const objectFormat: ResponseFormat = { type: 'json_object' };

describe('resolveStructuredStrategy', () => {
  it('OpenAI uses native json_schema even with tools present', () => {
    expect(resolveStructuredStrategy(schemaFormat, caps(), Vendor.OpenAI, true)).toBe('native');
    expect(resolveStructuredStrategy(schemaFormat, caps(), Vendor.OpenAI, false)).toBe('native');
  });

  it('OpenAI uses native json_object', () => {
    expect(resolveStructuredStrategy(objectFormat, caps(), Vendor.OpenAI, false)).toBe('native');
  });

  it('Anthropic always uses the prompt fallback for json_schema (no native mapping)', () => {
    // Even with supportsJSONSchema:true caps and no tools, Anthropic stays on the
    // prompt fallback — its converter does not emit native schema output.
    expect(resolveStructuredStrategy(schemaFormat, caps(), Vendor.Anthropic, false)).toBe('prompt');
    expect(resolveStructuredStrategy(schemaFormat, caps(), Vendor.Anthropic, true)).toBe('prompt');
  });

  it('Anthropic has no native json_object mode -> prompt', () => {
    expect(resolveStructuredStrategy(objectFormat, caps(), Vendor.Anthropic, false)).toBe('prompt');
  });

  it('Google/Vertex native schema is exclusive with tools', () => {
    expect(resolveStructuredStrategy(schemaFormat, caps(), Vendor.Google, false)).toBe('native');
    expect(resolveStructuredStrategy(schemaFormat, caps(), Vendor.Google, true)).toBe('prompt');
    expect(resolveStructuredStrategy(schemaFormat, caps(), Vendor.GoogleVertex, true)).toBe('prompt');
  });

  it('falls back to prompt when the model lacks the capability', () => {
    expect(resolveStructuredStrategy(schemaFormat, caps({ supportsJSONSchema: false }), Vendor.OpenAI, false)).toBe('prompt');
    expect(resolveStructuredStrategy(objectFormat, caps({ supportsJSON: false }), Vendor.OpenAI, false)).toBe('prompt');
  });

  it('unknown vendor defaults to capability-driven native', () => {
    expect(resolveStructuredStrategy(schemaFormat, caps(), undefined, false)).toBe('native');
  });
});

describe('toProviderResponseFormat', () => {
  it('maps json_schema with defaults for name/strict', () => {
    const pf = toProviderResponseFormat({ type: 'json_schema', schema: { type: 'object' } });
    expect(pf.type).toBe('json_schema');
    expect(pf.json_schema?.name).toBe('response');
    expect(pf.json_schema?.strict).toBe(true);
    expect(pf.json_schema?.schema).toEqual({ type: 'object' });
  });

  it('preserves caller-supplied name/description/strict', () => {
    const pf = toProviderResponseFormat({
      type: 'json_schema',
      name: 'contact',
      description: 'a contact',
      strict: false,
      schema: { type: 'object' },
    });
    expect(pf.json_schema?.name).toBe('contact');
    expect(pf.json_schema?.description).toBe('a contact');
    expect(pf.json_schema?.strict).toBe(false);
  });

  it('maps json_object', () => {
    expect(toProviderResponseFormat({ type: 'json_object' })).toEqual({ type: 'json_object' });
  });
});

describe('buildStructuredInstructionSuffix', () => {
  it('embeds the schema for json_schema', () => {
    const suffix = buildStructuredInstructionSuffix(schemaFormat);
    expect(suffix).toContain('JSON Schema:');
    expect(suffix).toContain('"required"');
    expect(suffix).toContain('raw JSON');
  });

  it('asks for raw JSON for json_object without a schema block', () => {
    const suffix = buildStructuredInstructionSuffix(objectFormat);
    expect(suffix).toContain('raw JSON');
    expect(suffix).not.toContain('JSON Schema:');
  });
});

describe('buildStructuredRepairInstruction', () => {
  it('includes the parse error and the previous output', () => {
    const instr = buildStructuredRepairInstruction(schemaFormat, '{bad', new Error('boom'));
    expect(instr).toContain('boom');
    expect(instr).toContain('{bad');
    expect(instr).toContain('JSON Schema');
  });
});

describe('parseStructuredOutput', () => {
  it('parses plain JSON', () => {
    const r = parseStructuredOutput('{"name":"Jane"}', objectFormat);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ name: 'Jane' });
  });

  it('parses JSON inside markdown fences (permissive repair)', () => {
    const r = parseStructuredOutput('```json\n{"name":"Jane"}\n```', objectFormat);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ name: 'Jane' });
  });

  it('returns a failure result (never throws) on unparseable text', () => {
    const r = parseStructuredOutput('this is not json at all', objectFormat);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(Error);
  });
});
