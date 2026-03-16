/**
 * VoiceStream - Voice pseudo-streaming capability
 *
 * Wraps an agent's text stream and interleaves audio events by chunking text
 * into sentences and synthesizing them via TTS in parallel. Produces the
 * illusion of real-time speech streaming.
 *
 * @example
 * ```typescript
 * const voice = VoiceStream.create({
 *   ttsConnector: 'openai',
 *   ttsModel: 'tts-1-hd',
 *   voice: 'nova',
 * });
 *
 * for await (const event of voice.wrap(agent.stream('Tell me a story'))) {
 *   if (event.type === StreamEventType.OUTPUT_TEXT_DELTA) {
 *     process.stdout.write(event.delta);
 *   } else if (event.type === StreamEventType.AUDIO_CHUNK_READY) {
 *     playbackQueue.enqueue(event);
 *   }
 * }
 * ```
 */

import { EventEmitter } from 'events';
import { TextToSpeech } from '../../core/TextToSpeech.js';
import { logger } from '../../infrastructure/observability/Logger.js';
import { StreamEventType } from '../../domain/entities/StreamEvent.js';
import type {
  StreamEvent,
  AudioChunkReadyEvent,
  AudioChunkErrorEvent,
  AudioStreamCompleteEvent,
} from '../../domain/entities/StreamEvent.js';
import type { IDisposable } from '../../domain/interfaces/IDisposable.js';
import type { VoiceStreamConfig } from './types.js';
import { SentenceChunkingStrategy } from './SentenceSplitter.js';
import type { IChunkingStrategy } from './types.js';

// =============================================================================
// Internal Types
// =============================================================================

interface TTSJob {
  index: number;
  text: string;
  promise: Promise<void>;
}

// =============================================================================
// VoiceStream
// =============================================================================

export class VoiceStream extends EventEmitter implements IDisposable {
  private tts: TextToSpeech;
  private chunker: IChunkingStrategy;
  private format: string;
  private speed: number;
  private maxConcurrentTTS: number;
  private maxQueuedChunks: number;
  private vendorOptions?: Record<string, unknown>;
  private streaming: boolean;

  // Pipeline state
  private chunkIndex = 0;
  private totalCharacters = 0;
  private totalDuration = 0;
  private activeJobs: Map<number, TTSJob> = new Map();
  private activeTTSCount = 0;
  private interrupted = false;
  private lastResponseId = '';
  private _isDestroyed = false;

  // Semaphore for TTS concurrency control
  private slotWaiters: Array<() => void> = [];

  // Audio event buffer for interleaving with text events
  private audioEventBuffer: StreamEvent[] = [];
  // Async notification: resolves when new events are pushed to audioEventBuffer
  private bufferNotify: (() => void) | null = null;

  // Queue backpressure
  private queueWaiters: Array<() => void> = [];

  /**
   * Create a new VoiceStream instance
   */
  static create(config: VoiceStreamConfig): VoiceStream {
    return new VoiceStream(config);
  }

  private constructor(config: VoiceStreamConfig) {
    super();

    this.tts = TextToSpeech.create({
      connector: config.ttsConnector,
      model: config.ttsModel,
      voice: config.voice,
    });

    this.chunker = config.chunkingStrategy ?? new SentenceChunkingStrategy(config.chunkingOptions);
    this.format = config.format ?? 'mp3';
    this.speed = config.speed ?? 1.0;
    this.maxConcurrentTTS = config.maxConcurrentTTS ?? 2;
    this.maxQueuedChunks = config.maxQueuedChunks ?? 5;
    this.vendorOptions = config.vendorOptions;
    this.streaming = config.streaming ?? false;
  }

  // ======================== Public API ========================

  /**
   * Transform an agent text stream into an augmented stream with audio events.
   * Original text events pass through unchanged; audio events are interleaved.
   *
   * The generator yields events in this order:
   * 1. All original StreamEvents (pass-through)
   * 2. AudioChunkReady/AudioChunkError events as TTS completes
   * 3. AudioStreamComplete as the final audio event
   */
  async *wrap(
    textStream: AsyncIterableIterator<StreamEvent>
  ): AsyncIterableIterator<StreamEvent> {
    this.reset();

    try {
      for await (const event of textStream) {
        // Always yield the original event (pass-through)
        yield event;

        // Track response_id for audio events
        if (event.response_id) {
          this.lastResponseId = event.response_id;
        }

        // Process text deltas for TTS
        if (event.type === StreamEventType.OUTPUT_TEXT_DELTA && !this.interrupted) {
          const completedChunks = this.chunker.feed(event.delta);
          for (const chunk of completedChunks) {
            await this.scheduleTTS(chunk);
          }
        }

        // On text done, flush remaining text from chunker
        if (
          (event.type === StreamEventType.OUTPUT_TEXT_DONE ||
            event.type === StreamEventType.RESPONSE_COMPLETE) &&
          !this.interrupted
        ) {
          const remaining = this.chunker.flush();
          if (remaining) {
            await this.scheduleTTS(remaining);
          }
        }

        // Drain any ready audio events between text events
        yield* this.drainAudioBuffer();
      }

      // Drain audio events as they arrive (sub-chunk granularity for streaming)
      while (this.activeJobs.size > 0 || this.audioEventBuffer.length > 0) {
        if (this.audioEventBuffer.length === 0) {
          // Wait for either a buffer push or all jobs to finish
          await Promise.race([
            this.waitForBufferNotify(),
            ...Array.from(this.activeJobs.values()).map((j) => j.promise),
          ]);
        }
        yield* this.drainAudioBuffer();
      }

      // Yield audio stream complete
      if (this.chunkIndex > 0) {
        const completeEvent: AudioStreamCompleteEvent = {
          type: StreamEventType.AUDIO_STREAM_COMPLETE,
          response_id: this.lastResponseId,
          total_chunks: this.chunkIndex,
          total_characters: this.totalCharacters,
          total_duration_seconds: this.totalDuration > 0 ? this.totalDuration : undefined,
        };
        yield completeEvent;

        this.emit('audio:complete', {
          totalChunks: this.chunkIndex,
          totalDurationSeconds: this.totalDuration > 0 ? this.totalDuration : undefined,
        });
      }
    } finally {
      // Cleanup on early exit (break, throw)
      this.cleanup();
    }
  }

  /**
   * Interrupt audio generation. Cancels pending TTS and flushes queue.
   * Call this when the user sends a new message mid-speech.
   * Active HTTP requests cannot be cancelled but their results will be discarded.
   */
  interrupt(): void {
    this.interrupted = true;
    const pendingCount = this.activeJobs.size;

    // Clear all pending jobs
    this.activeJobs.clear();
    this.activeTTSCount = 0;
    this.audioEventBuffer = [];
    this.holdBackBuffer = [];

    // Release all waiters
    this.releaseAllWaiters();

    // Reset chunker
    this.chunker.reset();

    this.emit('audio:interrupted', { pendingChunks: pendingCount });
  }

  /**
   * Reset state for a new stream. Called automatically by wrap().
   */
  reset(): void {
    this.chunkIndex = 0;
    this.totalCharacters = 0;
    this.totalDuration = 0;
    this.activeJobs.clear();
    this.activeTTSCount = 0;
    this.interrupted = false;
    this.lastResponseId = '';
    this.audioEventBuffer = [];
    this.bufferNotify = null;
    this.slotWaiters = [];
    this.queueWaiters = [];
    this.nextEmitChunkIndex = 0;
    this.holdBackBuffer = [];
    this.chunker.reset();
  }

  destroy(): void {
    this.interrupt();
    this._isDestroyed = true;
    this.removeAllListeners();
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  // ======================== Private Methods ========================

  /**
   * Schedule a text chunk for TTS synthesis.
   * Awaits a free queue slot if backpressure is active (lossless).
   */
  private async scheduleTTS(text: string): Promise<void> {
    if (this.interrupted || this._isDestroyed) return;

    const cleanText = text.trim();
    if (cleanText.length === 0) return;

    // Lossless backpressure: wait for a free queue slot
    while (this.activeJobs.size >= this.maxQueuedChunks && !this.interrupted) {
      await this.waitForQueueSlot();
    }

    if (this.interrupted) return;

    const index = this.chunkIndex++;
    this.totalCharacters += cleanText.length;

    const job: TTSJob = {
      index,
      text: cleanText,
      promise: this.executeTTS(index, cleanText),
    };

    this.activeJobs.set(index, job);
    job.promise.finally(() => {
      this.activeJobs.delete(index);
      this.releaseQueueWaiter();
    });
  }

  /**
   * Execute TTS for a single text chunk.
   * Respects concurrency semaphore.
   * Branches on streaming mode: yields sub-chunks or a single buffered chunk.
   */
  private async executeTTS(index: number, text: string): Promise<void> {
    // Wait for a TTS concurrency slot
    while (this.activeTTSCount >= this.maxConcurrentTTS && !this.interrupted) {
      await this.waitForTTSSlot();
    }

    if (this.interrupted) return;

    this.activeTTSCount++;

    try {
      const ttsStart = Date.now();

      if (this.streaming && this.tts.supportsStreaming(this.format as any)) {
        // Streaming path: accumulate small API chunks into ~125ms buffers before emitting
        let subIndex = 0;
        const streamFormat = this.format === 'mp3' ? 'pcm' : this.format;
        // 24kHz * 2 bytes * 0.125s = 6000 bytes per ~125ms of audio
        const MIN_BUFFER_BYTES = 6000;
        const pendingBuffers: Buffer[] = [];
        let pendingSize = 0;

        // For PCM s16le, we must always emit an even number of bytes (2 bytes per sample).
        // OpenAI's streaming chunks can split at arbitrary byte boundaries, so we carry
        // over any trailing odd byte to the next flush.
        let carryOver: Buffer | null = null;

        const flushPending = () => {
          if (pendingSize === 0 && !carryOver) return;

          // Prepend any leftover byte from previous flush
          if (carryOver) {
            pendingBuffers.unshift(carryOver);
            pendingSize += carryOver.length;
            carryOver = null;
          }

          let merged = Buffer.concat(pendingBuffers, pendingSize);
          pendingBuffers.length = 0;
          pendingSize = 0;

          // Ensure even byte count for PCM s16le
          if (streamFormat === 'pcm' && merged.length % 2 !== 0) {
            carryOver = Buffer.from([merged[merged.length - 1]!]);
            merged = merged.subarray(0, merged.length - 1);
          }

          if (merged.length === 0) return;

          const currentSubIndex = subIndex++;
          const audioEvent: AudioChunkReadyEvent = {
            type: StreamEventType.AUDIO_CHUNK_READY,
            response_id: this.lastResponseId,
            chunk_index: index,
            sub_index: currentSubIndex,
            text: currentSubIndex === 0 ? text : '',
            audio_base64: merged.toString('base64'),
            format: streamFormat,
          };
          this.pushAudioEvent(audioEvent);
        };

        for await (const chunk of this.tts.synthesizeStream(text, {
          format: streamFormat as any,
          speed: this.speed,
          vendorOptions: this.vendorOptions,
        })) {
          if (this.interrupted) return;

          if (chunk.audio.length > 0) {
            pendingBuffers.push(chunk.audio);
            pendingSize += chunk.audio.length;

            if (pendingSize >= MIN_BUFFER_BYTES) {
              flushPending();
            }
          }

          if (chunk.isFinal) {
            break;
          }
        }

        // Flush any remaining accumulated data
        flushPending();

        logger.debug({ chunkIndex: index, subChunks: subIndex, ttsMs: Date.now() - ttsStart }, `[VoiceStream] TTS chunk streamed`);
        this.emit('audio:ready', { chunkIndex: index, text });
      } else {
        // Buffered path: single chunk
        const response = await this.tts.synthesize(text, {
          format: this.format as any,
          speed: this.speed,
          vendorOptions: this.vendorOptions,
        });

        if (this.interrupted) return;

        if (response.durationSeconds) {
          this.totalDuration += response.durationSeconds;
        }

        const audioEvent: AudioChunkReadyEvent = {
          type: StreamEventType.AUDIO_CHUNK_READY,
          response_id: this.lastResponseId,
          chunk_index: index,
          text,
          audio_base64: response.audio.toString('base64'),
          format: response.format,
          duration_seconds: response.durationSeconds,
          characters_used: response.charactersUsed,
        };

        this.pushAudioEvent(audioEvent);
        logger.debug({ chunkIndex: index, ttsMs: Date.now() - ttsStart }, `[VoiceStream] TTS chunk ready`);
        this.emit('audio:ready', {
          chunkIndex: index,
          text,
          durationSeconds: response.durationSeconds,
        });
      }
    } catch (error) {
      if (this.interrupted) return;

      const errorEvent: AudioChunkErrorEvent = {
        type: StreamEventType.AUDIO_CHUNK_ERROR,
        response_id: this.lastResponseId,
        chunk_index: index,
        text,
        error: (error as Error).message,
      };

      this.pushAudioEvent(errorEvent);
      this.emit('audio:error', {
        chunkIndex: index,
        text,
        error: error as Error,
      });
    } finally {
      // Signal that this chunk is complete so the next chunk's events can be released
      this.advanceChunkGate(index);
      this.activeTTSCount--;
      this.releaseTTSSlot();
    }
  }

  /**
   * Drain the audio event buffer, yielding all ready events.
   */
  private *drainAudioBuffer(): Generator<StreamEvent> {
    while (this.audioEventBuffer.length > 0) {
      yield this.audioEventBuffer.shift()!;
    }
  }

  // ======================== Buffer Notification ========================

  /** Next chunk_index we're allowed to emit (ordering gate) */
  private nextEmitChunkIndex = 0;

  /** Events from future chunks held back until their turn */
  private holdBackBuffer: StreamEvent[] = [];

  /**
   * Push an audio event, respecting chunk_index ordering.
   * Events for the current chunk_index go directly to the consumer buffer.
   * Events from later chunks are held back until earlier chunks complete.
   */
  private pushAudioEvent(event: StreamEvent): void {
    const ev = event as { chunk_index?: number; sub_index?: number };

    if (ev.chunk_index === undefined || ev.chunk_index === this.nextEmitChunkIndex) {
      // Current chunk or non-indexed event — emit immediately
      this.audioEventBuffer.push(event);
    } else if (ev.chunk_index > this.nextEmitChunkIndex) {
      // Future chunk — hold back
      this.holdBackBuffer.push(event);
    } else {
      // Past chunk (shouldn't happen, but emit anyway)
      this.audioEventBuffer.push(event);
    }

    if (this.bufferNotify) {
      this.bufferNotify();
      this.bufferNotify = null;
    }
  }

  /**
   * Called when a TTS chunk_index finishes (all sub-chunks emitted).
   * Advances the gate and releases any held-back events for the next chunk.
   */
  private advanceChunkGate(completedChunkIndex: number): void {
    if (completedChunkIndex !== this.nextEmitChunkIndex) return;

    this.nextEmitChunkIndex++;

    // Release held-back events for the next chunk(s)
    const stillHeld: StreamEvent[] = [];
    for (const ev of this.holdBackBuffer) {
      const ci = (ev as { chunk_index?: number }).chunk_index;
      if (ci === this.nextEmitChunkIndex) {
        this.audioEventBuffer.push(ev);
      } else {
        stillHeld.push(ev);
      }
    }
    this.holdBackBuffer = stillHeld;

    // Wake consumer if we released events
    if (this.audioEventBuffer.length > 0 && this.bufferNotify) {
      this.bufferNotify();
      this.bufferNotify = null;
    }
  }

  /**
   * Wait until a new event is pushed to the audio buffer
   */
  private waitForBufferNotify(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.bufferNotify = resolve;
    });
  }

  // ======================== Semaphore / Backpressure ========================

  private waitForTTSSlot(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.slotWaiters.push(resolve);
    });
  }

  private releaseTTSSlot(): void {
    const waiter = this.slotWaiters.shift();
    if (waiter) waiter();
  }

  private waitForQueueSlot(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queueWaiters.push(resolve);
    });
  }

  private releaseQueueWaiter(): void {
    const waiter = this.queueWaiters.shift();
    if (waiter) waiter();
  }

  private releaseAllWaiters(): void {
    for (const waiter of this.slotWaiters) waiter();
    this.slotWaiters = [];
    for (const waiter of this.queueWaiters) waiter();
    this.queueWaiters = [];
    if (this.bufferNotify) {
      this.bufferNotify();
      this.bufferNotify = null;
    }
  }

  private cleanup(): void {
    this.releaseAllWaiters();
  }
}
