/**
 * TextPipeline - STT → Agent → TTS voice pipeline
 *
 * Processes a voice call using the text-based approach:
 * 1. Accumulate audio frames from caller
 * 2. VAD detects end of speech
 * 3. STT transcribes accumulated audio to text
 * 4. Agent processes text (may call tools)
 * 5. Agent response streamed through VoiceStream (TTS)
 * 6. Audio frames sent back to caller
 *
 * This pipeline works with ANY LLM - the agent handles text in/out,
 * and we handle the audio conversion on both sides.
 */

import { EventEmitter } from 'events';
import { Agent } from '../../../core/Agent.js';
import { TextToSpeech } from '../../../core/TextToSpeech.js';
import { SpeechToText } from '../../../core/SpeechToText.js';
import { VoiceStream } from '../../speech/VoiceStream.js';
import { StreamEventType } from '../../../domain/entities/StreamEvent.js';
import { logger } from '../../../infrastructure/observability/Logger.js';
import { resamplePcm, pcmToMulaw } from '../adapters/twilio/codecs.js';
import { VoiceSession } from '../VoiceSession.js';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import type {
  IVoicePipeline,
  IVoiceActivityDetector,
  AudioFrame,
  SessionState,
  VoiceSessionInfo,
  VoicePipelineEvents,
  VoiceHooks,
  TextPipelineConfig,
} from '../types.js';

// =============================================================================
// Configuration
// =============================================================================

export interface TextPipelineInitConfig {
  agent: Agent;
  session: VoiceSession;
  stt: TextPipelineConfig['stt'];
  tts: TextPipelineConfig['tts'];
  vad: IVoiceActivityDetector;
  interruptible: boolean;
  greeting?: string;
  hooks?: VoiceHooks;
}

// =============================================================================
// Constants
// =============================================================================

/** Target sample rate for telephony output (Twilio expects 8kHz) */
const OUTPUT_SAMPLE_RATE = 8000;

/** OpenAI TTS PCM output sample rate */
const TTS_SOURCE_SAMPLE_RATE = 24000;

/** Maximum utterance duration in ms (safety limit) */
const MAX_UTTERANCE_MS = 30000;

// =============================================================================
// TextPipeline
// =============================================================================

export class TextPipeline extends EventEmitter implements IVoicePipeline {
  private agent: Agent | null;
  private session: VoiceSession;
  private stt: SpeechToText | null;
  private tts: TextToSpeech | null;
  private voiceStream: VoiceStream | null;
  private vad: IVoiceActivityDetector;
  private hooks: VoiceHooks;
  private interruptible: boolean;
  private greeting?: string;
  private ttsVoice: string;

  // State
  private _state: SessionState = 'idle';
  private destroyed = false;
  private isProcessingUtterance = false; // Guard against concurrent onSpeechEnd

  // Audio accumulation buffer for current utterance
  private utteranceBuffer: Buffer[] = [];
  private utteranceStartTime = 0;

  // Interrupt handling
  private currentStreamAbort: AbortController | null = null;

  // Metrics
  private audioChunkCount = 0;

  constructor(config: TextPipelineInitConfig) {
    super();
    this.agent = config.agent;
    this.session = config.session;
    this.vad = config.vad;
    this.interruptible = config.interruptible;
    this.greeting = config.greeting;
    this.hooks = config.hooks ?? {};
    this.ttsVoice = config.tts.voice ?? 'nova';

    this.stt = SpeechToText.create({
      connector: config.stt.connector,
      model: config.stt.model,
      language: config.stt.language,
    });

    this.tts = TextToSpeech.create({
      connector: config.tts.connector,
      model: config.tts.model,
    });

    this.voiceStream = VoiceStream.create({
      ttsConnector: config.tts.connector,
      ttsModel: config.tts.model,
      voice: this.ttsVoice,
      speed: config.tts.speed,
      format: 'pcm',
      streaming: true,
    });

    logger.debug(
      { sessionId: this.session.sessionId, sttConnector: config.stt.connector, ttsVoice: this.ttsVoice },
      '[TextPipeline] Created'
    );
  }

  // ─── IVoicePipeline Implementation ──────────────────────────────

  async init(_sessionInfo: VoiceSessionInfo): Promise<void> {
    logger.debug({ sessionId: this.session.sessionId }, '[TextPipeline] Initializing');
    this.setState('listening');

    if (this.greeting) {
      await this.synthesizeAndSend(this.greeting);
      this.setState('listening');
    }
  }

  /** Consecutive high-energy frames during speaking state (for barge-in) */
  private bargeInFrames = 0;
  private bargeInDiagCounter = 0;
  /** Energy threshold for barge-in during speaking (higher than normal to reject echo) */
  private static readonly BARGE_IN_ENERGY_THRESHOLD = 0.05;
  /** Consecutive frames needed to confirm barge-in (not just a brief noise spike) */
  private static readonly BARGE_IN_FRAMES_REQUIRED = 5;

  processAudio(frame: AudioFrame): void {
    if (this.destroyed) return;

    // During processing state, ignore audio entirely
    if (this._state === 'processing') return;

    // During speaking state, only check for barge-in (higher threshold to reject echo)
    if (this._state === 'speaking') {
      if (!this.interruptible) return;

      const energy = this.calculateFrameEnergy(frame);

      // Log energy periodically so we can see what levels the caller's voice reaches
      if (this.bargeInDiagCounter++ % 50 === 0) {
        logger.debug(
          { sessionId: this.session.sessionId, energy: energy.toFixed(4), threshold: TextPipeline.BARGE_IN_ENERGY_THRESHOLD, consecutiveFrames: this.bargeInFrames },
          '[TextPipeline] DIAG: barge-in energy sample during speaking'
        );
      }

      if (energy > TextPipeline.BARGE_IN_ENERGY_THRESHOLD) {
        this.bargeInFrames++;
        if (this.bargeInFrames >= TextPipeline.BARGE_IN_FRAMES_REQUIRED) {
          logger.info(
            { sessionId: this.session.sessionId, energy: energy.toFixed(4), frames: this.bargeInFrames },
            '[TextPipeline] Barge-in detected!'
          );
          this.bargeInFrames = 0;
          this.interrupt();
        }
      } else {
        this.bargeInFrames = 0;
      }
      return;
    }

    // Listening state: normal VAD processing
    const vadEvent = this.vad.process(frame);

    if (vadEvent === 'speech_start') {
      // Clear any remaining Twilio audio buffer from previous response.
      // Our pipeline is in 'listening' but Twilio may still be playing buffered audio.
      this.emit('interrupt');
      this.onSpeechStart();
    }

    // Accumulate audio for the current utterance
    this.utteranceBuffer.push(frame.audio);

    if (this.utteranceStartTime === 0) {
      this.utteranceStartTime = frame.timestamp;
    }

    // Safety: max utterance duration
    if (frame.timestamp - this.utteranceStartTime > MAX_UTTERANCE_MS) {
      logger.warn(
        { sessionId: this.session.sessionId, durationMs: MAX_UTTERANCE_MS },
        '[TextPipeline] Max utterance duration reached, forcing speech end'
      );
      this.onSpeechEnd().catch((err) => {
        logger.error({ sessionId: this.session.sessionId, error: err }, '[TextPipeline] Error on forced speech end');
      });
    }

    if (vadEvent === 'speech_end') {
      this.onSpeechEnd().catch((err) => {
        logger.error({ sessionId: this.session.sessionId, error: err }, '[TextPipeline] Error on speech end');
      });
    }
  }

  /**
   * Calculate RMS energy of a single audio frame (for barge-in detection).
   */
  private calculateFrameEnergy(frame: AudioFrame): number {
    const { audio } = frame;
    const samples = audio.length / 2;
    if (samples === 0) return 0;
    let sum = 0;
    for (let i = 0; i < audio.length; i += 2) {
      const s = audio.readInt16LE(i) / 32768;
      sum += s * s;
    }
    return Math.sqrt(sum / samples);
  }

  onSpeechStart(): void {
    if (this._state === 'speaking' && this.interruptible) {
      this.interrupt();
    }
  }

  async onSpeechEnd(): Promise<void> {
    // Guard: prevent concurrent processing
    if (this.isProcessingUtterance) {
      logger.debug({ sessionId: this.session.sessionId }, '[TextPipeline] Already processing utterance, skipping');
      return;
    }

    if (this.destroyed || this.utteranceBuffer.length === 0) return;

    const audioBuffer = Buffer.concat(this.utteranceBuffer);
    const utteranceDurationMs = this.utteranceStartTime > 0
      ? Date.now() - this.session.startedAt.getTime() - this.utteranceStartTime
      : 0;
    this.utteranceBuffer = [];
    this.utteranceStartTime = 0;

    if (this._state === 'speaking') return;

    this.isProcessingUtterance = true;
    this.setState('processing');

    logger.debug(
      { sessionId: this.session.sessionId, bufferBytes: audioBuffer.length, durationMs: utteranceDurationMs },
      '[TextPipeline] Processing utterance'
    );

    try {
      // Bail out if destroyed during async gap (e.g., caller hung up during STT)
      if (this.destroyed || !this.stt || !this.agent) {
        logger.debug({ sessionId: this.session.sessionId }, '[TextPipeline] Pipeline destroyed before processing');
        return;
      }

      // Step 1: STT
      const sttStart = Date.now();
      const transcription = await this.stt.transcribe(audioBuffer);
      const sttDuration = Date.now() - sttStart;
      this.session.addSttTime(sttDuration);

      // Check again after async STT call
      if (this.destroyed || !this.agent) return;

      const text = transcription.text.trim();
      if (!text) {
        logger.debug({ sessionId: this.session.sessionId, sttMs: sttDuration }, '[TextPipeline] Empty STT result');
        this.setState('listening');
        return;
      }

      logger.debug(
        { sessionId: this.session.sessionId, text, sttMs: sttDuration },
        '[TextPipeline] STT complete'
      );

      // Step 2: beforeAgentResponse hook
      let processedText = text;
      if (this.hooks.beforeAgentResponse) {
        try {
          processedText = await this.hooks.beforeAgentResponse(text, this.session.getInfo());
        } catch (err) {
          logger.error(
            { sessionId: this.session.sessionId, hook: 'beforeAgentResponse', error: err },
            '[TextPipeline] Hook error'
          );
        }
      }

      // Check again after async hook
      if (this.destroyed || !this.agent || !this.voiceStream) return;

      // Step 3: Agent processing with streaming
      const agentStart = Date.now();
      this.setState('speaking');

      const abort = new AbortController();
      this.currentStreamAbort = abort;
      this.audioChunkCount = 0;

      logger.debug({ sessionId: this.session.sessionId, text: processedText }, '[TextPipeline] Agent stream started');

      const agentStream = this.agent.stream(processedText);
      let fullResponse = '';

      for await (const event of this.voiceStream.wrap(agentStream)) {
        if (abort.signal.aborted) break;

        if (event.type === StreamEventType.OUTPUT_TEXT_DELTA) {
          fullResponse += (event as { delta: string }).delta;
        } else if (event.type === StreamEventType.AUDIO_CHUNK_READY) {
          const audioEvent = event as {
            audio_base64: string;
            format: string;
            duration_seconds?: number;
          };

          // TTS returns PCM at 24kHz s16le — resample to 8kHz for telephony
          const pcmSource = Buffer.from(audioEvent.audio_base64, 'base64');

          const pcmResampled = resamplePcm(pcmSource, TTS_SOURCE_SAMPLE_RATE, OUTPUT_SAMPLE_RATE);

          // DIAG: dump first chunk's audio at each stage for offline analysis
          if (this.audioChunkCount === 0) {
            try {
              const dir = tmpdir();
              writeFileSync(`${dir}/vb_stream_24k.raw`, pcmSource);
              writeFileSync(`${dir}/vb_stream_8k.raw`, pcmResampled);
              const mulawData = pcmToMulaw(pcmResampled);
              writeFileSync(`${dir}/vb_stream.ulaw`, mulawData);
              logger.info({
                dir,
                pcm24kBytes: pcmSource.length,
                pcm8kBytes: pcmResampled.length,
                mulawBytes: mulawData.length,
                format: audioEvent.format,
              }, '[TextPipeline] DIAG: Audio dump saved to temp dir');
            } catch (diagErr) {
              logger.error({ error: diagErr }, '[TextPipeline] DIAG: Failed to dump audio');
            }
          }

          const outFrame: AudioFrame = {
            audio: pcmResampled,
            sampleRate: OUTPUT_SAMPLE_RATE,
            encoding: 'pcm_s16le',
            channels: 1,
            timestamp: Date.now() - this.session.startedAt.getTime(),
          };
          this.emit('audio:out', outFrame);
          this.audioChunkCount++;

          logger.debug(
            { sessionId: this.session.sessionId, chunkIndex: this.audioChunkCount, bytes: pcmResampled.length },
            '[TextPipeline] Audio chunk emitted'
          );
        }
      }

      const agentDuration = Date.now() - agentStart;
      this.session.addAgentTime(agentDuration);
      this.currentStreamAbort = null;

      // Step 4: afterAgentResponse hook
      if (this.hooks.afterAgentResponse && fullResponse) {
        try {
          await this.hooks.afterAgentResponse(fullResponse, this.session.getInfo());
        } catch (err) {
          logger.error(
            { sessionId: this.session.sessionId, hook: 'afterAgentResponse', error: err },
            '[TextPipeline] Hook error'
          );
        }
      }

      this.session.incrementTurns();

      logger.debug(
        { sessionId: this.session.sessionId, turn: this.session.turns, agentMs: agentDuration, chunks: this.audioChunkCount },
        '[TextPipeline] Turn complete'
      );

      if (!this.destroyed && !abort.signal.aborted) {
        this.setState('listening');
        this.vad.reset();
      }
    } catch (error) {
      logger.error(
        { sessionId: this.session.sessionId, error },
        '[TextPipeline] Processing error'
      );
      this.emit('error', error instanceof Error ? error : new Error(String(error)));

      if (!this.destroyed) {
        this.setState('listening');
        this.vad.reset();
      }
    } finally {
      this.isProcessingUtterance = false;
    }
  }

  interrupt(): void {
    if (this._state !== 'speaking') return;

    logger.debug(
      { sessionId: this.session.sessionId, state: this._state },
      '[TextPipeline] Interrupt triggered'
    );

    // Emit interrupt event so VoiceBridge can clear Twilio's audio buffer
    this.emit('interrupt');

    if (this.currentStreamAbort) {
      this.currentStreamAbort.abort();
      this.currentStreamAbort = null;
    }

    if (this.voiceStream) {
      this.voiceStream.interrupt();
    }

    if (this.hooks.onInterrupt) {
      this.hooks.onInterrupt(this.session.getInfo()).catch((err) => {
        logger.error(
          { sessionId: this.session.sessionId, hook: 'onInterrupt', error: err },
          '[TextPipeline] Hook error'
        );
      });
    }

    this.setState('listening');
    this.vad.reset();
    this.utteranceBuffer = [];
    this.utteranceStartTime = 0;
  }

  getState(): SessionState {
    return this._state;
  }

  on<K extends keyof VoicePipelineEvents>(event: K, handler: VoicePipelineEvents[K]): this {
    return super.on(event, handler);
  }

  off<K extends keyof VoicePipelineEvents>(event: K, handler: VoicePipelineEvents[K]): this {
    return super.off(event, handler);
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    logger.debug({ sessionId: this.session.sessionId }, '[TextPipeline] Destroying');

    if (this.currentStreamAbort) {
      this.currentStreamAbort.abort();
      this.currentStreamAbort = null;
    }

    // Clean up VoiceStream (implements IDisposable)
    if (this.voiceStream) {
      this.voiceStream.interrupt();
      this.voiceStream.destroy();
      this.voiceStream = null;
    }

    // Release references
    this.stt = null;
    this.tts = null;
    this.agent = null;
    this.utteranceBuffer = [];
    this.removeAllListeners();

    this.setState('ended');
  }

  // ─── Internal Helpers ────────────────────────────────────────────

  private setState(state: SessionState): void {
    if (this._state === state) return;
    const prev = this._state;
    this._state = state;
    logger.debug({ sessionId: this.session.sessionId, from: prev, to: state }, '[TextPipeline] State change');
    this.emit('state:change', state);
  }

  /**
   * Synthesize text to speech and emit audio frames.
   * Used for greeting and other non-agent audio.
   */
  private async synthesizeAndSend(text: string): Promise<void> {
    this.setState('speaking');

    try {
      const ttsStart = Date.now();
      const response = await this.tts!.synthesize(text, {
        voice: this.ttsVoice,
        format: 'pcm',
      });
      const ttsDuration = Date.now() - ttsStart;
      this.session.addTtsTime(ttsDuration);

      // TTS returns PCM at 24kHz — resample to 8kHz for telephony
      const pcmResampled = resamplePcm(response.audio, TTS_SOURCE_SAMPLE_RATE, OUTPUT_SAMPLE_RATE);

      // DIAG: dump greeting audio files for offline analysis
      try {
        const dir = tmpdir();
        writeFileSync(`${dir}/vb_greeting_24k.raw`, response.audio);
        writeFileSync(`${dir}/vb_greeting_8k.raw`, pcmResampled);
        const mulawData = pcmToMulaw(pcmResampled);
        writeFileSync(`${dir}/vb_greeting.ulaw`, mulawData);
        logger.info({ dir, pcm24kSize: response.audio.length, pcm8kSize: pcmResampled.length, mulawSize: mulawData.length },
          '[TextPipeline] DIAG: Greeting audio dumped to temp dir');
      } catch (e) {
        logger.error({ error: e }, '[TextPipeline] DIAG: Could not dump greeting audio');
      }

      const outFrame: AudioFrame = {
        audio: pcmResampled,
        sampleRate: OUTPUT_SAMPLE_RATE,
        encoding: 'pcm_s16le',
        channels: 1,
        timestamp: Date.now() - this.session.startedAt.getTime(),
      };

      this.emit('audio:out', outFrame);

      logger.debug(
        { sessionId: this.session.sessionId, ttsMs: ttsDuration, text: text.slice(0, 50) },
        '[TextPipeline] Greeting synthesized'
      );
    } catch (error) {
      logger.error(
        { sessionId: this.session.sessionId, error },
        '[TextPipeline] Greeting TTS error'
      );
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }
}
