/**
 * SpeechToText capability class
 * Provides high-level API for speech-to-text transcription
 */

import { Connector } from './Connector.js';
import { createSTTProvider } from './createAudioProvider.js';
import type { ISpeechToTextProvider, STTOptions, STTResponse } from '../domain/interfaces/IAudioProvider.js';
import { getSTTModelInfo, getSTTModelsByVendor, type ISTTModelDescription } from '../domain/entities/STTModel.js';
import * as fs from 'fs/promises';

/**
 * Configuration for SpeechToText capability
 */
export interface SpeechToTextConfig {
  /** Connector name or instance */
  connector: string | Connector;

  /** Default model to use */
  model?: string;

  /** Default language (ISO-639-1 code) */
  language?: string;

  /** Default temperature for sampling */
  temperature?: number;
}

/**
 * SpeechToText capability class
 * Provides speech-to-text transcription with model introspection
 *
 * @example
 * ```typescript
 * const stt = SpeechToText.create({
 *   connector: 'openai',
 *   model: 'whisper-1',
 * });
 *
 * const result = await stt.transcribe(audioBuffer);
 * console.log(result.text);
 *
 * const detailed = await stt.transcribeWithTimestamps(audioBuffer, 'word');
 * console.log(detailed.words);
 * ```
 */
export class SpeechToText {
  private provider: ISpeechToTextProvider;
  private config: SpeechToTextConfig;

  /**
   * Create a new SpeechToText instance
   */
  static create(config: SpeechToTextConfig): SpeechToText {
    return new SpeechToText(config);
  }

  private constructor(config: SpeechToTextConfig) {
    const connector = typeof config.connector === 'string'
      ? Connector.get(config.connector)
      : config.connector;

    this.provider = createSTTProvider(connector);
    this.config = config;
  }

  // ======================== Transcription Methods ========================

  /**
   * Transcribe audio to text
   *
   * @param audio - Audio data as Buffer or file path
   * @param options - Optional transcription parameters
   * @returns Transcription result with text and metadata
   */
  async transcribe(
    audio: Buffer | string,
    options?: Partial<Omit<STTOptions, 'model' | 'audio'>>
  ): Promise<STTResponse> {
    const fullOptions: STTOptions = {
      model: this.config.model ?? this.getDefaultModel(),
      audio,
      language: options?.language ?? this.config.language,
      outputFormat: options?.outputFormat,
      includeTimestamps: options?.includeTimestamps,
      timestampGranularity: options?.timestampGranularity,
      prompt: options?.prompt,
      temperature: options?.temperature ?? this.config.temperature,
      vendorOptions: options?.vendorOptions,
    };

    return this.provider.transcribe(fullOptions);
  }

  /**
   * Transcribe audio file by path
   *
   * @param filePath - Path to audio file
   * @param options - Optional transcription parameters
   */
  async transcribeFile(
    filePath: string,
    options?: Partial<Omit<STTOptions, 'model' | 'audio'>>
  ): Promise<STTResponse> {
    const audio = await fs.readFile(filePath);
    return this.transcribe(audio, options);
  }

  /**
   * Transcribe audio with word or segment timestamps
   *
   * @param audio - Audio data as Buffer or file path
   * @param granularity - Timestamp granularity ('word' or 'segment')
   * @param options - Optional transcription parameters
   */
  async transcribeWithTimestamps(
    audio: Buffer | string,
    granularity: 'word' | 'segment' = 'segment',
    options?: Partial<Omit<STTOptions, 'model' | 'audio' | 'includeTimestamps' | 'timestampGranularity'>>
  ): Promise<STTResponse> {
    return this.transcribe(audio, {
      ...options,
      outputFormat: 'verbose_json',
      includeTimestamps: true,
      timestampGranularity: granularity,
    });
  }

  /**
   * Translate audio to English text
   * Note: Only supported by some models (e.g., Whisper)
   *
   * @param audio - Audio data as Buffer or file path
   * @param options - Optional transcription parameters
   */
  async translate(
    audio: Buffer | string,
    options?: Partial<Omit<STTOptions, 'model' | 'audio'>>
  ): Promise<STTResponse> {
    if (!this.provider.translate) {
      throw new Error('Translation not supported by this provider');
    }

    const fullOptions: STTOptions = {
      model: this.config.model ?? this.getDefaultModel(),
      audio,
      outputFormat: options?.outputFormat,
      prompt: options?.prompt,
      temperature: options?.temperature ?? this.config.temperature,
      vendorOptions: options?.vendorOptions,
    };

    return this.provider.translate(fullOptions);
  }

  // ======================== Introspection Methods ========================

  /**
   * Get model information for current or specified model
   */
  getModelInfo(model?: string): ISTTModelDescription {
    const targetModel = model ?? this.config.model ?? this.getDefaultModel();
    const info = getSTTModelInfo(targetModel);

    if (!info) {
      throw new Error(`Unknown STT model: ${targetModel}`);
    }

    return info;
  }

  /**
   * Get model capabilities
   */
  getModelCapabilities(model?: string) {
    return this.getModelInfo(model).capabilities;
  }

  /**
   * List all available models for this provider's vendor
   */
  listAvailableModels(): ISTTModelDescription[] {
    const vendor = this.provider.vendor;
    if (!vendor) {
      return [];
    }
    return getSTTModelsByVendor(vendor as any);
  }

  /**
   * Check if a specific feature is supported by the model
   */
  supportsFeature(
    feature: keyof ISTTModelDescription['capabilities']['features'],
    model?: string
  ): boolean {
    const caps = this.getModelCapabilities(model);
    return Boolean(caps.features[feature]);
  }

  /**
   * Get supported input audio formats
   */
  getSupportedInputFormats(model?: string): readonly string[] | string[] {
    return this.getModelCapabilities(model).inputFormats;
  }

  /**
   * Get supported output formats
   */
  getSupportedOutputFormats(model?: string): readonly string[] {
    return this.getModelCapabilities(model).outputFormats;
  }

  /**
   * Get supported languages (empty array = auto-detect all)
   */
  getSupportedLanguages(model?: string): readonly string[] {
    return this.getModelCapabilities(model).languages;
  }

  /**
   * Check if timestamps are supported
   */
  supportsTimestamps(model?: string): boolean {
    return this.getModelCapabilities(model).timestamps.supported;
  }

  /**
   * Check if translation is supported
   */
  supportsTranslation(model?: string): boolean {
    return this.supportsFeature('translation', model);
  }

  /**
   * Check if speaker diarization is supported
   */
  supportsDiarization(model?: string): boolean {
    return this.supportsFeature('diarization', model);
  }

  /**
   * Get timestamp granularities supported
   */
  getTimestampGranularities(model?: string): ('word' | 'segment')[] | undefined {
    return this.getModelCapabilities(model).timestamps.granularities;
  }

  // ======================== Configuration Methods ========================

  /**
   * Update default model
   */
  setModel(model: string): void {
    this.config.model = model;
  }

  /**
   * Update default language
   */
  setLanguage(language: string): void {
    this.config.language = language;
  }

  /**
   * Update default temperature
   */
  setTemperature(temperature: number): void {
    this.config.temperature = temperature;
  }

  // ======================== Private Methods ========================

  /**
   * Get default model (first active model for vendor)
   */
  private getDefaultModel(): string {
    const models = this.listAvailableModels();
    const firstModel = models[0];
    if (!firstModel) {
      throw new Error('No STT models available for this provider');
    }
    return firstModel.name;
  }
}
