/**
 * Types for voice pseudo-streaming capability
 */

import type { Connector } from '../../core/Connector.js';
import type { AudioFormat } from '../../domain/types/SharedTypes.js';
import type { AudioChunkReadyEvent } from '../../domain/entities/StreamEvent.js';

// =============================================================================
// Chunking Strategy
// =============================================================================

/**
 * Interface for text chunking strategies used by VoiceStream.
 * Implementations accumulate streaming text deltas and emit complete
 * chunks suitable for TTS synthesis.
 */
export interface IChunkingStrategy {
  /**
   * Feed a text delta from the stream.
   * Returns any completed chunks (sentences/phrases).
   * Keeps partial text in an internal buffer.
   */
  feed(delta: string): string[];

  /**
   * Flush remaining buffered text as a final chunk.
   * Called when the text stream ends.
   */
  flush(): string | null;

  /** Reset internal state for reuse */
  reset(): void;
}

/**
 * Options for the default SentenceChunkingStrategy
 */
export interface ChunkingOptions {
  /** Minimum characters before emitting a chunk. Default: 20 */
  minChunkLength?: number;

  /** Maximum characters per chunk. Forces split at clause boundary. Default: 500 */
  maxChunkLength?: number;

  /** Skip text inside fenced code blocks. Default: true */
  skipCodeBlocks?: boolean;

  /** Strip markdown formatting (bold, italic, links, headings). Default: true */
  stripMarkdown?: boolean;

  /** Additional abbreviations to recognize (e.g., ['Corp.', 'Ltd.']) */
  additionalAbbreviations?: string[];
}

// =============================================================================
// VoiceStream Configuration
// =============================================================================

/**
 * Configuration for VoiceStream
 */
export interface VoiceStreamConfig {
  /** TTS connector name or instance */
  ttsConnector: string | Connector;

  /** TTS model (e.g., 'tts-1-hd', 'gpt-4o-mini-tts') */
  ttsModel?: string;

  /** Voice ID (e.g., 'nova', 'alloy') */
  voice?: string;

  /** Audio output format. Default: 'mp3' */
  format?: AudioFormat;

  /** Speech speed (0.25 to 4.0). Default: 1.0 */
  speed?: number;

  /** Custom chunking strategy. Default: SentenceChunkingStrategy */
  chunkingStrategy?: IChunkingStrategy;

  /** Options for default chunking strategy (ignored if chunkingStrategy provided) */
  chunkingOptions?: ChunkingOptions;

  /** Maximum concurrent TTS synthesis requests. Default: 2 */
  maxConcurrentTTS?: number;

  /**
   * Maximum queued chunks waiting for TTS.
   * When full, wrap() awaits a free slot (lossless backpressure).
   * Default: 5
   */
  maxQueuedChunks?: number;

  /** Vendor-specific TTS options passthrough */
  vendorOptions?: Record<string, unknown>;

  /**
   * Enable streaming TTS. When true, audio chunks are yielded as they arrive
   * from the API instead of buffering the entire response. Best with format 'pcm'.
   * Default: false
   */
  streaming?: boolean;
}

// =============================================================================
// VoiceStream Events (for EventEmitter)
// =============================================================================

/**
 * Events emitted by VoiceStream via EventEmitter
 */
export interface VoiceStreamEvents {
  'audio:ready': (data: { chunkIndex: number; text: string; durationSeconds?: number }) => void;
  'audio:error': (data: { chunkIndex: number; text: string; error: Error }) => void;
  'audio:complete': (data: { totalChunks: number; totalDurationSeconds?: number }) => void;
  'audio:interrupted': (data: { pendingChunks: number }) => void;
}

// =============================================================================
// AudioPlaybackQueue Callback
// =============================================================================

/**
 * Callback invoked when the next in-order audio chunk is ready for playback
 */
export type AudioChunkPlaybackCallback = (event: AudioChunkReadyEvent) => void;
