/**
 * Unit tests for Video Model Registry
 */

import { describe, it, expect } from 'vitest';
import {
  VIDEO_MODEL_REGISTRY,
  getVideoModelInfo,
  getVideoModelsByVendor,
  getActiveVideoModels,
  getVideoModelsWithFeature,
  getVideoModelsWithAudio,
  calculateVideoCost,
  VIDEO_MODELS,
} from '../../../src/domain/entities/VideoModel.js';
import { Vendor } from '../../../src/core/Vendor.js';

describe('VideoModel Registry', () => {
  describe('Registry structure', () => {
    it('should have all declared OpenAI models', () => {
      expect(VIDEO_MODEL_REGISTRY['sora-2']).toBeDefined();
      expect(VIDEO_MODEL_REGISTRY['sora-2-pro']).toBeDefined();
    });

    it('should have all declared Google models', () => {
      expect(VIDEO_MODEL_REGISTRY['veo-2.0-generate-001']).toBeDefined();
      expect(VIDEO_MODEL_REGISTRY['veo-3-generate-preview']).toBeDefined();
      expect(VIDEO_MODEL_REGISTRY['veo-3.1-fast-generate-preview']).toBeDefined();
      expect(VIDEO_MODEL_REGISTRY['veo-3.1-generate-preview']).toBeDefined();
    });

    it('should have consistent structure', () => {
      const model = VIDEO_MODEL_REGISTRY['sora-2'];
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('displayName');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('isActive');
      expect(model).toHaveProperty('sources');
      expect(model).toHaveProperty('capabilities');
      expect(model.sources).toHaveProperty('lastVerified');
    });

    it('should have valid capabilities', () => {
      const model = VIDEO_MODEL_REGISTRY['sora-2'];
      expect(model.capabilities).toHaveProperty('durations');
      expect(model.capabilities).toHaveProperty('resolutions');
      expect(model.capabilities).toHaveProperty('maxFps');
      expect(model.capabilities).toHaveProperty('audio');
      expect(model.capabilities).toHaveProperty('imageToVideo');
      expect(model.capabilities).toHaveProperty('features');
    });
  });

  describe('getVideoModelInfo', () => {
    it('should return model info for valid model', () => {
      const model = getVideoModelInfo('sora-2');
      expect(model).toBeDefined();
      expect(model?.name).toBe('sora-2');
    });

    it('should return undefined for unknown model', () => {
      const model = getVideoModelInfo('unknown-model');
      expect(model).toBeUndefined();
    });
  });

  describe('getVideoModelsByVendor', () => {
    it('should return OpenAI models', () => {
      const models = getVideoModelsByVendor(Vendor.OpenAI);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.provider === Vendor.OpenAI)).toBe(true);
      expect(models.every((m) => m.isActive)).toBe(true);
    });

    it('should return Google models', () => {
      const models = getVideoModelsByVendor(Vendor.Google);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.provider === Vendor.Google)).toBe(true);
    });

    it('should return empty for unsupported vendor', () => {
      const models = getVideoModelsByVendor(Vendor.Anthropic);
      expect(models.length).toBe(0);
    });
  });

  describe('getActiveVideoModels', () => {
    it('should return all active models', () => {
      const models = getActiveVideoModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.isActive)).toBe(true);
    });
  });

  describe('getVideoModelsWithFeature', () => {
    it('should find models with upscaling support', () => {
      const models = getVideoModelsWithFeature('upscaling');
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.name === 'sora-2-pro')).toBe(true);
      expect(models.some((m) => m.name === 'veo-3-generate-preview')).toBe(true);
    });

    it('should find models with style control', () => {
      const models = getVideoModelsWithFeature('styleControl');
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.name === 'sora-2-pro')).toBe(true);
    });

    it('should find models with seed support', () => {
      const models = getVideoModelsWithFeature('seed');
      expect(models.length).toBeGreaterThan(0);
      // All models should support seed
      expect(models.some((m) => m.name === 'sora-2')).toBe(true);
      expect(models.some((m) => m.name === 'veo-2.0-generate-001')).toBe(true);
    });
  });

  describe('getVideoModelsWithAudio', () => {
    it('should find models with audio generation', () => {
      const models = getVideoModelsWithAudio();
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.name === 'sora-2')).toBe(true);
      expect(models.some((m) => m.name === 'veo-3-generate-preview')).toBe(true);
      expect(models.some((m) => m.name === 'veo-3.1-generate-preview')).toBe(true);
    });

    it('should not include models without audio', () => {
      const models = getVideoModelsWithAudio();
      expect(models.some((m) => m.name === 'veo-2.0-generate-001')).toBe(false);
      // Note: Veo 3.1 Fast now has audio according to updated API docs
    });
  });

  describe('calculateVideoCost', () => {
    it('should calculate cost for sora-2', () => {
      const cost = calculateVideoCost('sora-2', 8);
      expect(cost).toBe(1.20); // 8 * 0.15
    });

    it('should calculate cost for sora-2-pro', () => {
      const cost = calculateVideoCost('sora-2-pro', 12);
      expect(cost).toBeCloseTo(4.80, 2); // 12 * 0.40
    });

    it('should calculate cost for Google Veo', () => {
      const cost = calculateVideoCost('veo-3-generate-preview', 8);
      expect(cost).toBe(6.00); // 8 * 0.75
    });

    it('should return null for unknown model', () => {
      const cost = calculateVideoCost('unknown', 1);
      expect(cost).toBeNull();
    });
  });

  describe('Model constants', () => {
    it('should have VIDEO_MODELS constants for OpenAI', () => {
      expect(VIDEO_MODELS[Vendor.OpenAI].SORA_2).toBe('sora-2');
      expect(VIDEO_MODELS[Vendor.OpenAI].SORA_2_PRO).toBe('sora-2-pro');
    });

    it('should have VIDEO_MODELS constants for Google', () => {
      expect(VIDEO_MODELS[Vendor.Google].VEO_2).toBe('veo-2.0-generate-001');
      expect(VIDEO_MODELS[Vendor.Google].VEO_3).toBe('veo-3-generate-preview');
      expect(VIDEO_MODELS[Vendor.Google].VEO_3_FAST).toBe('veo-3.1-fast-generate-preview');
      expect(VIDEO_MODELS[Vendor.Google].VEO_3_1).toBe('veo-3.1-generate-preview');
    });
  });

  describe('Model capabilities', () => {
    it('should have correct durations for Sora 2', () => {
      const model = getVideoModelInfo('sora-2');
      expect(model?.capabilities.durations).toContain(4);
      expect(model?.capabilities.durations).toContain(8);
      expect(model?.capabilities.durations).toContain(12);
    });

    it('should have correct resolutions for Sora 2', () => {
      const model = getVideoModelInfo('sora-2');
      expect(model?.capabilities.resolutions).toContain('1280x720');
      expect(model?.capabilities.resolutions).toContain('720x1280');
    });

    it('should mark Sora 2 as having audio', () => {
      const model = getVideoModelInfo('sora-2');
      expect(model?.capabilities.audio).toBe(true);
    });

    it('should mark Veo 3.1 as having video extension', () => {
      const model = getVideoModelInfo('veo-3.1-generate-preview');
      expect(model?.capabilities.videoExtension).toBe(true);
    });

    it('should mark Veo 3.1 Fast as having audio', () => {
      const model = getVideoModelInfo('veo-3.1-fast-generate-preview');
      expect(model?.capabilities.audio).toBe(true);
    });

    it('should mark Veo 2 as supporting frame control', () => {
      const model = getVideoModelInfo('veo-2.0-generate-001');
      expect(model?.capabilities.frameControl).toBe(true);
    });
  });
});
