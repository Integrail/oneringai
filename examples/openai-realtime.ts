import {
  Connector,
  OpenAIRealtimeAPI,
  OpenAIRealtimeSession,
  Vendor,
} from '../src/index.js';

const connector = Connector.create({
  name: 'openai-realtime',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Server-side WebSocket session. Audio is base64 PCM24, PCMU, or PCMA.
const session = new OpenAIRealtimeSession({
  connector,
  model: 'gpt-realtime-2.1',
  session: {
    reasoning: { effort: 'low' },
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

session.on('event', (event) => {
  if (event.type === 'response.output_audio.delta') {
    // Send Buffer.from(event.delta, 'base64') to your audio output.
  }
});
session.on('error', console.error);
await session.connect();
session.sendText('Introduce yourself in one sentence.');
session.createResponse();

// For browser WebRTC, mint a short-lived client secret on your server.
const realtimeAPI = new OpenAIRealtimeAPI(connector);
const clientSecret = await realtimeAPI.createClientSecret({
  session: {
    type: 'realtime',
    model: 'gpt-realtime-2.1-mini',
    audio: { output: { voice: 'marin' } },
  },
  expiresAfterSeconds: 600,
});
console.log(clientSecret.value);
