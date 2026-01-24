/**
 * Unit tests for TTS Model Registry
 */

import { describe, it, expect } from 'vitest';
import {
  TTS_MODEL_REGISTRY,
  getTTSModelInfo,
  getTTSModelsByVendor,
  getActiveTTSModels,
  getTTSModelsWithFeature,
  calculateTTSCost,
  TTS_MODELS,
} from '../../../src/domain/entities/TTSModel.js';
import { Vendor } from '../../../src/core/Vendor.js';

describe('TTSModel Registry', () => {
  describe('Registry structure', () => {
    it('should have all declared models', () => {
      expect(TTS_MODEL_REGISTRY['tts-1']).toBeDefined();
      expect(TTS_MODEL_REGISTRY['tts-1-hd']).toBeDefined();
      expect(TTS_MODEL_REGISTRY['gpt-4o-mini-tts']).toBeDefined();
      expect(TTS_MODEL_REGISTRY['gemini-tts']).toBeDefined();
    });

    it('should have consistent structure', () => {
      const model = TTS_MODEL_REGISTRY['tts-1'];
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('displayName');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('isActive');
      expect(model).toHaveProperty('sources');
      expect(model).toHaveProperty('capabilities');
      expect(model.sources).toHaveProperty('lastVerified');
    });

    it('should have valid capabilities', () => {
      const model = TTS_MODEL_REGISTRY['tts-1'];
      expect(model.capabilities).toHaveProperty('voices');
      expect(model.capabilities).toHaveProperty('formats');
      expect(model.capabilities).toHaveProperty('languages');
      expect(model.capabilities).toHaveProperty('speed');
      expect(model.capabilities).toHaveProperty('features');
      expect(model.capabilities).toHaveProperty('limits');
    });
  });

  describe('getTTSModelInfo', () => {
    it('should return model info for valid model', () => {
      const model = getTTSModelInfo('tts-1');
      expect(model).toBeDefined();
      expect(model?.name).toBe('tts-1');
    });

    it('should return undefined for unknown model', () => {
      const model = getTTSModelInfo('unknown-model');
      expect(model).toBeUndefined();
    });
  });

  describe('getTTSModelsByVendor', () => {
    it('should return OpenAI models', () => {
      const models = getTTSModelsByVendor(Vendor.OpenAI);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.provider === Vendor.OpenAI)).toBe(true);
      expect(models.every((m) => m.isActive)).toBe(true);
    });

    it('should return Google models', () => {
      const models = getTTSModelsByVendor(Vendor.Google);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.provider === Vendor.Google)).toBe(true);
    });

    it('should return empty for unsupported vendor', () => {
      const models = getTTSModelsByVendor(Vendor.Anthropic);
      expect(models.length).toBe(0);
    });
  });

  describe('getActiveTTSModels', () => {
    it('should return all active models', () => {
      const models = getActiveTTSModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.isActive)).toBe(true);
    });
  });

  describe('getTTSModelsWithFeature', () => {
    it('should find models with streaming', () => {
      const models = getTTSModelsWithFeature('streaming');
      expect(models.length).toBe(0); // v1 doesn't implement streaming
    });

    it('should find models with instruction steering', () => {
      const models = getTTSModelsWithFeature('instructionSteering');
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.name === 'gpt-4o-mini-tts')).toBe(true);
    });

    it('should find models with voice cloning', () => {
      const models = getTTSModelsWithFeature('voiceCloning');
      expect(models.some((m) => m.name === 'gpt-4o-mini-tts')).toBe(true);
    });
  });

  describe('calculateTTSCost', () => {
    it('should calculate cost for tts-1', () => {
      const cost = calculateTTSCost('tts-1', 1000);
      expect(cost).toBe(0.015); // $0.015 per 1k characters
    });

    it('should calculate cost for tts-1-hd', () => {
      const cost = calculateTTSCost('tts-1-hd', 1000);
      expect(cost).toBe(0.030); // $0.030 per 1k characters
    });

    it('should calculate cost for partial amounts', () => {
      const cost = calculateTTSCost('tts-1', 500);
      expect(cost).toBe(0.0075); // Half the cost
    });

    it('should return null for model without pricing', () => {
      const cost = calculateTTSCost('gemini-tts', 1000);
      expect(cost).toBeNull();
    });

    it('should return null for unknown model', () => {
      const cost = calculateTTSCost('unknown', 1000);
      expect(cost).toBeNull();
    });
  });

  describe('Model constants', () => {
    it('should have TTS_MODELS constants', () => {
      expect(TTS_MODELS[Vendor.OpenAI].TTS_1).toBe('tts-1');
      expect(TTS_MODELS[Vendor.OpenAI].TTS_1_HD).toBe('tts-1-hd');
      expect(TTS_MODELS[Vendor.OpenAI].GPT_4O_MINI_TTS).toBe('gpt-4o-mini-tts');
      expect(TTS_MODELS[Vendor.Google].GEMINI_TTS).toBe('gemini-tts');
    });
  });

  describe('Voice data sharing (DRY)', () => {
    it('should share voice data across OpenAI models', () => {
      const tts1 = getTTSModelInfo('tts-1');
      const tts1hd = getTTSModelInfo('tts-1-hd');
      const gpt4oTts = getTTSModelInfo('gpt-4o-mini-tts');

      // All OpenAI models should reference the same voice array
      expect(tts1?.capabilities.voices).toBe(tts1hd?.capabilities.voices);
      expect(tts1?.capabilities.voices).toBe(gpt4oTts?.capabilities.voices);
    });

    it('should have 13 OpenAI voices', () => {
      const model = getTTSModelInfo('tts-1');
      expect(model?.capabilities.voices.length).toBe(13);
    });

    it('should have default voice marked', () => {
      const model = getTTSModelInfo('tts-1');
      const defaultVoice = model?.capabilities.voices.find((v) => v.isDefault);
      expect(defaultVoice).toBeDefined();
      expect(defaultVoice?.id).toBe('alloy');
    });
  });
});
