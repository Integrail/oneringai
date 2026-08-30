import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import { BaseMediaProvider } from '../base/BaseMediaProvider.js';
import type {
  ISpeechToTextProvider,
  STTOptions,
  STTResponse,
  SegmentTimestamp,
  WordTimestamp,
} from '../../../domain/interfaces/IAudioProvider.js';
import type { ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import type { GoogleConfig } from '../../../domain/types/ProviderConfig.js';
import { ProviderError } from '../../../domain/errors/AIErrors.js';
import { detectAudioContainer, wrapRawAudioAsWav } from '../../../utils/audioUtils.js';

type Interaction = Record<string, any>;

/** Audio transcription through the native Gemini Interactions ASR configuration. */
export class GoogleSTTProvider extends BaseMediaProvider implements ISpeechToTextProvider {
  readonly name = 'google-stt';
  readonly vendor = 'google' as const;
  readonly capabilities: ProviderCapabilities = {
    text: false,
    images: false,
    videos: false,
    audio: true,
    features: { speechToText: true },
  };

  private readonly client: GoogleGenAI;

  constructor(config: GoogleConfig) {
    super(config);
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async transcribe(options: STTOptions): Promise<STTResponse> {
    return this.executeWithCircuitBreaker(async () => {
      if (options.outputFormat && options.outputFormat !== 'text') {
        throw new ProviderError(
          'google',
          `Gemini Interactions transcription does not support ${options.outputFormat} output`,
        );
      }
      const audio = await this.readAudio(options);
      const vendor = options.vendorOptions ?? {};
      const instructions = String(
        vendor.instructions
        ?? (options.language
          ? `Transcribe this audio accurately in ${options.language}. Return only the transcript.`
          : 'Transcribe this audio accurately. Return only the transcript.'),
      );
      const configuredTranscription = (vendor.transcriptionConfig
        ?? vendor.transcription_config
        ?? {}) as Record<string, unknown>;
      const customVocabulary = vendor.customVocabulary ?? vendor.custom_vocabulary;
      const diarizationMode = vendor.diarizationMode ?? vendor.diarization_mode;
      const transcriptionConfig: Record<string, unknown> = {
        ...configuredTranscription,
        ...(options.language ? { language_codes: [options.language] } : {}),
        ...(options.includeTimestamps ? { timestamp_granularities: ['word'] } : {}),
        ...(customVocabulary ? { custom_vocabulary: customVocabulary } : {}),
        ...(diarizationMode ? { diarization_mode: diarizationMode } : {}),
      };
      const interaction = await (this.client.interactions as any).create({
        model: options.model || 'gemini-3.5-transcribe',
        input: [
          { type: 'text', text: instructions },
          {
            type: 'audio',
            data: audio.data,
            mime_type: audio.mimeType,
            ...(audio.sampleRate === undefined ? {} : { sample_rate: audio.sampleRate }),
          },
        ],
        store: false,
        response_format: { type: 'text', mime_type: 'text/plain' },
        generation_config: { transcription_config: transcriptionConfig },
      }) as Interaction;

      const rawText = this.extractText(interaction);
      if (!rawText) throw new ProviderError('google', 'Gemini returned no transcript');
      const words = this.extractWords(interaction);
      const segments = options.includeTimestamps
        ? this.extractSegments(rawText, audio.durationSeconds, words)
        : [];
      const text = this.stripTimestampMarkers(rawText);
      const durationSeconds = words.length > 0
        ? Math.max(...words.map((word) => word.end))
        : segments.length > 0
          ? Math.max(...segments.map((segment) => segment.end))
          : audio.durationSeconds;
      return {
        text,
        language: options.language,
        ...(words.length > 0 ? { words } : {}),
        ...(segments.length > 0 ? { segments } : {}),
        ...(durationSeconds === undefined ? {} : { durationSeconds }),
      };
    }, 'stt.transcribe', { model: options.model });
  }

  async translate(options: STTOptions): Promise<STTResponse> {
    return this.transcribe({
      ...options,
      vendorOptions: {
        ...options.vendorOptions,
        instructions: options.vendorOptions?.instructions
          ?? 'Transcribe this audio and translate it to English. Return only the English transcript.',
      },
    });
  }

  private extractText(interaction: Interaction): string {
    if (interaction.output_text) return interaction.output_text;
    return (interaction.steps ?? [])
      .filter((step: Interaction) => step.type === 'model_output')
      .flatMap((step: Interaction) => step.content ?? [])
      .filter((content: Interaction) => content.type === 'text')
      .map((content: Interaction) => content.text ?? '')
      .join('');
  }

  private extractWords(interaction: Interaction): WordTimestamp[] {
    return (interaction.steps ?? [])
      .filter((step: Interaction) => step.type === 'model_output')
      .flatMap((step: Interaction) => step.content ?? [])
      .flatMap((content: Interaction) => content.annotations ?? [])
      .filter((annotation: Interaction) => annotation.type === 'word_info')
      .map((annotation: Interaction) => ({
        word: annotation.text ?? '',
        start: this.parseOffset(annotation.start_offset),
        end: this.parseOffset(annotation.end_offset),
        ...(annotation.speaker === undefined ? {} : { speaker: annotation.speaker }),
      }));
  }

  private extractSegments(
    text: string,
    audioDuration: number | undefined,
    words: WordTimestamp[],
  ): SegmentTimestamp[] {
    const marker = /<\|(\d+(?:\.\d+)?)\|>/g;
    const matches = [...text.matchAll(marker)];
    const segments: SegmentTimestamp[] = [];
    for (let index = 0; index < matches.length - 1; index += 1) {
      const current = matches[index]!;
      const next = matches[index + 1]!;
      const contentStart = current.index! + current[0].length;
      const content = text.slice(contentStart, next.index).trim();
      if (!content) continue;
      segments.push({
        id: segments.length,
        text: content,
        start: Number.parseFloat(current[1]!),
        end: Number.parseFloat(next[1]!),
      });
    }
    if (segments.length > 0) return segments;

    const startMarker = /^\s*(?:(\d{1,2}):)?(\d{2}):(\d{2}(?:\.\d+)?)\s+/;
    const timestamp = startMarker.exec(text);
    const start = timestamp
      ? Number(timestamp[1] ?? 0) * 3600 + Number(timestamp[2]) * 60 + Number(timestamp[3])
      : words[0]?.start ?? 0;
    const end = words.length > 0 ? words[words.length - 1]!.end : audioDuration;
    if (end === undefined || end < start) return [];
    return [{ id: 0, text: this.stripTimestampMarkers(text), start, end }];
  }

  private stripTimestampMarkers(text: string): string {
    return text
      .replace(/<\|\d+(?:\.\d+)?\|>/g, '')
      .replace(/^\s*(?:(?:\d{1,2}:)?\d{2}:\d{2}(?:\.\d+)?)\s+/, '')
      .trim();
  }

  private parseOffset(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    const parsed = Number.parseFloat(value.endsWith('s') ? value.slice(0, -1) : value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async readAudio(options: STTOptions): Promise<{
    data: string;
    mimeType: string;
    sampleRate?: number;
    durationSeconds?: number;
  }> {
    const { audio } = options;
    if (Buffer.isBuffer(audio)) {
      const detected = options.encoding ? undefined : detectAudioContainer(audio);
      if (detected) {
        return { data: audio.toString('base64'), mimeType: detected.mimeType };
      }
      const sampleRate = options.sampleRate ?? 16000;
      if (options.encoding === 'mulaw' || options.encoding === 'alaw') {
        return {
          data: audio.toString('base64'),
          mimeType: options.encoding === 'mulaw' ? 'audio/mulaw' : 'audio/alaw',
          sampleRate,
          durationSeconds: audio.length / sampleRate,
        };
      }
      const wav = wrapRawAudioAsWav(audio, sampleRate, 'pcm');
      return {
        data: wav.toString('base64'),
        mimeType: 'audio/wav',
        durationSeconds: audio.length / (sampleRate * 2),
      };
    }
    const extension = path.extname(audio).toLowerCase();
    const mimeType = extension === '.mp3' ? 'audio/mpeg'
      : extension === '.aiff' || extension === '.aif' ? 'audio/aiff'
        : extension === '.ogg' ? 'audio/ogg'
          : extension === '.flac' ? 'audio/flac'
            : extension === '.aac' ? 'audio/aac'
              : 'audio/wav';
    return { data: (await fs.promises.readFile(audio)).toString('base64'), mimeType };
  }
}
