import { describe, it, expect } from 'vitest';
import { resolveModelCapabilities, resolveMaxContextTokens } from '../../../../src/infrastructure/providers/base/ModelCapabilityResolver.js';
import type { ModelCapabilities } from '../../../../src/domain/interfaces/ITextProvider.js';

const GENERIC_DEFAULTS: ModelCapabilities = {
  supportsTools: false,
  supportsVision: false,
  supportsJSON: false,
  supportsJSONSchema: false,
  maxTokens: 4096,
  maxOutputTokens: 2048,
};

describe('ModelCapabilityResolver', () => {
  describe('resolveModelCapabilities()', () => {
    it('should return registry values for a registered model', () => {
      const caps = resolveModelCapabilities('gpt-5.2', GENERIC_DEFAULTS);

      expect(caps.maxTokens).toBe(400000);
      expect(caps.maxInputTokens).toBe(400000);
      expect(caps.maxOutputTokens).toBe(128000);
      expect(caps.supportsTools).toBe(true);
      expect(caps.supportsVision).toBe(true);
      expect(caps.supportsJSON).toBe(true);
      expect(caps.supportsJSONSchema).toBe(true);
    });

    it('should return vendor defaults for an unregistered model', () => {
      const caps = resolveModelCapabilities('totally-unknown-model', GENERIC_DEFAULTS);

      expect(caps.maxTokens).toBe(4096);
      expect(caps.maxOutputTokens).toBe(2048);
      expect(caps.supportsTools).toBe(false);
      expect(caps.supportsVision).toBe(false);
    });

    it('should resolve Anthropic models from registry', () => {
      const caps = resolveModelCapabilities('claude-sonnet-4-5-20250929', GENERIC_DEFAULTS);

      expect(caps.maxTokens).toBe(200000);
      expect(caps.maxOutputTokens).toBe(64000);
      expect(caps.supportsTools).toBe(true);
      expect(caps.supportsVision).toBe(true);
    });

    it('should resolve Google models from registry', () => {
      const caps = resolveModelCapabilities('gemini-2.5-pro', GENERIC_DEFAULTS);

      expect(caps.maxTokens).toBe(1000000);
      expect(caps.maxOutputTokens).toBe(65536);
      expect(caps.supportsTools).toBe(true);
    });

    it('should resolve Grok models from registry', () => {
      const caps = resolveModelCapabilities('grok-4-1-fast-reasoning', GENERIC_DEFAULTS);

      expect(caps.maxTokens).toBe(2000000);
      expect(caps.maxOutputTokens).toBe(65536);
    });

    it('should support Anthropic JSONSchema override pattern', () => {
      const caps = resolveModelCapabilities('claude-sonnet-4-5-20250929', GENERIC_DEFAULTS);
      // Registry has structuredOutput: true, so supportsJSONSchema defaults to true
      expect(caps.supportsJSONSchema).toBe(true);
      // Anthropic provider would override this:
      caps.supportsJSONSchema = false;
      expect(caps.supportsJSONSchema).toBe(false);
    });
  });

  describe('resolveMaxContextTokens()', () => {
    it('should return registry value for a registered model', () => {
      expect(resolveMaxContextTokens('gpt-5.2', 128000)).toBe(400000);
    });

    it('should return fallback for an unregistered model', () => {
      expect(resolveMaxContextTokens('unknown-model', 128000)).toBe(128000);
    });

    it('should return fallback when model is undefined', () => {
      expect(resolveMaxContextTokens(undefined, 200000)).toBe(200000);
    });

    it('should return accurate value for gpt-4.1 (1M context)', () => {
      expect(resolveMaxContextTokens('gpt-4.1', 128000)).toBe(1000000);
    });

    it('should return accurate value for o3-mini', () => {
      expect(resolveMaxContextTokens('o3-mini', 128000)).toBe(200000);
    });
  });
});
