/**
 * VoiceStream Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoiceStream } from '@/capabilities/speech/VoiceStream.js';
import { StreamEventType } from '@/domain/entities/StreamEvent.js';
import type {
  StreamEvent,
  OutputTextDeltaEvent,
  OutputTextDoneEvent,
  ResponseCompleteEvent,
  AudioChunkReadyEvent,
  AudioChunkErrorEvent,
  AudioStreamCompleteEvent,
} from '@/domain/entities/StreamEvent.js';

// Mock TextToSpeech
vi.mock('@/core/TextToSpeech.js', () => {
  return {
    TextToSpeech: {
      create: vi.fn(() => ({
        synthesize: vi.fn(async (text: string) => ({
          audio: Buffer.from(`audio-for-${text}`),
          format: 'mp3',
          durationSeconds: text.length * 0.05,
          charactersUsed: text.length,
        })),
      })),
    },
  };
});

// Helper: create async generator from events
async function* createStream(events: StreamEvent[]): AsyncIterableIterator<StreamEvent> {
  for (const event of events) {
    yield event;
  }
}

function makeTextDelta(delta: string, index = 0): OutputTextDeltaEvent {
  return {
    type: StreamEventType.OUTPUT_TEXT_DELTA,
    response_id: 'resp-1',
    item_id: 'item-1',
    output_index: 0,
    content_index: 0,
    delta,
    sequence_number: index,
  };
}

function makeTextDone(text: string): OutputTextDoneEvent {
  return {
    type: StreamEventType.OUTPUT_TEXT_DONE,
    response_id: 'resp-1',
    item_id: 'item-1',
    output_index: 0,
    text,
  };
}

function makeResponseComplete(): ResponseCompleteEvent {
  return {
    type: StreamEventType.RESPONSE_COMPLETE,
    response_id: 'resp-1',
    status: 'completed',
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    iterations: 1,
    duration_ms: 100,
  };
}

describe('VoiceStream', () => {
  let voice: VoiceStream;

  beforeEach(() => {
    voice = VoiceStream.create({
      ttsConnector: 'openai',
      ttsModel: 'tts-1',
      voice: 'nova',
      maxConcurrentTTS: 2,
      maxQueuedChunks: 5,
    });
  });

  afterEach(() => {
    voice.destroy();
  });

  it('should pass through all original events', async () => {
    const originalEvents: StreamEvent[] = [
      makeTextDelta('Hi '),
      makeTextDone('Hi '),
      makeResponseComplete(),
    ];

    const outputEvents: StreamEvent[] = [];
    for await (const event of voice.wrap(createStream(originalEvents))) {
      outputEvents.push(event);
    }

    // Should contain all original events
    const textDelta = outputEvents.find((e) => e.type === StreamEventType.OUTPUT_TEXT_DELTA);
    expect(textDelta).toBeDefined();

    const textDone = outputEvents.find((e) => e.type === StreamEventType.OUTPUT_TEXT_DONE);
    expect(textDone).toBeDefined();

    const complete = outputEvents.find((e) => e.type === StreamEventType.RESPONSE_COMPLETE);
    expect(complete).toBeDefined();
  });

  it('should produce audio chunk events for complete sentences', async () => {
    const events: StreamEvent[] = [
      makeTextDelta('Hello world. '),
      makeTextDelta('How are you? '),
      makeResponseComplete(),
    ];

    const audioEvents: AudioChunkReadyEvent[] = [];
    for await (const event of voice.wrap(createStream(events))) {
      if (event.type === StreamEventType.AUDIO_CHUNK_READY) {
        audioEvents.push(event as AudioChunkReadyEvent);
      }
    }

    expect(audioEvents.length).toBeGreaterThanOrEqual(1);
    // All audio events should have base64 audio
    for (const ae of audioEvents) {
      expect(ae.audio_base64).toBeTruthy();
      expect(ae.format).toBe('mp3');
      expect(ae.chunk_index).toBeGreaterThanOrEqual(0);
    }
  });

  it('should emit AudioStreamComplete at the end', async () => {
    const events: StreamEvent[] = [
      makeTextDelta('Hello world. '),
      makeResponseComplete(),
    ];

    const outputEvents: StreamEvent[] = [];
    for await (const event of voice.wrap(createStream(events))) {
      outputEvents.push(event);
    }

    const completeEvent = outputEvents.find(
      (e) => e.type === StreamEventType.AUDIO_STREAM_COMPLETE
    ) as AudioStreamCompleteEvent | undefined;

    expect(completeEvent).toBeDefined();
    expect(completeEvent!.total_chunks).toBeGreaterThanOrEqual(1);
    expect(completeEvent!.total_characters).toBeGreaterThan(0);
  });

  it('should flush remaining text on response complete', async () => {
    const events: StreamEvent[] = [
      makeTextDelta('This is incomplete text without a period'),
      makeResponseComplete(),
    ];

    const audioEvents: StreamEvent[] = [];
    for await (const event of voice.wrap(createStream(events))) {
      if (event.type === StreamEventType.AUDIO_CHUNK_READY) {
        audioEvents.push(event);
      }
    }

    // The incomplete text should be flushed and synthesized
    expect(audioEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty stream', async () => {
    const events: StreamEvent[] = [makeResponseComplete()];

    const audioEvents: StreamEvent[] = [];
    for await (const event of voice.wrap(createStream(events))) {
      if (
        event.type === StreamEventType.AUDIO_CHUNK_READY ||
        event.type === StreamEventType.AUDIO_STREAM_COMPLETE
      ) {
        audioEvents.push(event);
      }
    }

    // No text = no audio events (no AUDIO_STREAM_COMPLETE either)
    expect(audioEvents).toHaveLength(0);
  });

  it('should handle interrupt', async () => {
    const interrupted = vi.fn();
    voice.on('audio:interrupted', interrupted);

    // Create a slow stream
    async function* slowStream(): AsyncIterableIterator<StreamEvent> {
      yield makeTextDelta('First sentence here. ');
      yield makeTextDelta('Second sentence here. ');
      voice.interrupt();
      yield makeTextDelta('Third sentence after interrupt. ');
      yield makeResponseComplete();
    }

    const audioEvents: StreamEvent[] = [];
    for await (const event of voice.wrap(slowStream())) {
      if (event.type === StreamEventType.AUDIO_CHUNK_READY) {
        audioEvents.push(event);
      }
    }

    expect(interrupted).toHaveBeenCalled();
    // After interrupt, no new audio should be scheduled for "Third sentence"
  });

  it('should implement IDisposable', () => {
    expect(voice.isDestroyed).toBe(false);
    voice.destroy();
    expect(voice.isDestroyed).toBe(true);
  });

  it('should emit audio:ready events', async () => {
    const readyEvents: Array<{ chunkIndex: number; text: string }> = [];
    voice.on('audio:ready', (data) => readyEvents.push(data));

    const events: StreamEvent[] = [
      makeTextDelta('A simple test sentence. '),
      makeResponseComplete(),
    ];

    for await (const _event of voice.wrap(createStream(events))) {
      // consume
    }

    expect(readyEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle TTS errors gracefully', async () => {
    // Create voice with a TTS that throws
    const { TextToSpeech } = await import('@/core/TextToSpeech.js');
    (TextToSpeech.create as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      synthesize: vi.fn(async () => {
        throw new Error('TTS API error');
      }),
    });

    const errorVoice = VoiceStream.create({
      ttsConnector: 'openai',
      ttsModel: 'tts-1',
      voice: 'nova',
    });

    const events: StreamEvent[] = [
      makeTextDelta('This will fail to synthesize. '),
      makeResponseComplete(),
    ];

    const errorEvents: AudioChunkErrorEvent[] = [];
    for await (const event of errorVoice.wrap(createStream(events))) {
      if (event.type === StreamEventType.AUDIO_CHUNK_ERROR) {
        errorEvents.push(event as AudioChunkErrorEvent);
      }
    }

    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    expect(errorEvents[0]!.error).toBe('TTS API error');

    errorVoice.destroy();
  });

  it('should reset between wrap calls', async () => {
    const events1: StreamEvent[] = [
      makeTextDelta('First stream sentence. '),
      makeResponseComplete(),
    ];
    const events2: StreamEvent[] = [
      makeTextDelta('Second stream sentence. '),
      makeResponseComplete(),
    ];

    const audio1: StreamEvent[] = [];
    for await (const event of voice.wrap(createStream(events1))) {
      if (event.type === StreamEventType.AUDIO_CHUNK_READY) audio1.push(event);
    }

    const audio2: StreamEvent[] = [];
    for await (const event of voice.wrap(createStream(events2))) {
      if (event.type === StreamEventType.AUDIO_CHUNK_READY) audio2.push(event);
    }

    // Both should have audio
    expect(audio1.length).toBeGreaterThanOrEqual(1);
    expect(audio2.length).toBeGreaterThanOrEqual(1);

    // Second stream should start chunk_index from 0 (reset)
    const firstChunk = audio2[0] as AudioChunkReadyEvent;
    expect(firstChunk.chunk_index).toBe(0);
  });
});
