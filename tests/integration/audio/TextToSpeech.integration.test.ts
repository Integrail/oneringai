/**
 * Integration tests for TextToSpeech (requires API keys)
 * These tests make real API calls to verify functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Connector } from '../../../src/core/Connector.js';
import { TextToSpeech } from '../../../src/core/TextToSpeech.js';
import { Vendor } from '../../../src/core/Vendor.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);
const HAS_GOOGLE_KEY = Boolean(GOOGLE_API_KEY);

// Skip tests if no API key
const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;
const describeIfGoogle = HAS_GOOGLE_KEY ? describe : describe.skip;

describeIfOpenAI('TextToSpeech Integration (OpenAI)', () => {
  const tempFiles: string[] = [];

  beforeAll(() => {
    if (!OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set, skipping OpenAI TTS integration tests');
      return;
    }

    Connector.create({
      name: 'openai-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: OPENAI_API_KEY },
    });
  });

  afterAll(async () => {
    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore errors
      }
    }

    Connector.clear();
  });

  describe('Basic synthesis', () => {
    it('should synthesize short text with tts-1', async () => {
      const tts = TextToSpeech.create({
        connector: 'openai-test',
        model: 'tts-1',
        voice: 'alloy',
      });

      const response = await tts.synthesize('Hello, this is a test.');

      expect(response.audio).toBeInstanceOf(Buffer);
      expect(response.audio.length).toBeGreaterThan(0);
      expect(response.format).toBe('mp3');
      expect(response.charactersUsed).toBe('Hello, this is a test.'.length); // 22
    }, 30000); // 30s timeout

    it('should synthesize with different voices', async () => {
      const tts = TextToSpeech.create({
        connector: 'openai-test',
        model: 'tts-1',
      });

      const alloy = await tts.synthesize('Test', { voice: 'alloy' });
      const nova = await tts.synthesize('Test', { voice: 'nova' });

      expect(alloy.audio).toBeInstanceOf(Buffer);
      expect(nova.audio).toBeInstanceOf(Buffer);
      // Audio should be different (can't directly compare buffers)
      expect(alloy.audio.length).toBeGreaterThan(0);
      expect(nova.audio.length).toBeGreaterThan(0);
    }, 30000);

    it('should synthesize with speed control', async () => {
      const tts = TextToSpeech.create({
        connector: 'openai-test',
        model: 'tts-1',
      });

      const normal = await tts.synthesize('Testing speed control', { speed: 1.0 });
      const fast = await tts.synthesize('Testing speed control', { speed: 2.0 });

      expect(normal.audio).toBeInstanceOf(Buffer);
      expect(fast.audio).toBeInstanceOf(Buffer);
      // Faster should be smaller
      expect(fast.audio.length).toBeLessThan(normal.audio.length);
    }, 30000);
  });

  describe('File output', () => {
    it('should save audio to file', async () => {
      const tts = TextToSpeech.create({
        connector: 'openai-test',
        model: 'tts-1',
      });

      const outputPath = path.join(__dirname, 'test-output.mp3');
      tempFiles.push(outputPath);

      await tts.toFile('This is saved to a file.', outputPath);

      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    }, 30000);

    it('should save with different formats', async () => {
      const tts = TextToSpeech.create({
        connector: 'openai-test',
        model: 'tts-1',
      });

      const opusPath = path.join(__dirname, 'test-output.opus');
      tempFiles.push(opusPath);

      await tts.toFile('Testing opus format', opusPath, { format: 'opus' });

      const stats = await fs.stat(opusPath);
      expect(stats.size).toBeGreaterThan(0);
    }, 30000);
  });

  describe('High-definition model', () => {
    it('should synthesize with tts-1-hd', async () => {
      const tts = TextToSpeech.create({
        connector: 'openai-test',
        model: 'tts-1-hd',
        voice: 'nova',
      });

      const response = await tts.synthesize('High definition audio test.');

      expect(response.audio).toBeInstanceOf(Buffer);
      expect(response.audio.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Instruction steering (gpt-4o-mini-tts)', () => {
    it('should synthesize with instruction steering', async () => {
      const tts = TextToSpeech.create({
        connector: 'openai-test',
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
      });

      const response = await tts.synthesize(
        'Welcome to our meditation app. Take a deep breath.',
        {
          vendorOptions: {
            instructions: 'speak like a calm meditation guide',
          },
        }
      );

      expect(response.audio).toBeInstanceOf(Buffer);
      expect(response.audio.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Error handling', () => {
    it('should throw on invalid voice', async () => {
      const tts = TextToSpeech.create({
        connector: 'openai-test',
        model: 'tts-1',
      });

      await expect(
        tts.synthesize('Test', { voice: 'invalid-voice' as any })
      ).rejects.toThrow();
    }, 30000);

    it('should throw on text too long', async () => {
      const tts = TextToSpeech.create({
        connector: 'openai-test',
        model: 'tts-1',
      });

      // Generate text longer than 4096 characters
      const longText = 'a'.repeat(5000);

      await expect(
        tts.synthesize(longText)
      ).rejects.toThrow();
    }, 30000);
  });
});

// ============================================================================
// Google TTS Integration Tests
// ============================================================================

describeIfGoogle('TextToSpeech Integration (Google)', () => {
  const tempFiles: string[] = [];

  beforeAll(() => {
    if (!GOOGLE_API_KEY) {
      console.warn('⚠️  GOOGLE_API_KEY not set, skipping Google TTS integration tests');
      return;
    }

    Connector.create({
      name: 'google-test',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY },
    });
  });

  afterAll(async () => {
    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore errors
      }
    }

    // Clear only if we created this connector
    if (HAS_GOOGLE_KEY) {
      try {
        Connector.clear();
      } catch {
        // Ignore if already cleared
      }
    }
  });

  describe('Basic synthesis with Gemini TTS', () => {
    it('should synthesize short text with gemini-2.5-flash-preview-tts', async () => {
      const tts = TextToSpeech.create({
        connector: 'google-test',
        model: 'gemini-2.5-flash-preview-tts',
        voice: 'Kore',
      });

      const response = await tts.synthesize('Hello, this is a test from Google.');

      expect(response.audio).toBeInstanceOf(Buffer);
      expect(response.audio.length).toBeGreaterThan(0);
      expect(response.format).toBe('wav'); // Google outputs WAV
      expect(response.charactersUsed).toBe('Hello, this is a test from Google.'.length);
    }, 60000); // 60s timeout for Google

    it('should synthesize with different voices', async () => {
      const tts = TextToSpeech.create({
        connector: 'google-test',
        model: 'gemini-2.5-flash-preview-tts',
      });

      // Use longer text - Gemini TTS doesn't handle very short text well
      const kore = await tts.synthesize('This is a test with the Kore voice.', { voice: 'Kore' });
      const puck = await tts.synthesize('This is a test with the Puck voice.', { voice: 'Puck' });

      expect(kore.audio).toBeInstanceOf(Buffer);
      expect(puck.audio).toBeInstanceOf(Buffer);
      expect(kore.audio.length).toBeGreaterThan(0);
      expect(puck.audio.length).toBeGreaterThan(0);
    }, 60000);

    it('should synthesize with Charon voice', async () => {
      const tts = TextToSpeech.create({
        connector: 'google-test',
        model: 'gemini-2.5-flash-preview-tts',
        voice: 'Charon',
      });

      const response = await tts.synthesize('Testing the Charon voice.');

      expect(response.audio).toBeInstanceOf(Buffer);
      expect(response.audio.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('File output', () => {
    it('should save audio to WAV file', async () => {
      const tts = TextToSpeech.create({
        connector: 'google-test',
        model: 'gemini-2.5-flash-preview-tts',
      });

      const outputPath = path.join(__dirname, 'test-google-output.wav');
      tempFiles.push(outputPath);

      await tts.toFile('This is saved to a file from Google.', outputPath);

      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      // Verify WAV header
      const buffer = await fs.readFile(outputPath);
      expect(buffer.slice(0, 4).toString()).toBe('RIFF');
      expect(buffer.slice(8, 12).toString()).toBe('WAVE');
    }, 60000);
  });

  describe('Pro model', () => {
    it('should synthesize with gemini-2.5-pro-preview-tts', async () => {
      const tts = TextToSpeech.create({
        connector: 'google-test',
        model: 'gemini-2.5-pro-preview-tts',
        voice: 'Aoede',
      });

      const response = await tts.synthesize('Testing the pro quality model.');

      expect(response.audio).toBeInstanceOf(Buffer);
      expect(response.audio.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('List voices', () => {
    it('should list available voices', async () => {
      const tts = TextToSpeech.create({
        connector: 'google-test',
        model: 'gemini-2.5-flash-preview-tts',
      });

      const voices = await tts.listVoices();

      expect(voices.length).toBeGreaterThan(0);
      expect(voices.some(v => v.id === 'Kore')).toBe(true);
      expect(voices.some(v => v.id === 'Puck')).toBe(true);
      expect(voices.some(v => v.id === 'Charon')).toBe(true);
    });
  });
});
