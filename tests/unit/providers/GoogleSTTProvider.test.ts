import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInteractionsCreate, mockGoogleGenAI } = vi.hoisted(() => {
  const mockInteractionsCreate = vi.fn();
  const mockGoogleGenAI = vi.fn(() => ({
    interactions: { create: mockInteractionsCreate },
  }));
  return { mockInteractionsCreate, mockGoogleGenAI };
});

vi.mock('@google/genai', () => ({ GoogleGenAI: mockGoogleGenAI }));

import { GoogleSTTProvider } from '@/infrastructure/providers/google/GoogleSTTProvider.js';

describe('GoogleSTTProvider', () => {
  let provider: GoogleSTTProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GoogleSTTProvider({ apiKey: 'test-key' });
    mockInteractionsCreate.mockResolvedValue({
      output_text: 'hello world',
      steps: [{
        type: 'model_output',
        content: [{
          type: 'text',
          text: 'hello world',
          annotations: [
            { type: 'word_info', text: 'hello', start_offset: '0s', end_offset: '0.4s', speaker: 'spk_1' },
            { type: 'word_info', text: 'world', start_offset: '0.5s', end_offset: '0.9s', speaker: 'spk_1' },
          ],
        }],
      }],
    });
  });

  it('wraps 8 kHz TextPipeline PCM correctly and requests native word timestamps', async () => {
    const pcm = Buffer.from([0, 1, 2, 3]);
    const result = await provider.transcribe({
      model: 'gemini-3.6-flash',
      audio: pcm,
      encoding: 'pcm',
      sampleRate: 8000,
      language: 'en',
      includeTimestamps: true,
      timestampGranularity: 'word',
      vendorOptions: { diarizationMode: 'speaker', customVocabulary: ['OneRingAI'] },
    });

    const request = mockInteractionsCreate.mock.calls[0][0];
    const audio = request.input[1];
    const wav = Buffer.from(audio.data, 'base64');
    expect(audio).toMatchObject({ type: 'audio', mime_type: 'audio/wav' });
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(8000);
    expect(wav.subarray(44)).toEqual(pcm);
    expect(request.generation_config.transcription_config).toEqual({
      language_codes: ['en'],
      timestamp_granularities: ['word'],
      custom_vocabulary: ['OneRingAI'],
      diarization_mode: 'speaker',
    });
    expect(result).toMatchObject({
      text: 'hello world',
      language: 'en',
      durationSeconds: 0.9,
      words: [
        { word: 'hello', start: 0, end: 0.4, speaker: 'spk_1' },
        { word: 'world', start: 0.5, end: 0.9, speaker: 'spk_1' },
      ],
    });
  });

  it('fails explicitly for unsupported output formats', async () => {
    await expect(provider.transcribe({
      model: 'gemini-3.6-flash',
      audio: Buffer.from([0, 1]),
      outputFormat: 'srt',
    })).rejects.toThrow('does not support srt output');
  });

  it('normalizes native inline timestamp markers into clean segment output', async () => {
    mockInteractionsCreate.mockResolvedValue({
      output_text: '<|0.00|>hello world<|0.90|>',
      steps: [{
        type: 'model_output',
        content: [{ type: 'text', text: '<|0.00|>hello world<|0.90|>' }],
      }],
    });

    const response = await provider.transcribe({
      model: 'gemini-3.6-flash',
      audio: Buffer.alloc(28_800),
      encoding: 'pcm',
      sampleRate: 16000,
      includeTimestamps: true,
      timestampGranularity: 'segment',
    });

    expect(response.text).toBe('hello world');
    expect(response.segments).toEqual([{ id: 0, text: 'hello world', start: 0, end: 0.9 }]);
  });
});
