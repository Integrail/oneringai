/**
 * OpenAI Realtime API example.
 *
 * Demonstrates a server-side WebSocket session and minting a short-lived
 * browser credential without exposing the credential itself.
 */

import 'dotenv/config';
import {
  Connector,
  OpenAIRealtimeAPI,
  OpenAIRealtimeSession,
  Vendor,
} from '../src/index.js';

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Add it to .env before running this example.');
  }

  const connector = Connector.create({
    name: 'openai-realtime',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey },
  });

  // Server-side WebSocket session. Audio deltas are base64-encoded PCM24.
  const session = new OpenAIRealtimeSession({
    connector,
    model: 'gpt-realtime-2.1-mini',
    session: {
      output_modalities: ['audio'],
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          noise_reduction: { type: 'near_field' },
          turn_detection: { type: 'semantic_vad', eagerness: 'auto' },
        },
        output: { format: { type: 'audio/pcm', rate: 24000 }, voice: 'marin' },
      },
    },
  });

  let audioBytes = 0;
  let transcript = '';
  let responseTimeout: NodeJS.Timeout | undefined;

  try {
    await session.connect();
    console.log('Connected to OpenAI Realtime.');
    const responseDone = new Promise<void>((resolve, reject) => {
      responseTimeout = setTimeout(
        () => reject(new Error('Timed out waiting for the realtime response')),
        30_000,
      );

      session.on('event', (event) => {
        if (event.type === 'response.output_audio.delta' && typeof event.delta === 'string') {
          audioBytes += Buffer.byteLength(event.delta, 'base64');
        }
        if (
          (event.type === 'response.output_audio_transcript.delta' ||
            event.type === 'response.output_text.delta') &&
          typeof event.delta === 'string'
        ) {
          transcript += event.delta;
        }
        if (event.type === 'response.done') resolve();
        if (event.type === 'error') {
          reject(new Error(event.error?.message || 'OpenAI Realtime returned an error'));
        }
      });
      session.on('error', reject);
    });
    session.sendText('Introduce yourself in one sentence.');
    session.createResponse();
    await responseDone;
    console.log(`Received ${audioBytes} bytes of audio.`);
    if (transcript) console.log(`Transcript: ${transcript}`);
  } finally {
    if (responseTimeout) clearTimeout(responseTimeout);
    session.close();
  }

  // A server can mint this secret for a browser WebRTC client. Never log value.
  const realtimeAPI = new OpenAIRealtimeAPI(connector);
  const clientSecret = await realtimeAPI.createClientSecret({
    session: {
      type: 'realtime',
      model: 'gpt-realtime-2.1-mini',
      audio: { output: { voice: 'marin' } },
    },
    expiresAfterSeconds: 600,
  });
  console.log(`Minted a browser client secret expiring at ${new Date(clientSecret.expires_at * 1000).toISOString()}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
