import { describe, it, expect } from 'vitest';
import {
  MODEL_REGISTRY,
  LLM_MODELS,
  getModelInfo,
  getModelsByVendor,
  getActiveModels,
  calculateCost,
} from '../../../../src/domain/entities/Model.js';
import { Vendor } from '../../../../src/core/Vendor.js';

describe('Model Registry', () => {
  describe('MODEL_REGISTRY', () => {
    it('should have all 26 models', () => {
      const modelCount = Object.keys(MODEL_REGISTRY).length;
      expect(modelCount).toBe(26);
    });

    it('should have 12 OpenAI models', () => {
      const openAIModels = Object.values(MODEL_REGISTRY).filter(
        (model) => model.provider === Vendor.OpenAI
      );
      expect(openAIModels).toHaveLength(12);
    });

    it('should have 7 Anthropic models', () => {
      const anthropicModels = Object.values(MODEL_REGISTRY).filter(
        (model) => model.provider === Vendor.Anthropic
      );
      expect(anthropicModels).toHaveLength(7);
    });

    it('should have 7 Google models', () => {
      const googleModels = Object.values(MODEL_REGISTRY).filter(
        (model) => model.provider === Vendor.Google
      );
      expect(googleModels).toHaveLength(7);
    });

    it('should have all models marked as active', () => {
      const activeCount = Object.values(MODEL_REGISTRY).filter(
        (model) => model.isActive
      ).length;
      expect(activeCount).toBe(26);
    });

    it('should have valid pricing for all models', () => {
      Object.values(MODEL_REGISTRY).forEach((model) => {
        expect(model.features.input.cpm).toBeGreaterThan(0);
        expect(model.features.output.cpm).toBeGreaterThan(0);
      });
    });

    it('should have valid context windows for all models', () => {
      Object.values(MODEL_REGISTRY).forEach((model) => {
        expect(model.features.input.tokens).toBeGreaterThan(0);
        expect(model.features.output.tokens).toBeGreaterThan(0);
      });
    });
  });

  describe('LLM_MODELS constants', () => {
    it('should have OpenAI model constants', () => {
      expect(LLM_MODELS[Vendor.OpenAI].GPT_5_2).toBe('gpt-5.2');
      expect(LLM_MODELS[Vendor.OpenAI].GPT_5_2_PRO).toBe('gpt-5.2-pro');
      expect(LLM_MODELS[Vendor.OpenAI].GPT_5).toBe('gpt-5');
      expect(LLM_MODELS[Vendor.OpenAI].O3_MINI).toBe('o3-mini');
    });

    it('should have Anthropic model constants', () => {
      expect(LLM_MODELS[Vendor.Anthropic].CLAUDE_OPUS_4_5).toBe(
        'claude-opus-4-5-20251101'
      );
      expect(LLM_MODELS[Vendor.Anthropic].CLAUDE_SONNET_4_5).toBe(
        'claude-sonnet-4-5-20250929'
      );
      expect(LLM_MODELS[Vendor.Anthropic].CLAUDE_HAIKU_4_5).toBe(
        'claude-haiku-4-5-20251001'
      );
    });

    it('should have Google model constants', () => {
      expect(LLM_MODELS[Vendor.Google].GEMINI_3_FLASH_PREVIEW).toBe(
        'gemini-3-flash-preview'
      );
      expect(LLM_MODELS[Vendor.Google].GEMINI_3_PRO_PREVIEW).toBe('gemini-3-pro-preview');
      expect(LLM_MODELS[Vendor.Google].GEMINI_2_5_PRO).toBe('gemini-2.5-pro');
    });

    it('should have all model constants registered in MODEL_REGISTRY', () => {
      const openAIModels = Object.values(LLM_MODELS[Vendor.OpenAI]);
      const anthropicModels = Object.values(LLM_MODELS[Vendor.Anthropic]);
      const googleModels = Object.values(LLM_MODELS[Vendor.Google]);

      openAIModels.forEach((modelName) => {
        expect(MODEL_REGISTRY[modelName]).toBeDefined();
      });

      anthropicModels.forEach((modelName) => {
        expect(MODEL_REGISTRY[modelName]).toBeDefined();
      });

      googleModels.forEach((modelName) => {
        expect(MODEL_REGISTRY[modelName]).toBeDefined();
      });
    });
  });

  describe('getModelInfo()', () => {
    it('should return model info for valid model name', () => {
      const model = getModelInfo('gpt-5.2');
      expect(model).toBeDefined();
      expect(model?.name).toBe('gpt-5.2');
      expect(model?.provider).toBe(Vendor.OpenAI);
    });

    it('should return undefined for invalid model name', () => {
      const model = getModelInfo('invalid-model-name');
      expect(model).toBeUndefined();
    });

    it('should return correct pricing for GPT-5.2', () => {
      const model = getModelInfo('gpt-5.2');
      expect(model?.features.input.cpm).toBe(1.75);
      expect(model?.features.output.cpm).toBe(14);
      expect(model?.features.input.cpmCached).toBeUndefined();
    });

    it('should return correct pricing for Claude Opus 4.5', () => {
      const model = getModelInfo('claude-opus-4-5-20251101');
      expect(model?.features.input.cpm).toBe(5);
      expect(model?.features.output.cpm).toBe(25);
      expect(model?.features.input.cpmCached).toBe(0.5);
    });

    it('should return correct context window for Gemini 3 Flash', () => {
      const model = getModelInfo('gemini-3-flash-preview');
      expect(model?.features.input.tokens).toBe(1000000);
      expect(model?.features.output.tokens).toBe(65536);
    });
  });

  describe('getModelsByVendor()', () => {
    it('should filter models by OpenAI vendor', () => {
      const models = getModelsByVendor(Vendor.OpenAI);
      expect(models).toHaveLength(12);
      expect(models.every((m) => m.provider === Vendor.OpenAI)).toBe(true);
    });

    it('should filter models by Anthropic vendor', () => {
      const models = getModelsByVendor(Vendor.Anthropic);
      expect(models).toHaveLength(7);
      expect(models.every((m) => m.provider === Vendor.Anthropic)).toBe(true);
    });

    it('should filter models by Google vendor', () => {
      const models = getModelsByVendor(Vendor.Google);
      expect(models).toHaveLength(7);
      expect(models.every((m) => m.provider === Vendor.Google)).toBe(true);
    });

    it('should return empty array for vendor with no models', () => {
      const models = getModelsByVendor(Vendor.Ollama);
      expect(models).toHaveLength(0);
    });

    it('should include all expected OpenAI models', () => {
      const models = getModelsByVendor(Vendor.OpenAI);
      const modelNames = models.map((m) => m.name);

      expect(modelNames).toContain('gpt-5.2');
      expect(modelNames).toContain('gpt-5.2-pro');
      expect(modelNames).toContain('gpt-5');
      expect(modelNames).toContain('gpt-5-mini');
      expect(modelNames).toContain('gpt-5-nano');
      expect(modelNames).toContain('gpt-4.1');
      expect(modelNames).toContain('gpt-4.1-mini');
      expect(modelNames).toContain('gpt-4.1-nano');
      expect(modelNames).toContain('gpt-4o');
      expect(modelNames).toContain('gpt-4o-mini');
      expect(modelNames).toContain('o3-mini');
      expect(modelNames).toContain('o1');
    });
  });

  describe('getActiveModels()', () => {
    it('should return all active models', () => {
      const models = getActiveModels();
      expect(models).toHaveLength(26);
      expect(models.every((m) => m.isActive)).toBe(true);
    });

    it('should include models from all vendors', () => {
      const models = getActiveModels();
      const providers = new Set(models.map((m) => m.provider));

      expect(providers.has(Vendor.OpenAI)).toBe(true);
      expect(providers.has(Vendor.Anthropic)).toBe(true);
      expect(providers.has(Vendor.Google)).toBe(true);
    });
  });

  describe('calculateCost()', () => {
    it('should calculate cost correctly for GPT-5.2', () => {
      // $1.75/M input + $14/M output
      const cost = calculateCost('gpt-5.2', 1_000_000, 1_000_000);
      expect(cost).toBe(15.75);
    });

    it('should calculate cost correctly for small token counts', () => {
      // 50K input tokens = $0.0875, 2K output tokens = $0.028
      const cost = calculateCost('gpt-5.2', 50_000, 2_000);
      expect(cost).toBeCloseTo(0.1155, 4);
    });

    it('should calculate cost with cache discount', () => {
      // gpt-5.2 doesn't have cached pricing, falls back to standard
      const cost = calculateCost('gpt-5.2', 1_000_000, 1_000_000, {
        useCachedInput: true,
      });
      expect(cost).toBe(15.75);
    });

    it('should calculate cost correctly for Claude Opus 4.5', () => {
      // $5/M input + $25/M output
      const cost = calculateCost('claude-opus-4-5-20251101', 1_000_000, 1_000_000);
      expect(cost).toBe(30);
    });

    it('should calculate cost with cache for Claude models', () => {
      // $0.5/M cached + $25/M output
      const cost = calculateCost('claude-opus-4-5-20251101', 1_000_000, 1_000_000, {
        useCachedInput: true,
      });
      expect(cost).toBe(25.5);
    });

    it('should calculate cost correctly for Gemini 2.5 Flash', () => {
      // $0.15/M input + $0.6/M output
      const cost = calculateCost('gemini-2.5-flash', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(0.75, 2);
    });

    it('should calculate cost for very cheap models (GPT-5-nano)', () => {
      // $0.05/M input + $0.4/M output
      const cost = calculateCost('gpt-5-nano', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(0.45, 2);
    });

    it('should calculate cost for expensive models (GPT-5.2-pro)', () => {
      // $21/M input + $168/M output
      const cost = calculateCost('gpt-5.2-pro', 1_000_000, 1_000_000);
      expect(cost).toBe(189);
    });

    it('should return null for invalid model', () => {
      const cost = calculateCost('invalid-model', 1_000_000, 1_000_000);
      expect(cost).toBeNull();
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost('gpt-5.2', 0, 0);
      expect(cost).toBe(0);
    });

    it('should calculate cost accurately for fractional tokens', () => {
      // 123 input tokens, 456 output tokens
      const cost = calculateCost('gpt-5.2', 123, 456);
      const expectedCost = (123 / 1_000_000) * 1.75 + (456 / 1_000_000) * 14;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should fall back to standard pricing when cache not available', () => {
      // o3-mini doesn't have cached pricing
      const cost = calculateCost('o3-mini', 1_000_000, 1_000_000, {
        useCachedInput: true,
      });
      // Should use standard pricing: $1.1/M input + $4.4/M output
      expect(cost).toBeCloseTo(5.5, 2);
    });
  });

  describe('Model data accuracy', () => {
    it('should have correct GPT-5.2 series pricing', () => {
      const gpt52 = getModelInfo('gpt-5.2');
      const pro = getModelInfo('gpt-5.2-pro');

      expect(gpt52?.features.input.cpm).toBe(1.75);
      expect(pro?.features.input.cpm).toBe(21);

      expect(gpt52?.features.output.cpm).toBe(14);
      expect(pro?.features.output.cpm).toBe(168);
    });

    it('should have correct Claude 4.5 series pricing', () => {
      const opus = getModelInfo('claude-opus-4-5-20251101');
      const sonnet = getModelInfo('claude-sonnet-4-5-20250929');
      const haiku = getModelInfo('claude-haiku-4-5-20251001');

      expect(opus?.features.input.cpm).toBe(5);
      expect(sonnet?.features.input.cpm).toBe(3);
      expect(haiku?.features.input.cpm).toBe(1);

      expect(opus?.features.output.cpm).toBe(25);
      expect(sonnet?.features.output.cpm).toBe(15);
      expect(haiku?.features.output.cpm).toBe(5);
    });

    it('should have correct Gemini 3 Flash preview pricing', () => {
      const flash = getModelInfo('gemini-3-flash-preview');
      expect(flash?.features.input.cpm).toBe(0.15);
      expect(flash?.features.output.cpm).toBe(0.6);
    });

    it('should have reasoning flag for appropriate models', () => {
      const gpt52 = getModelInfo('gpt-5.2');
      const o3mini = getModelInfo('o3-mini');
      const gemini3Flash = getModelInfo('gemini-3-flash-preview');

      expect(gpt52?.features.reasoning).toBe(true);
      expect(o3mini?.features.reasoning).toBe(true);
      expect(gemini3Flash?.features.reasoning).toBe(true);
    });

    it('should have extended thinking for Claude 4.5 models', () => {
      const opus = getModelInfo('claude-opus-4-5-20251101');
      const sonnet = getModelInfo('claude-sonnet-4-5-20250929');
      const haiku = getModelInfo('claude-haiku-4-5-20251001');

      expect(opus?.features.extendedThinking).toBe(true);
      expect(sonnet?.features.extendedThinking).toBe(true);
      expect(haiku?.features.extendedThinking).toBe(true);
    });

    it('should have vision support for modern models', () => {
      const gpt52 = getModelInfo('gpt-5.2');
      const claude = getModelInfo('claude-opus-4-5-20251101');
      const gemini = getModelInfo('gemini-3-flash-preview');

      expect(gpt52?.features.vision).toBe(true);
      expect(claude?.features.vision).toBe(true);
      expect(gemini?.features.vision).toBe(true);
    });

    it('should have correct context windows', () => {
      const gpt52 = getModelInfo('gpt-5.2');
      const claude = getModelInfo('claude-opus-4-5-20251101');
      const gemini = getModelInfo('gemini-3-flash-preview');

      expect(gpt52?.features.input.tokens).toBe(400000);
      expect(claude?.features.input.tokens).toBe(200000);
      expect(gemini?.features.input.tokens).toBe(1000000);
    });
  });
});
