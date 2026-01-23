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

## Open Questions

1. **Unified MediaProcessor?** - Should we add a fluent pipeline API in v2?
2. **Caching?** - Should TTS/STT results be cached?
3. **Cost tracking?** - Add cost estimation to Model registry for audio/video?
4. **File handling?** - Abstract file I/O or require users to handle?
5. **Real-time audio?** - WebSocket support for live transcription?

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
