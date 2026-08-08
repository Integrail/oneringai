import { describe, expect, it } from 'vitest';
import { detectAudioContainer, wrapRawAudioAsWav } from '@/utils/audioUtils.js';

describe('detectAudioContainer', () => {
  it.each([0xf0, 0xf1, 0xf8, 0xf9])(
    'detects AAC ADTS 0xff%s before the broad MP3 sync mask',
    (secondByte) => {
    expect(detectAudioContainer(Buffer.from([0xff, secondByte, 0x50, 0x80]))).toEqual({
      mimeType: 'audio/aac',
      extension: 'aac',
    });
    },
  );

  it('continues to detect MPEG frame sync as MP3', () => {
    expect(detectAudioContainer(Buffer.from([0xff, 0xfb, 0x90, 0x64]))).toEqual({
      mimeType: 'audio/mpeg',
      extension: 'mp3',
    });
  });

  it.each([
    ['mulaw', 7],
    ['alaw', 6],
  ] as const)('writes a WAVEFORMATEX cbSize field for raw %s audio', (encoding, formatTag) => {
    const audio = Buffer.from([1, 2, 3, 4]);
    const wav = wrapRawAudioAsWav(audio, 8000, encoding);

    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(wav.readUInt32LE(16)).toBe(18);
    expect(wav.readUInt16LE(20)).toBe(formatTag);
    expect(wav.readUInt16LE(36)).toBe(0);
    expect(wav.subarray(38, 42).toString('ascii')).toBe('data');
    expect(wav.readUInt32LE(42)).toBe(audio.length);
    expect(wav.subarray(46)).toEqual(audio);
  });

  it('keeps the compact 16-byte fmt chunk for PCM WAV', () => {
    const wav = wrapRawAudioAsWav(Buffer.from([1, 2]), 16000, 'pcm');

    expect(wav.readUInt32LE(16)).toBe(16);
    expect(wav.subarray(36, 40).toString('ascii')).toBe('data');
    expect(wav).toHaveLength(46);
  });
});
