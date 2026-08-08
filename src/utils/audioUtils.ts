/** Raw audio encodings accepted by the normalized STT APIs. */
export type RawAudioEncoding = 'pcm' | 'mulaw' | 'alaw';

export interface DetectedAudioContainer {
  mimeType: string;
  extension: string;
}

/** Detect common self-describing audio containers supplied as buffers. */
export function detectAudioContainer(audio: Buffer): DetectedAudioContainer | undefined {
  if (audio.length >= 12
    && audio.subarray(0, 4).toString('ascii') === 'RIFF'
    && audio.subarray(8, 12).toString('ascii') === 'WAVE') {
    return { mimeType: 'audio/wav', extension: 'wav' };
  }
  if (audio.length >= 12
    && audio.subarray(0, 4).toString('ascii') === 'FORM'
    && (audio.subarray(8, 12).toString('ascii') === 'AIFF'
      || audio.subarray(8, 12).toString('ascii') === 'AIFC')) {
    return { mimeType: 'audio/aiff', extension: 'aiff' };
  }
  // AAC ADTS also matches MPEG's broad 0xffe0 sync mask, so check it first.
  if (audio.length >= 2
    && audio[0] === 0xff
    // ADTS: 12-bit syncword, layer=00; MPEG ID and CRC protection may vary.
    && (audio[1]! & 0xf6) === 0xf0) {
    return { mimeType: 'audio/aac', extension: 'aac' };
  }
  if (audio.subarray(0, 3).toString('ascii') === 'ID3'
    || (audio.length >= 2 && audio[0] === 0xff && (audio[1]! & 0xe0) === 0xe0)) {
    return { mimeType: 'audio/mpeg', extension: 'mp3' };
  }
  if (audio.subarray(0, 4).toString('ascii') === 'fLaC') {
    return { mimeType: 'audio/flac', extension: 'flac' };
  }
  if (audio.subarray(0, 4).toString('ascii') === 'OggS') {
    return { mimeType: 'audio/ogg', extension: 'ogg' };
  }
  if (audio.length >= 4
    && audio[0] === 0x1a && audio[1] === 0x45 && audio[2] === 0xdf && audio[3] === 0xa3) {
    return { mimeType: 'audio/webm', extension: 'webm' };
  }
  if (audio.length >= 12 && audio.subarray(4, 8).toString('ascii') === 'ftyp') {
    return { mimeType: 'audio/mp4', extension: 'm4a' };
  }
  return undefined;
}

/** Wrap headerless mono audio in a WAV container with an explicit sample rate. */
export function wrapRawAudioAsWav(
  audio: Buffer,
  sampleRate: number,
  encoding: RawAudioEncoding = 'pcm',
): Buffer {
  const bitsPerSample = encoding === 'pcm' ? 16 : 8;
  const audioFormat = encoding === 'pcm' ? 1 : encoding === 'alaw' ? 6 : 7;
  const formatChunkSize = encoding === 'pcm' ? 16 : 18;
  const channels = 1;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataChunkOffset = 20 + formatChunkSize;
  const header = Buffer.alloc(dataChunkOffset + 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(header.length + audio.length - 8, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(formatChunkSize, 16);
  header.writeUInt16LE(audioFormat, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  if (encoding !== 'pcm') {
    // WAVE_FORMAT_ALAW/WAVE_FORMAT_MULAW use WAVEFORMATEX, whose trailing
    // cbSize member is required even when there is no extra format payload.
    header.writeUInt16LE(0, 36);
  }
  header.write('data', dataChunkOffset);
  header.writeUInt32LE(audio.length, dataChunkOffset + 4);

  return Buffer.concat([header, audio]);
}
