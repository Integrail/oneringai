/**
 * Integration tests for SpeechToText (requires API keys)
 * These tests make real API calls to verify functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Connector } from '../../../src/core/Connector.js';
import { SpeechToText } from '../../../src/core/SpeechToText.js';
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

describeIfOpenAI('SpeechToText Integration (OpenAI)', () => {
  const tempFiles: string[] = [];
  let testAudioPath: string;

  beforeAll(async () => {
    if (!OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set, skipping OpenAI STT integration tests');
      return;
    }

    Connector.create({
      name: 'openai-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: OPENAI_API_KEY },
    });

    // Generate a test audio file using TTS
    const tts = TextToSpeech.create({
      connector: 'openai-test',
      model: 'tts-1',
    });

    testAudioPath = path.join(__dirname, 'test-audio.mp3');
    tempFiles.push(testAudioPath);

    await tts.toFile('The quick brown fox jumps over the lazy dog.', testAudioPath);
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

  describe('Basic transcription', () => {
    it('should transcribe audio file with whisper-1', async () => {
      const stt = SpeechToText.create({
        connector: 'openai-test',
        model: 'whisper-1',
      });

      const result = await stt.transcribeFile(testAudioPath);

      expect(result.text).toBeDefined();
      expect(result.text.toLowerCase()).toContain('quick brown fox');
      expect(result.text.toLowerCase()).toContain('lazy dog');
    }, 60000); // 60s timeout for audio processing

    it('should transcribe from Buffer', async () => {
      const stt = SpeechToText.create({
        connector: 'openai-test',
        model: 'whisper-1',
      });

      const audioBuffer = await fs.readFile(testAudioPath);
      const result = await stt.transcribe(audioBuffer);

      expect(result.text).toBeDefined();
      expect(result.text.toLowerCase()).toContain('fox');
    }, 60000);
  });

  describe('Timestamps', () => {
    it('should get segment timestamps', async () => {
      const stt = SpeechToText.create({
        connector: 'openai-test',
        model: 'whisper-1',
      });

      const result = await stt.transcribeWithTimestamps(testAudioPath, 'segment');

      expect(result.text).toBeDefined();
      expect(result.segments).toBeDefined();
      expect(result.segments!.length).toBeGreaterThan(0);

      const firstSegment = result.segments![0];
      expect(firstSegment).toHaveProperty('text');
      expect(firstSegment).toHaveProperty('start');
      expect(firstSegment).toHaveProperty('end');
    }, 60000);

    it('should get word timestamps', async () => {
      const stt = SpeechToText.create({
        connector: 'openai-test',
        model: 'whisper-1',
      });

      const result = await stt.transcribeWithTimestamps(testAudioPath, 'word');

      expect(result.text).toBeDefined();
      expect(result.words).toBeDefined();
      expect(result.words!.length).toBeGreaterThan(0);

      const firstWord = result.words![0];
      expect(firstWord).toHaveProperty('word');
      expect(firstWord).toHaveProperty('start');
      expect(firstWord).toHaveProperty('end');
      expect(firstWord.start).toBeGreaterThanOrEqual(0);
      expect(firstWord.end).toBeGreaterThan(firstWord.start);
    }, 60000);
  });

  describe('Output formats', () => {
    it('should support different output formats', async () => {
      const stt = SpeechToText.create({
        connector: 'openai-test',
        model: 'whisper-1',
      });

      const json = await stt.transcribe(testAudioPath, { outputFormat: 'json' });
      expect(json.text).toBeDefined();

      const text = await stt.transcribe(testAudioPath, { outputFormat: 'text' });
      expect(text.text).toBeDefined();

      const srt = await stt.transcribe(testAudioPath, { outputFormat: 'srt' });
      expect(srt.text).toBeDefined();
    }, 60000);
  });

  describe('Language detection', () => {
    it('should auto-detect English', async () => {
      const stt = SpeechToText.create({
        connector: 'openai-test',
        model: 'whisper-1',
      });

      // Use verbose_json to get language info
      const result = await stt.transcribe(testAudioPath, { outputFormat: 'verbose_json' });

      // Language detection is available in verbose mode
      if (result.language) {
        // API returns 'english' for whisper-1
        expect(['en', 'english'].some(lang => result.language?.includes(lang))).toBe(true);
      }
      // The transcription should still work
      expect(result.text).toBeDefined();
    }, 60000);

    it('should accept language hint', async () => {
      const stt = SpeechToText.create({
        connector: 'openai-test',
        model: 'whisper-1',
      });

      const result = await stt.transcribe(testAudioPath, { language: 'en' });

      expect(result.text).toBeDefined();
    }, 60000);
  });

  describe('Introspection', () => {
    it('should check feature support', () => {
      const stt = SpeechToText.create({
        connector: 'openai-test',
        model: 'whisper-1',
      });

      expect(stt.supportsTranslation()).toBe(true);
      expect(stt.supportsDiarization()).toBe(false);
      expect(stt.supportsTimestamps()).toBe(true);
    });

    it('should get supported formats', () => {
      const stt = SpeechToText.create({
        connector: 'openai-test',
        model: 'whisper-1',
      });

      const inputFormats = stt.getSupportedInputFormats();
      expect(inputFormats).toContain('mp3');
      expect(inputFormats).toContain('wav');

      const outputFormats = stt.getSupportedOutputFormats();
      expect(outputFormats).toContain('json');
      expect(outputFormats).toContain('srt');
    });
  });
});

// Groq tests (if key available)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HAS_GROQ_KEY = Boolean(GROQ_API_KEY);
const describeIfGroq = HAS_GROQ_KEY ? describe : describe.skip;

describeIfGroq('SpeechToText Integration (Groq)', () => {
  const tempFiles: string[] = [];
  let testAudioPath: string;

  beforeAll(async () => {
    if (!GROQ_API_KEY || !OPENAI_API_KEY) {
      console.warn('⚠️  API keys not set, skipping Groq STT integration tests');
      return;
    }

    // Create connectors
    Connector.create({
      name: 'openai-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: OPENAI_API_KEY },
    });

    Connector.create({
      name: 'groq-test',
      vendor: Vendor.Groq,
      auth: { type: 'api_key', apiKey: GROQ_API_KEY },
    });

    // Generate test audio with OpenAI TTS
    const tts = TextToSpeech.create({ connector: 'openai-test' });
    testAudioPath = path.join(__dirname, 'test-audio-groq.mp3');
    tempFiles.push(testAudioPath);
    await tts.toFile('Testing Groq transcription.', testAudioPath);
  });

  afterAll(async () => {
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore
      }
    }
    Connector.clear();
  });

  it('should transcribe with ultra-fast Groq Whisper', async () => {
    const stt = SpeechToText.create({
      connector: 'groq-test',
      model: 'whisper-large-v3',
    });

    const result = await stt.transcribeFile(testAudioPath);

    expect(result.text).toBeDefined();
    expect(result.text.toLowerCase()).toContain('groq');
  }, 60000);
});
