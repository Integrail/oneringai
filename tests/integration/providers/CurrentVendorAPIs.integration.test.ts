/**
 * Focused live smoke tests for each vendor's preferred production API path.
 *
 * These tests are intentionally small but billable. They verify that the model
 * registry's current selections and the provider transports agree with the
 * public APIs. Missing credentials skip only the affected vendor.
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as dotenv from 'dotenv';
import { Connector } from '../../../src/core/Connector.js';
import { Agent } from '../../../src/core/Agent.js';
import { Vendor } from '../../../src/core/Vendor.js';
import { TextToSpeech } from '../../../src/core/TextToSpeech.js';
import { SpeechToText } from '../../../src/core/SpeechToText.js';
import { ImageGeneration } from '../../../src/capabilities/images/ImageGeneration.js';
import { VideoGeneration } from '../../../src/capabilities/video/VideoGeneration.js';
import { Embeddings } from '../../../src/capabilities/embeddings/Embeddings.js';
import { GoogleTextProvider } from '../../../src/infrastructure/providers/google/GoogleTextProvider.js';
import { AnthropicTextProvider } from '../../../src/infrastructure/providers/anthropic/AnthropicTextProvider.js';
import { ContentType } from '../../../src/domain/entities/Content.js';
import { StreamEventType } from '../../../src/domain/entities/StreamEvent.js';
import { GrokRealtimeAPI } from '../../../src/capabilities/voice/grok/GrokRealtimeAPI.js';
import { GrokRealtimeSession } from '../../../src/capabilities/voice/grok/GrokRealtimeSession.js';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

const describeIf = (condition: unknown): typeof describe => condition ? describe : describe.skip;

async function expectShortReply(connector: string, model: string): Promise<void> {
  const agent = Agent.create({ connector, model });
  try {
    const response = await agent.runDirect('Reply with exactly: current', {
      maxOutputTokens: 128,
    });
    expect(response.status).toBe('completed');
    expect(response.output_text?.toLowerCase()).toContain('current');
    expect(response.usage.input_tokens).toBeGreaterThan(0);
    expect(response.usage.output_tokens).toBeGreaterThan(0);
  } finally {
    agent.destroy();
  }
}

afterEach(() => Connector.clear());

describeIf(OPENAI_API_KEY)('current OpenAI API', () => {
  it('calls the preferred economical GPT-5.6 model through Responses', async () => {
    Connector.create({
      name: 'openai-current-live',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
    });
    await expectShortReply('openai-current-live', 'gpt-5.6-luna');
  }, 60_000);
});

describeIf(ANTHROPIC_API_KEY)('current Anthropic API', () => {
  it('calls Claude Fable 5.1 with normalized metadata and adaptive thinking', async () => {
    const provider = new AnthropicTextProvider({ apiKey: ANTHROPIC_API_KEY! });
    const response = await provider.generate({
      model: 'claude-fable-5-1',
      input: 'Reply with exactly: current',
      max_output_tokens: 2_048,
      metadata: { user_id: 'oneringai-live-check', workflow: 'must-stay-local' },
      thinking: { enabled: true, effort: 'high' },
    });
    expect(response.status).toBe('completed');
    expect(response.output_text?.toLowerCase()).toContain('current');
  }, 60_000);
});

describeIf(GOOGLE_API_KEY)('current Google API', () => {
  it('calls Gemini 3.8 Flash through the Interactions API default', async () => {
    Connector.create({
      name: 'google-current-live',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY! },
    });
    await expectShortReply('google-current-live', 'gemini-3.8-flash');
  }, 60_000);

  it('streams Gemini Interactions through a terminal completed status', async () => {
    const provider = new GoogleTextProvider({ apiKey: GOOGLE_API_KEY! });
    const events = [];
    for await (const event of provider.streamGenerate({
      model: 'gemini-3.8-flash',
      input: 'Reply with exactly: streamed',
      max_output_tokens: 128,
    })) events.push(event);

    expect(events.some((event) =>
      event.type === StreamEventType.OUTPUT_TEXT_DELTA)).toBe(true);
    expect(events.at(-1)).toMatchObject({
      type: StreamEventType.RESPONSE_COMPLETE,
      status: 'completed',
    });
  }, 60_000);

  it('continues a stored Gemini Interaction by normalized response id', async () => {
    const connector = Connector.create({
      name: 'google-continuity-live',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY! },
    });
    const agent = Agent.create({ connector, model: 'gemini-3.8-flash' });
    try {
      const first = await agent.runDirect('Remember this exact code word: aurora. Reply with OK.');
      const second = await agent.runDirect('What exact code word did I give you?', {
        previousResponseId: first.id,
      });
      expect(second.output_text?.toLowerCase()).toContain('aurora');
    } finally {
      agent.destroy();
    }
  }, 60_000);

  it('uses normalized size and image count with native Gemini image generation', async () => {
    const connector = Connector.create({
      name: 'google-native-image-live',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY! },
    });
    const images = await ImageGeneration.create({ connector }).generate({
      model: 'gemini-3.1-flash-image',
      prompt: 'A minimal blue circle on a plain white background.',
      size: '1024x1024',
      n: 2,
    });
    expect(images.data).toHaveLength(2);
    expect(images.data.every((image) => (image.b64_json?.length ?? 0) > 1_000)).toBe(true);
  }, 120_000);

  it('forces a named function through Interactions allowed_tools', async () => {
    const provider = new GoogleTextProvider({ apiKey: GOOGLE_API_KEY! });
    const response = await provider.generate({
      model: 'gemini-3.8-flash',
      input: 'Call lookup_code with code current. Do not answer in prose.',
      tools: [{
        type: 'function',
        function: {
          name: 'lookup_code',
          description: 'Look up a code',
          parameters: {
            type: 'object',
            properties: { code: { type: 'string' } },
            required: ['code'],
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'lookup_code' } },
    });
    expect(response.output.flatMap((item) => item.content ?? [])).toContainEqual(
      expect.objectContaining({ type: ContentType.TOOL_USE, name: 'lookup_code' }),
    );
  }, 60_000);

  it('forces a named function through legacy generateContent allowedFunctionNames', async () => {
    const provider = new GoogleTextProvider({ apiKey: GOOGLE_API_KEY! });
    const response = await provider.generate({
      model: 'gemini-3.8-flash',
      input: 'Call lookup_code with code current. Do not answer in prose.',
      tools: [
        {
          type: 'function',
          function: {
            name: 'lookup_code',
            description: 'Look up a code',
            parameters: {
              type: 'object',
              properties: { code: { type: 'string' } },
              required: ['code'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'unrelated_tool',
            description: 'A function that must not be selected',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'lookup_code' } },
      vendorOptions: { api: 'generateContent' },
    });
    expect(response.output.flatMap((item) => item.content ?? [])).toContainEqual(
      expect.objectContaining({ type: ContentType.TOOL_USE, name: 'lookup_code' }),
    );
  }, 60_000);

  it('embeds an external image URL by fetching and inlining it', async () => {
    const connector = Connector.create({
      name: 'google-multimodal-embedding-live',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY! },
    });
    const embeddings = Embeddings.create({ connector, model: 'gemini-embedding-2' });
    const response = await embeddings.embedMultimodal([
      { type: 'text', text: 'A plate of baked food' },
      {
        type: 'image',
        data: 'https://storage.googleapis.com/generativeai-downloads/images/scones.jpg',
      },
    ], { dimensions: 128 });
    expect(response.embeddings[0]).toHaveLength(128);
  }, 60_000);

  it('generates Omni image-to-video with response-format duration', async () => {
    const connector = Connector.create({
      name: 'google-omni-video-live',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY! },
    });
    const videos = VideoGeneration.create({ connector });
    const response = await videos.generate({
      model: 'gemini-omni-1.1-flash',
      prompt: 'A subtle slow camera push-in; keep the food and table realistic.',
      image: 'https://storage.googleapis.com/generativeai-downloads/images/scones.jpg',
      duration: 3,
      aspectRatio: '16:9',
    });
    expect(response.status).toBe('completed');
    expect(response.video?.b64_json?.length).toBeGreaterThan(1_000);
  }, 180_000);
});

describeIf(GOOGLE_API_KEY && XAI_API_KEY)('current Google native transcription', () => {
  it('transcribes 8 kHz raw PCM with normalized Gemini timestamps', async () => {
    Connector.create({
      name: 'xai-google-stt-fixture-live',
      vendor: Vendor.Grok,
      auth: { type: 'api_key', apiKey: XAI_API_KEY! },
    });
    Connector.create({
      name: 'google-stt-live',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY! },
    });
    const tts = TextToSpeech.create({
      connector: 'xai-google-stt-fixture-live',
      model: 'xai-tts',
      voice: 'eve',
      format: 'pcm',
    });
    const audio = await tts.synthesize('Google timestamps are current.', {
      vendorOptions: { output_format: { codec: 'pcm', sample_rate: 8000 } },
    });
    const stt = SpeechToText.create({ connector: 'google-stt-live', model: 'gemini-3.5-transcribe' });
    const transcript = await stt.transcribeWithTimestamps(audio.audio, 'word', {
      encoding: 'pcm',
      sampleRate: 8000,
    });
    expect(transcript.text.toLowerCase()).toContain('current');
    expect(transcript.segments?.length).toBeGreaterThan(0);
  }, 90_000);
});

describeIf(XAI_API_KEY)('current xAI APIs', () => {
  it('calls Grok 4.6 through the OpenAI-compatible text API', async () => {
    Connector.create({
      name: 'xai-current-live',
      vendor: Vendor.Grok,
      auth: { type: 'api_key', apiKey: XAI_API_KEY! },
    });
    await expectShortReply('xai-current-live', 'grok-4.6');
  }, 60_000);

  it('round-trips speech through the dedicated xAI TTS and STT APIs', async () => {
    Connector.create({
      name: 'xai-tts-live',
      vendor: Vendor.Grok,
      auth: { type: 'api_key', apiKey: XAI_API_KEY! },
    });
    const tts = TextToSpeech.create({
      connector: 'xai-tts-live',
      model: 'xai-tts',
      voice: 'eve',
      // The provider-specific output format intentionally overrides this
      // normalized default; response metadata must follow the returned codec.
      format: 'mp3',
    });
    const response = await tts.synthesize('Realtime voice is current.', {
      vendorOptions: {
        output_format: { codec: 'pcm', sample_rate: 8000 },
        optimize_streaming_latency: 2,
      },
    });
    expect(response.audio.length).toBeGreaterThan(1_000);
    expect(response.format).toBe('pcm');

    const stt = SpeechToText.create({ connector: 'xai-tts-live', model: 'xai-stt' });
    const transcript = await stt.transcribe(response.audio, { encoding: 'pcm', sampleRate: 8000 });
    expect(transcript.text.toLowerCase()).toContain('current');
  }, 60_000);

  it('connects to 32 kHz PCM binary-transport Voice Agent and mints a browser secret', async () => {
    const connector = Connector.create({
      name: 'xai-realtime-live',
      vendor: Vendor.Grok,
      auth: { type: 'api_key', apiKey: XAI_API_KEY! },
    });
    const secret = await new GrokRealtimeAPI(connector).createClientSecret(60);
    expect(secret.value).toBeTruthy();
    expect(secret.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1_000));

    const session = new GrokRealtimeSession({
      connector,
      model: 'grok-voice-think-fast-2.0',
      session: {
        voice: 'eve',
        turn_detection: null,
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 32000 },
            transport: 'binary',
            transcription: { language_hint: 'en' },
          },
          output: {
            format: { type: 'audio/pcm', rate: 32000 },
            transport: 'binary',
          },
        },
      },
    });
    try {
      const updated = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for xAI session.updated')), 30_000);
        session.on('event', (event) => {
          if (event.type !== 'session.updated') return;
          clearTimeout(timeout);
          resolve();
        });
        session.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      expect((await session.connect()).type).toBe('session.created');
      await updated;
    } finally {
      session.close();
    }
  }, 60_000);
});
