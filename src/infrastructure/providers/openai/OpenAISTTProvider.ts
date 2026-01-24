/**
 * OpenAI Speech-to-Text provider
 * Supports: whisper-1, gpt-4o-transcribe, gpt-4o-transcribe-diarize
 */

import OpenAI from 'openai';
import { BaseMediaProvider } from '../base/BaseMediaProvider.js';
import type { ISpeechToTextProvider, STTOptions, STTResponse, STTOutputFormat } from '../../../domain/interfaces/IAudioProvider.js';
import type { ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import type { OpenAIConfig } from '../../../domain/types/ProviderConfig.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderError,
} from '../../../domain/errors/AIErrors.js';
import * as fs from 'fs';
import { Readable } from 'stream';

export class OpenAISTTProvider extends BaseMediaProvider implements ISpeechToTextProvider {
  readonly name: string = 'openai-stt';
  readonly vendor = 'openai' as const;
  readonly capabilities: ProviderCapabilities = {
    text: false,
    images: false,
    videos: false,
    audio: true,
    features: {
      speechToText: true,
    },
  };

  private client: OpenAI;

  constructor(config: OpenAIConfig) {
    super(config);

    this.client = new OpenAI({
      apiKey: config.auth.type === 'api_key' ? config.auth.apiKey : undefined,
      baseURL: config.baseURL,
      organization: config.organization,
      timeout: config.timeout ?? 120000, // 2 minutes for audio processing
      maxRetries: config.maxRetries ?? 2,
    });
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(options: STTOptions): Promise<STTResponse> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart('stt.transcribe', {
            model: options.model,
            language: options.language,
            format: options.outputFormat,
          });

          // Prepare audio file
          const audioFile = await this.prepareAudioFile(options.audio);

          // Build request parameters
          const requestParams: Partial<OpenAI.Audio.TranscriptionCreateParams> = {
            model: options.model,
            file: audioFile,
            language: options.language,
            prompt: options.prompt,
            temperature: options.temperature,
          };

          // Map output format
          if (options.outputFormat) {
            requestParams.response_format = this.mapOutputFormat(options.outputFormat);
          } else if (options.includeTimestamps) {
            requestParams.response_format = 'verbose_json';
          }

          // Add timestamp granularity if needed
          if (options.includeTimestamps && options.timestampGranularity) {
            requestParams.timestamp_granularities = [options.timestampGranularity];
          }

          // Add diarization options if using diarize model
          if (options.model.includes('diarize') && options.vendorOptions?.max_speakers) {
            (requestParams as any).max_speakers = options.vendorOptions.max_speakers;
          }

          const response = await this.client.audio.transcriptions.create(
            requestParams as OpenAI.Audio.TranscriptionCreateParams
          );

          this.logOperationComplete('stt.transcribe', {
            model: options.model,
            textLength: typeof response === 'string' ? response.length : response.text?.length || 0,
          });

          return this.convertResponse(response);
        } catch (error: any) {
          this.handleError(error);
          throw error; // TypeScript needs this
        }
      },
      'stt.transcribe',
      { model: options.model }
    );
  }

  /**
   * Translate audio to English text
   */
  async translate(options: STTOptions): Promise<STTResponse> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart('stt.translate', {
            model: options.model,
          });

          const audioFile = await this.prepareAudioFile(options.audio);

          const requestParams: Partial<OpenAI.Audio.TranslationCreateParams> = {
            model: options.model,
            file: audioFile,
            prompt: options.prompt,
            temperature: options.temperature,
          };

          if (options.outputFormat) {
            requestParams.response_format = this.mapOutputFormat(options.outputFormat);
          }

          const response = await this.client.audio.translations.create(
            requestParams as OpenAI.Audio.TranslationCreateParams
          );

          this.logOperationComplete('stt.translate', {
            model: options.model,
            textLength: typeof response === 'string' ? response.length : response.text?.length || 0,
          });

          return this.convertResponse(response);
        } catch (error: any) {
          this.handleError(error);
          throw error;
        }
      },
      'stt.translate',
      { model: options.model }
    );
  }

  /**
   * Prepare audio file for API request
   * Handles both Buffer and file path inputs
   */
  private async prepareAudioFile(audio: Buffer | string): Promise<any> {
    if (Buffer.isBuffer(audio)) {
      // Convert Buffer to File-like object that OpenAI SDK expects
      const blob = new Blob([audio]);
      return new File([blob], 'audio.wav', { type: 'audio/wav' });
    } else if (typeof audio === 'string') {
      // File path - create ReadStream
      return fs.createReadStream(audio);
    } else {
      throw new Error('Invalid audio input: must be Buffer or file path');
    }
  }

  /**
   * Map semantic output format to OpenAI format
   */
  private mapOutputFormat(
    format: STTOutputFormat
  ): OpenAI.Audio.TranscriptionCreateParams['response_format'] {
    switch (format) {
      case 'json':
        return 'json';
      case 'text':
        return 'text';
      case 'srt':
        return 'srt';
      case 'vtt':
        return 'vtt';
      case 'verbose_json':
        return 'verbose_json';
      default:
        return 'json';
    }
  }

  /**
   * Convert OpenAI response to our standard format
   */
  private convertResponse(response: OpenAI.Audio.Transcription | string): STTResponse {
    // Handle simple string response
    if (typeof response === 'string') {
      return { text: response };
    }

    // Handle JSON response
    const result: STTResponse = {
      text: response.text,
      language: response.language,
      durationSeconds: response.duration,
    };

    // Add word timestamps if available
    if ((response as any).words) {
      result.words = (response as any).words.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      }));
    }

    // Add segment timestamps if available
    if ((response as any).segments) {
      result.segments = (response as any).segments.map((s: any) => ({
        id: s.id,
        text: s.text,
        start: s.start,
        end: s.end,
        tokens: s.tokens,
      }));
    }

    return result;
  }

  /**
   * Handle OpenAI API errors
   */
  private handleError(error: any): never {
    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      const message = error.message || 'Unknown OpenAI API error';

      if (status === 401) {
        throw new ProviderAuthError('openai', 'Invalid API key');
      }

      if (status === 429) {
        throw new ProviderRateLimitError('openai', message);
      }

      if (status === 400) {
        throw new ProviderError('openai', `Bad request: ${message}`);
      }

      if (status === 413) {
        throw new ProviderError('openai', 'Audio file too large (max 25MB)');
      }

      throw new ProviderError('openai', message);
    }

    throw error;
  }
}
