/**
 * Voice pseudo-streaming capability
 *
 * Provides real-time speech synthesis from agent text streams
 * by chunking text into sentences and calling TTS in parallel.
 */

export { VoiceStream } from './VoiceStream.js';
export { SentenceChunkingStrategy } from './SentenceSplitter.js';
export { AudioPlaybackQueue } from './AudioPlaybackQueue.js';

export type {
  IChunkingStrategy,
  ChunkingOptions,
  VoiceStreamConfig,
  VoiceStreamEvents,
  AudioChunkPlaybackCallback,
} from './types.js';
