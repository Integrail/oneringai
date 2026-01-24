# Multi-Modal Architecture Design

## Executive Summary

This document proposes a comprehensive architecture for extending `@oneringai/agents` to support multiple modalities beyond text generation: **Image Generation**, **Video Generation**, **Text-to-Speech (TTS)**, and **Speech-to-Text (STT)**.

The design follows Clean Architecture principles, maintains backward compatibility, and leverages existing patterns in the codebase.

---

## Current State Analysis

### What We Already Have

```typescript
// IProvider.ts - Already anticipates multi-modal!
export interface ProviderCapabilities {
  text: boolean;
  images: boolean;   // Already defined
  videos: boolean;   // Already defined
  audio: boolean;    // Already defined
}
```

**Existing Interfaces:**
- `IProvider` - Base interface with capability flags
- `ITextProvider` - Text generation (generate, stream, capabilities)
- `IImageProvider` - Image generation (generateImage, editImage, createVariation)
- `BaseProvider` - Shared configuration
- `BaseTextProvider` - Circuit breaker, logging, metrics

**Existing Patterns:**
1. Interface per capability
2. Base class with shared functionality
3. Factory function for provider creation
4. Connector as single auth source
5. Lazy observability initialization

---

## Architecture Decision: Capability Providers vs. Unified Agent

### Option A: Extend Agent with All Capabilities ❌

```typescript
// NOT RECOMMENDED
class Agent {
  run(input): Promise<TextResponse>;
  generateImage(prompt): Promise<ImageResponse>;
  generateVideo(prompt): Promise<VideoResponse>;
  synthesizeSpeech(text): Promise<AudioResponse>;
  transcribe(audio): Promise<TextResponse>;
}
```

**Problems:**
- Bloated interface - Agent becomes "god class"
- Mixed concerns - not all vendors support all capabilities
- Type complexity - response types vary wildly
- Dependency overhead - imports all SDKs even if unused

### Option B: Separate Capability Classes ✅

```typescript
// RECOMMENDED
const textAgent = Agent.create({ connector, model });
const imageGen = ImageGenerator.create({ connector, model });
const videoGen = VideoGenerator.create({ connector, model });
const tts = TextToSpeech.create({ connector, model });
const stt = SpeechToText.create({ connector, model });
```

**Benefits:**
- Single responsibility - each class does one thing well
- Tree-shakeable - only import what you use
- Vendor-appropriate - easy to check if vendor supports capability
- Simpler types - each class has specific response types
- Testable - mock only what you need

### Option C: Unified MediaProcessor with Method Chaining

```typescript
// ALTERNATIVE - Pipeline approach
const processor = MediaProcessor.create({ connector });

// Image workflow
const result = await processor
  .text("A sunset over mountains")
  .toImage({ model: 'dall-e-3', size: '1024x1024' });

// Audio workflow
const audio = await processor
  .text("Hello, welcome to our app")
  .toSpeech({ voice: 'alloy' });

// Transcription workflow
const text = await processor
  .audio(audioBuffer)
  .toText({ model: 'whisper-1' });
```

This is elegant but adds complexity. **Consider for v2.**

---

## Recommended Architecture

### Core Principle: "Capability Classes"

Each modality gets its own top-level class that follows the Agent pattern:

```
┌─────────────────────────────────────────────────────────┐
│                    User Code                             │
├─────────────┬─────────────┬────────────┬────────────────┤
│   Agent     │ ImageGen    │ VideoGen   │ AudioProcessor │
│  (text)     │ (images)    │ (video)    │ (TTS/STT)      │
├─────────────┴─────────────┴────────────┴────────────────┤
│                Provider Factory Layer                    │
│   createTextProvider  createImageProvider  etc.         │
├─────────────────────────────────────────────────────────┤
│                Interface Layer (Domain)                  │
│   ITextProvider  IImageProvider  IVideoProvider  etc.   │
├─────────────────────────────────────────────────────────┤
│                Base Classes (Infrastructure)             │
│   BaseTextProvider  BaseImageProvider  etc.             │
├─────────────────────────────────────────────────────────┤
│                Vendor Implementations                    │
│   OpenAI  Anthropic  Google  ElevenLabs  etc.           │
└─────────────────────────────────────────────────────────┘
```

---

## Detailed Interface Design

### 1. Extend ProviderCapabilities

```typescript
// src/domain/interfaces/IProvider.ts

export interface ProviderCapabilities {
  // Existing
  text: boolean;
  images: boolean;
  videos: boolean;
  audio: boolean;

  // New - more granular audio capabilities
  textToSpeech?: boolean;
  speechToText?: boolean;

  // New - specific image capabilities
  imageGeneration?: boolean;
  imageEdit?: boolean;
  imageVariation?: boolean;
  imageAnalysis?: boolean;  // Vision (input, not output)

  // New - specific video capabilities
  videoGeneration?: boolean;
  videoAnalysis?: boolean;
}
```

### 2. Audio Interfaces (TTS/STT)

```typescript
// src/domain/interfaces/IAudioProvider.ts

import { IProvider } from './IProvider.js';

// ============ Text-to-Speech ============

export interface TTSOptions {
  model: string;                  // e.g., 'tts-1', 'tts-1-hd'
  input: string;                  // Text to synthesize
  voice: string;                  // e.g., 'alloy', 'echo', 'fable'
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;                 // 0.25 to 4.0
}

export interface TTSResponse {
  audio: Buffer;                  // Audio data
  format: string;                 // Format used
  duration_seconds?: number;      // Duration if known
  characters_used?: number;       // For billing
}

export interface TTSStreamEvent {
  type: 'audio_chunk' | 'complete' | 'error';
  chunk?: Buffer;
  error?: Error;
}

export interface ITextToSpeechProvider extends IProvider {
  /**
   * Synthesize speech from text
   */
  synthesize(options: TTSOptions): Promise<TTSResponse>;

  /**
   * Stream audio chunks in real-time
   */
  synthesizeStream?(options: TTSOptions): AsyncIterableIterator<TTSStreamEvent>;

  /**
   * List available voices
   */
  listVoices?(): Promise<VoiceInfo[]>;

  /**
   * List available models
   */
  listModels?(): Promise<string[]>;
}

export interface VoiceInfo {
  id: string;
  name: string;
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
  preview_url?: string;
}

// ============ Speech-to-Text ============

export interface STTOptions {
  model: string;                  // e.g., 'whisper-1'
  audio: Buffer | string;         // Audio data or file path
  language?: string;              // ISO-639-1 code
  prompt?: string;                // Optional context
  response_format?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
  temperature?: number;
  timestamp_granularities?: Array<'word' | 'segment'>;
}

export interface STTResponse {
  text: string;
  language?: string;
  duration?: number;
  words?: WordTimestamp[];
  segments?: SegmentTimestamp[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface SegmentTimestamp {
  id: number;
  text: string;
  start: number;
  end: number;
  tokens?: number[];
}

export interface ISpeechToTextProvider extends IProvider {
  /**
   * Transcribe audio to text
   */
  transcribe(options: STTOptions): Promise<STTResponse>;

  /**
   * Translate audio to English text
   */
  translate?(options: STTOptions): Promise<STTResponse>;

  /**
   * List available models
   */
  listModels?(): Promise<string[]>;
}
```

### 3. Video Interfaces

```typescript
// src/domain/interfaces/IVideoProvider.ts

import { IProvider } from './IProvider.js';

export interface VideoGenerateOptions {
  model: string;                  // e.g., 'veo-2', 'runway-gen3'
  prompt: string;
  duration?: number;              // Seconds
  resolution?: '720p' | '1080p' | '4k';
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  fps?: number;
  style?: string;
  negative_prompt?: string;
  seed?: number;

  // Image-to-video
  image?: Buffer | string;

  // Video-to-video (editing)
  source_video?: Buffer | string;

  // Audio
  audio?: Buffer | string;
}

export interface VideoResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  video_data?: Buffer;
  thumbnail_url?: string;
  duration_seconds?: number;
  resolution?: string;
  created_at: number;
  error?: string;
}

export interface VideoProgressEvent {
  type: 'queued' | 'processing' | 'progress' | 'completed' | 'failed';
  progress?: number;              // 0-100
  estimated_time_remaining?: number;
  video?: VideoResponse;
  error?: Error;
}

export interface IVideoProvider extends IProvider {
  /**
   * Generate video from prompt (async - may take minutes)
   */
  generateVideo(options: VideoGenerateOptions): Promise<VideoResponse>;

  /**
   * Generate video with progress updates
   */
  generateVideoWithProgress?(
    options: VideoGenerateOptions
  ): AsyncIterableIterator<VideoProgressEvent>;

  /**
   * Check status of video generation
   */
  getVideoStatus?(id: string): Promise<VideoResponse>;

  /**
   * Cancel video generation
   */
  cancelVideo?(id: string): Promise<void>;

  /**
   * List available models
   */
  listModels?(): Promise<string[]>;
}
```

### 4. Enhanced Image Interface

```typescript
// src/domain/interfaces/IImageProvider.ts (extended)

// Keep existing interface, add:

export interface ImageAnalyzeOptions {
  model: string;
  image: Buffer | string;         // Image to analyze
  prompt?: string;                // What to look for
  detail?: 'auto' | 'low' | 'high';
}

export interface ImageAnalysisResponse {
  description: string;
  labels?: string[];
  objects?: DetectedObject[];
  text?: ExtractedText[];
  colors?: DominantColor[];
  faces?: DetectedFace[];
  nsfw_score?: number;
}

// Add to IImageProvider:
export interface IImageProvider extends IProvider {
  // ... existing methods ...

  /**
   * Analyze image content (optional - uses vision models)
   */
  analyzeImage?(options: ImageAnalyzeOptions): Promise<ImageAnalysisResponse>;
}
```

---

## Capability Classes (Public API)

### 1. ImageGenerator

```typescript
// src/core/ImageGenerator.ts

import { Connector } from './Connector.js';
import { createImageProvider } from './createImageProvider.js';
import { IImageProvider, ImageGenerateOptions, ImageResponse } from '../domain/interfaces/IImageProvider.js';

export interface ImageGeneratorConfig {
  connector: string | Connector;
  model?: string;                 // Default model
}

export class ImageGenerator {
  private provider: IImageProvider;
  private defaultModel?: string;

  static create(config: ImageGeneratorConfig): ImageGenerator {
    return new ImageGenerator(config);
  }

  private constructor(config: ImageGeneratorConfig) {
    const connector = typeof config.connector === 'string'
      ? Connector.get(config.connector)
      : config.connector;

    this.provider = createImageProvider(connector);
    this.defaultModel = config.model;
  }

  /**
   * Generate image from text prompt
   */
  async generate(
    prompt: string,
    options?: Partial<ImageGenerateOptions>
  ): Promise<ImageResponse> {
    return this.provider.generateImage({
      model: options?.model || this.defaultModel || this.getDefaultModel(),
      prompt,
      ...options,
    });
  }

  /**
   * Edit an existing image
   */
  async edit(
    image: Buffer | string,
    prompt: string,
    options?: Partial<ImageEditOptions>
  ): Promise<ImageResponse> {
    if (!this.provider.editImage) {
      throw new Error('Image editing not supported by this provider');
    }
    return this.provider.editImage({
      model: options?.model || this.defaultModel || this.getDefaultModel(),
      image,
      prompt,
      ...options,
    });
  }

  /**
   * Create variations of an image
   */
  async createVariation(
    image: Buffer | string,
    options?: Partial<ImageVariationOptions>
  ): Promise<ImageResponse> {
    if (!this.provider.createVariation) {
      throw new Error('Image variations not supported by this provider');
    }
    return this.provider.createVariation({
      model: options?.model || this.defaultModel || this.getDefaultModel(),
      image,
      ...options,
    });
  }

  private getDefaultModel(): string {
    // Provider-specific defaults
    return 'dall-e-3';
  }
}
```

### 2. TextToSpeech

```typescript
// src/core/TextToSpeech.ts

export interface TextToSpeechConfig {
  connector: string | Connector;
  model?: string;
  voice?: string;
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav';
}

export class TextToSpeech {
  private provider: ITextToSpeechProvider;
  private defaults: Partial<TTSOptions>;

  static create(config: TextToSpeechConfig): TextToSpeech {
    return new TextToSpeech(config);
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(
    text: string,
    options?: Partial<TTSOptions>
  ): Promise<TTSResponse> {
    return this.provider.synthesize({
      model: options?.model || this.defaults.model || 'tts-1',
      voice: options?.voice || this.defaults.voice || 'alloy',
      input: text,
      response_format: options?.response_format || this.defaults.response_format,
      speed: options?.speed,
    });
  }

  /**
   * Stream audio chunks
   */
  async *stream(
    text: string,
    options?: Partial<TTSOptions>
  ): AsyncIterableIterator<Buffer> {
    if (!this.provider.synthesizeStream) {
      // Fallback: yield entire buffer at once
      const response = await this.synthesize(text, options);
      yield response.audio;
      return;
    }

    for await (const event of this.provider.synthesizeStream({
      model: options?.model || this.defaults.model || 'tts-1',
      voice: options?.voice || this.defaults.voice || 'alloy',
      input: text,
      ...options,
    })) {
      if (event.type === 'audio_chunk' && event.chunk) {
        yield event.chunk;
      } else if (event.type === 'error') {
        throw event.error;
      }
    }
  }

  /**
   * Save audio to file
   */
  async toFile(
    text: string,
    filePath: string,
    options?: Partial<TTSOptions>
  ): Promise<void> {
    const response = await this.synthesize(text, options);
    await fs.writeFile(filePath, response.audio);
  }

  /**
   * List available voices
   */
  async listVoices(): Promise<VoiceInfo[]> {
    if (!this.provider.listVoices) {
      return [];
    }
    return this.provider.listVoices();
  }
}
```

### 3. SpeechToText

```typescript
// src/core/SpeechToText.ts

export interface SpeechToTextConfig {
  connector: string | Connector;
  model?: string;
  language?: string;
}

export class SpeechToText {
  private provider: ISpeechToTextProvider;
  private defaults: Partial<STTOptions>;

  static create(config: SpeechToTextConfig): SpeechToText {
    return new SpeechToText(config);
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(
    audio: Buffer | string,
    options?: Partial<STTOptions>
  ): Promise<STTResponse> {
    return this.provider.transcribe({
      model: options?.model || this.defaults.model || 'whisper-1',
      audio,
      language: options?.language || this.defaults.language,
      ...options,
    });
  }

  /**
   * Transcribe file
   */
  async transcribeFile(
    filePath: string,
    options?: Partial<STTOptions>
  ): Promise<STTResponse> {
    const audio = await fs.readFile(filePath);
    return this.transcribe(audio, options);
  }

  /**
   * Translate audio to English
   */
  async translate(
    audio: Buffer | string,
    options?: Partial<STTOptions>
  ): Promise<STTResponse> {
    if (!this.provider.translate) {
      throw new Error('Translation not supported by this provider');
    }
    return this.provider.translate({
      model: options?.model || this.defaults.model || 'whisper-1',
      audio,
      ...options,
    });
  }

  /**
   * Get transcription with timestamps
   */
  async transcribeWithTimestamps(
    audio: Buffer | string,
    granularity: 'word' | 'segment' = 'segment'
  ): Promise<STTResponse> {
    return this.transcribe(audio, {
      response_format: 'verbose_json',
      timestamp_granularities: [granularity],
    });
  }
}
```

### 4. VideoGenerator

```typescript
// src/core/VideoGenerator.ts

export interface VideoGeneratorConfig {
  connector: string | Connector;
  model?: string;
}

export class VideoGenerator {
  private provider: IVideoProvider;
  private defaultModel?: string;

  static create(config: VideoGeneratorConfig): VideoGenerator {
    return new VideoGenerator(config);
  }

  /**
   * Generate video from prompt
   * Note: This is async and may take several minutes
   */
  async generate(
    prompt: string,
    options?: Partial<VideoGenerateOptions>
  ): Promise<VideoResponse> {
    return this.provider.generateVideo({
      model: options?.model || this.defaultModel || this.getDefaultModel(),
      prompt,
      ...options,
    });
  }

  /**
   * Generate video with progress updates
   */
  async *generateWithProgress(
    prompt: string,
    options?: Partial<VideoGenerateOptions>
  ): AsyncIterableIterator<VideoProgressEvent> {
    if (!this.provider.generateVideoWithProgress) {
      // Fallback: poll status
      const response = await this.generate(prompt, options);
      yield { type: 'queued' };

      while (response.status === 'pending' || response.status === 'processing') {
        await sleep(5000); // Poll every 5 seconds
        const status = await this.getStatus(response.id);
        yield {
          type: status.status === 'completed' ? 'completed' : 'processing',
          video: status,
        };
        if (status.status === 'completed' || status.status === 'failed') {
          break;
        }
      }
      return;
    }

    yield* this.provider.generateVideoWithProgress({
      model: options?.model || this.defaultModel || this.getDefaultModel(),
      prompt,
      ...options,
    });
  }

  /**
   * Generate video from image
   */
  async fromImage(
    image: Buffer | string,
    prompt: string,
    options?: Partial<VideoGenerateOptions>
  ): Promise<VideoResponse> {
    return this.generate(prompt, { ...options, image });
  }

  /**
   * Check generation status
   */
  async getStatus(id: string): Promise<VideoResponse> {
    if (!this.provider.getVideoStatus) {
      throw new Error('Status checking not supported');
    }
    return this.provider.getVideoStatus(id);
  }

  /**
   * Cancel generation
   */
  async cancel(id: string): Promise<void> {
    if (!this.provider.cancelVideo) {
      throw new Error('Cancellation not supported');
    }
    return this.provider.cancelVideo(id);
  }
}
```

---

## Vendor Capability Matrix

```typescript
// src/core/VendorCapabilities.ts

export const VENDOR_CAPABILITIES: Record<Vendor, ProviderCapabilities> = {
  [Vendor.OpenAI]: {
    text: true,
    images: true,
    videos: false,          // Not yet, but Sora coming
    audio: true,
    textToSpeech: true,     // TTS-1, TTS-1-HD
    speechToText: true,     // Whisper
    imageGeneration: true,  // DALL-E 3
    imageEdit: true,        // DALL-E 2
    imageVariation: true,   // DALL-E 2
    imageAnalysis: true,    // GPT-4V
  },

  [Vendor.Anthropic]: {
    text: true,
    images: false,          // No image generation
    videos: false,
    audio: false,
    textToSpeech: false,
    speechToText: false,
    imageGeneration: false,
    imageAnalysis: true,    // Claude vision
  },

  [Vendor.Google]: {
    text: true,
    images: true,
    videos: true,           // Veo
    audio: true,
    textToSpeech: true,     // Cloud TTS
    speechToText: true,     // Cloud STT
    imageGeneration: true,  // Imagen 3
    imageEdit: true,
    imageAnalysis: true,    // Gemini vision
    videoGeneration: true,  // Veo 2
  },

  [Vendor.GoogleVertex]: {
    text: true,
    images: true,
    videos: true,
    audio: true,
    textToSpeech: true,
    speechToText: true,
    imageGeneration: true,
    videoGeneration: true,
  },

  // Others...
  [Vendor.Groq]: {
    text: true,
    images: false,
    videos: false,
    audio: true,
    speechToText: true,     // Whisper on Groq
  },

  // ... etc
};

/**
 * Check if a vendor supports a capability
 */
export function vendorSupports(
  vendor: Vendor,
  capability: keyof ProviderCapabilities
): boolean {
  const caps = VENDOR_CAPABILITIES[vendor];
  return caps?.[capability] ?? false;
}

/**
 * Get all vendors that support a capability
 */
export function vendorsWithCapability(
  capability: keyof ProviderCapabilities
): Vendor[] {
  return Object.entries(VENDOR_CAPABILITIES)
    .filter(([_, caps]) => caps[capability])
    .map(([vendor]) => vendor as Vendor);
}
```

---

## Factory Functions

```typescript
// src/core/createImageProvider.ts

export function createImageProvider(connector: Connector): IImageProvider {
  const vendor = connector.vendor;

  if (!vendorSupports(vendor, 'imageGeneration')) {
    throw new Error(
      `Vendor '${vendor}' does not support image generation. ` +
      `Supported vendors: ${vendorsWithCapability('imageGeneration').join(', ')}`
    );
  }

  const config = extractProviderConfig(connector);

  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAIImageProvider(config);
    case Vendor.Google:
      return new GoogleImageProvider(config);
    // ... etc
    default:
      throw new Error(`No image provider for vendor: ${vendor}`);
  }
}

// Similar for other capabilities:
// createTextToSpeechProvider()
// createSpeechToTextProvider()
// createVideoProvider()
```

---

## Usage Examples

### Text-to-Speech

```typescript
import { Connector, TextToSpeech, Vendor } from '@oneringai/agents';

Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'tts-1-hd',
  voice: 'nova',
});

// Simple synthesis
const audio = await tts.synthesize('Hello, welcome to our application!');
console.log(`Generated ${audio.audio.length} bytes of audio`);

// Save to file
await tts.toFile(
  'This is a longer text that will be converted to speech.',
  './output.mp3'
);

// Stream (for real-time playback)
for await (const chunk of tts.stream('Streaming audio in real-time...')) {
  // Send chunk to audio player
  audioPlayer.enqueue(chunk);
}
```

### Speech-to-Text

```typescript
import { Connector, SpeechToText, Vendor } from '@oneringai/agents';

const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',
});

// Transcribe file
const result = await stt.transcribeFile('./recording.mp3');
console.log(result.text);

// Transcribe with timestamps
const detailed = await stt.transcribeWithTimestamps(audioBuffer, 'word');
for (const word of detailed.words!) {
  console.log(`${word.word} [${word.start}s - ${word.end}s]`);
}

// Translate to English
const translated = await stt.translate(foreignAudio);
console.log(translated.text);
```

### Image Generation

```typescript
import { Connector, ImageGenerator, Vendor } from '@oneringai/agents';

const imageGen = ImageGenerator.create({
  connector: 'openai',
  model: 'dall-e-3',
});

// Generate image
const image = await imageGen.generate(
  'A serene Japanese garden with a koi pond at sunset',
  { size: '1792x1024', quality: 'hd', style: 'natural' }
);
console.log(image.data[0].url);

// Edit existing image
const edited = await imageGen.edit(
  './original.png',
  'Add a red bird sitting on the branch',
  { mask: './mask.png' }
);
```

### Video Generation

```typescript
import { Connector, VideoGenerator, Vendor } from '@oneringai/agents';

Connector.create({
  name: 'google',
  vendor: Vendor.Google,
  auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY! },
});

const videoGen = VideoGenerator.create({
  connector: 'google',
  model: 'veo-2',
});

// Generate with progress
for await (const event of videoGen.generateWithProgress(
  'A drone flying over a mountain range at golden hour',
  { duration: 10, resolution: '1080p' }
)) {
  switch (event.type) {
    case 'queued':
      console.log('Video queued for processing...');
      break;
    case 'processing':
      console.log(`Progress: ${event.progress}%`);
      break;
    case 'completed':
      console.log(`Video ready: ${event.video!.video_url}`);
      break;
    case 'failed':
      console.error(`Failed: ${event.error}`);
      break;
  }
}
```

### Multi-Modal Pipeline (Future)

```typescript
// Combine capabilities
const stt = SpeechToText.create({ connector: 'openai' });
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
const tts = TextToSpeech.create({ connector: 'openai' });

// Voice assistant pipeline
const transcription = await stt.transcribe(userAudio);
const response = await agent.run(transcription.text);
const audio = await tts.synthesize(response.output_text);
```

---

## File Structure

```
src/
├── core/
│   ├── index.ts                    # Exports all
│   ├── Vendor.ts                   # (existing)
│   ├── Connector.ts                # (existing)
│   ├── Agent.ts                    # (existing - text only)
│   │
│   │ # NEW CAPABILITY CLASSES
│   ├── ImageGenerator.ts           # Image generation
│   ├── VideoGenerator.ts           # Video generation
│   ├── TextToSpeech.ts             # TTS
│   ├── SpeechToText.ts             # STT
│   │
│   │ # NEW FACTORIES
│   ├── createProvider.ts           # (existing - text)
│   ├── createImageProvider.ts      # Image provider factory
│   ├── createVideoProvider.ts      # Video provider factory
│   ├── createAudioProvider.ts      # TTS/STT provider factory
│   │
│   └── VendorCapabilities.ts       # Capability matrix
│
├── domain/
│   └── interfaces/
│       ├── IProvider.ts            # (extend capabilities)
│       ├── ITextProvider.ts        # (existing)
│       ├── IImageProvider.ts       # (existing, extend)
│       ├── IAudioProvider.ts       # NEW: TTS + STT
│       └── IVideoProvider.ts       # NEW: Video generation
│
├── infrastructure/
│   └── providers/
│       ├── openai/
│       │   ├── OpenAITextProvider.ts     # (existing)
│       │   ├── OpenAIImageProvider.ts    # NEW
│       │   ├── OpenAITTSProvider.ts      # NEW
│       │   └── OpenAISTTProvider.ts      # NEW
│       ├── google/
│       │   ├── GoogleTextProvider.ts     # (existing)
│       │   ├── GoogleImageProvider.ts    # NEW (Imagen)
│       │   ├── GoogleVideoProvider.ts    # NEW (Veo)
│       │   ├── GoogleTTSProvider.ts      # NEW
│       │   └── GoogleSTTProvider.ts      # NEW
│       ├── elevenlabs/                   # NEW - audio specialist
│       │   └── ElevenLabsTTSProvider.ts
│       └── base/
│           ├── BaseTextProvider.ts       # (existing)
│           ├── BaseImageProvider.ts      # NEW
│           ├── BaseAudioProvider.ts      # NEW
│           └── BaseVideoProvider.ts      # NEW
│
└── index.ts                        # Add new exports
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Extend `ProviderCapabilities` interface
- [ ] Create `VendorCapabilities` matrix
- [ ] Create `IAudioProvider` interface (TTS + STT)
- [ ] Create `IVideoProvider` interface
- [ ] Create base classes

### Phase 2: OpenAI Audio (Week 2)
- [ ] Implement `OpenAITTSProvider`
- [ ] Implement `OpenAISTTProvider`
- [ ] Create `TextToSpeech` capability class
- [ ] Create `SpeechToText` capability class
- [ ] Add tests

### Phase 3: OpenAI Images (Week 3)
- [ ] Implement `OpenAIImageProvider`
- [ ] Create `ImageGenerator` capability class
- [ ] Add tests

### Phase 4: Google Multi-Modal (Week 4)
- [ ] Implement `GoogleImageProvider` (Imagen)
- [ ] Implement `GoogleTTSProvider`
- [ ] Implement `GoogleSTTProvider`
- [ ] Implement `GoogleVideoProvider` (Veo)
- [ ] Create `VideoGenerator` capability class
- [ ] Add tests

### Phase 5: Specialty Providers (Week 5)
- [ ] ElevenLabs TTS
- [ ] AssemblyAI STT
- [ ] Stability AI images
- [ ] Runway video

### Phase 6: Polish (Week 6)
- [ ] Documentation
- [ ] Examples
- [ ] Performance optimization
- [ ] Error handling refinement

---

## Key Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent extension vs separate classes | Separate classes | SRP, tree-shaking, cleaner types |
| One interface per capability | Yes | Type safety, optional methods |
| Capability checking | Static matrix + runtime | Fast lookups, graceful errors |
| Base classes | Yes, per capability | Shared observability, DRY |
| Factory functions | One per capability | Clear, testable |
| Streaming support | AsyncIterator | Consistent with text |
| Progress events | For long operations | Video gen can take minutes |

---

## Multi-Modal Model Registries

### Design Philosophy

Following the existing `MODEL_REGISTRY` pattern in `src/domain/entities/Model.ts`, we create **separate registry files** for each modality. This ensures:

1. **Clear separation** - Each modality is independently maintainable
2. **Consistent patterns** - Same interface structure as LLM registry
3. **Source tracking** - Documentation links for keeping data current
4. **Type safety** - Strong typing for capabilities per modality

### File Structure for Registries

```
src/domain/entities/
├── Model.ts                    # LLM models (existing)
├── ImageModel.ts               # Image generation models (NEW)
├── TTSModel.ts                 # Text-to-speech models (NEW)
├── STTModel.ts                 # Speech-to-text models (NEW)
├── VideoModel.ts               # Video generation models (NEW)
└── index.ts                    # Re-exports all registries
```

---

### 1. Image Model Registry (`ImageModel.ts`)

```typescript
// src/domain/entities/ImageModel.ts

import { Vendor } from '../../core/Vendor.js';
import type { Vendor as VendorType } from '../../core/Vendor.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Semantic aspect ratios supported across vendors
 */
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '3:2' | '2:3';

/**
 * Semantic quality levels
 */
export type ImageQuality = 'draft' | 'standard' | 'high' | 'ultra';

/**
 * Semantic image styles
 */
export type ImageStyle =
  | 'natural'
  | 'artistic'
  | 'photographic'
  | 'cinematic'
  | 'anime'
  | '3d-render'
  | 'digital-art'
  | 'watercolor'
  | 'oil-painting';

/**
 * Image output format
 */
export type ImageOutputFormat = 'url' | 'base64' | 'buffer';

/**
 * Complete description of an image generation model
 */
export interface IImageModelDescription {
  /** Model identifier (e.g., "dall-e-3") */
  name: string;

  /** Display name for UI */
  displayName: string;

  /** Vendor/provider */
  provider: VendorType;

  /** Model description */
  description?: string;

  /** Whether the model is currently available */
  isActive: boolean;

  /** Release date (YYYY-MM-DD) */
  releaseDate?: string;

  /** Deprecation date if scheduled */
  deprecationDate?: string;

  /** Documentation/pricing links for maintenance */
  sources: {
    /** Official documentation URL */
    documentation: string;
    /** Pricing page URL */
    pricing?: string;
    /** API reference URL */
    apiReference?: string;
    /** Last verified date (YYYY-MM-DD) */
    lastVerified: string;
  };

  /** Model capabilities */
  capabilities: {
    /** Supported aspect ratios */
    aspectRatios: AspectRatio[];

    /** Supported quality levels */
    qualities: ImageQuality[];

    /** Supported styles (empty if not applicable) */
    styles: ImageStyle[];

    /** Maximum images per request */
    maxImagesPerRequest: number;

    /** Maximum prompt length in characters */
    maxPromptLength?: number;

    /** Feature support flags */
    features: {
      negativePrompt: boolean;
      seed: boolean;
      edit: boolean;
      variation: boolean;
      inpainting: boolean;
      outpainting: boolean;
      upscaling: boolean;
    };

    /** Size constraints for vendors using pixel dimensions */
    sizeConstraints?: {
      minWidth: number;
      maxWidth: number;
      minHeight: number;
      maxHeight: number;
      stepSize?: number;  // Must be multiple of
    };

    /** Vendor-specific options schema */
    vendorOptions?: Record<string, VendorOptionSchema>;
  };

  /** Pricing information */
  pricing?: {
    /** Price per image at standard quality/size */
    perImage?: number;
    /** Price per megapixel (for variable pricing) */
    perMegapixel?: number;
    /** Price tiers by quality/size */
    tiers?: Array<{
      quality: ImageQuality;
      size: string;
      price: number;
    }>;
    currency: 'USD';
  };
}

/**
 * Schema for vendor-specific options (for validation/documentation)
 */
export interface VendorOptionSchema {
  type: 'string' | 'number' | 'boolean' | 'enum';
  description: string;
  required?: boolean;
  enum?: string[];
  min?: number;
  max?: number;
  default?: unknown;
}

// ============================================================================
// Model Name Constants
// ============================================================================

/**
 * Image model name constants organized by vendor
 */
export const IMAGE_MODELS = {
  [Vendor.OpenAI]: {
    DALL_E_3: 'dall-e-3',
    DALL_E_2: 'dall-e-2',
  },
  [Vendor.Google]: {
    IMAGEN_3: 'imagen-3',
    IMAGEN_3_FAST: 'imagen-3-fast',
  },
  [Vendor.Custom]: {
    // Stability AI (via API)
    STABLE_DIFFUSION_3_5_LARGE: 'stable-diffusion-3.5-large',
    STABLE_DIFFUSION_3_5_MEDIUM: 'stable-diffusion-3.5-medium',
    STABLE_DIFFUSION_3_5_LARGE_TURBO: 'stable-diffusion-3.5-large-turbo',
    // Flux (via Replicate/Together)
    FLUX_1_1_PRO: 'flux-1.1-pro',
    FLUX_1_1_PRO_ULTRA: 'flux-1.1-pro-ultra',
    FLUX_1_SCHNELL: 'flux-1-schnell',
  },
} as const;

// ============================================================================
// Model Registry
// ============================================================================

/**
 * Complete image model registry
 *
 * Maintenance: Update lastVerified when checking vendor documentation
 * @see Individual model sources for latest information
 *
 * Last full audit: January 2026
 */
export const IMAGE_MODEL_REGISTRY: Record<string, IImageModelDescription> = {
  // ==========================================================================
  // OpenAI Models
  // Source: https://platform.openai.com/docs/guides/images
  // ==========================================================================

  'dall-e-3': {
    name: 'dall-e-3',
    displayName: 'DALL-E 3',
    provider: Vendor.OpenAI,
    description: 'Latest OpenAI image model with excellent prompt following and text rendering',
    isActive: true,
    releaseDate: '2023-11-06',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/images',
      pricing: 'https://openai.com/pricing',
      apiReference: 'https://platform.openai.com/docs/api-reference/images/create',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16'],
      qualities: ['standard', 'high'],
      styles: ['natural', 'artistic'],
      maxImagesPerRequest: 1,
      maxPromptLength: 4000,
      features: {
        negativePrompt: false,
        seed: false,
        edit: false,
        variation: false,
        inpainting: false,
        outpainting: false,
        upscaling: false,
      },
    },
    pricing: {
      tiers: [
        { quality: 'standard', size: '1024x1024', price: 0.040 },
        { quality: 'standard', size: '1024x1792', price: 0.080 },
        { quality: 'standard', size: '1792x1024', price: 0.080 },
        { quality: 'high', size: '1024x1024', price: 0.080 },
        { quality: 'high', size: '1024x1792', price: 0.120 },
        { quality: 'high', size: '1792x1024', price: 0.120 },
      ],
      currency: 'USD',
    },
  },

  'dall-e-2': {
    name: 'dall-e-2',
    displayName: 'DALL-E 2',
    provider: Vendor.OpenAI,
    description: 'Previous generation with edit, variation, and inpainting support',
    isActive: true,
    releaseDate: '2022-04-06',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/images',
      pricing: 'https://openai.com/pricing',
      apiReference: 'https://platform.openai.com/docs/api-reference/images',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['1:1'],
      qualities: ['standard'],
      styles: [],
      maxImagesPerRequest: 10,
      features: {
        negativePrompt: false,
        seed: false,
        edit: true,
        variation: true,
        inpainting: true,
        outpainting: false,
        upscaling: false,
      },
      sizeConstraints: {
        minWidth: 256,
        maxWidth: 1024,
        minHeight: 256,
        maxHeight: 1024,
      },
    },
    pricing: {
      tiers: [
        { quality: 'standard', size: '256x256', price: 0.016 },
        { quality: 'standard', size: '512x512', price: 0.018 },
        { quality: 'standard', size: '1024x1024', price: 0.020 },
      ],
      currency: 'USD',
    },
  },

  // ==========================================================================
  // Google Models
  // Source: https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview
  // ==========================================================================

  'imagen-3': {
    name: 'imagen-3',
    displayName: 'Imagen 3',
    provider: Vendor.Google,
    description: 'Google\'s highest quality image generation model',
    isActive: true,
    releaseDate: '2024-08-01',
    sources: {
      documentation: 'https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview',
      pricing: 'https://cloud.google.com/vertex-ai/generative-ai/pricing',
      apiReference: 'https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
      qualities: ['standard', 'high'],
      styles: ['natural', 'photographic', 'artistic'],
      maxImagesPerRequest: 4,
      features: {
        negativePrompt: true,
        seed: true,
        edit: true,
        variation: false,
        inpainting: true,
        outpainting: true,
        upscaling: true,
      },
      vendorOptions: {
        personGeneration: {
          type: 'enum',
          description: 'Control generation of people in images',
          enum: ['dont_allow', 'allow_adult', 'allow_all'],
          default: 'allow_adult',
        },
        safetyFilterLevel: {
          type: 'enum',
          description: 'Safety filter strictness',
          enum: ['block_low_and_above', 'block_medium_and_above', 'block_only_high'],
          default: 'block_medium_and_above',
        },
        addWatermark: {
          type: 'boolean',
          description: 'Add SynthID watermark',
          default: true,
        },
      },
    },
    pricing: {
      perImage: 0.040,  // Standard quality
      currency: 'USD',
    },
  },

  'imagen-3-fast': {
    name: 'imagen-3-fast',
    displayName: 'Imagen 3 Fast',
    provider: Vendor.Google,
    description: 'Faster, lower-cost variant of Imagen 3',
    isActive: true,
    releaseDate: '2024-08-01',
    sources: {
      documentation: 'https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview',
      pricing: 'https://cloud.google.com/vertex-ai/generative-ai/pricing',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      qualities: ['standard'],
      styles: ['natural', 'photographic'],
      maxImagesPerRequest: 4,
      features: {
        negativePrompt: true,
        seed: true,
        edit: false,
        variation: false,
        inpainting: false,
        outpainting: false,
        upscaling: false,
      },
      vendorOptions: {
        personGeneration: {
          type: 'enum',
          description: 'Control generation of people in images',
          enum: ['dont_allow', 'allow_adult', 'allow_all'],
          default: 'allow_adult',
        },
      },
    },
    pricing: {
      perImage: 0.020,
      currency: 'USD',
    },
  },

  // ==========================================================================
  // Stability AI Models (via API)
  // Source: https://platform.stability.ai/docs/api-reference
  // ==========================================================================

  'stable-diffusion-3.5-large': {
    name: 'stable-diffusion-3.5-large',
    displayName: 'Stable Diffusion 3.5 Large',
    provider: Vendor.Custom,
    description: 'Stability AI\'s most capable model with excellent prompt adherence',
    isActive: true,
    releaseDate: '2024-10-22',
    sources: {
      documentation: 'https://platform.stability.ai/docs/api-reference#tag/Generate/paths/~1v2beta~1stable-image~1generate~1sd3/post',
      pricing: 'https://platform.stability.ai/pricing',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '3:2', '2:3'],
      qualities: ['draft', 'standard', 'high'],
      styles: ['natural', 'artistic', 'photographic', 'cinematic', 'anime', '3d-render', 'digital-art'],
      maxImagesPerRequest: 1,
      features: {
        negativePrompt: true,
        seed: true,
        edit: false,
        variation: false,
        inpainting: true,
        outpainting: true,
        upscaling: true,
      },
      sizeConstraints: {
        minWidth: 512,
        maxWidth: 2048,
        minHeight: 512,
        maxHeight: 2048,
        stepSize: 64,
      },
      vendorOptions: {
        cfg_scale: {
          type: 'number',
          description: 'Classifier-free guidance scale (how closely to follow prompt)',
          min: 1,
          max: 10,
          default: 5,
        },
        steps: {
          type: 'number',
          description: 'Number of diffusion steps',
          min: 1,
          max: 50,
          default: 40,
        },
      },
    },
    pricing: {
      perImage: 0.065,  // Per image at default resolution
      perMegapixel: 0.065,
      currency: 'USD',
    },
  },

  'stable-diffusion-3.5-large-turbo': {
    name: 'stable-diffusion-3.5-large-turbo',
    displayName: 'Stable Diffusion 3.5 Large Turbo',
    provider: Vendor.Custom,
    description: 'Faster variant optimized for speed with 4-step generation',
    isActive: true,
    releaseDate: '2024-10-22',
    sources: {
      documentation: 'https://platform.stability.ai/docs/api-reference',
      pricing: 'https://platform.stability.ai/pricing',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
      qualities: ['standard'],
      styles: ['natural', 'artistic', 'photographic', 'cinematic', 'anime'],
      maxImagesPerRequest: 1,
      features: {
        negativePrompt: true,
        seed: true,
        edit: false,
        variation: false,
        inpainting: false,
        outpainting: false,
        upscaling: false,
      },
      sizeConstraints: {
        minWidth: 512,
        maxWidth: 2048,
        minHeight: 512,
        maxHeight: 2048,
        stepSize: 64,
      },
    },
    pricing: {
      perImage: 0.040,
      currency: 'USD',
    },
  },

  // ==========================================================================
  // Flux Models (via Replicate/Together/BFL)
  // Source: https://docs.bfl.ml/
  // ==========================================================================

  'flux-1.1-pro': {
    name: 'flux-1.1-pro',
    displayName: 'FLUX 1.1 Pro',
    provider: Vendor.Custom,
    description: 'Black Forest Labs flagship model with excellent quality and speed',
    isActive: true,
    releaseDate: '2024-10-01',
    sources: {
      documentation: 'https://docs.bfl.ml/',
      pricing: 'https://docs.bfl.ml/#pricing',
      apiReference: 'https://api.bfl.ml/docs',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
      qualities: ['standard', 'high'],
      styles: ['natural', 'artistic', 'photographic', 'cinematic'],
      maxImagesPerRequest: 1,
      features: {
        negativePrompt: false,
        seed: true,
        edit: false,
        variation: false,
        inpainting: false,
        outpainting: false,
        upscaling: false,
      },
      sizeConstraints: {
        minWidth: 256,
        maxWidth: 1440,
        minHeight: 256,
        maxHeight: 1440,
      },
      vendorOptions: {
        guidance: {
          type: 'number',
          description: 'Guidance scale for generation',
          min: 1.5,
          max: 5,
          default: 3,
        },
        safety_tolerance: {
          type: 'number',
          description: 'Safety filter tolerance (0-6, higher = more permissive)',
          min: 0,
          max: 6,
          default: 2,
        },
      },
    },
    pricing: {
      perImage: 0.040,
      currency: 'USD',
    },
  },

  'flux-1.1-pro-ultra': {
    name: 'flux-1.1-pro-ultra',
    displayName: 'FLUX 1.1 Pro Ultra',
    provider: Vendor.Custom,
    description: 'Highest resolution Flux model with up to 4MP output',
    isActive: true,
    releaseDate: '2024-11-06',
    sources: {
      documentation: 'https://docs.bfl.ml/',
      pricing: 'https://docs.bfl.ml/#pricing',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
      qualities: ['high', 'ultra'],
      styles: ['natural', 'artistic', 'photographic', 'cinematic'],
      maxImagesPerRequest: 1,
      features: {
        negativePrompt: false,
        seed: true,
        edit: false,
        variation: false,
        inpainting: false,
        outpainting: false,
        upscaling: true,
      },
      sizeConstraints: {
        minWidth: 256,
        maxWidth: 2048,
        minHeight: 256,
        maxHeight: 2048,
      },
    },
    pricing: {
      perImage: 0.060,
      currency: 'USD',
    },
  },

  'flux-1-schnell': {
    name: 'flux-1-schnell',
    displayName: 'FLUX.1 Schnell',
    provider: Vendor.Custom,
    description: 'Fast, open-weights Flux model optimized for speed (Apache 2.0 license)',
    isActive: true,
    releaseDate: '2024-08-01',
    sources: {
      documentation: 'https://docs.bfl.ml/',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      qualities: ['standard'],
      styles: ['natural', 'artistic'],
      maxImagesPerRequest: 1,
      features: {
        negativePrompt: false,
        seed: true,
        edit: false,
        variation: false,
        inpainting: false,
        outpainting: false,
        upscaling: false,
      },
    },
    pricing: {
      perImage: 0.003,  // Very cheap, can self-host
      currency: 'USD',
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get image model information by name
 */
export function getImageModelInfo(modelName: string): IImageModelDescription | undefined {
  return IMAGE_MODEL_REGISTRY[modelName];
}

/**
 * Get image model capabilities by name
 */
export function getImageModelCapabilities(modelName: string): IImageModelDescription['capabilities'] | undefined {
  return IMAGE_MODEL_REGISTRY[modelName]?.capabilities;
}

/**
 * Get all image models for a specific vendor
 */
export function getImageModelsByVendor(vendor: VendorType): IImageModelDescription[] {
  return Object.values(IMAGE_MODEL_REGISTRY).filter((model) => model.provider === vendor && model.isActive);
}

/**
 * Get all currently active image models
 */
export function getActiveImageModels(): IImageModelDescription[] {
  return Object.values(IMAGE_MODEL_REGISTRY).filter((model) => model.isActive);
}

/**
 * Get all image models that support a specific feature
 */
export function getImageModelsWithFeature(
  feature: keyof IImageModelDescription['capabilities']['features']
): IImageModelDescription[] {
  return Object.values(IMAGE_MODEL_REGISTRY).filter(
    (model) => model.isActive && model.capabilities.features[feature]
  );
}

/**
 * Get all image models that support a specific aspect ratio
 */
export function getImageModelsWithAspectRatio(aspectRatio: AspectRatio): IImageModelDescription[] {
  return Object.values(IMAGE_MODEL_REGISTRY).filter(
    (model) => model.isActive && model.capabilities.aspectRatios.includes(aspectRatio)
  );
}

/**
 * Calculate estimated cost for image generation
 */
export function calculateImageCost(
  modelName: string,
  options?: { quality?: ImageQuality; size?: string; count?: number }
): number | null {
  const model = getImageModelInfo(modelName);
  if (!model?.pricing) return null;

  const count = options?.count ?? 1;

  // Check for tier-based pricing
  if (model.pricing.tiers && options?.quality && options?.size) {
    const tier = model.pricing.tiers.find(
      (t) => t.quality === options.quality && t.size === options.size
    );
    if (tier) return tier.price * count;
  }

  // Default per-image pricing
  if (model.pricing.perImage) {
    return model.pricing.perImage * count;
  }

  return null;
}
```

---

### 2. TTS Model Registry (`TTSModel.ts`)

```typescript
// src/domain/entities/TTSModel.ts

import { Vendor } from '../../core/Vendor.js';
import type { Vendor as VendorType } from '../../core/Vendor.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Audio output formats
 */
export type AudioFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | 'ogg';

/**
 * Voice information
 */
export interface IVoiceInfo {
  /** Voice identifier */
  id: string;
  /** Display name */
  name: string;
  /** Primary language (ISO-639-1) */
  language: string;
  /** Gender */
  gender: 'male' | 'female' | 'neutral';
  /** Voice style/tone */
  style?: string;
  /** Preview audio URL */
  previewUrl?: string;
  /** Whether this is the default voice */
  isDefault?: boolean;
  /** Age range */
  age?: 'child' | 'young' | 'adult' | 'senior';
  /** Accent/locale variant */
  accent?: string;
}

/**
 * Complete description of a TTS model
 */
export interface ITTSModelDescription {
  /** Model identifier */
  name: string;

  /** Display name for UI */
  displayName: string;

  /** Vendor/provider */
  provider: VendorType;

  /** Model description */
  description?: string;

  /** Whether the model is currently available */
  isActive: boolean;

  /** Release date (YYYY-MM-DD) */
  releaseDate?: string;

  /** Documentation links for maintenance */
  sources: {
    documentation: string;
    pricing?: string;
    apiReference?: string;
    voiceLibrary?: string;
    lastVerified: string;
  };

  /** Model capabilities */
  capabilities: {
    /** Available voices (static list or empty if fetched dynamically) */
    voices: IVoiceInfo[];

    /** Supported output formats */
    formats: AudioFormat[];

    /** Supported languages (ISO-639-1 codes) */
    languages: string[];

    /** Speed control */
    speed: {
      supported: boolean;
      min?: number;
      max?: number;
      default?: number;
    };

    /** Feature support */
    features: {
      streaming: boolean;
      ssml: boolean;
      emotions: boolean;
      voiceCloning: boolean;
      wordTimestamps: boolean;
    };

    /** Limits */
    limits: {
      maxInputLength: number;  // Characters
      maxRequestsPerMinute?: number;
    };

    /** Vendor-specific options */
    vendorOptions?: Record<string, VendorOptionSchema>;
  };

  /** Pricing information */
  pricing?: {
    /** Cost per 1,000 characters */
    per1kCharacters: number;
    currency: 'USD';
  };
}

// ============================================================================
// Model Name Constants
// ============================================================================

export const TTS_MODELS = {
  [Vendor.OpenAI]: {
    TTS_1: 'tts-1',
    TTS_1_HD: 'tts-1-hd',
  },
  [Vendor.Google]: {
    STANDARD: 'google-tts-standard',
    WAVENET: 'google-tts-wavenet',
    NEURAL2: 'google-tts-neural2',
    STUDIO: 'google-tts-studio',
  },
  [Vendor.Custom]: {
    ELEVENLABS_MULTILINGUAL_V2: 'eleven_multilingual_v2',
    ELEVENLABS_TURBO_V2_5: 'eleven_turbo_v2_5',
    CARTESIA_SONIC: 'cartesia-sonic-2',
  },
} as const;

// ============================================================================
// Model Registry
// ============================================================================

/**
 * Complete TTS model registry
 *
 * Last full audit: January 2026
 */
export const TTS_MODEL_REGISTRY: Record<string, ITTSModelDescription> = {
  // ==========================================================================
  // OpenAI Models
  // Source: https://platform.openai.com/docs/guides/text-to-speech
  // ==========================================================================

  'tts-1': {
    name: 'tts-1',
    displayName: 'TTS-1',
    provider: Vendor.OpenAI,
    description: 'Fast, low-latency text-to-speech optimized for real-time use',
    isActive: true,
    releaseDate: '2023-11-06',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/text-to-speech',
      pricing: 'https://openai.com/pricing',
      apiReference: 'https://platform.openai.com/docs/api-reference/audio/createSpeech',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      voices: [
        { id: 'alloy', name: 'Alloy', language: 'en', gender: 'neutral', isDefault: true },
        { id: 'ash', name: 'Ash', language: 'en', gender: 'male' },
        { id: 'ballad', name: 'Ballad', language: 'en', gender: 'male' },
        { id: 'coral', name: 'Coral', language: 'en', gender: 'female' },
        { id: 'echo', name: 'Echo', language: 'en', gender: 'male' },
        { id: 'fable', name: 'Fable', language: 'en', gender: 'neutral', accent: 'british' },
        { id: 'nova', name: 'Nova', language: 'en', gender: 'female' },
        { id: 'onyx', name: 'Onyx', language: 'en', gender: 'male' },
        { id: 'sage', name: 'Sage', language: 'en', gender: 'female' },
        { id: 'shimmer', name: 'Shimmer', language: 'en', gender: 'female' },
      ],
      formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'tr'],
      speed: {
        supported: true,
        min: 0.25,
        max: 4.0,
        default: 1.0,
      },
      features: {
        streaming: true,
        ssml: false,
        emotions: false,
        voiceCloning: false,
        wordTimestamps: false,
      },
      limits: {
        maxInputLength: 4096,
      },
    },
    pricing: {
      per1kCharacters: 0.015,
      currency: 'USD',
    },
  },

  'tts-1-hd': {
    name: 'tts-1-hd',
    displayName: 'TTS-1 HD',
    provider: Vendor.OpenAI,
    description: 'High-definition text-to-speech with improved audio quality',
    isActive: true,
    releaseDate: '2023-11-06',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/text-to-speech',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      voices: [
        { id: 'alloy', name: 'Alloy', language: 'en', gender: 'neutral', isDefault: true },
        { id: 'ash', name: 'Ash', language: 'en', gender: 'male' },
        { id: 'ballad', name: 'Ballad', language: 'en', gender: 'male' },
        { id: 'coral', name: 'Coral', language: 'en', gender: 'female' },
        { id: 'echo', name: 'Echo', language: 'en', gender: 'male' },
        { id: 'fable', name: 'Fable', language: 'en', gender: 'neutral', accent: 'british' },
        { id: 'nova', name: 'Nova', language: 'en', gender: 'female' },
        { id: 'onyx', name: 'Onyx', language: 'en', gender: 'male' },
        { id: 'sage', name: 'Sage', language: 'en', gender: 'female' },
        { id: 'shimmer', name: 'Shimmer', language: 'en', gender: 'female' },
      ],
      formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'tr'],
      speed: {
        supported: true,
        min: 0.25,
        max: 4.0,
        default: 1.0,
      },
      features: {
        streaming: true,
        ssml: false,
        emotions: false,
        voiceCloning: false,
        wordTimestamps: false,
      },
      limits: {
        maxInputLength: 4096,
      },
    },
    pricing: {
      per1kCharacters: 0.030,
      currency: 'USD',
    },
  },

  // ==========================================================================
  // ElevenLabs Models
  // Source: https://elevenlabs.io/docs/api-reference
  // ==========================================================================

  'eleven_multilingual_v2': {
    name: 'eleven_multilingual_v2',
    displayName: 'ElevenLabs Multilingual v2',
    provider: Vendor.Custom,
    description: 'High-quality multilingual TTS with emotion and style control',
    isActive: true,
    releaseDate: '2023-08-22',
    sources: {
      documentation: 'https://elevenlabs.io/docs/api-reference/text-to-speech',
      pricing: 'https://elevenlabs.io/pricing',
      voiceLibrary: 'https://elevenlabs.io/voice-library',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      voices: [], // Dynamic - fetch via API listVoices()
      formats: ['mp3', 'pcm', 'ogg'],
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'tr', 'cs', 'el', 'fi', 'id', 'ms', 'ro', 'uk', 'vi'],
      speed: {
        supported: false,  // Uses stability/similarity instead
      },
      features: {
        streaming: true,
        ssml: true,
        emotions: true,
        voiceCloning: true,
        wordTimestamps: true,
      },
      limits: {
        maxInputLength: 5000,
      },
      vendorOptions: {
        stability: {
          type: 'number',
          description: 'Voice stability (0-1). Lower = more expressive, higher = more consistent',
          min: 0,
          max: 1,
          default: 0.5,
        },
        similarity_boost: {
          type: 'number',
          description: 'Voice similarity boost (0-1). Higher = closer to original voice',
          min: 0,
          max: 1,
          default: 0.75,
        },
        style: {
          type: 'number',
          description: 'Style exaggeration (0-1). Higher = more expressive',
          min: 0,
          max: 1,
          default: 0,
        },
        use_speaker_boost: {
          type: 'boolean',
          description: 'Enhance speaker similarity',
          default: true,
        },
      },
    },
    pricing: {
      per1kCharacters: 0.30,  // Creator tier
      currency: 'USD',
    },
  },

  'eleven_turbo_v2_5': {
    name: 'eleven_turbo_v2_5',
    displayName: 'ElevenLabs Turbo v2.5',
    provider: Vendor.Custom,
    description: 'Low-latency model optimized for real-time conversational AI',
    isActive: true,
    releaseDate: '2024-06-01',
    sources: {
      documentation: 'https://elevenlabs.io/docs/api-reference/text-to-speech',
      pricing: 'https://elevenlabs.io/pricing',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      voices: [], // Dynamic
      formats: ['mp3', 'pcm', 'ogg'],
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'hi'],
      speed: {
        supported: false,
      },
      features: {
        streaming: true,
        ssml: false,
        emotions: true,
        voiceCloning: true,
        wordTimestamps: false,
      },
      limits: {
        maxInputLength: 5000,
      },
    },
    pricing: {
      per1kCharacters: 0.18,  // Cheaper than v2
      currency: 'USD',
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getTTSModelInfo(modelName: string): ITTSModelDescription | undefined {
  return TTS_MODEL_REGISTRY[modelName];
}

export function getTTSModelsByVendor(vendor: VendorType): ITTSModelDescription[] {
  return Object.values(TTS_MODEL_REGISTRY).filter((model) => model.provider === vendor && model.isActive);
}

export function getActiveTTSModels(): ITTSModelDescription[] {
  return Object.values(TTS_MODEL_REGISTRY).filter((model) => model.isActive);
}

export function getTTSModelsWithFeature(
  feature: keyof ITTSModelDescription['capabilities']['features']
): ITTSModelDescription[] {
  return Object.values(TTS_MODEL_REGISTRY).filter(
    (model) => model.isActive && model.capabilities.features[feature]
  );
}

export function calculateTTSCost(modelName: string, characterCount: number): number | null {
  const model = getTTSModelInfo(modelName);
  if (!model?.pricing) return null;
  return (characterCount / 1000) * model.pricing.per1kCharacters;
}
```

---

### 3. STT Model Registry (`STTModel.ts`)

```typescript
// src/domain/entities/STTModel.ts

import { Vendor } from '../../core/Vendor.js';
import type { Vendor as VendorType } from '../../core/Vendor.js';

// ============================================================================
// Types
// ============================================================================

export type STTOutputFormat = 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';

export interface ISTTModelDescription {
  name: string;
  displayName: string;
  provider: VendorType;
  description?: string;
  isActive: boolean;
  releaseDate?: string;

  sources: {
    documentation: string;
    pricing?: string;
    apiReference?: string;
    lastVerified: string;
  };

  capabilities: {
    /** Supported input audio formats */
    inputFormats: string[];

    /** Supported output formats */
    outputFormats: STTOutputFormat[];

    /** Supported languages (empty = auto-detect all) */
    languages: string[];

    /** Timestamp support */
    timestamps: {
      supported: boolean;
      granularities?: ('word' | 'segment')[];
    };

    /** Feature support */
    features: {
      translation: boolean;      // Translate to English
      diarization: boolean;      // Speaker identification
      streaming: boolean;        // Real-time transcription
      punctuation: boolean;      // Auto-punctuation
      profanityFilter: boolean;
    };

    /** Limits */
    limits: {
      maxFileSizeMB: number;
      maxDurationSeconds?: number;
    };

    vendorOptions?: Record<string, VendorOptionSchema>;
  };

  pricing?: {
    perMinute: number;
    currency: 'USD';
  };
}

// ============================================================================
// Model Constants
// ============================================================================

export const STT_MODELS = {
  [Vendor.OpenAI]: {
    WHISPER_1: 'whisper-1',
  },
  [Vendor.Groq]: {
    WHISPER_LARGE_V3: 'whisper-large-v3',
    WHISPER_LARGE_V3_TURBO: 'whisper-large-v3-turbo',
    DISTIL_WHISPER_LARGE_V3_EN: 'distil-whisper-large-v3-en',
  },
  [Vendor.Custom]: {
    ASSEMBLYAI_BEST: 'assemblyai-best',
    ASSEMBLYAI_NANO: 'assemblyai-nano',
    DEEPGRAM_NOVA_2: 'deepgram-nova-2',
  },
} as const;

// ============================================================================
// Model Registry
// ============================================================================

export const STT_MODEL_REGISTRY: Record<string, ISTTModelDescription> = {
  // ==========================================================================
  // OpenAI Models
  // Source: https://platform.openai.com/docs/guides/speech-to-text
  // ==========================================================================

  'whisper-1': {
    name: 'whisper-1',
    displayName: 'Whisper',
    provider: Vendor.OpenAI,
    description: 'OpenAI\'s general-purpose speech recognition model',
    isActive: true,
    releaseDate: '2023-03-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/speech-to-text',
      pricing: 'https://openai.com/pricing',
      apiReference: 'https://platform.openai.com/docs/api-reference/audio/createTranscription',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      inputFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
      outputFormats: ['json', 'text', 'srt', 'vtt', 'verbose_json'],
      languages: [], // Supports 50+ languages with auto-detection
      timestamps: {
        supported: true,
        granularities: ['word', 'segment'],
      },
      features: {
        translation: true,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false,
      },
      limits: {
        maxFileSizeMB: 25,
      },
    },
    pricing: {
      perMinute: 0.006,
      currency: 'USD',
    },
  },

  // ==========================================================================
  // Groq Models (Whisper on Groq hardware)
  // Source: https://console.groq.com/docs/speech-text
  // ==========================================================================

  'whisper-large-v3': {
    name: 'whisper-large-v3',
    displayName: 'Whisper Large v3 (Groq)',
    provider: Vendor.Groq,
    description: 'Whisper Large v3 with ultra-fast inference on Groq LPUs',
    isActive: true,
    releaseDate: '2024-04-01',
    sources: {
      documentation: 'https://console.groq.com/docs/speech-text',
      pricing: 'https://groq.com/pricing/',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      inputFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'flac', 'ogg'],
      outputFormats: ['json', 'text', 'verbose_json'],
      languages: [],
      timestamps: {
        supported: true,
        granularities: ['segment'],
      },
      features: {
        translation: true,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false,
      },
      limits: {
        maxFileSizeMB: 25,
      },
    },
    pricing: {
      perMinute: 0.001,  // 6x cheaper than OpenAI
      currency: 'USD',
    },
  },

  // ==========================================================================
  // AssemblyAI Models
  // Source: https://www.assemblyai.com/docs
  // ==========================================================================

  'assemblyai-best': {
    name: 'assemblyai-best',
    displayName: 'AssemblyAI Best',
    provider: Vendor.Custom,
    description: 'AssemblyAI\'s highest accuracy model with advanced features',
    isActive: true,
    releaseDate: '2024-01-01',
    sources: {
      documentation: 'https://www.assemblyai.com/docs',
      pricing: 'https://www.assemblyai.com/pricing',
      apiReference: 'https://www.assemblyai.com/docs/api-reference/transcripts',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      inputFormats: ['mp3', 'mp4', 'wav', 'flac', 'ogg', 'webm', 'm4a'],
      outputFormats: ['json', 'text', 'srt', 'vtt'],
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh', 'hi', 'pl', 'ru', 'uk', 'vi'],
      timestamps: {
        supported: true,
        granularities: ['word', 'segment'],
      },
      features: {
        translation: false,
        diarization: true,
        streaming: true,
        punctuation: true,
        profanityFilter: true,
      },
      limits: {
        maxFileSizeMB: 5000,  // 5GB
      },
      vendorOptions: {
        speaker_labels: {
          type: 'boolean',
          description: 'Enable speaker diarization',
          default: false,
        },
        auto_chapters: {
          type: 'boolean',
          description: 'Automatically generate chapters',
          default: false,
        },
        entity_detection: {
          type: 'boolean',
          description: 'Detect named entities (PII, dates, etc.)',
          default: false,
        },
        sentiment_analysis: {
          type: 'boolean',
          description: 'Analyze sentiment per sentence',
          default: false,
        },
        auto_highlights: {
          type: 'boolean',
          description: 'Extract key phrases and highlights',
          default: false,
        },
        summarization: {
          type: 'boolean',
          description: 'Generate summary of transcript',
          default: false,
        },
      },
    },
    pricing: {
      perMinute: 0.0062,
      currency: 'USD',
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getSTTModelInfo(modelName: string): ISTTModelDescription | undefined {
  return STT_MODEL_REGISTRY[modelName];
}

export function getSTTModelsByVendor(vendor: VendorType): ISTTModelDescription[] {
  return Object.values(STT_MODEL_REGISTRY).filter((model) => model.provider === vendor && model.isActive);
}

export function getActiveSTTModels(): ISTTModelDescription[] {
  return Object.values(STT_MODEL_REGISTRY).filter((model) => model.isActive);
}

export function calculateSTTCost(modelName: string, durationSeconds: number): number | null {
  const model = getSTTModelInfo(modelName);
  if (!model?.pricing) return null;
  return (durationSeconds / 60) * model.pricing.perMinute;
}
```

---

### 4. Video Model Registry (`VideoModel.ts`)

```typescript
// src/domain/entities/VideoModel.ts

import { Vendor } from '../../core/Vendor.js';
import type { Vendor as VendorType } from '../../core/Vendor.js';

// ============================================================================
// Types
// ============================================================================

export type VideoResolution = '480p' | '720p' | '1080p' | '4k';
export type VideoStyle = 'realistic' | 'animated' | 'cinematic' | 'documentary' | 'artistic' | '3d';

export interface IVideoModelDescription {
  name: string;
  displayName: string;
  provider: VendorType;
  description?: string;
  isActive: boolean;
  releaseDate?: string;

  sources: {
    documentation: string;
    pricing?: string;
    apiReference?: string;
    examples?: string;
    lastVerified: string;
  };

  capabilities: {
    /** Supported aspect ratios */
    aspectRatios: AspectRatio[];

    /** Supported resolutions */
    resolutions: VideoResolution[];

    /** Supported styles */
    styles: VideoStyle[];

    /** Duration constraints */
    duration: {
      min: number;  // Seconds
      max: number;  // Seconds
      step?: number;  // Must be multiple of
    };

    /** Frame rates */
    frameRates: number[];

    /** Feature support */
    features: {
      negativePrompt: boolean;
      seed: boolean;
      imageToVideo: boolean;
      videoToVideo: boolean;
      audioTrack: boolean;
      cameraControl: boolean;
    };

    limits: {
      maxPromptLength?: number;
    };

    vendorOptions?: Record<string, VendorOptionSchema>;
  };

  pricing?: {
    perSecond?: number;
    perVideo?: number;
    tiers?: Array<{ resolution: VideoResolution; duration: number; price: number }>;
    currency: 'USD';
  };
}

// ============================================================================
// Model Constants
// ============================================================================

export const VIDEO_MODELS = {
  [Vendor.Google]: {
    VEO_2: 'veo-2',
  },
  [Vendor.Custom]: {
    RUNWAY_GEN3_ALPHA: 'gen-3-alpha',
    RUNWAY_GEN3_ALPHA_TURBO: 'gen-3-alpha-turbo',
    KLING_1_5_PRO: 'kling-1.5-pro',
    MINIMAX_VIDEO_01: 'minimax-video-01',
    LUMA_RAY_2: 'luma-ray-2',
  },
} as const;

// ============================================================================
// Model Registry
// ============================================================================

export const VIDEO_MODEL_REGISTRY: Record<string, IVideoModelDescription> = {
  // ==========================================================================
  // Google Models
  // Source: https://cloud.google.com/vertex-ai/generative-ai/docs/video/overview
  // ==========================================================================

  'veo-2': {
    name: 'veo-2',
    displayName: 'Veo 2',
    provider: Vendor.Google,
    description: 'Google\'s latest video generation model with high quality and consistency',
    isActive: true,
    releaseDate: '2024-12-01',
    sources: {
      documentation: 'https://cloud.google.com/vertex-ai/generative-ai/docs/video/overview',
      pricing: 'https://cloud.google.com/vertex-ai/generative-ai/pricing',
      examples: 'https://deepmind.google/technologies/veo/',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['16:9', '9:16', '1:1'],
      resolutions: ['720p', '1080p'],
      styles: ['realistic', 'cinematic', 'artistic'],
      duration: {
        min: 5,
        max: 60,
      },
      frameRates: [24],
      features: {
        negativePrompt: true,
        seed: true,
        imageToVideo: true,
        videoToVideo: false,
        audioTrack: false,
        cameraControl: true,
      },
      vendorOptions: {
        camera_motion: {
          type: 'enum',
          description: 'Camera movement style',
          enum: ['static', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down', 'zoom_in', 'zoom_out', 'dolly', 'orbit'],
        },
      },
    },
    pricing: {
      perSecond: 0.035,
      currency: 'USD',
    },
  },

  // ==========================================================================
  // Runway Models
  // Source: https://docs.runwayml.com/
  // ==========================================================================

  'gen-3-alpha': {
    name: 'gen-3-alpha',
    displayName: 'Runway Gen-3 Alpha',
    provider: Vendor.Custom,
    description: 'Runway\'s most advanced video generation model',
    isActive: true,
    releaseDate: '2024-06-17',
    sources: {
      documentation: 'https://docs.runwayml.com/',
      pricing: 'https://runwayml.com/pricing/',
      apiReference: 'https://docs.runwayml.com/reference/text-to-video',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
      resolutions: ['720p', '1080p'],
      styles: ['realistic', 'cinematic', 'animated', 'artistic'],
      duration: {
        min: 5,
        max: 10,
        step: 5,
      },
      frameRates: [24],
      features: {
        negativePrompt: false,
        seed: true,
        imageToVideo: true,
        videoToVideo: true,
        audioTrack: false,
        cameraControl: true,
      },
      vendorOptions: {
        motion_score: {
          type: 'number',
          description: 'Amount of motion in the video (1-10)',
          min: 1,
          max: 10,
          default: 5,
        },
      },
    },
    pricing: {
      perSecond: 0.05,
      currency: 'USD',
    },
  },

  'gen-3-alpha-turbo': {
    name: 'gen-3-alpha-turbo',
    displayName: 'Runway Gen-3 Alpha Turbo',
    provider: Vendor.Custom,
    description: 'Faster, more cost-effective variant of Gen-3 Alpha',
    isActive: true,
    releaseDate: '2024-08-01',
    sources: {
      documentation: 'https://docs.runwayml.com/',
      pricing: 'https://runwayml.com/pricing/',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['16:9', '9:16', '1:1'],
      resolutions: ['720p'],
      styles: ['realistic', 'cinematic'],
      duration: {
        min: 5,
        max: 10,
        step: 5,
      },
      frameRates: [24],
      features: {
        negativePrompt: false,
        seed: true,
        imageToVideo: true,
        videoToVideo: false,
        audioTrack: false,
        cameraControl: false,
      },
    },
    pricing: {
      perSecond: 0.025,
      currency: 'USD',
    },
  },

  // ==========================================================================
  // Luma Labs Models
  // Source: https://docs.lumalabs.ai/
  // ==========================================================================

  'luma-ray-2': {
    name: 'luma-ray-2',
    displayName: 'Luma Ray 2',
    provider: Vendor.Custom,
    description: 'Luma\'s latest video model with excellent motion quality',
    isActive: true,
    releaseDate: '2025-01-01',
    sources: {
      documentation: 'https://docs.lumalabs.ai/',
      pricing: 'https://lumalabs.ai/pricing',
      lastVerified: '2026-01-15',
    },
    capabilities: {
      aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
      resolutions: ['720p', '1080p'],
      styles: ['realistic', 'cinematic', 'animated', 'artistic'],
      duration: {
        min: 5,
        max: 20,
        step: 5,
      },
      frameRates: [24, 30],
      features: {
        negativePrompt: false,
        seed: true,
        imageToVideo: true,
        videoToVideo: true,
        audioTrack: false,
        cameraControl: true,
      },
      vendorOptions: {
        loop: {
          type: 'boolean',
          description: 'Create a looping video',
          default: false,
        },
        keyframes: {
          type: 'boolean',
          description: 'Use start/end image keyframes',
          default: false,
        },
      },
    },
    pricing: {
      perSecond: 0.032,
      currency: 'USD',
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getVideoModelInfo(modelName: string): IVideoModelDescription | undefined {
  return VIDEO_MODEL_REGISTRY[modelName];
}

export function getVideoModelsByVendor(vendor: VendorType): IVideoModelDescription[] {
  return Object.values(VIDEO_MODEL_REGISTRY).filter((model) => model.provider === vendor && model.isActive);
}

export function getActiveVideoModels(): IVideoModelDescription[] {
  return Object.values(VIDEO_MODEL_REGISTRY).filter((model) => model.isActive);
}

export function calculateVideoCost(
  modelName: string,
  durationSeconds: number,
  resolution?: VideoResolution
): number | null {
  const model = getVideoModelInfo(modelName);
  if (!model?.pricing) return null;

  if (model.pricing.perSecond) {
    return durationSeconds * model.pricing.perSecond;
  }

  if (model.pricing.tiers && resolution) {
    const tier = model.pricing.tiers.find(
      (t) => t.resolution === resolution && t.duration >= durationSeconds
    );
    if (tier) return tier.price;
  }

  return null;
}
```

---

### Registry Index File

```typescript
// src/domain/entities/index.ts

// LLM Models (existing)
export * from './Model.js';

// Image Generation Models
export * from './ImageModel.js';

// Text-to-Speech Models
export * from './TTSModel.js';

// Speech-to-Text Models
export * from './STTModel.js';

// Video Generation Models
export * from './VideoModel.js';

// Shared types
export type { VendorOptionSchema } from './ImageModel.js';
```

---

### Maintenance Guidelines

Each registry includes a `sources` field with:

| Field | Purpose |
|-------|---------|
| `documentation` | Official docs URL for capability verification |
| `pricing` | Pricing page URL for cost updates |
| `apiReference` | API docs for implementation details |
| `lastVerified` | Date when this entry was last audited |

**Maintenance workflow:**

1. **Quarterly audit** - Check all `lastVerified` dates older than 90 days
2. **On new release** - Add new model, update `lastVerified`
3. **On deprecation** - Set `isActive: false`, add `deprecationDate`
4. **Price changes** - Update `pricing` object, update `lastVerified`

---

## Extended Model Capabilities System

### Design Philosophy

Different vendors have vastly different options for the same capability:

```typescript
// OpenAI DALL-E 3
{ size: '1024x1024' | '1792x1024', quality: 'standard' | 'hd', style: 'vivid' | 'natural' }

// Google Imagen 3
{ aspectRatio: '1:1' | '16:9', personGeneration: 'allow' | 'disallow' }

// Stability AI
{ width: 512-2048, height: 512-2048, cfg_scale: 0-35, steps: 10-50 }
```

**Our solution: Extended Model Capabilities with Semantic Options**

1. **Semantic Options** - User-friendly, normalized interface
2. **Model Registry** - Each model declares what it supports
3. **Validation Layer** - Check options before API calls
4. **Provider Normalization** - Map semantic → vendor-specific
5. **Escape Hatch** - `vendorOptions` for power users

---

### Semantic Option Types

```typescript
// src/domain/types/SemanticOptions.ts

/**
 * Semantic aspect ratios - normalized across vendors
 */
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9';

/**
 * Semantic quality levels - normalized across vendors
 */
export type QualityLevel = 'draft' | 'standard' | 'high' | 'ultra';

/**
 * Semantic image styles - normalized across vendors
 */
export type ImageStyle = 'natural' | 'artistic' | 'photographic' | 'cinematic' | 'anime' | '3d-render';

/**
 * Semantic video styles
 */
export type VideoStyle = 'realistic' | 'animated' | 'cinematic' | 'documentary' | 'artistic';

/**
 * Audio output formats - actual formats (not semantic)
 */
export type AudioFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | 'ogg';

/**
 * Output format preference
 */
export type OutputFormat = 'url' | 'base64' | 'buffer';
```

---

### Model Capability Registries

#### Image Model Registry

```typescript
// src/domain/entities/ImageModel.ts

export interface ImageModelCapabilities {
  // Supported semantic options
  aspectRatios: AspectRatio[];
  qualities: QualityLevel[];
  styles: ImageStyle[];

  // Limits
  maxCount: number;                    // Max images per request
  maxPromptLength?: number;            // Max prompt characters

  // Feature support
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  supportsEdit: boolean;
  supportsVariation: boolean;
  supportsInpainting: boolean;
  supportsOutpainting: boolean;

  // Size constraints (for vendors that use pixel sizes)
  sizeConstraints?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    stepSize?: number;                 // Must be multiple of (e.g., 64)
  };

  // Vendor-specific option schema (for documentation/validation)
  vendorSpecificOptions?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'enum';
    description: string;
    enum?: string[];
    min?: number;
    max?: number;
    default?: unknown;
  }>;
}

export interface ImageModelDescription {
  id: string;
  vendor: Vendor;
  displayName: string;
  description?: string;

  capabilities: ImageModelCapabilities;

  // Pricing (per image or per 1K pixels)
  pricing?: {
    perImage?: number;
    per1kPixels?: number;
    currency: 'USD';
  };

  // Metadata
  releaseDate?: string;
  isActive: boolean;
}

export const IMAGE_MODEL_REGISTRY: Record<string, ImageModelDescription> = {
  // ============ OpenAI ============
  'dall-e-3': {
    id: 'dall-e-3',
    vendor: Vendor.OpenAI,
    displayName: 'DALL-E 3',
    description: 'Latest OpenAI image generation model with excellent prompt following',
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16'],
      qualities: ['standard', 'high'],
      styles: ['natural', 'artistic'],
      maxCount: 1,
      maxPromptLength: 4000,
      supportsNegativePrompt: false,
      supportsSeed: false,
      supportsEdit: false,
      supportsVariation: false,
      supportsInpainting: false,
      supportsOutpainting: false,
    },
    pricing: { perImage: 0.04, currency: 'USD' },  // Standard 1024x1024
    isActive: true,
  },

  'dall-e-2': {
    id: 'dall-e-2',
    vendor: Vendor.OpenAI,
    displayName: 'DALL-E 2',
    description: 'Previous generation with edit and variation support',
    capabilities: {
      aspectRatios: ['1:1'],
      qualities: ['standard'],
      styles: [],
      maxCount: 10,
      supportsNegativePrompt: false,
      supportsSeed: false,
      supportsEdit: true,
      supportsVariation: true,
      supportsInpainting: true,
      supportsOutpainting: false,
      sizeConstraints: {
        minWidth: 256,
        maxWidth: 1024,
        minHeight: 256,
        maxHeight: 1024,
      },
    },
    pricing: { perImage: 0.02, currency: 'USD' },
    isActive: true,
  },

  // ============ Google ============
  'imagen-3': {
    id: 'imagen-3',
    vendor: Vendor.Google,
    displayName: 'Imagen 3',
    description: 'Google\'s latest image generation model',
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      qualities: ['standard', 'high'],
      styles: ['natural', 'photographic', 'artistic'],
      maxCount: 4,
      supportsNegativePrompt: true,
      supportsSeed: true,
      supportsEdit: true,
      supportsVariation: false,
      supportsInpainting: true,
      supportsOutpainting: true,
      vendorSpecificOptions: {
        personGeneration: {
          type: 'enum',
          description: 'Whether to allow generation of people',
          enum: ['allow', 'disallow'],
          default: 'allow',
        },
        safetyFilterLevel: {
          type: 'enum',
          description: 'Safety filter strictness',
          enum: ['block_none', 'block_few', 'block_some', 'block_most'],
          default: 'block_some',
        },
      },
    },
    isActive: true,
  },

  // ============ Stability AI ============
  'stable-diffusion-xl': {
    id: 'stable-diffusion-xl',
    vendor: Vendor.Custom,  // Via API
    displayName: 'Stable Diffusion XL',
    description: 'Open source high-quality image generation',
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
      qualities: ['draft', 'standard', 'high'],
      styles: ['natural', 'artistic', 'photographic', 'cinematic', 'anime', '3d-render'],
      maxCount: 4,
      supportsNegativePrompt: true,
      supportsSeed: true,
      supportsEdit: false,
      supportsVariation: false,
      supportsInpainting: true,
      supportsOutpainting: true,
      sizeConstraints: {
        minWidth: 512,
        maxWidth: 2048,
        minHeight: 512,
        maxHeight: 2048,
        stepSize: 64,
      },
      vendorSpecificOptions: {
        cfg_scale: {
          type: 'number',
          description: 'Classifier-free guidance scale',
          min: 0,
          max: 35,
          default: 7,
        },
        steps: {
          type: 'number',
          description: 'Number of diffusion steps',
          min: 10,
          max: 150,
          default: 30,
        },
        sampler: {
          type: 'enum',
          description: 'Sampling algorithm',
          enum: ['euler', 'euler_ancestral', 'dpm++_2m', 'dpm++_sde'],
          default: 'dpm++_2m',
        },
      },
    },
    isActive: true,
  },
};

// ============ Helper Functions ============

export function getImageModelInfo(modelId: string): ImageModelDescription | undefined {
  return IMAGE_MODEL_REGISTRY[modelId];
}

export function getImageModelCapabilities(modelId: string): ImageModelCapabilities | undefined {
  return IMAGE_MODEL_REGISTRY[modelId]?.capabilities;
}

export function getImageModelsByVendor(vendor: Vendor): ImageModelDescription[] {
  return Object.values(IMAGE_MODEL_REGISTRY).filter(m => m.vendor === vendor && m.isActive);
}

export function getImageModelsWithCapability(
  capability: keyof ImageModelCapabilities
): ImageModelDescription[] {
  return Object.values(IMAGE_MODEL_REGISTRY).filter(m => {
    const caps = m.capabilities;
    const value = caps[capability];
    return m.isActive && (Array.isArray(value) ? value.length > 0 : Boolean(value));
  });
}
```

#### TTS Model Registry

```typescript
// src/domain/entities/TTSModel.ts

export interface TTSModelCapabilities {
  // Supported options
  voices: VoiceInfo[];
  formats: AudioFormat[];

  // Speed control
  supportsSpeed: boolean;
  minSpeed?: number;                   // e.g., 0.25
  maxSpeed?: number;                   // e.g., 4.0

  // Features
  supportsStreaming: boolean;
  supportsSSML: boolean;
  supportsEmotions: boolean;
  supportsVoiceCloning: boolean;

  // Limits
  maxInputLength?: number;             // Max characters per request

  // Languages
  languages: string[];                 // ISO-639-1 codes

  // Vendor-specific
  vendorSpecificOptions?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'enum';
    description: string;
    enum?: string[];
    min?: number;
    max?: number;
  }>;
}

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  style?: string;                      // e.g., 'conversational', 'narrative'
  previewUrl?: string;
  isDefault?: boolean;
}

export interface TTSModelDescription {
  id: string;
  vendor: Vendor;
  displayName: string;
  description?: string;
  capabilities: TTSModelCapabilities;
  pricing?: {
    per1kCharacters: number;
    currency: 'USD';
  };
  isActive: boolean;
}

export const TTS_MODEL_REGISTRY: Record<string, TTSModelDescription> = {
  // ============ OpenAI ============
  'tts-1': {
    id: 'tts-1',
    vendor: Vendor.OpenAI,
    displayName: 'TTS-1',
    description: 'Fast, low-latency text-to-speech',
    capabilities: {
      voices: [
        { id: 'alloy', name: 'Alloy', language: 'en', gender: 'neutral', isDefault: true },
        { id: 'echo', name: 'Echo', language: 'en', gender: 'male' },
        { id: 'fable', name: 'Fable', language: 'en', gender: 'neutral' },
        { id: 'onyx', name: 'Onyx', language: 'en', gender: 'male' },
        { id: 'nova', name: 'Nova', language: 'en', gender: 'female' },
        { id: 'shimmer', name: 'Shimmer', language: 'en', gender: 'female' },
      ],
      formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
      supportsSpeed: true,
      minSpeed: 0.25,
      maxSpeed: 4.0,
      supportsStreaming: true,
      supportsSSML: false,
      supportsEmotions: false,
      supportsVoiceCloning: false,
      maxInputLength: 4096,
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ja', 'ko', 'zh'],
    },
    pricing: { per1kCharacters: 0.015, currency: 'USD' },
    isActive: true,
  },

  'tts-1-hd': {
    id: 'tts-1-hd',
    vendor: Vendor.OpenAI,
    displayName: 'TTS-1 HD',
    description: 'High-definition text-to-speech',
    capabilities: {
      voices: [
        { id: 'alloy', name: 'Alloy', language: 'en', gender: 'neutral', isDefault: true },
        { id: 'echo', name: 'Echo', language: 'en', gender: 'male' },
        { id: 'fable', name: 'Fable', language: 'en', gender: 'neutral' },
        { id: 'onyx', name: 'Onyx', language: 'en', gender: 'male' },
        { id: 'nova', name: 'Nova', language: 'en', gender: 'female' },
        { id: 'shimmer', name: 'Shimmer', language: 'en', gender: 'female' },
      ],
      formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
      supportsSpeed: true,
      minSpeed: 0.25,
      maxSpeed: 4.0,
      supportsStreaming: true,
      supportsSSML: false,
      supportsEmotions: false,
      supportsVoiceCloning: false,
      maxInputLength: 4096,
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ja', 'ko', 'zh'],
    },
    pricing: { per1kCharacters: 0.030, currency: 'USD' },
    isActive: true,
  },

  // ============ ElevenLabs ============
  'eleven_multilingual_v2': {
    id: 'eleven_multilingual_v2',
    vendor: Vendor.Custom,
    displayName: 'ElevenLabs Multilingual v2',
    description: 'High-quality multilingual TTS with emotion support',
    capabilities: {
      voices: [], // Dynamic - fetched via API
      formats: ['mp3', 'pcm', 'ogg'],
      supportsSpeed: false,
      supportsStreaming: true,
      supportsSSML: true,
      supportsEmotions: true,
      supportsVoiceCloning: true,
      maxInputLength: 5000,
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'],
      vendorSpecificOptions: {
        stability: {
          type: 'number',
          description: 'Voice stability (0-1)',
          min: 0,
          max: 1,
        },
        similarity_boost: {
          type: 'number',
          description: 'Voice similarity boost (0-1)',
          min: 0,
          max: 1,
        },
        style: {
          type: 'number',
          description: 'Style exaggeration (0-1)',
          min: 0,
          max: 1,
        },
      },
    },
    pricing: { per1kCharacters: 0.30, currency: 'USD' },
    isActive: true,
  },
};
```

#### STT Model Registry

```typescript
// src/domain/entities/STTModel.ts

export interface STTModelCapabilities {
  // Supported options
  languages: string[];                 // ISO-639-1 codes, empty = auto-detect
  formats: AudioFormat[];              // Supported input formats
  outputFormats: ('json' | 'text' | 'srt' | 'vtt' | 'verbose_json')[];

  // Features
  supportsTimestamps: boolean;
  timestampGranularities?: ('word' | 'segment')[];
  supportsTranslation: boolean;        // Translate to English
  supportsDiarization: boolean;        // Speaker identification
  supportsStreaming: boolean;          // Real-time transcription

  // Limits
  maxAudioDuration?: number;           // Seconds
  maxFileSizeMB?: number;

  // Vendor-specific
  vendorSpecificOptions?: Record<string, any>;
}

export interface STTModelDescription {
  id: string;
  vendor: Vendor;
  displayName: string;
  description?: string;
  capabilities: STTModelCapabilities;
  pricing?: {
    perMinute: number;
    currency: 'USD';
  };
  isActive: boolean;
}

export const STT_MODEL_REGISTRY: Record<string, STTModelDescription> = {
  // ============ OpenAI ============
  'whisper-1': {
    id: 'whisper-1',
    vendor: Vendor.OpenAI,
    displayName: 'Whisper',
    description: 'OpenAI\'s general-purpose speech recognition',
    capabilities: {
      languages: [], // Auto-detect, supports 50+ languages
      formats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
      outputFormats: ['json', 'text', 'srt', 'vtt', 'verbose_json'],
      supportsTimestamps: true,
      timestampGranularities: ['word', 'segment'],
      supportsTranslation: true,
      supportsDiarization: false,
      supportsStreaming: false,
      maxFileSizeMB: 25,
    },
    pricing: { perMinute: 0.006, currency: 'USD' },
    isActive: true,
  },

  // ============ Groq ============
  'whisper-large-v3': {
    id: 'whisper-large-v3',
    vendor: Vendor.Groq,
    displayName: 'Whisper Large v3 (Groq)',
    description: 'Ultra-fast Whisper on Groq hardware',
    capabilities: {
      languages: [],
      formats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'flac', 'ogg'],
      outputFormats: ['json', 'text', 'verbose_json'],
      supportsTimestamps: true,
      timestampGranularities: ['segment'],
      supportsTranslation: true,
      supportsDiarization: false,
      supportsStreaming: false,
      maxFileSizeMB: 25,
    },
    pricing: { perMinute: 0.001, currency: 'USD' },  // Much cheaper
    isActive: true,
  },

  // ============ AssemblyAI ============
  'assemblyai-default': {
    id: 'assemblyai-default',
    vendor: Vendor.Custom,
    displayName: 'AssemblyAI',
    description: 'AssemblyAI speech recognition with advanced features',
    capabilities: {
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh'],
      formats: ['mp3', 'mp4', 'wav', 'flac', 'ogg', 'webm'],
      outputFormats: ['json', 'text', 'srt', 'vtt'],
      supportsTimestamps: true,
      timestampGranularities: ['word', 'segment'],
      supportsTranslation: false,
      supportsDiarization: true,
      supportsStreaming: true,
      vendorSpecificOptions: {
        speaker_labels: {
          type: 'boolean',
          description: 'Enable speaker diarization',
        },
        auto_chapters: {
          type: 'boolean',
          description: 'Auto-generate chapters',
        },
        entity_detection: {
          type: 'boolean',
          description: 'Detect named entities',
        },
        sentiment_analysis: {
          type: 'boolean',
          description: 'Analyze sentiment',
        },
      },
    },
    pricing: { perMinute: 0.0062, currency: 'USD' },
    isActive: true,
  },
};
```

#### Video Model Registry

```typescript
// src/domain/entities/VideoModel.ts

export interface VideoModelCapabilities {
  // Supported options
  aspectRatios: AspectRatio[];
  resolutions: ('480p' | '720p' | '1080p' | '4k')[];
  styles: VideoStyle[];

  // Duration
  minDuration: number;                 // Seconds
  maxDuration: number;                 // Seconds
  durationStep?: number;               // Must be multiple of

  // Frame rate
  frameRates: number[];                // e.g., [24, 30, 60]

  // Features
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  supportsImageToVideo: boolean;
  supportsVideoToVideo: boolean;
  supportsAudioTrack: boolean;

  // Limits
  maxPromptLength?: number;

  // Vendor-specific
  vendorSpecificOptions?: Record<string, any>;
}

export interface VideoModelDescription {
  id: string;
  vendor: Vendor;
  displayName: string;
  description?: string;
  capabilities: VideoModelCapabilities;
  pricing?: {
    perSecond: number;
    currency: 'USD';
  };
  isActive: boolean;
}

export const VIDEO_MODEL_REGISTRY: Record<string, VideoModelDescription> = {
  // ============ Google ============
  'veo-2': {
    id: 'veo-2',
    vendor: Vendor.Google,
    displayName: 'Veo 2',
    description: 'Google\'s latest video generation model',
    capabilities: {
      aspectRatios: ['16:9', '9:16', '1:1'],
      resolutions: ['720p', '1080p'],
      styles: ['realistic', 'cinematic', 'artistic'],
      minDuration: 5,
      maxDuration: 60,
      frameRates: [24],
      supportsNegativePrompt: true,
      supportsSeed: true,
      supportsImageToVideo: true,
      supportsVideoToVideo: false,
      supportsAudioTrack: false,
    },
    isActive: true,
  },

  // ============ Runway ============
  'gen-3-alpha': {
    id: 'gen-3-alpha',
    vendor: Vendor.Custom,
    displayName: 'Runway Gen-3 Alpha',
    description: 'Runway\'s most advanced video generation',
    capabilities: {
      aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
      resolutions: ['720p', '1080p'],
      styles: ['realistic', 'cinematic', 'animated', 'artistic'],
      minDuration: 5,
      maxDuration: 10,
      durationStep: 5,
      frameRates: [24],
      supportsNegativePrompt: false,
      supportsSeed: true,
      supportsImageToVideo: true,
      supportsVideoToVideo: true,
      supportsAudioTrack: false,
      vendorSpecificOptions: {
        motion_score: {
          type: 'number',
          description: 'Amount of motion (1-10)',
          min: 1,
          max: 10,
          default: 5,
        },
      },
    },
    pricing: { perSecond: 0.05, currency: 'USD' },
    isActive: true,
  },
};
```

---

### Semantic Options Interfaces

```typescript
// src/domain/types/ImageOptions.ts

import { AspectRatio, QualityLevel, ImageStyle, OutputFormat } from './SemanticOptions.js';

/**
 * Semantic image generation options
 * These are normalized by providers to vendor-specific formats
 */
export interface ImageGenerateOptions {
  model: string;
  prompt: string;
  negativePrompt?: string;

  // Semantic options - normalized by providers
  aspectRatio?: AspectRatio;
  quality?: QualityLevel;
  style?: ImageStyle;
  count?: number;
  seed?: number;

  // Output
  outputFormat?: OutputFormat;

  // Escape hatch for vendor-specific options
  vendorOptions?: Record<string, unknown>;
}

// src/domain/types/TTSOptions.ts

export interface TTSGenerateOptions {
  model: string;
  input: string;
  voice?: string;

  // Semantic options
  format?: AudioFormat;
  speed?: number;

  // Escape hatch
  vendorOptions?: Record<string, unknown>;
}

// src/domain/types/STTOptions.ts

export interface STTTranscribeOptions {
  model: string;
  audio: Buffer | string;

  // Semantic options
  language?: string;
  outputFormat?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
  includeTimestamps?: boolean;
  timestampGranularity?: 'word' | 'segment';

  // Escape hatch
  vendorOptions?: Record<string, unknown>;
}

// src/domain/types/VideoOptions.ts

export interface VideoGenerateOptions {
  model: string;
  prompt: string;
  negativePrompt?: string;

  // Semantic options
  aspectRatio?: AspectRatio;
  resolution?: '480p' | '720p' | '1080p' | '4k';
  style?: VideoStyle;
  duration?: number;
  frameRate?: number;
  seed?: number;

  // Image-to-video
  sourceImage?: Buffer | string;

  // Escape hatch
  vendorOptions?: Record<string, unknown>;
}
```

---

### Validation Layer

```typescript
// src/capabilities/validation/OptionsValidator.ts

import { ImageGenerateOptions } from '../../domain/types/ImageOptions.js';
import { IMAGE_MODEL_REGISTRY, ImageModelCapabilities } from '../../domain/entities/ImageModel.js';
import { ValidationError, UnsupportedOptionError, OptionOutOfRangeError } from '../../domain/errors/index.js';
import { logger } from '../../infrastructure/observability/Logger.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  normalizedOptions: Record<string, unknown>;
}

export class ImageOptionsValidator {
  private logger = logger.child({ component: 'ImageOptionsValidator' });

  /**
   * Validate and normalize image generation options
   */
  validate(options: ImageGenerateOptions): ValidationResult {
    const modelInfo = IMAGE_MODEL_REGISTRY[options.model];

    if (!modelInfo) {
      return {
        valid: false,
        errors: [new ValidationError(`Unknown model: ${options.model}`)],
        warnings: [],
        normalizedOptions: {},
      };
    }

    const caps = modelInfo.capabilities;
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const normalized: Record<string, unknown> = { ...options };

    // Validate aspect ratio
    if (options.aspectRatio) {
      if (!caps.aspectRatios.includes(options.aspectRatio)) {
        errors.push(new UnsupportedOptionError(
          'aspectRatio',
          options.aspectRatio,
          caps.aspectRatios
        ));
      }
    }

    // Validate quality with fallback
    if (options.quality) {
      if (!caps.qualities.includes(options.quality)) {
        const fallback = this.findClosestQuality(options.quality, caps.qualities);
        warnings.push(
          `Quality '${options.quality}' not supported by ${options.model}. ` +
          `Using '${fallback}' instead.`
        );
        normalized.quality = fallback;
      }
    }

    // Validate style with fallback
    if (options.style) {
      if (caps.styles.length === 0) {
        warnings.push(`Style not supported by ${options.model}. Ignoring.`);
        delete normalized.style;
      } else if (!caps.styles.includes(options.style)) {
        warnings.push(
          `Style '${options.style}' not supported by ${options.model}. ` +
          `Available: ${caps.styles.join(', ')}. Ignoring.`
        );
        delete normalized.style;
      }
    }

    // Validate count
    if (options.count !== undefined) {
      if (options.count > caps.maxCount) {
        errors.push(new OptionOutOfRangeError(
          'count',
          options.count,
          1,
          caps.maxCount
        ));
      }
    }

    // Validate negative prompt support
    if (options.negativePrompt && !caps.supportsNegativePrompt) {
      warnings.push(`Negative prompts not supported by ${options.model}. Ignoring.`);
      delete normalized.negativePrompt;
    }

    // Validate seed support
    if (options.seed !== undefined && !caps.supportsSeed) {
      warnings.push(`Seed not supported by ${options.model}. Ignoring.`);
      delete normalized.seed;
    }

    // Log warnings
    for (const warning of warnings) {
      this.logger.warn({ model: options.model, warning }, 'Option validation warning');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalizedOptions: normalized,
    };
  }

  private findClosestQuality(
    requested: QualityLevel,
    available: QualityLevel[]
  ): QualityLevel {
    const order: QualityLevel[] = ['draft', 'standard', 'high', 'ultra'];
    const requestedIndex = order.indexOf(requested);

    // Find closest available (prefer higher quality)
    for (let i = requestedIndex; i >= 0; i--) {
      if (available.includes(order[i])) {
        return order[i];
      }
    }
    for (let i = requestedIndex + 1; i < order.length; i++) {
      if (available.includes(order[i])) {
        return order[i];
      }
    }

    return available[0];
  }
}

// Similar validators for TTS, STT, Video...
export class TTSOptionsValidator { /* ... */ }
export class STTOptionsValidator { /* ... */ }
export class VideoOptionsValidator { /* ... */ }
```

---

### Provider Normalization

```typescript
// src/infrastructure/providers/openai/OpenAIImageProvider.ts

import { BaseImageProvider } from '../base/BaseImageProvider.js';
import { ImageGenerateOptions } from '../../../domain/types/ImageOptions.js';
import { ImageOptionsValidator } from '../../../capabilities/validation/OptionsValidator.js';
import { AspectRatio, QualityLevel, ImageStyle } from '../../../domain/types/SemanticOptions.js';

export class OpenAIImageProvider extends BaseImageProvider {
  readonly name = 'openai-image';

  private validator = new ImageOptionsValidator();

  async generateImage(options: ImageGenerateOptions): Promise<ImageResponse> {
    // Validate options
    const validation = this.validator.validate(options);

    if (!validation.valid) {
      throw validation.errors[0];
    }

    // Log any warnings
    for (const warning of validation.warnings) {
      this.logger.warn({ warning }, 'Option adjusted');
    }

    // Normalize to OpenAI format
    const openaiParams = this.normalizeToOpenAI(
      validation.normalizedOptions as ImageGenerateOptions
    );

    return this.executeWithCircuitBreaker(async () => {
      const response = await this.client.images.generate(openaiParams);
      return this.convertResponse(response);
    }, options.model);
  }

  /**
   * Normalize semantic options to OpenAI-specific format
   */
  private normalizeToOpenAI(options: ImageGenerateOptions): OpenAI.ImageGenerateParams {
    return {
      model: options.model,
      prompt: options.prompt,

      // Map aspectRatio → size
      size: this.mapAspectRatioToSize(options.aspectRatio, options.model),

      // Map quality
      quality: this.mapQuality(options.quality),

      // Map style
      style: this.mapStyle(options.style),

      // Direct mappings
      n: options.count,
      response_format: options.outputFormat === 'base64' ? 'b64_json' : 'url',

      // Vendor-specific pass-through
      ...options.vendorOptions,
    };
  }

  private mapAspectRatioToSize(
    ratio: AspectRatio | undefined,
    model: string
  ): '1024x1024' | '1792x1024' | '1024x1792' | '512x512' | '256x256' {
    if (model === 'dall-e-3') {
      switch (ratio) {
        case '16:9':
        case '21:9':
          return '1792x1024';
        case '9:16':
          return '1024x1792';
        case '1:1':
        case '4:3':
        case '3:4':
        default:
          return '1024x1024';
      }
    }
    // DALL-E 2 only supports 1:1
    return '1024x1024';
  }

  private mapQuality(quality: QualityLevel | undefined): 'standard' | 'hd' {
    switch (quality) {
      case 'high':
      case 'ultra':
        return 'hd';
      default:
        return 'standard';
    }
  }

  private mapStyle(style: ImageStyle | undefined): 'vivid' | 'natural' | undefined {
    switch (style) {
      case 'natural':
      case 'photographic':
        return 'natural';
      case 'artistic':
      case 'cinematic':
      case 'anime':
      case '3d-render':
        return 'vivid';
      default:
        return undefined;
    }
  }
}
```

---

### Capability Class with Introspection

```typescript
// src/core/ImageGenerator.ts

import { Connector } from './Connector.js';
import { createImageProvider } from './createImageProvider.js';
import { IImageProvider } from '../domain/interfaces/IImageProvider.js';
import { ImageGenerateOptions } from '../domain/types/ImageOptions.js';
import { ImageResponse } from '../domain/entities/ImageResponse.js';
import {
  IMAGE_MODEL_REGISTRY,
  ImageModelCapabilities,
  ImageModelDescription,
  getImageModelInfo,
  getImageModelsByVendor,
} from '../domain/entities/ImageModel.js';
import { ImageOptionsValidator } from '../capabilities/validation/OptionsValidator.js';

export interface ImageGeneratorConfig {
  connector: string | Connector;
  model?: string;

  // Default options
  defaultAspectRatio?: AspectRatio;
  defaultQuality?: QualityLevel;
  defaultStyle?: ImageStyle;
}

export class ImageGenerator {
  private provider: IImageProvider;
  private config: ImageGeneratorConfig;
  private validator = new ImageOptionsValidator();

  static create(config: ImageGeneratorConfig): ImageGenerator {
    return new ImageGenerator(config);
  }

  private constructor(config: ImageGeneratorConfig) {
    const connector = typeof config.connector === 'string'
      ? Connector.get(config.connector)
      : config.connector;

    this.provider = createImageProvider(connector);
    this.config = config;
  }

  // ============ Generation Methods ============

  /**
   * Generate image from text prompt
   */
  async generate(
    prompt: string,
    options?: Partial<Omit<ImageGenerateOptions, 'model' | 'prompt'>>
  ): Promise<ImageResponse> {
    const fullOptions: ImageGenerateOptions = {
      model: options?.model ?? this.config.model ?? this.getDefaultModel(),
      prompt,
      aspectRatio: options?.aspectRatio ?? this.config.defaultAspectRatio,
      quality: options?.quality ?? this.config.defaultQuality,
      style: options?.style ?? this.config.defaultStyle,
      ...options,
    };

    return this.provider.generateImage(fullOptions);
  }

  // ============ Introspection Methods ============

  /**
   * Get capabilities for the current or specified model
   */
  getModelCapabilities(model?: string): ImageModelCapabilities {
    const targetModel = model ?? this.config.model ?? this.getDefaultModel();
    const info = getImageModelInfo(targetModel);

    if (!info) {
      throw new Error(`Unknown model: ${targetModel}`);
    }

    return info.capabilities;
  }

  /**
   * Get full model information
   */
  getModelInfo(model?: string): ImageModelDescription {
    const targetModel = model ?? this.config.model ?? this.getDefaultModel();
    const info = getImageModelInfo(targetModel);

    if (!info) {
      throw new Error(`Unknown model: ${targetModel}`);
    }

    return info;
  }

  /**
   * List all available models for this provider's vendor
   */
  listAvailableModels(): ImageModelDescription[] {
    return getImageModelsByVendor(this.provider.vendor);
  }

  /**
   * Check if a specific option is supported
   */
  supportsOption(
    option: keyof ImageModelCapabilities,
    model?: string
  ): boolean {
    const caps = this.getModelCapabilities(model);
    const value = caps[option];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }

  /**
   * Get supported aspect ratios for current model
   */
  getSupportedAspectRatios(model?: string): AspectRatio[] {
    return this.getModelCapabilities(model).aspectRatios;
  }

  /**
   * Get supported quality levels for current model
   */
  getSupportedQualities(model?: string): QualityLevel[] {
    return this.getModelCapabilities(model).qualities;
  }

  /**
   * Get supported styles for current model
   */
  getSupportedStyles(model?: string): ImageStyle[] {
    return this.getModelCapabilities(model).styles;
  }

  /**
   * Validate options without making a request
   */
  validateOptions(options: ImageGenerateOptions): ValidationResult {
    return this.validator.validate(options);
  }

  /**
   * Get vendor-specific options schema for documentation/UI
   */
  getVendorOptionsSchema(model?: string): Record<string, any> | undefined {
    return this.getModelCapabilities(model).vendorSpecificOptions;
  }

  // ============ Private ============

  private getDefaultModel(): string {
    // Get first active model for this vendor
    const models = this.listAvailableModels();
    if (models.length === 0) {
      throw new Error('No models available for this provider');
    }
    return models[0].id;
  }
}
```

---

### Usage Examples with Introspection

```typescript
import { Connector, ImageGenerator, Vendor } from '@oneringai/agents';

Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const imageGen = ImageGenerator.create({
  connector: 'openai',
  model: 'dall-e-3',
});

// ============ Introspection ============

// Check what's supported before making requests
const caps = imageGen.getModelCapabilities();
console.log('Supported aspect ratios:', caps.aspectRatios);
// ['1:1', '16:9', '9:16']

console.log('Supports negative prompts:', caps.supportsNegativePrompt);
// false

console.log('Max images per request:', caps.maxCount);
// 1

// Get vendor-specific options for building UI
const vendorOpts = imageGen.getVendorOptionsSchema();
console.log(vendorOpts);
// undefined for DALL-E 3 (no special options)

// Check different model
const sdxlCaps = imageGen.getModelCapabilities('stable-diffusion-xl');
console.log('SDXL vendor options:', sdxlCaps.vendorSpecificOptions);
// { cfg_scale: { type: 'number', min: 0, max: 35 }, steps: {...}, sampler: {...} }

// ============ Validation ============

// Validate before sending (optional - also done internally)
const validation = imageGen.validateOptions({
  model: 'dall-e-3',
  prompt: 'A cat',
  aspectRatio: '21:9',  // Not supported by DALL-E 3
  negativePrompt: 'ugly',  // Not supported
});

console.log(validation.valid);  // false
console.log(validation.errors[0].message);
// "Option 'aspectRatio' value '21:9' not supported. Available: 1:1, 16:9, 9:16"
console.log(validation.warnings);
// ["Negative prompts not supported by dall-e-3. Ignoring."]

// ============ Generation with Semantic Options ============

// Use semantic options - automatically normalized
const image = await imageGen.generate('A serene Japanese garden at sunset', {
  aspectRatio: '16:9',  // → OpenAI size: '1792x1024'
  quality: 'high',      // → OpenAI quality: 'hd'
  style: 'photographic', // → OpenAI style: 'natural'
});

// ============ Vendor-Specific Escape Hatch ============

// For power users who need vendor-specific control
const image2 = await imageGen.generate('A portrait', {
  vendorOptions: {
    user: 'user-123',  // OpenAI-specific tracking
  },
});

// Using Stability AI with vendor-specific options
const sdGen = ImageGenerator.create({
  connector: 'stability',
  model: 'stable-diffusion-xl',
});

const sdImage = await sdGen.generate('A fantasy landscape', {
  aspectRatio: '21:9',
  quality: 'high',
  style: 'artistic',
  negativePrompt: 'blurry, low quality',
  seed: 12345,
  vendorOptions: {
    cfg_scale: 12,      // Stability-specific
    steps: 50,          // Stability-specific
    sampler: 'dpm++_2m', // Stability-specific
  },
});
```

---

### Error Classes

```typescript
// src/domain/errors/ValidationErrors.ts

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnsupportedOptionError extends ValidationError {
  constructor(
    public readonly option: string,
    public readonly value: unknown,
    public readonly supportedValues: unknown[]
  ) {
    super(
      `Option '${option}' value '${value}' not supported. ` +
      `Available: ${supportedValues.join(', ')}`
    );
    this.name = 'UnsupportedOptionError';
  }
}

export class OptionOutOfRangeError extends ValidationError {
  constructor(
    public readonly option: string,
    public readonly value: number,
    public readonly min: number,
    public readonly max: number
  ) {
    super(
      `Option '${option}' value ${value} out of range. ` +
      `Must be between ${min} and ${max}`
    );
    this.name = 'OptionOutOfRangeError';
  }
}

export class UnsupportedCapabilityError extends Error {
  constructor(
    public readonly capability: string,
    public readonly model: string
  ) {
    super(`Capability '${capability}' not supported by model '${model}'`);
    this.name = 'UnsupportedCapabilityError';
  }
}
```

---

## Open Questions

1. **Unified MediaProcessor?** - Should we add a fluent pipeline API in v2?
2. **Caching?** - Should TTS/STT results be cached?
3. **Cost tracking?** - Add cost estimation to Model registry for audio/video?
4. **File handling?** - Abstract file I/O or require users to handle?
5. **Real-time audio?** - WebSocket support for live transcription?
6. **Dynamic capability fetch?** - Should we fetch voice lists from APIs at runtime?

---

## Key Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent extension vs separate classes | Separate classes | SRP, tree-shaking, cleaner types |
| One interface per capability | Yes | Type safety, optional methods |
| Capability checking | Static matrix + runtime | Fast lookups, graceful errors |
| Base classes | Yes, per capability | Shared observability, DRY |
| Factory functions | One per capability | Clear, testable |
| Streaming support | AsyncIterator | Consistent with text |
| Progress events | For long operations | Video gen can take minutes |
| **Vendor options handling** | **Extended Model Capabilities** | **Semantic normalization + validation + escape hatch** |
| **Option validation** | **Pre-call with warnings** | **Fail fast on errors, warn on adjustments** |
| **Introspection** | **Full capability queries** | **Enable dynamic UIs, documentation** |

---

## Conclusion

This architecture:

1. **Preserves backward compatibility** - Agent class unchanged
2. **Follows existing patterns** - Connector-first, interface-per-capability
3. **Enables tree-shaking** - Import only what you use
4. **Provides clear capability checking** - Know upfront what works
5. **Supports streaming** - For real-time TTS/STT
6. **Handles async operations** - Video generation with progress
7. **Is extensible** - Easy to add new vendors/capabilities
8. **Handles vendor differences gracefully** - Semantic options + validation + normalization
9. **Enables rich introspection** - Query capabilities, build dynamic UIs
10. **Provides escape hatches** - Power users can access vendor-specific features
