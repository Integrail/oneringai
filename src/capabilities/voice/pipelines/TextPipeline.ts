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
import { VoiceSession } from '../VoiceSession.js';
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

/** Target format for audio output to adapter (PCM 16-bit, 8kHz for telephony) */
const OUTPUT_SAMPLE_RATE = 8000;

/** Maximum utterance duration in ms (safety limit) */
const MAX_UTTERANCE_MS = 30000;

// =============================================================================
// TextPipeline
// =============================================================================

export class TextPipeline extends EventEmitter implements IVoicePipeline {
  private agent: Agent;
  private session: VoiceSession;
  private stt: SpeechToText;
  private tts: TextToSpeech;
  private voiceStream: VoiceStream;
  private vad: IVoiceActivityDetector;
  private hooks: VoiceHooks;
  private interruptible: boolean;
  private greeting?: string;

  // State
  private _state: SessionState = 'idle';
  private destroyed = false;

  // Audio accumulation buffer for current utterance
  private utteranceBuffer: Buffer[] = [];
  private utteranceStartTime = 0;

  // Interrupt handling
  private currentStreamAbort: AbortController | null = null;

  constructor(config: TextPipelineInitConfig) {
    super();
    this.agent = config.agent;
    this.session = config.session;
    this.vad = config.vad;
    this.interruptible = config.interruptible;
    this.greeting = config.greeting;
    this.hooks = config.hooks ?? {};

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
      voice: config.tts.voice ?? 'nova',
      speed: config.tts.speed,
      format: 'pcm',
      streaming: true,
    });
  }

  // ─── IVoicePipeline Implementation ──────────────────────────────

  async init(_sessionInfo: VoiceSessionInfo): Promise<void> {
    this.setState('listening');

    if (this.greeting) {
      await this.synthesizeAndSend(this.greeting);
      this.setState('listening');
    }
  }

  processAudio(frame: AudioFrame): void {
    if (this.destroyed) return;

    const vadEvent = this.vad.process(frame);

    if (vadEvent === 'speech_start') {
      this.onSpeechStart();
    }

    // Accumulate audio when in listening/connected state
    if (this._state === 'listening' || this._state === 'connected') {
      this.utteranceBuffer.push(frame.audio);

      if (this.utteranceStartTime === 0) {
        this.utteranceStartTime = frame.timestamp;
      }

      // Safety: max utterance duration
      if (frame.timestamp - this.utteranceStartTime > MAX_UTTERANCE_MS) {
        this.onSpeechEnd().catch((err) => {
          logger.error({ error: err }, '[TextPipeline] Error on forced speech end');
        });
      }
    }

    if (vadEvent === 'speech_end') {
      this.onSpeechEnd().catch((err) => {
        logger.error({ error: err }, '[TextPipeline] Error on speech end');
      });
    }
  }

  onSpeechStart(): void {
    if (this._state === 'speaking' && this.interruptible) {
      this.interrupt();
    }
  }

  async onSpeechEnd(): Promise<void> {
    if (this.destroyed || this.utteranceBuffer.length === 0) return;

    const audioBuffer = Buffer.concat(this.utteranceBuffer);
    this.utteranceBuffer = [];
    this.utteranceStartTime = 0;

    if (this._state === 'speaking') return;

    this.setState('processing');

    try {
      // Step 1: STT
      const sttStart = Date.now();
      const transcription = await this.stt.transcribe(audioBuffer);
      const sttDuration = Date.now() - sttStart;
      this.session.addSttTime(sttDuration);

      const text = transcription.text.trim();
      if (!text) {
        this.setState('listening');
        return;
      }

      logger.debug({ text, sttMs: sttDuration }, '[TextPipeline] STT result');

      // Step 2: beforeAgentResponse hook
      let processedText = text;
      if (this.hooks.beforeAgentResponse) {
        try {
          processedText = await this.hooks.beforeAgentResponse(text, this.session.getInfo());
        } catch (err) {
          logger.error({ error: err }, '[TextPipeline] beforeAgentResponse hook error');
        }
      }

      // Step 3: Agent processing with streaming
      const agentStart = Date.now();
      this.setState('speaking');

      const abort = new AbortController();
      this.currentStreamAbort = abort;

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
          const audio = Buffer.from(audioEvent.audio_base64, 'base64');
          const outFrame: AudioFrame = {
            audio,
            sampleRate: OUTPUT_SAMPLE_RATE,
            encoding: 'pcm_s16le',
            channels: 1,
            timestamp: Date.now() - this.session.startedAt.getTime(),
          };
          this.emit('audio:out', outFrame);
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
          logger.error({ error: err }, '[TextPipeline] afterAgentResponse hook error');
        }
      }

      this.session.incrementTurns();

      if (!this.destroyed && !abort.signal.aborted) {
        this.setState('listening');
        this.vad.reset();
      }
    } catch (error) {
      logger.error({ error }, '[TextPipeline] Processing error');
      this.emit('error', error instanceof Error ? error : new Error(String(error)));

      if (!this.destroyed) {
        this.setState('listening');
        this.vad.reset();
      }
    }
  }

  interrupt(): void {
    if (this._state !== 'speaking') return;

    logger.debug('[TextPipeline] Interrupting agent speech');

    if (this.currentStreamAbort) {
      this.currentStreamAbort.abort();
      this.currentStreamAbort = null;
    }

    this.voiceStream.interrupt();

    if (this.hooks.onInterrupt) {
      this.hooks.onInterrupt(this.session.getInfo()).catch((err) => {
        logger.error({ error: err }, '[TextPipeline] onInterrupt hook error');
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

    if (this.currentStreamAbort) {
      this.currentStreamAbort.abort();
      this.currentStreamAbort = null;
    }

    this.voiceStream.interrupt();
    this.utteranceBuffer = [];
    this.removeAllListeners();

    this.setState('ended');
  }

  // ─── Internal Helpers ────────────────────────────────────────────

  private setState(state: SessionState): void {
    if (this._state === state) return;
    this._state = state;
    this.emit('state:change', state);
  }

  private async synthesizeAndSend(text: string): Promise<void> {
    this.setState('speaking');

    try {
      const ttsStart = Date.now();
      const response = await this.tts.synthesize(text, {
        voice: 'nova',
        format: 'pcm',
      });
      this.session.addTtsTime(Date.now() - ttsStart);

      const outFrame: AudioFrame = {
        audio: response.audio,
        sampleRate: OUTPUT_SAMPLE_RATE,
        encoding: 'pcm_s16le',
        channels: 1,
        timestamp: Date.now() - this.session.startedAt.getTime(),
      };

      this.emit('audio:out', outFrame);
    } catch (error) {
      logger.error({ error }, '[TextPipeline] Greeting TTS error');
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }
}
