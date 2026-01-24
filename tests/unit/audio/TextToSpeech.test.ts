/**
 * Unit tests for TextToSpeech capability class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextToSpeech } from '../../../src/core/TextToSpeech.js';
import { Connector } from '../../../src/core/Connector.js';
import { Vendor } from '../../../src/core/Vendor.js';
import type { ITextToSpeechProvider, TTSResponse } from '../../../src/domain/interfaces/IAudioProvider.js';

describe('TextToSpeech', () => {
  beforeEach(() => {
    // Clear connectors before each test
    Connector.clear();
  });

  describe('Creation', () => {
    it('should create instance with connector name', () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({
        connector: 'test-openai',
      });

      expect(tts).toBeInstanceOf(TextToSpeech);
    });

    it('should create instance with connector object', () => {
      const connector = Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({
        connector,
      });

      expect(tts).toBeInstanceOf(TextToSpeech);
    });

    it('should throw if connector not found', () => {
      expect(() => {
        TextToSpeech.create({ connector: 'nonexistent' });
      }).toThrow();
    });
  });

  describe('Configuration', () => {
    it('should accept default model', () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({
        connector: 'test-openai',
        model: 'tts-1-hd',
      });

      expect(tts.getModelInfo().name).toBe('tts-1-hd');
    });

    it('should accept default voice', () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({
        connector: 'test-openai',
        voice: 'nova',
      });

      expect(tts).toBeInstanceOf(TextToSpeech);
    });

    it('should allow updating model', () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({
        connector: 'test-openai',
        model: 'tts-1',
      });

      tts.setModel('tts-1-hd');
      expect(tts.getModelInfo().name).toBe('tts-1-hd');
    });
  });

  describe('Introspection', () => {
    it('should get model info', () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({
        connector: 'test-openai',
        model: 'tts-1',
      });

      const info = tts.getModelInfo();
      expect(info.name).toBe('tts-1');
      expect(info.provider).toBe(Vendor.OpenAI);
    });

    it('should get model capabilities', () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({
        connector: 'test-openai',
        model: 'tts-1',
      });

      const caps = tts.getModelCapabilities();
      expect(caps.voices.length).toBeGreaterThan(0);
      expect(caps.formats.length).toBeGreaterThan(0);
      expect(caps.speed.supported).toBe(true);
    });

    it('should list available models', () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({ connector: 'test-openai' });
      const models = tts.listAvailableModels();

      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.provider === Vendor.OpenAI)).toBe(true);
    });

    it('should check feature support', () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({
        connector: 'test-openai',
        model: 'gpt-4o-mini-tts',
      });

      expect(tts.supportsFeature('instructionSteering')).toBe(true);
      expect(tts.supportsFeature('emotions')).toBe(true);
      expect(tts.supportsFeature('ssml')).toBe(false);
    });

    it('should get supported formats', () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({ connector: 'test-openai' });
      const formats = tts.getSupportedFormats();

      expect(formats).toContain('mp3');
      expect(formats).toContain('opus');
      expect(formats).toContain('wav');
    });

    it('should check speed control support', () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({ connector: 'test-openai' });
      expect(tts.supportsSpeedControl()).toBe(true);
    });
  });

  describe('Voice listing', () => {
    it('should list voices from registry for OpenAI', async () => {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tts = TextToSpeech.create({ connector: 'test-openai' });
      const voices = await tts.listVoices();

      expect(voices.length).toBe(13);
      expect(voices.some((v) => v.id === 'alloy')).toBe(true);
      expect(voices.some((v) => v.id === 'nova')).toBe(true);
    });
  });
});
