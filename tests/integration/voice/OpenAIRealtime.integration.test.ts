/**
 * Live OpenAI Realtime API integration tests.
 *
 * These tests make billable API calls and require OPENAI_API_KEY. They cover
 * protocols that the normal text-model integration matrix intentionally skips.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as dotenv from 'dotenv';
import { Connector } from '../../../src/core/Connector.js';
import { Vendor } from '../../../src/core/Vendor.js';
import { OpenAIRealtimeAPI } from '../../../src/capabilities/voice/openai/OpenAIRealtimeAPI.js';
import { OpenAIRealtimeSession } from '../../../src/capabilities/voice/openai/OpenAIRealtimeSession.js';
import type { OpenAIRealtimeServerEvent } from '../../../src/capabilities/voice/openai/RealtimeTypes.js';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const describeIfOpenAI = OPENAI_API_KEY ? describe : describe.skip;

function waitForEvent(
  session: OpenAIRealtimeSession,
  predicate: (event: OpenAIRealtimeServerEvent) => boolean,
  timeoutMs = 30_000,
): Promise<OpenAIRealtimeServerEvent> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timeout);
      session.off('event', onEvent);
      session.off('error', onError);
    };
    const onEvent = (event: OpenAIRealtimeServerEvent): void => {
      if (!predicate(event)) return;
      cleanup();
      resolve(event);
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for OpenAI Realtime event after ${timeoutMs}ms`));
    }, timeoutMs);

    session.on('event', onEvent);
    session.on('error', onError);
  });
}

function appendPCM24(session: OpenAIRealtimeSession, audio: Buffer): void {
  // Keep chunks comfortably below realtime event-size limits.
  for (let offset = 0; offset < audio.length; offset += 24_000) {
    session.appendAudio(audio.subarray(offset, offset + 24_000));
  }
}

describeIfOpenAI('OpenAI Realtime live integration', () => {
  let connector: Connector;
  let speechPCM: Buffer;

  beforeAll(async () => {
    connector = Connector.create({
      name: 'openai-realtime-live-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
    });

    const response = await connector.fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'alloy',
        input: 'One Ring AI validates realtime transcription and translation.',
        response_format: 'pcm',
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI TTS fixture failed (${response.status}): ${await response.text()}`);
    }
    speechPCM = Buffer.from(await response.arrayBuffer());
    expect(speechPCM.length).toBeGreaterThan(24_000);
  }, 60_000);

  afterAll(() => Connector.clear());

  it('streams native response audio from gpt-realtime-2.1', async () => {
    const session = new OpenAIRealtimeSession({
      connector,
      model: 'gpt-realtime-2.1',
      session: {
        instructions: 'Reply with one short sentence.',
        output_modalities: ['audio'],
        audio: {
          output: {
            format: { type: 'audio/pcm', rate: 24000 },
            voice: 'marin',
          },
        },
      },
    });

    try {
      await session.connect();
      const audio = waitForEvent(session, event => event.type === 'response.output_audio.delta');
      const done = waitForEvent(session, event => event.type === 'response.done');
      session.sendText('Say: Realtime voice is working.');
      session.createResponse();

      const audioEvent = await audio;
      expect(Buffer.from(String(audioEvent.delta), 'base64').length).toBeGreaterThan(0);
      expect((await done).response?.status).toBe('completed');
    } finally {
      session.close();
    }
  }, 60_000);

  it.each(['gpt-realtime-2.1-mini', 'gpt-realtime-2'])(
    'streams a text response from %s',
    async (model) => {
      const session = new OpenAIRealtimeSession({
        connector,
        model,
        session: { output_modalities: ['text'] },
      });

      try {
        await session.connect();
        const text = waitForEvent(session, event => event.type === 'response.output_text.done');
        session.sendText('Reply with exactly: working');
        session.createResponse();

        expect(String((await text).text).toLowerCase()).toContain('working');
      } finally {
        session.close();
      }
    },
    60_000,
  );

  it('streams a transcript with gpt-live-transcribe', async () => {
    const session = new OpenAIRealtimeSession({
      connector,
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: {
              model: 'gpt-live-transcribe',
              languages: ['en'],
              keywords: ['One Ring AI'],
              delay: 'low',
            },
            turn_detection: null,
          },
        },
      },
    });

    try {
      await session.connect();
      const completed = waitForEvent(
        session,
        event => event.type === 'conversation.item.input_audio_transcription.completed',
      );
      appendPCM24(session, speechPCM);
      session.commitAudio();

      const event = await completed;
      expect(String(event.transcript).toLowerCase()).toContain('transcription');
    } finally {
      session.close();
    }
  }, 60_000);

  it('streams a transcript with gpt-realtime-whisper', async () => {
    const session = new OpenAIRealtimeSession({
      connector,
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: { model: 'gpt-realtime-whisper' },
            turn_detection: null,
          },
        },
      },
    });

    try {
      await session.connect();
      const completed = waitForEvent(
        session,
        event => event.type === 'conversation.item.input_audio_transcription.completed',
      );
      appendPCM24(session, speechPCM);
      session.commitAudio();

      expect(String((await completed).transcript).toLowerCase()).toContain('translation');
    } finally {
      session.close();
    }
  }, 60_000);

  it('streams translated transcript and audio with gpt-realtime-translate', async () => {
    const session = new OpenAIRealtimeSession({
      connector,
      model: 'gpt-realtime-translate',
      session: {
        audio: {
          output: { language: 'es' },
        },
      },
    });

    try {
      await session.connect();
      const transcript = waitForEvent(
        session,
        event => event.type === 'session.output_transcript.delta',
      );
      const audio = waitForEvent(session, event => event.type === 'session.output_audio.delta');
      const closed = waitForEvent(session, event => event.type === 'session.closed');
      appendPCM24(session, speechPCM);
      session.closeTranslation();

      const [transcriptEvent, audioEvent] = await Promise.all([transcript, audio, closed]);
      expect(String(transcriptEvent.delta).length).toBeGreaterThan(0);
      expect(Buffer.from(String(audioEvent.delta), 'base64').length).toBeGreaterThan(0);
    } finally {
      session.close();
    }
  }, 60_000);

  it('mints standard and translation WebRTC client secrets', async () => {
    const api = new OpenAIRealtimeAPI(connector);
    const standard = await api.createClientSecret({
      session: {
        type: 'realtime',
        model: 'gpt-realtime-2.1-mini',
        instructions: 'Answer concisely.',
      },
      expiresAfterSeconds: 60,
    });
    const translation = await api.createTranslationClientSecret({
      session: {
        model: 'gpt-realtime-translate',
        audio: { output: { language: 'de' } },
      },
    });

    expect(standard.value).toBeTruthy();
    expect(standard.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(translation.value).toBeTruthy();
  }, 60_000);
});
