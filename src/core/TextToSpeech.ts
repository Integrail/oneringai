/**
 * TextToSpeech capability class
 * Provides high-level API for text-to-speech synthesis
 */

import { Connector } from './Connector.js';
import { createTTSProvider } from './createAudioProvider.js';
import type { ITextToSpeechProvider, TTSOptions, TTSResponse } from '../domain/interfaces/IAudioProvider.js';
import type { AudioFormat } from '../domain/types/SharedTypes.js';
import { getTTSModelInfo, getTTSModelsByVendor, type ITTSModelDescription, type IVoiceInfo } from '../domain/entities/TTSModel.js';
import * as fs from 'fs/promises';

/**
 * Configuration for TextToSpeech capability
 */
export interface TextToSpeechConfig {
  /** Connector name or instance */
  connector: string | Connector;

  /** Default model to use */
  model?: string;

  /** Default voice to use */
  voice?: string;

  /** Default audio format */
  format?: AudioFormat;

  /** Default speed (0.25 to 4.0) */
  speed?: number;
}

/**
 * TextToSpeech capability class
 * Provides text-to-speech synthesis with model introspection
 *
 * @example
 * ```typescript
 * const tts = TextToSpeech.create({
 *   connector: 'openai',
 *   model: 'tts-1-hd',
 *   voice: 'nova',
 * });
 *
 * const audio = await tts.synthesize('Hello, world!');
 * await tts.toFile('Hello', './output.mp3');
 * ```
 */
export class TextToSpeech {
  private provider: ITextToSpeechProvider;
  private config: TextToSpeechConfig;

  /**
   * Create a new TextToSpeech instance
   */
  static create(config: TextToSpeechConfig): TextToSpeech {
    return new TextToSpeech(config);
  }

  private constructor(config: TextToSpeechConfig) {
    const connector = typeof config.connector === 'string'
      ? Connector.get(config.connector)
      : config.connector;

    this.provider = createTTSProvider(connector);
    this.config = config;
  }

  // ======================== Synthesis Methods ========================

  /**
   * Synthesize speech from text
   *
   * @param text - Text to synthesize
   * @param options - Optional synthesis parameters
   * @returns Audio data and metadata
   */
  async synthesize(
    text: string,
    options?: Partial<Omit<TTSOptions, 'model' | 'input'>>
  ): Promise<TTSResponse> {
    const fullOptions: TTSOptions = {
      model: this.config.model ?? this.getDefaultModel(),
      input: text,
      voice: options?.voice ?? this.config.voice ?? this.getDefaultVoice(),
      format: options?.format ?? this.config.format,
      speed: options?.speed ?? this.config.speed,
      vendorOptions: options?.vendorOptions,
    };

    return this.provider.synthesize(fullOptions);
  }

  /**
   * Synthesize speech and save to file
   *
   * @param text - Text to synthesize
   * @param filePath - Output file path
   * @param options - Optional synthesis parameters
   */
  async toFile(
    text: string,
    filePath: string,
    options?: Partial<Omit<TTSOptions, 'model' | 'input'>>
  ): Promise<void> {
    const response = await this.synthesize(text, options);
    await fs.writeFile(filePath, response.audio);
  }

  // ======================== Introspection Methods ========================

  /**
   * Get model information for current or specified model
   */
  getModelInfo(model?: string): ITTSModelDescription {
    const targetModel = model ?? this.config.model ?? this.getDefaultModel();
    const info = getTTSModelInfo(targetModel);

    if (!info) {
      throw new Error(`Unknown TTS model: ${targetModel}`);
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
   * List all available voices for current model
   * For dynamic voice providers (e.g., ElevenLabs), fetches from API
   * For static providers (e.g., OpenAI), returns from registry
   */
  async listVoices(model?: string): Promise<IVoiceInfo[]> {
    // Try to fetch from provider API first
    if (this.provider.listVoices) {
      return this.provider.listVoices();
    }

    // Fall back to static list from registry
    const caps = this.getModelCapabilities(model);
    return caps.voices;
  }

  /**
   * List all available models for this provider's vendor
   */
  listAvailableModels(): ITTSModelDescription[] {
    const vendor = this.provider.vendor;
    if (!vendor) {
      return [];
    }
    return getTTSModelsByVendor(vendor as any);
  }

  /**
   * Check if a specific feature is supported by the model
   */
  supportsFeature(
    feature: keyof ITTSModelDescription['capabilities']['features'],
    model?: string
  ): boolean {
    const caps = this.getModelCapabilities(model);
    return Boolean(caps.features[feature]);
  }

  /**
   * Get supported audio formats for the model
   */
  getSupportedFormats(model?: string): readonly AudioFormat[] | AudioFormat[] {
    return this.getModelCapabilities(model).formats;
  }

  /**
   * Get supported languages for the model
   */
  getSupportedLanguages(model?: string): readonly string[] | string[] {
    return this.getModelCapabilities(model).languages;
  }

  /**
   * Check if speed control is supported
   */
  supportsSpeedControl(model?: string): boolean {
    return this.getModelCapabilities(model).speed.supported;
  }

  // ======================== Configuration Methods ========================

  /**
   * Update default model
   */
  setModel(model: string): void {
    this.config.model = model;
  }

  /**
   * Update default voice
   */
  setVoice(voice: string): void {
    this.config.voice = voice;
  }

  /**
   * Update default format
   */
  setFormat(format: AudioFormat): void {
    this.config.format = format;
  }

  /**
   * Update default speed
   */
  setSpeed(speed: number): void {
    this.config.speed = speed;
  }

  // ======================== Private Methods ========================

  /**
   * Get default model (first active model for vendor)
   */
  private getDefaultModel(): string {
    const models = this.listAvailableModels();
    const firstModel = models[0];
    if (!firstModel) {
      throw new Error('No TTS models available for this provider');
    }
    return firstModel.name;
  }

  /**
   * Get default voice (first or default-marked voice)
   */
  private getDefaultVoice(): string {
    const caps = this.getModelInfo().capabilities;
    const defaultVoice = caps.voices.find((v) => v.isDefault);
    return defaultVoice?.id ?? caps.voices[0]?.id ?? 'alloy';
  }
}
