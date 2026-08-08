import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ISpeechToTextProvider } from '@/domain/interfaces/IAudioProvider.js';

vi.mock('@/core/createAudioProvider.js', () => ({
  createSTTProvider: vi.fn(),
}));

import { Connector } from '@/core/Connector.js';
import { SpeechToText } from '@/core/SpeechToText.js';
import { Vendor } from '@/core/Vendor.js';
import { createSTTProvider } from '@/core/createAudioProvider.js';

const mockCreateProvider = vi.mocked(createSTTProvider);

describe('SpeechToText', () => {
  let provider: ISpeechToTextProvider;

  beforeEach(() => {
    Connector.clear();
    provider = {
      name: 'mock-stt',
      vendor: Vendor.Google,
      capabilities: { text: false, images: false, videos: false, audio: true },
      validateConfig: vi.fn().mockResolvedValue(true),
      transcribe: vi.fn().mockResolvedValue({ text: 'hello' }),
      translate: vi.fn().mockResolvedValue({ text: 'translated' }),
    };
    mockCreateProvider.mockReturnValue(provider);
  });

  it('preserves the file path so providers can infer compressed audio formats', async () => {
    const connector = Connector.create({
      name: 'google-stt-path',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const stt = SpeechToText.create({ connector, model: 'gemini-3.6-flash' });

    await stt.transcribeFile('/tmp/recording.flac');

    expect(provider.transcribe).toHaveBeenCalledWith(expect.objectContaining({
      audio: '/tmp/recording.flac',
    }));
  });

  it('forwards normalized raw-audio metadata without forcing a vendor output format', async () => {
    const connector = Connector.create({
      name: 'google-stt-raw',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const stt = SpeechToText.create({ connector, model: 'gemini-3.6-flash' });

    await stt.transcribeWithTimestamps(Buffer.from([0, 1]), 'word', {
      encoding: 'pcm',
      sampleRate: 8000,
    });

    expect(provider.transcribe).toHaveBeenCalledWith(expect.objectContaining({
      encoding: 'pcm',
      sampleRate: 8000,
      includeTimestamps: true,
      timestampGranularity: 'word',
      outputFormat: undefined,
    }));
  });

  it('forwards configured and per-call language hints to translation', async () => {
    const connector = Connector.create({
      name: 'google-stt-translation',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const stt = SpeechToText.create({
      connector,
      model: 'gemini-3.6-flash',
      language: 'fr',
    });

    await stt.translate(Buffer.from([0, 1]));
    await stt.translate(Buffer.from([2, 3]), { language: 'de' });

    expect(provider.translate).toHaveBeenNthCalledWith(1, expect.objectContaining({ language: 'fr' }));
    expect(provider.translate).toHaveBeenNthCalledWith(2, expect.objectContaining({ language: 'de' }));
  });
});
