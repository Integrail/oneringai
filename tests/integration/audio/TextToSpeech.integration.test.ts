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
const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);

// Skip tests if no API key
const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;

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
