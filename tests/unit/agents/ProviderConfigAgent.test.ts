/**
 * Unit tests for `extractProviderConfig` — the LLM-response parser used by
 * ProviderConfigAgent. Covers the happy path plus the LLM drift cases that
 * used to break the strict `JSON.parse` call (fences, trailing commas,
 * single quotes).
 */

import { describe, it, expect } from 'vitest';
import { extractProviderConfig } from '@/agents/ProviderConfigAgent.js';

describe('extractProviderConfig', () => {
  it('parses a clean marker block', () => {
    const response = [
      'Here is your config:',
      '===CONFIG_START===',
      '{"name":"openai","clientId":"abc","scopes":["read","write"]}',
      '===CONFIG_END===',
      'Let me know if anything is off.',
    ].join('\n');
    const cfg = extractProviderConfig(response) as Record<string, unknown>;
    expect(cfg.name).toBe('openai');
    expect(cfg.clientId).toBe('abc');
    expect(cfg.scopes).toEqual(['read', 'write']);
  });

  it('tolerates ```json fences nested inside the marker block', () => {
    const response = [
      '===CONFIG_START===',
      '```json',
      '{"name":"github","clientId":"abc"}',
      '```',
      '===CONFIG_END===',
    ].join('\n');
    const cfg = extractProviderConfig(response) as Record<string, unknown>;
    expect(cfg.name).toBe('github');
  });

  it('recovers from trailing commas', () => {
    const response = [
      '===CONFIG_START===',
      '{"name":"slack","scopes":["chat:write","users:read",],}',
      '===CONFIG_END===',
    ].join('\n');
    const cfg = extractProviderConfig(response) as Record<string, unknown>;
    expect(cfg.name).toBe('slack');
    expect(cfg.scopes).toEqual(['chat:write', 'users:read']);
  });

  it('recovers from single-quoted strings', () => {
    const response = [
      '===CONFIG_START===',
      "{'name':'google','clientId':'xyz'}",
      '===CONFIG_END===',
    ].join('\n');
    const cfg = extractProviderConfig(response) as Record<string, unknown>;
    expect(cfg.name).toBe('google');
  });

  it('throws a clear error when markers are missing', () => {
    expect(() => extractProviderConfig('No config here.')).toThrow(
      /No configuration found/,
    );
  });

  it('throws a parse error when the marker block is garbage', () => {
    const response = [
      '===CONFIG_START===',
      'not even json',
      '===CONFIG_END===',
    ].join('\n');
    expect(() => extractProviderConfig(response)).toThrow(
      /Failed to parse configuration JSON/,
    );
  });
});
