/**
 * Provider-backed browser-to-OpenAI-to-server voice-agent test.
 *
 * This is intentionally opt-in because it launches Chrome and makes billable
 * OpenAI calls. It exercises the same split used by distributed applications:
 * browser WebRTC carries media, while a trusted OneRingAI Agent owns prompts,
 * local tools, transcripts, usage, and the server sideband connection.
 *
 * Run with: npm run test:realtime:e2e
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as dotenv from 'dotenv';
import { Agent } from '../../../src/core/Agent.js';
import { Connector } from '../../../src/core/Connector.js';
import { Vendor } from '../../../src/core/Vendor.js';
import type { ToolFunction, ToolResult } from '../../../src/domain/entities/Tool.js';
import { OpenAIRealtimeAPI } from '../../../src/capabilities/voice/openai/OpenAIRealtimeAPI.js';
import {
  OpenAIRealtimeAgentSession,
  type OpenAIRealtimeAgentUsage,
} from '../../../src/capabilities/voice/openai/OpenAIRealtimeAgentSession.js';

dotenv.config({ quiet: true });

const enabled = process.env.RUN_LIVE_OPENAI_REALTIME_E2E === '1';
const connectorName = 'openai-realtime-browser-e2e';

interface BrowserResult {
  ok: boolean;
  error?: string;
  callId?: string;
  dataChannelOpened?: boolean;
  remoteTrackSeen?: boolean;
  receivedAudioBytes?: number;
  outputTranscript?: string;
  eventTypes?: string[];
}

describe.skipIf(!enabled).sequential('OpenAI Realtime voice agent browser E2E', () => {
  let connector: Connector;
  let temporaryDirectory = '';

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('RUN_LIVE_OPENAI_REALTIME_E2E=1 requires OPENAI_API_KEY');
    }
    Connector.remove(connectorName);
    connector = Connector.create({
      name: connectorName,
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY },
    });
  });

  afterAll(async () => {
    Connector.remove(connectorName);
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('runs WebRTC media, sideband control, transcription, a local tool, spoken output, usage, and cleanup', async () => {
    const chrome = resolveChromeExecutable();
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'oneringai-realtime-e2e-'));
    const speechPCM = await synthesizeSpeechFixture(connector);
    const microphoneWav = pcm24MonoToWav48Stereo(speechPCM, 1, 2);

    const browserModule = await compileBrowserPeer();
    const browserResult = deferred<BrowserResult>();
    const browserClosed = deferred<void>();
    const allowBrowserClose = deferred<void>();
    const providerErrors: Error[] = [];
    let agentSession: OpenAIRealtimeAgentSession | null = null;
    let activeCallId: string | null = null;
    let releaseCallId: string | null = null;
    let providerRelease: Promise<void> | null = null;
    let toolCalls = 0;
    let toolResult: ToolResult | null = null;
    let inputTranscript = '';
    let outputTranscript = '';
    let usage: OpenAIRealtimeAgentUsage | null = null;
    let beforeExecutionCalls = 0;
    let afterExecutionCalls = 0;
    let completedHookInput = '';
    let completedHookStatus = '';

    const probe: ToolFunction<{ code: string }, { marker: string; receivedCode: string }> = {
      definition: {
        type: 'function',
        function: {
          name: 'realtime_voice_probe',
          description: 'Required voice integration probe. Call exactly once with the code spoken by the user.',
          parameters: {
            type: 'object',
            properties: { code: { type: 'string' } },
            required: ['code'],
            additionalProperties: false,
          },
        },
      },
      permission: { scope: 'always', riskLevel: 'low' },
      execute: async ({ code }) => {
        toolCalls++;
        return { marker: 'VOICE_TOOL_CONFIRMED', receivedCode: code };
      },
    };
    const agent = Agent.create({
      connector,
      model: 'gpt-realtime-2.1',
      name: 'Realtime browser E2E agent',
      userId: 'realtime-e2e-user',
      instructions: [
        'This is a deterministic voice integration test.',
        'When the user asks to run the voice integration probe, call realtime_voice_probe exactly once.',
        'After the tool succeeds, speak exactly: Voice tool confirmed.',
        'Do not answer before calling the tool.',
      ].join(' '),
      tools: [probe],
      permissions: { autoApproveAll: true },
      hooks: {
        'before:execution': () => {
          beforeExecutionCalls++;
          return {};
        },
        'after:execution': ({ input, response }) => {
          afterExecutionCalls++;
          completedHookInput = JSON.stringify(input);
          completedHookStatus = response.status;
          return {};
        },
      },
    });
    const realtimeAPI = new OpenAIRealtimeAPI(connector);

    const server = createServer((request, response) => {
      void handleBrowserRequest(request, response, {
        browserModule,
        microphoneWav,
        onCreateCall: async (sdp) => {
          if (agentSession || activeCallId) throw new Error('The E2E browser attempted to create more than one call');
          const call = await realtimeAPI.createWebRTCCallWithMetadata({
            sdp,
            session: realtimeSessionConfig(),
            safetyIdentifier: 'oneringai-realtime-e2e',
          });
          activeCallId = call.callId;
          agentSession = new OpenAIRealtimeAgentSession({
            agent,
            callId: call.callId,
            contextSync: 'per_turn',
            session: realtimeSessionConfig(),
            safetyIdentifier: 'oneringai-realtime-e2e',
          });
          agentSession.on('error', (error) => { providerErrors.push(error); });
          agentSession.on('transcript:input', (transcript) => { inputTranscript = transcript; });
          agentSession.on('transcript:output', (transcript) => { outputTranscript = transcript; });
          agentSession.on('tool:complete', (result) => { toolResult = result; });
          agentSession.on('usage', (current) => { usage = current; });
          await agentSession.connect();
          return call;
        },
        onReleaseCall: async (callId) => {
          releaseCallId = callId;
          providerRelease = realtimeAPI.hangupCall(callId);
          void providerRelease.catch(() => undefined);
        },
        onResult: (result) => browserResult.resolve(result),
        waitUntilCloseAllowed: () => allowBrowserClose.promise,
        onClosed: () => browserClosed.resolve(),
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!response.headersSent) sendJSON(response, 500, { error: message });
        else response.destroy();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const pageURL = `http://127.0.0.1:${address.port}/`;
    let chromeProcess: ChildProcess | null = null;
    let chromeDiagnostics = '';

    try {
      chromeProcess = spawn(chrome, [
        '--headless=new',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--autoplay-policy=no-user-gesture-required',
        `--user-data-dir=${path.join(temporaryDirectory, 'chrome-profile')}`,
        pageURL,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      chromeProcess.stderr?.on('data', (chunk) => {
        chromeDiagnostics = `${chromeDiagnostics}${chunk.toString()}`.slice(-12_000);
      });
      chromeProcess.once('error', (error) => browserResult.reject(error));
      chromeProcess.once('exit', (code) => {
        if (code && code !== 0) {
          browserResult.reject(new Error(`Chrome exited with code ${code}: ${chromeDiagnostics}`));
        }
      });

      const result = await withTimeout(
        browserResult.promise,
        120_000,
        () => new Error(`Timed out waiting for the browser voice result: ${chromeDiagnostics}`),
      );
      // OpenAI delivers the same session events over two transports. The
      // browser data channel can observe an event a few milliseconds before
      // the server sideband, so let the authoritative Agent state catch up.
      await waitFor(() => Boolean(outputTranscript && usage), 10_000);
      expect(result.ok, JSON.stringify({
        browser: result,
        server: {
          inputTranscriptSeen: Boolean(inputTranscript),
          outputTranscriptSeen: Boolean(outputTranscript),
          toolCalls,
          toolResultState: toolResult?.state,
          usage,
          providerErrors: providerErrors.map((error) => error.message),
        },
      }, null, 2)).toBe(true);
      expect(result.callId).toBe(activeCallId);
      expect(result.dataChannelOpened).toBe(true);
      expect(result.remoteTrackSeen).toBe(true);
      expect(result.receivedAudioBytes).toBeGreaterThan(0);
      expect(normalize(result.outputTranscript ?? '')).toContain('voice tool confirmed');
      expect(result.eventTypes).toContain('conversation.item.input_audio_transcription.completed');
      expect(result.eventTypes).toContain('response.output_audio_transcript.done');

      expect(normalize(inputTranscript)).toContain('voice integration probe');
      expect(toolCalls).toBe(1);
      expect(toolResult).toMatchObject({
        tool_name: 'realtime_voice_probe',
        content: { marker: 'VOICE_TOOL_CONFIRMED' },
        state: 'completed',
      });
      expect(normalize(outputTranscript)).toContain('voice tool confirmed');
      expect(usage?.input_audio_tokens).toBeGreaterThan(0);
      expect(usage?.output_audio_tokens).toBeGreaterThan(0);
      expect(providerErrors).toEqual([]);

      await agentSession?.close(1000, 'E2E completed');
      expect(agent.isRunning()).toBe(false);
      expect(beforeExecutionCalls).toBe(1);
      expect(afterExecutionCalls).toBe(1);
      expect(completedHookStatus).toBe('completed');
      expect(normalize(completedHookInput)).toContain('voice integration probe');
      const contextHistory = JSON.stringify(agent.context.getConversation());
      expect(contextHistory).toContain('realtime_voice_probe');
      expect(contextHistory).toContain('VOICE_TOOL_CONFIRMED');
      expect(normalize(contextHistory)).toContain('voice tool confirmed');
      allowBrowserClose.resolve();
      await withTimeout(browserClosed.promise, 20_000, () => new Error('Browser did not release the Realtime call'));
      expect(releaseCallId).toBe(activeCallId);
      if (!providerRelease) throw new Error('The trusted release callback did not initiate provider hangup');
      await withTimeout(providerRelease, 20_000, () => new Error('OpenAI did not acknowledge Realtime hangup'));
    } finally {
      allowBrowserClose.resolve();
      if (agentSession?.isConnected) await agentSession.close(1000, 'E2E cleanup').catch(() => undefined);
      if (activeCallId && releaseCallId !== activeCallId) {
        await realtimeAPI.hangupCall(activeCallId).catch(() => undefined);
      }
      await stopChild(chromeProcess);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      agent.destroy();
    }
  }, 180_000);
});

function realtimeSessionConfig() {
  return {
    model: 'gpt-realtime-2.1' as const,
    output_modalities: ['audio'] as const,
    audio: {
      input: {
        format: { type: 'audio/pcm' as const, rate: 24000 as const },
        noise_reduction: { type: 'near_field' as const },
        transcription: { model: 'gpt-live-transcribe', language: 'en' },
        turn_detection: {
          type: 'server_vad' as const,
          threshold: 0.45,
          prefix_padding_ms: 500,
          silence_duration_ms: 900,
          create_response: false,
          interrupt_response: true,
        },
      },
      output: {
        format: { type: 'audio/pcm' as const, rate: 24000 as const },
        voice: 'marin' as const,
      },
    },
  };
}

async function synthesizeSpeechFixture(connector: Connector): Promise<Buffer> {
  const response = await connector.fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts-1',
      voice: 'alloy',
      input: 'One Ring AI validates realtime transcription and translation by asking you to run the voice integration probe with code cobalt seven.',
      response_format: 'pcm',
    }),
  });
  if (!response.ok) throw new Error(`OpenAI TTS fixture failed (${response.status})`);
  const pcm = Buffer.from(await response.arrayBuffer());
  if (pcm.length < 24_000) throw new Error('OpenAI TTS fixture was unexpectedly short');
  return pcm;
}

function pcm24MonoToWav48Stereo(pcm: Buffer, leadingSilenceSeconds: number, trailingSilenceSeconds: number): Buffer {
  if (pcm.length % 2 !== 0) throw new Error('PCM fixture must contain 16-bit samples');
  const silenceFrame = Buffer.alloc(48_000 * 2 * 2);
  const speech = Buffer.alloc(pcm.length * 4);
  for (let source = 0, target = 0; source < pcm.length; source += 2) {
    const sample = pcm.readInt16LE(source);
    for (let duplicate = 0; duplicate < 2; duplicate++) {
      speech.writeInt16LE(sample, target);
      speech.writeInt16LE(sample, target + 2);
      target += 4;
    }
  }
  const audio = Buffer.concat([
    ...Array.from({ length: leadingSilenceSeconds }, () => silenceFrame),
    speech,
    ...Array.from({ length: trailingSilenceSeconds }, () => silenceFrame),
  ]);
  const wav = Buffer.alloc(44 + audio.length);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + audio.length, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(48_000, 24);
  wav.writeUInt32LE(48_000 * 2 * 2, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(audio.length, 40);
  audio.copy(wav, 44);
  return wav;
}

async function compileBrowserPeer(): Promise<string> {
  const sourcePath = new URL('../../../src/realtime-browser/OpenAIRealtimeWebRTCPeer.ts', import.meta.url);
  const source = await readFile(sourcePath, 'utf8');
  return ts.transpileModule(source, {
    fileName: 'OpenAIRealtimeWebRTCPeer.ts',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
    },
  }).outputText;
}

interface BrowserServerHandlers {
  browserModule: string;
  microphoneWav: Buffer;
  onCreateCall(sdp: string): Promise<{ sdp: string; callId: string }>;
  onReleaseCall(callId: string): Promise<void>;
  onResult(result: BrowserResult): void;
  waitUntilCloseAllowed(): Promise<void>;
  onClosed(): void;
}

async function handleBrowserRequest(
  request: IncomingMessage,
  response: ServerResponse,
  handlers: BrowserServerHandlers,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(browserPage());
    return;
  }
  if (request.method === 'GET' && url.pathname === '/peer.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    response.end(handlers.browserModule);
    return;
  }
  if (request.method === 'GET' && url.pathname === '/microphone.wav') {
    response.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': handlers.microphoneWav.length,
      'Cache-Control': 'no-store',
    });
    response.end(handlers.microphoneWav);
    return;
  }
  if (request.method === 'POST' && url.pathname === '/call') {
    const body = await readJSON<{ sdp?: unknown }>(request);
    if (typeof body.sdp !== 'string' || !body.sdp.trim()) throw new Error('Browser did not send an SDP offer');
    sendJSON(response, 200, await handlers.onCreateCall(body.sdp));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/release') {
    const body = await readJSON<{ callId?: unknown }>(request);
    if (typeof body.callId !== 'string' || !body.callId.trim()) throw new Error('Browser did not send a call ID');
    await handlers.onReleaseCall(body.callId);
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === 'POST' && url.pathname === '/result') {
    handlers.onResult(await readJSON<BrowserResult>(request));
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === 'GET' && url.pathname === '/finish') {
    await handlers.waitUntilCloseAllowed();
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === 'POST' && url.pathname === '/closed') {
    handlers.onClosed();
    response.writeHead(204);
    response.end();
    return;
  }
  response.writeHead(404);
  response.end('Not found');
}

function browserPage(): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>OneRingAI Realtime E2E</title>
<script type="module">
  import { OpenAIRealtimeWebRTCPeer } from '/peer.js';
  const eventTypes = [];
  let outputTranscript = '';
  let remoteTrackSeen = false;
  let rtc;
  let peer;
  const report = async (result) => fetch('/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  });
  try {
    const audioContext = new AudioContext({ sampleRate: 48000 });
    await audioContext.resume();
    const fixtureResponse = await fetch('/microphone.wav');
    const fixture = await audioContext.decodeAudioData(await fixtureResponse.arrayBuffer());
    const microphoneSource = audioContext.createBufferSource();
    const microphoneDestination = audioContext.createMediaStreamDestination();
    microphoneSource.buffer = fixture;
    microphoneSource.connect(microphoneDestination);
    const audio = document.createElement('audio');
    audio.autoplay = true;
    document.body.append(audio);
    peer = new OpenAIRealtimeWebRTCPeer({
      peerConnectionFactory: (configuration) => {
        rtc = new RTCPeerConnection(configuration);
        return rtc;
      },
      exchangeSdp: async (sdp) => {
        const response = await fetch('/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sdp }),
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      },
      releaseCall: async (callId) => {
        const response = await fetch('/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId }),
        });
        if (!response.ok) throw new Error(await response.text());
      },
      localStream: microphoneDestination.stream,
      connectTimeoutMs: 30000,
      onRemoteTrack: (streamOrTrack) => {
        remoteTrackSeen = true;
        audio.srcObject = streamOrTrack instanceof MediaStream
          ? streamOrTrack
          : new MediaStream([streamOrTrack]);
        void audio.play();
      },
    });
    peer.on('event', (event) => {
      eventTypes.push(event.type);
      if (event.type === 'response.output_audio_transcript.done') {
        outputTranscript = String(event.transcript || '');
      }
    });
    await peer.connect();
    microphoneSource.start();
    const deadline = Date.now() + 90000;
    let receivedAudioBytes = 0;
    while (Date.now() < deadline) {
      const stats = await rtc.getStats();
      receivedAudioBytes = 0;
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          receivedAudioBytes += Number(report.bytesReceived || 0);
        }
      });
      if (receivedAudioBytes > 0 && /voice tool confirmed/i.test(outputTranscript)) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await report({
      ok: receivedAudioBytes > 0 && /voice tool confirmed/i.test(outputTranscript),
      callId: peer.callId,
      dataChannelOpened: peer.isOpen,
      remoteTrackSeen,
      receivedAudioBytes,
      outputTranscript,
      eventTypes: [...new Set(eventTypes)],
      ...(!receivedAudioBytes ? { error: 'No remote audio RTP was received' } : {}),
      ...(outputTranscript ? {} : { error: 'No assistant audio transcript was received' }),
    });
    await fetch('/finish');
    await peer.closeAndRelease(1000, 'E2E completed');
    await fetch('/closed', { method: 'POST' });
  } catch (error) {
    await report({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      callId: peer?.callId,
      dataChannelOpened: peer?.isOpen,
      remoteTrackSeen,
      outputTranscript,
      eventTypes: [...new Set(eventTypes)],
    });
  }
</script>`;
}

async function readJSON<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += value.length;
    if (bytes > 2 * 1024 * 1024) throw new Error('Browser request exceeded 2 MiB');
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

function sendJSON(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function resolveChromeExecutable(): string {
  const configured = process.env.OPENAI_REALTIME_E2E_CHROME;
  const candidates = [
    configured,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((value): value is string => Boolean(value));
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new Error('Chrome is required; set OPENAI_REALTIME_E2E_CHROME to its executable path');
  }
  return executable;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorFactory: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(errorFactory()), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function stopChild(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill('SIGTERM');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), 5_000); }),
  ]);
  if (timer) clearTimeout(timer);
  if (!stopped) {
    child.kill('SIGKILL');
    await exited;
  }
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for the server sideband state');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
