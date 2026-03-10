/**
 * AudioPlaybackQueue Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioPlaybackQueue } from '@/capabilities/speech/AudioPlaybackQueue.js';
import { StreamEventType } from '@/domain/entities/StreamEvent.js';
import type { AudioChunkReadyEvent } from '@/domain/entities/StreamEvent.js';

function makeAudioEvent(index: number): AudioChunkReadyEvent {
  return {
    type: StreamEventType.AUDIO_CHUNK_READY,
    response_id: 'test-response',
    chunk_index: index,
    text: `Chunk ${index}`,
    audio_base64: Buffer.from(`audio-${index}`).toString('base64'),
    format: 'mp3',
    duration_seconds: 1.0,
  };
}

describe('AudioPlaybackQueue', () => {
  let playedChunks: AudioChunkReadyEvent[];
  let queue: AudioPlaybackQueue;

  beforeEach(() => {
    playedChunks = [];
    queue = new AudioPlaybackQueue((event) => {
      playedChunks.push(event);
    });
  });

  it('should play chunks in order when received in order', () => {
    queue.enqueue(makeAudioEvent(0));
    queue.enqueue(makeAudioEvent(1));
    queue.enqueue(makeAudioEvent(2));

    expect(playedChunks).toHaveLength(3);
    expect(playedChunks[0]!.chunk_index).toBe(0);
    expect(playedChunks[1]!.chunk_index).toBe(1);
    expect(playedChunks[2]!.chunk_index).toBe(2);
  });

  it('should reorder out-of-order chunks', () => {
    queue.enqueue(makeAudioEvent(2)); // arrives first
    expect(playedChunks).toHaveLength(0); // waiting for 0

    queue.enqueue(makeAudioEvent(0)); // now 0 and waiting
    expect(playedChunks).toHaveLength(1); // played 0, waiting for 1
    expect(playedChunks[0]!.chunk_index).toBe(0);

    queue.enqueue(makeAudioEvent(1)); // now 1 arrives, should drain 1 and 2
    expect(playedChunks).toHaveLength(3);
    expect(playedChunks[1]!.chunk_index).toBe(1);
    expect(playedChunks[2]!.chunk_index).toBe(2);
  });

  it('should buffer gaps correctly', () => {
    queue.enqueue(makeAudioEvent(3));
    queue.enqueue(makeAudioEvent(1));
    expect(playedChunks).toHaveLength(0);
    expect(queue.pendingCount).toBe(2);

    queue.enqueue(makeAudioEvent(0));
    expect(playedChunks).toHaveLength(2); // 0 and 1
    expect(queue.pendingCount).toBe(1); // still waiting to deliver 3

    queue.enqueue(makeAudioEvent(2));
    expect(playedChunks).toHaveLength(4); // all delivered
    expect(queue.pendingCount).toBe(0);
  });

  it('should reset state', () => {
    queue.enqueue(makeAudioEvent(0));
    queue.enqueue(makeAudioEvent(1));
    expect(playedChunks).toHaveLength(2);

    queue.reset();
    expect(queue.pendingCount).toBe(0);
    expect(queue.nextExpectedIndex).toBe(0);

    // After reset, should accept from 0 again
    queue.enqueue(makeAudioEvent(0));
    expect(playedChunks).toHaveLength(3);
  });

  it('should report nextExpectedIndex correctly', () => {
    expect(queue.nextExpectedIndex).toBe(0);
    queue.enqueue(makeAudioEvent(0));
    expect(queue.nextExpectedIndex).toBe(1);
    queue.enqueue(makeAudioEvent(1));
    expect(queue.nextExpectedIndex).toBe(2);
  });

  it('should handle sequential enqueues correctly', () => {
    const callback = vi.fn();
    const q = new AudioPlaybackQueue(callback);

    q.enqueue(makeAudioEvent(0));
    q.enqueue(makeAudioEvent(1));
    q.enqueue(makeAudioEvent(2));
    q.enqueue(makeAudioEvent(3));

    expect(callback).toHaveBeenCalledTimes(4);
    expect(callback).toHaveBeenNthCalledWith(1, expect.objectContaining({ chunk_index: 0 }));
    expect(callback).toHaveBeenNthCalledWith(4, expect.objectContaining({ chunk_index: 3 }));
  });
});
