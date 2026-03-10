/**
 * AudioPlaybackQueue - Consumer-side helper for ordered audio playback
 *
 * TTS chunks may complete out of order (chunk 2 finishes before chunk 1).
 * This queue buffers audio events and delivers them to the callback
 * in sequential order by chunk_index.
 *
 * @example
 * ```typescript
 * const queue = new AudioPlaybackQueue((event) => {
 *   // Play audio chunk — guaranteed to be in order
 *   playAudio(Buffer.from(event.audio_base64, 'base64'));
 * });
 *
 * for await (const event of voiceStream.wrap(agent.stream('Hello'))) {
 *   if (isAudioChunkReady(event)) {
 *     queue.enqueue(event);
 *   }
 * }
 * ```
 */

import type { AudioChunkReadyEvent } from '../../domain/entities/StreamEvent.js';
import type { AudioChunkPlaybackCallback } from './types.js';

export class AudioPlaybackQueue {
  private buffer: Map<number, AudioChunkReadyEvent> = new Map();
  private nextPlayIndex = 0;
  private onReady: AudioChunkPlaybackCallback;

  constructor(onReady: AudioChunkPlaybackCallback) {
    this.onReady = onReady;
  }

  /**
   * Enqueue an audio chunk event. If it's the next expected chunk,
   * it (and any subsequent buffered chunks) are immediately delivered
   * to the callback in order.
   */
  enqueue(event: AudioChunkReadyEvent): void {
    this.buffer.set(event.chunk_index, event);
    this.drain();
  }

  /**
   * Reset the queue (e.g., on interruption or new stream).
   */
  reset(): void {
    this.buffer.clear();
    this.nextPlayIndex = 0;
  }

  /**
   * Number of chunks currently buffered waiting for earlier chunks.
   */
  get pendingCount(): number {
    return this.buffer.size;
  }

  /**
   * The next chunk index expected for playback.
   */
  get nextExpectedIndex(): number {
    return this.nextPlayIndex;
  }

  // ======================== Private ========================

  private drain(): void {
    while (this.buffer.has(this.nextPlayIndex)) {
      const event = this.buffer.get(this.nextPlayIndex)!;
      this.buffer.delete(this.nextPlayIndex);
      this.nextPlayIndex++;
      this.onReady(event);
    }
  }
}
